import { Attendance } from "@/models/Attendance";
import { BiometricMapping, BiometricDevice, UnmappedPunch } from "@/models/Biometric";
import { Employee } from "@/models/Employee";
import ZKLib from "node-zklib";

export function getISTDateComponents(date: Date) {
  const dateStr = date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
  const timeStr = date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const hour24 = Number(date.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }));
  const minute = Number(date.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", minute: "numeric" }));
  return { dateStr, timeStr, hour24, minute };
}

/**
 * Reconciles all punch logs (from live machine and stored unmapped punches)
 * for a specific mapped biometric ID into the employee's Attendance records.
 */
export async function reconcileEmployeePunches(
  biometricId: string,
  employee: { employeeId: string; name: string; department?: string; branch?: string }
): Promise<number> {
  const cleanBioId = String(biometricId).trim();
  if (!cleanBioId) return 0;

  const punchesList: Date[] = [];

  // 1. Try to connect to live physical terminal if reachable on LAN
  try {
    const dev = await BiometricDevice.findOne({ deviceId: "DEV-01" });
    const targetIp = dev?.ipAddress || "192.168.29.201";
    const targetPort = dev?.port || 4370;
    const zk = new ZKLib(targetIp, targetPort, 4000, 2000, 0, "tcp");
    await zk.createSocket();
    const logsRes = await zk.getAttendances();
    await zk.disconnect();

    if (Array.isArray(logsRes?.data)) {
      for (const log of logsRes.data) {
        if (String(log.deviceUserId).trim() === cleanBioId && log.recordTime) {
          const d = new Date(log.recordTime);
          if (!isNaN(d.getTime()) && d.getFullYear() >= 2020) {
            punchesList.push(d);
          }
        }
      }
    }
  } catch {
    // Machine unreachable from current host (e.g. cloud deployment), fallback to DB
  }

  // 2. Also retrieve all stored punches from MongoDB Atlas
  const dbPunches = await UnmappedPunch.find({ biometricId: cleanBioId });
  for (const p of dbPunches) {
    if (p.punchTime) {
      const d = new Date(p.punchTime);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2020) {
        punchesList.push(d);
      }
    }
  }

  if (punchesList.length === 0) return 0;

  // Group punches by IST date YYYY-MM-DD
  const dayGroups = new Map<string, Date[]>();
  for (const d of punchesList) {
    const { dateStr } = getISTDateComponents(d);
    if (!dayGroups.has(dateStr)) dayGroups.set(dateStr, []);
    dayGroups.get(dateStr)!.push(d);
  }

  const bulkOps: any[] = [];
  for (const [dateStr, punches] of dayGroups.entries()) {
    punches.sort((a, b) => a.getTime() - b.getTime());
    const first = punches[0];
    const last = punches[punches.length - 1];

    const firstComp = getISTDateComponents(first);
    const checkInTime = firstComp.timeStr;
    const hasMultiplePunches = punches.length > 1;
    const checkOutTime = hasMultiplePunches ? getISTDateComponents(last).timeStr : null;

    let totalHours = 0;
    if (hasMultiplePunches) {
      const diffMs = last.getTime() - first.getTime();
      totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
    }

    const firstMinutes = firstComp.hour24 * 60 + firstComp.minute;
    // General Shift starts at 10:00 AM with 15 mins grace period (10:15 AM)
    const isLate = firstMinutes > (10 * 60 + 15);
    let status = isLate ? "Late" : "Present";
    if (totalHours > 0 && totalHours < 4.5 && hasMultiplePunches) {
      status = "Half-day";
    }

    bulkOps.push({
      updateOne: {
        filter: { employeeId: employee.employeeId, date: dateStr },
        update: {
          $set: {
            employeeId: employee.employeeId,
            employeeName: employee.name,
            department: employee.department || "Operations",
            branch: employee.branch || "Headquarters",
            date: dateStr,
            checkIn: checkInTime,
            checkOut: checkOutTime,
            totalHours,
            status,
            confirmation: "Confirmed",
            deviceUsed: "eSSL K30 Pro - Main Office",
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        upsert: true,
      },
    });
  }

  if (bulkOps.length > 0) {
    await Attendance.bulkWrite(bulkOps, { ordered: false });
  }

  // Mark all unmapped punches for this biometric ID as resolved
  await UnmappedPunch.updateMany(
    { biometricId: cleanBioId },
    { $set: { resolved: true, updatedAt: new Date() } }
  );

  return bulkOps.length;
}

/**
 * Self-healing reconcile: Scans all active biometric mappings and reconciles
 * any unresolved punches in MongoDB Atlas into official Attendance records.
 */
export async function reconcileAllActiveMappings(): Promise<{ processedPunches: number; updatedRecords: number }> {
  const activeMappings = await BiometricMapping.find({ status: "Active" });
  if (activeMappings.length === 0) return { processedPunches: 0, updatedRecords: 0 };

  const activePins = activeMappings.map((m) => String(m.biometricId).trim());
  const pendingPunches = await UnmappedPunch.find({
    biometricId: { $in: activePins },
  });

  if (pendingPunches.length === 0) return { processedPunches: 0, updatedRecords: 0 };

  const pinToMapping = new Map(activeMappings.map((m) => [String(m.biometricId).trim(), m]));
  const employees = await Employee.find({});
  const empMap = new Map(employees.map((e) => [e.employeeId, e]));

  const dayGroups = new Map<string, { employeeId: string; date: string; punches: Date[] }>();
  for (const p of pendingPunches) {
    if (!p.punchTime) continue;
    const d = new Date(p.punchTime);
    if (isNaN(d.getTime())) continue;

    const mapping = pinToMapping.get(String(p.biometricId).trim());
    if (!mapping) continue;

    const { dateStr } = getISTDateComponents(d);
    const key = `${mapping.employeeId}_${dateStr}`;
    if (!dayGroups.has(key)) {
      dayGroups.set(key, { employeeId: mapping.employeeId, date: dateStr, punches: [] });
    }
    dayGroups.get(key)!.punches.push(d);
  }

  const bulkOps: any[] = [];
  for (const item of dayGroups.values()) {
    item.punches.sort((a, b) => a.getTime() - b.getTime());
    const first = item.punches[0];
    const last = item.punches[item.punches.length - 1];

    const firstComp = getISTDateComponents(first);
    const checkInTime = firstComp.timeStr;
    const hasMultiplePunches = item.punches.length > 1;
    const checkOutTime = hasMultiplePunches ? getISTDateComponents(last).timeStr : null;

    let totalHours = 0;
    if (hasMultiplePunches) {
      const diffMs = last.getTime() - first.getTime();
      totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
    }

    const firstMinutes = firstComp.hour24 * 60 + firstComp.minute;
    // General Shift starts at 10:00 AM with 15 mins grace period (10:15 AM)
    const isLate = firstMinutes > (10 * 60 + 15);
    let status = isLate ? "Late" : "Present";
    if (totalHours > 0 && totalHours < 4.5 && hasMultiplePunches) {
      status = "Half-day";
    }

    const emp = empMap.get(item.employeeId);

    bulkOps.push({
      updateOne: {
        filter: { employeeId: item.employeeId, date: item.date },
        update: {
          $set: {
            employeeId: item.employeeId,
            employeeName: emp?.name || "Employee",
            department: emp?.department || "Operations",
            branch: emp?.branch || "Headquarters",
            date: item.date,
            checkIn: checkInTime,
            checkOut: checkOutTime,
            totalHours,
            status,
            confirmation: "Confirmed",
            deviceUsed: "eSSL K30 Pro - Main Office",
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        upsert: true,
      },
    });
  }

  if (bulkOps.length > 0) {
    await Attendance.bulkWrite(bulkOps, { ordered: false });
    await UnmappedPunch.updateMany(
      { biometricId: { $in: activePins } },
      { $set: { resolved: true, updatedAt: new Date() } }
    );
  }

  return { processedPunches: pendingPunches.length, updatedRecords: bulkOps.length };
}

/**
 * Connects to physical hardware, downloads raw logs, updates mapped attendance records,
 * saves unmapped logs, and updates terminal health status.
 */
export async function syncLiveBiometricHardware(
  overrideIp?: string,
  overridePort?: number
): Promise<{ success: boolean; totalLogs: number; updatedRecords: number; error?: string }> {
  let targetIp = overrideIp || "192.168.29.201";
  let targetPort = overridePort || 4370;

  const dev = await BiometricDevice.findOne({ deviceId: "DEV-01" });
  if (dev?.ipAddress && !overrideIp) targetIp = dev.ipAddress;
  if (dev?.port && !overridePort) targetPort = dev.port;

  try {
    const zk = new ZKLib(targetIp, targetPort, 15000, 4000, 0, "tcp");
    await zk.createSocket();
    const logsRes = await zk.getAttendances();
    await zk.disconnect();

    const punches = logsRes?.data || [];
    const mappings = await BiometricMapping.find({ status: "Active" });
    const pinToMapping = new Map(mappings.map((m) => [String(m.biometricId).trim(), m]));
    const employees = await Employee.find({});
    const empMap = new Map(employees.map((e) => [e.employeeId, e]));

    const groups = new Map<string, { employeeId: string; date: string; punches: Date[] }>();
    const unmappedGroups = new Map<string, { biometricId: string; date: string; punches: Date[] }>();

    for (const log of punches) {
      if (!log.deviceUserId || !log.recordTime) continue;
      const pin = String(log.deviceUserId).trim();
      if (!pin) continue;

      const d = new Date(log.recordTime);
      if (isNaN(d.getTime()) || d.getFullYear() < 2020) continue;

      const { dateStr } = getISTDateComponents(d);
      const mapping = pinToMapping.get(pin);

      if (mapping) {
        const key = `${mapping.employeeId}_${dateStr}`;
        if (!groups.has(key)) {
          groups.set(key, { employeeId: mapping.employeeId, date: dateStr, punches: [] });
        }
        groups.get(key)!.punches.push(d);
      } else {
        const unKey = `${pin}_${dateStr}`;
        if (!unmappedGroups.has(unKey)) {
          unmappedGroups.set(unKey, { biometricId: pin, date: dateStr, punches: [] });
        }
        unmappedGroups.get(unKey)!.punches.push(d);
      }
    }

    const bulkOps: any[] = [];
    for (const item of groups.values()) {
      item.punches.sort((a, b) => a.getTime() - b.getTime());
      const first = item.punches[0];
      const last = item.punches[item.punches.length - 1];

      const firstComp = getISTDateComponents(first);
      const checkInTime = firstComp.timeStr;
      const hasMultiplePunches = item.punches.length > 1;
      const checkOutTime = hasMultiplePunches ? getISTDateComponents(last).timeStr : null;

      let totalHours = 0;
      if (hasMultiplePunches) {
        const diffMs = last.getTime() - first.getTime();
        totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
      }

      const firstMinutes = firstComp.hour24 * 60 + firstComp.minute;
      // General Shift starts at 10:00 AM with 15 mins grace period (10:15 AM)
      const isLate = firstMinutes > (10 * 60 + 15);
      let status = isLate ? "Late" : "Present";
      if (totalHours > 0 && totalHours < 4.5 && hasMultiplePunches) {
        status = "Half-day";
      }

      const emp = empMap.get(item.employeeId);

      bulkOps.push({
        updateOne: {
          filter: { employeeId: item.employeeId, date: item.date },
          update: {
            $set: {
              employeeId: item.employeeId,
              employeeName: emp?.name || "Employee",
              department: emp?.department || "Operations",
              branch: emp?.branch || "Headquarters",
              date: item.date,
              checkIn: checkInTime,
              checkOut: checkOutTime,
              totalHours,
              status,
              confirmation: "Confirmed",
              deviceUsed: "eSSL K30 Pro - Main Office",
              updatedAt: new Date(),
            },
            $setOnInsert: { createdAt: new Date() },
          },
          upsert: true,
        },
      });
    }

    if (bulkOps.length > 0) {
      await Attendance.bulkWrite(bulkOps, { ordered: false });
    }

    // Save unmapped punches in batches of 500
    const unmappedBulk: any[] = [];
    for (const item of unmappedGroups.values()) {
      item.punches.sort((a, b) => a.getTime() - b.getTime());
      const first = item.punches[0];
      const last = item.punches[item.punches.length - 1];

      unmappedBulk.push({
        updateOne: {
          filter: { deviceId: "DEV-01", biometricId: item.biometricId, punchTime: first },
          update: {
            $set: {
              deviceId: "DEV-01",
              biometricId: item.biometricId,
              punchTime: first,
              punchType: item.punches.length > 1 ? "CheckIn" : "Unknown",
              resolved: false,
              updatedAt: new Date(),
            },
            $setOnInsert: { createdAt: new Date() },
          },
          upsert: true,
        },
      });

      if (item.punches.length > 1) {
        unmappedBulk.push({
          updateOne: {
            filter: { deviceId: "DEV-01", biometricId: item.biometricId, punchTime: last },
            update: {
              $set: {
                deviceId: "DEV-01",
                biometricId: item.biometricId,
                punchTime: last,
                punchType: "CheckOut",
                resolved: false,
                updatedAt: new Date(),
              },
              $setOnInsert: { createdAt: new Date() },
            },
            upsert: true,
          },
        });
      }
    }

    if (unmappedBulk.length > 0) {
      for (let i = 0; i < unmappedBulk.length; i += 500) {
        const chunk = unmappedBulk.slice(i, i + 500);
        await UnmappedPunch.bulkWrite(chunk, { ordered: false }).catch(() => {});
      }
    }

    // Mark all resolved
    const mappedPins = Array.from(pinToMapping.keys());
    await UnmappedPunch.updateMany(
      { biometricId: { $in: mappedPins } },
      { $set: { resolved: true, updatedAt: new Date() } }
    );

    await BiometricDevice.updateOne(
      { deviceId: "DEV-01" },
      {
        $set: {
          status: "Online",
          lastSync: new Date(),
          totalLogsCount: punches.length,
          enrolledUsersCount: 25,
        },
      }
    );

    return { success: true, totalLogs: punches.length, updatedRecords: bulkOps.length };
  } catch (err: any) {
    return { success: false, totalLogs: 0, updatedRecords: 0, error: err.message };
  }
}
