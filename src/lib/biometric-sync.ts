import { connectToDatabase } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { BiometricMapping, BiometricDevice, UnmappedPunch } from "@/models/Biometric";
import { Employee } from "@/models/Employee";
import ZKLib from "node-zklib";
import net from "net";
import { classifyLoginTime } from "@/lib/policies";

export function getISTDateComponents(date: Date) {
  const dateStr = date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
  const timeStr = date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const hour24Raw = Number(
    date.toLocaleTimeString("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hourCycle: "h23",
    })
  );
  const hour24 = hour24Raw === 24 ? 0 : hour24Raw;
  const minute = Number(date.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", minute: "numeric" }));
  return { dateStr, timeStr, hour24, minute };
}

function checkTcpPort(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port, timeout: timeoutMs }, () => {
      sock.destroy();
      resolve(true);
    });
    sock.on("error", () => {
      sock.destroy();
      resolve(false);
    });
    sock.on("timeout", () => {
      sock.destroy();
      resolve(false);
    });
  });
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

    const loginClass = classifyLoginTime(checkInTime);
    let status = loginClass.status === "Half Day" ? "Half-day" : loginClass.status;
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

    const loginClass = classifyLoginTime(checkInTime);
    let status = loginClass.status === "Half Day" ? "Half-day" : loginClass.status;
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
  overridePort?: number,
  options?: { recentOnlyDays?: number; connectTimeoutMs?: number }
): Promise<{
  success: boolean;
  totalLogs: number;
  recentLogsChecked?: number;
  skippedOldLogs?: number;
  updatedRecords: number;
  userCount?: number;
  error?: string;
}> {
  let targetIp = overrideIp || "192.168.29.201";
  let targetPort = overridePort || 4370;
  let commKey = 0;

  const dev =
    (await BiometricDevice.findOne({ deviceId: "DEV-01" })) ||
    (await BiometricDevice.findOne({ connection: "TCP/IP" }));
  if (dev?.ipAddress && !overrideIp) targetIp = dev.ipAddress;
  if (dev?.port && !overridePort) targetPort = dev.port;
  if (dev?.commKey) commKey = Number(dev.commKey) || 0;

  const reachable = await checkTcpPort(targetIp, targetPort, options?.connectTimeoutMs ?? 2000);
  if (!reachable) {
    return {
      success: false,
      totalLogs: 0,
      updatedRecords: 0,
      error: `Biometric terminal at ${targetIp}:${targetPort} is not reachable from this host.`,
    };
  }

  try {
    const zk = new ZKLib(targetIp, targetPort, 15000, 4000, commKey, "tcp");
    await zk.createSocket();
    const usersRes = await zk.getUsers().catch(() => null);
    const logsRes = await zk.getAttendances();
    await zk.disconnect();

    const punches = logsRes?.data || [];
    const enrolledUsersCount = usersRes?.data?.length || dev?.enrolledUsersCount || 25;
    const mappings = await BiometricMapping.find({ status: "Active" });
    const pinToMapping = new Map(mappings.map((m) => [String(m.biometricId).trim(), m]));
    const employees = await Employee.find({});
    const empMap = new Map(employees.map((e) => [e.employeeId, e]));

    // Determine incremental watermark per mapped employee (keep 1-day overlap to catch evening check-outs)
    const empMaxDates: Array<{ _id: string; maxDate: string }> = await Attendance.aggregate([
      { $group: { _id: "$employeeId", maxDate: { $max: "$date" } } },
    ]);
    const empCutoffMap = new Map<string, string>();
    for (const row of empMaxDates) {
      if (row._id && row.maxDate) {
        const d = new Date(row.maxDate + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() - 1);
        empCutoffMap.set(row._id, d.toISOString().slice(0, 10));
      }
    }

    // Determine incremental watermark for unmapped punches (only store new/recent unmapped punches)
    const latestUnmapped = await UnmappedPunch.findOne({})
      .sort({ punchTime: -1 })
      .select("punchTime")
      .lean();
    let unmappedCutoffIso: string | null = null;
    if (latestUnmapped?.punchTime) {
      const latestDateStr = getISTDateComponents(new Date(latestUnmapped.punchTime)).dateStr;
      const d = new Date(latestDateStr + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      unmappedCutoffIso = d.toISOString().slice(0, 10);
    }

    const explicitCutoffIso = options?.recentOnlyDays
      ? getISTDateComponents(new Date(Date.now() - options.recentOnlyDays * 86400000)).dateStr
      : null;

    const groups = new Map<string, { employeeId: string; date: string; punches: Date[] }>();
    const unmappedGroups = new Map<string, { biometricId: string; date: string; punches: Date[] }>();
    let recentLogsChecked = 0;
    let skippedOldLogs = 0;

    for (const log of punches) {
      if (!log.deviceUserId || !log.recordTime) continue;
      const pin = String(log.deviceUserId).trim();
      if (!pin) continue;

      const d = new Date(log.recordTime);
      if (isNaN(d.getTime()) || d.getFullYear() < 2020) continue;

      const { dateStr } = getISTDateComponents(d);
      if (explicitCutoffIso && dateStr < explicitCutoffIso) {
        skippedOldLogs++;
        continue;
      }

      const mapping = pinToMapping.get(pin);

      if (mapping) {
        const empCutoff = empCutoffMap.get(mapping.employeeId);
        if (empCutoff && dateStr < empCutoff) {
          skippedOldLogs++;
          continue;
        }
        recentLogsChecked++;
        const key = `${mapping.employeeId}_${dateStr}`;
        if (!groups.has(key)) {
          groups.set(key, { employeeId: mapping.employeeId, date: dateStr, punches: [] });
        }
        groups.get(key)!.punches.push(d);
      } else {
        if (unmappedCutoffIso && dateStr < unmappedCutoffIso) {
          skippedOldLogs++;
          continue;
        }
        recentLogsChecked++;
        const unKey = `${pin}_${dateStr}`;
        if (!unmappedGroups.has(unKey)) {
          unmappedGroups.set(unKey, { biometricId: pin, date: dateStr, punches: [] });
        }
        unmappedGroups.get(unKey)!.punches.push(d);
      }
    }

    // Fetch existing attendance docs for candidate dates so we only write records that are new or actually changed
    const candidateDates = Array.from(new Set(Array.from(groups.values()).map((g) => g.date)));
    const existingAttDocs =
      candidateDates.length > 0
        ? await Attendance.find({ date: { $in: candidateDates } }).lean()
        : [];
    const existingAttMap = new Map(
      existingAttDocs.map((doc: any) => [`${doc.employeeId}_${doc.date}`, doc])
    );

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

      const loginClass = classifyLoginTime(checkInTime);
      let status = loginClass.status === "Half Day" ? "Half-day" : loginClass.status;
      if (totalHours > 0 && totalHours < 4.5 && hasMultiplePunches) {
        status = "Half-day";
      }

      const existing = existingAttMap.get(`${item.employeeId}_${item.date}`);
      if (
        existing &&
        (existing.checkIn || null) === (checkInTime || null) &&
        (existing.checkOut || null) === (checkOutTime || null) &&
        existing.status === status &&
        Number(existing.totalHours || 0) === totalHours
      ) {
        continue;
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
              deviceUsed: dev?.name || "eSSL K30 Pro - Main Office",
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

    // Save only recent/new unmapped punches in batches of 500
    const unmappedBulk: any[] = [];
    for (const item of unmappedGroups.values()) {
      item.punches.sort((a, b) => a.getTime() - b.getTime());
      const first = item.punches[0];
      const last = item.punches[item.punches.length - 1];

      unmappedBulk.push({
        updateOne: {
          filter: { deviceId: dev?.deviceId || "DEV-01", biometricId: item.biometricId, punchTime: first },
          update: {
            $set: {
              deviceId: dev?.deviceId || "DEV-01",
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
            filter: { deviceId: dev?.deviceId || "DEV-01", biometricId: item.biometricId, punchTime: last },
            update: {
              $set: {
                deviceId: dev?.deviceId || "DEV-01",
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

    // Mark mapped pins resolved only if any unresolved remain
    const mappedPins = Array.from(pinToMapping.keys());
    if (mappedPins.length > 0) {
      await UnmappedPunch.updateMany(
        { biometricId: { $in: mappedPins }, resolved: false },
        { $set: { resolved: true, updatedAt: new Date() } }
      );
    }

    await BiometricDevice.updateOne(
      { deviceId: dev?.deviceId || "DEV-01" },
      {
        $set: {
          status: "Online",
          lastSync: new Date(),
          totalLogsCount: punches.length,
          enrolledUsersCount,
        },
      }
    );

    return {
      success: true,
      totalLogs: punches.length,
      recentLogsChecked,
      skippedOldLogs,
      updatedRecords: bulkOps.length,
      userCount: enrolledUsersCount,
    };
  } catch (err: any) {
    return { success: false, totalLogs: 0, updatedRecords: 0, error: err.message };
  }
}

const gAuto = globalThis as unknown as {
  __bioAutoSyncLastAt?: number;
  __bioAutoSyncBackoffUntil?: number;
  __bioAutoSyncInFlight?: Promise<void> | null;
  __bioBgIntervalStarted?: boolean;
};

const isCloudEnvironment = () => Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

/**
 * Automatically syncs recent punches from the live biometric terminal
 * at most once every 60s when running on the office LAN (disabled on Vercel cloud).
 */
export async function autoSyncBiometricIfStale(): Promise<void> {
  if (isCloudEnvironment()) return;
  startBackgroundBiometricSync();
  const now = Date.now();
  if (gAuto.__bioAutoSyncInFlight) {
    return gAuto.__bioAutoSyncInFlight;
  }
  if (gAuto.__bioAutoSyncBackoffUntil && now < gAuto.__bioAutoSyncBackoffUntil) {
    return;
  }
  if (gAuto.__bioAutoSyncLastAt && now - gAuto.__bioAutoSyncLastAt < 60_000) {
    return;
  }

  gAuto.__bioAutoSyncInFlight = (async () => {
    try {
      const dev =
        (await BiometricDevice.findOne({ deviceId: "DEV-01" })) ||
        (await BiometricDevice.findOne({ connection: "TCP/IP" }));
      const dbLastSync = dev?.lastSync ? new Date(dev.lastSync).getTime() : 0;
      if (now - dbLastSync < 60_000) {
        gAuto.__bioAutoSyncLastAt = now;
        return;
      }

      const res = await syncLiveBiometricHardware(undefined, undefined, {
        recentOnlyDays: 30,
        connectTimeoutMs: 1500,
      });
      if (res.success) {
        gAuto.__bioAutoSyncLastAt = Date.now();
      } else {
        gAuto.__bioAutoSyncBackoffUntil = Date.now() + 180_000;
      }
    } catch {
      gAuto.__bioAutoSyncBackoffUntil = Date.now() + 180_000;
    } finally {
      gAuto.__bioAutoSyncInFlight = null;
    }
  })();

  return gAuto.__bioAutoSyncInFlight;
}

/**
 * Starts a persistent background interval (every 2 minutes) on the Node.js server
 * so biometric punches continuously sync to MongoDB Atlas even when no user
 * manually opens /attendance.
 */
export function startBackgroundBiometricSync(): void {
  if (typeof window !== "undefined") return;
  if (isCloudEnvironment()) return;
  if (gAuto.__bioBgIntervalStarted) return;
  gAuto.__bioBgIntervalStarted = true;

  const tick = async () => {
    try {
      const conn = await connectToDatabase();
      if (!conn) return;
      await autoSyncBiometricIfStale();
    } catch {
      // Silently ignore; next tick retries cleanly
    }
  };

  setTimeout(() => {
    void tick();
  }, 5000);

  const timer = setInterval(() => {
    void tick();
  }, 2 * 60 * 1000);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
}
