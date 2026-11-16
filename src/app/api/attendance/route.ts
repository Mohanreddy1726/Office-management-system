import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { BiometricMapping, BiometricDevice, UnmappedPunch } from "@/models/Biometric";
import { Employee } from "@/models/Employee";
import { AuditLog } from "@/models/AuditLog";
import { getCurrentUser } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";
import ZKLib from "node-zklib";

export const dynamic = "force-dynamic";

function getISTDateComponents(date: Date) {
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

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    const isEmployee = session?.role === "employee" && session?.employeeId;

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const all = searchParams.get("all") === "true";

    const conn = await connectToDatabase();
    if (conn) {
      const query: any = {};
      if (!all && date && date !== "all") {
        query.date = date;
      }
      if (isEmployee) {
        query.employeeId = session.employeeId;
      }
      const rawRecords = await Attendance.find(query).sort({ date: -1, checkIn: 1 });
      const records = rawRecords.map((r) => ({
        id: r._id.toString(),
        employeeId: r.employeeId,
        employeeName: r.employeeName || "Employee",
        department: r.department || "Operations",
        branch: r.branch || "Headquarters",
        date: r.date,
        shiftId: "SH-GEN",
        checkIn: r.checkIn || undefined,
        checkOut: r.checkOut || undefined,
        workedMinutes: r.totalHours ? Math.round(r.totalHours * 60) : 0,
        lateMinutes: r.status === "Late" ? 30 : 0,
        status: (r.status === "On Leave" ? "Leave" : r.status === "Half-day" ? "Half Day" : r.status || "Present") as any,
        source: "Biometric" as const,
        confirmation: r.confirmation || "Confirmed",
        deviceUsed: r.deviceUsed || "eSSL K30 Pro - Main Office",
        correction: r.correction || {},
      }));
      return NextResponse.json({ success: true, records, date });
    } else {
      const store = getMockStore();
      let records = store.attendances;
      if (!all && date && date !== "all") {
        records = records.filter((a) => a.date === date);
      }
      if (isEmployee) {
        records = records.filter((r) => r.employeeId === session.employeeId);
      }
      return NextResponse.json({ success: true, records, date });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    const roleHeader = req.headers.get("x-user-role");
    const role = session?.role || (roleHeader === "super_admin" || roleHeader === "hr_admin" ? roleHeader : null);

    const body = await req.json();
    const { action } = body;

    if (action !== "sync_biometric" && !session && !role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (action === "sync_biometric") {
      const conn = await connectToDatabase();
      let targetIp = "192.168.29.201";
      let targetPort = 4370;

      if (conn) {
        const dev = await BiometricDevice.findOne({ deviceId: "DEV-01" });
        if (dev?.ipAddress) targetIp = dev.ipAddress;
        if (dev?.port) targetPort = dev.port;
      }

      try {
        const zk = new ZKLib(targetIp, targetPort, 8000, 3000, 0, "tcp");
        await zk.createSocket();
        const logsRes = await zk.getAttendances();
        await zk.disconnect();

        const punches = logsRes?.data || [];
        if (conn && punches.length > 0) {
          const mappings = await BiometricMapping.find({ status: "Active" });
          const pinToMapping = new Map(mappings.map((m) => [String(m.biometricId).trim(), m]));
          const employees = await Employee.find({});
          const empMap = new Map(employees.map((e) => [e.employeeId, e]));

          // Group by (employeeId, dateStr)
          const groups = new Map<string, { employeeId: string; date: string; punches: Date[] }>();
          const unmappedPunches: any[] = [];

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
              unmappedPunches.push({
                deviceId: "DEV-01",
                biometricId: pin,
                punchTime: d,
                punchType: "Unknown",
                resolved: false,
              });
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
            const isLate = firstMinutes > (9 * 60 + 30);
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

          // Mark resolved in UnmappedPunch
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
              },
            }
          );

          return NextResponse.json({
            success: true,
            message: `Synced ${punches.length} punch records from eSSL K30 Pro terminal (${bulkOps.length} attendance records updated).`,
            summary: { processed: punches.length, updatedRecords: bulkOps.length },
          });
        }
      } catch (err: any) {
        // Fallback for cloud deployments: Reconcile unmapped punches stored in MongoDB Atlas with active mappings!
        if (conn) {
          const mappings = await BiometricMapping.find({ status: "Active" });
          const pinToMapping = new Map(mappings.map((m) => [String(m.biometricId).trim(), m]));
          const employees = await Employee.find({});
          const empMap = new Map(employees.map((e) => [e.employeeId, e]));

          const mappedPins = Array.from(pinToMapping.keys());
          const pendingPunches = await UnmappedPunch.find({ biometricId: { $in: mappedPins } });

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
            const isLate = firstMinutes > (9 * 60 + 30);
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
              { biometricId: { $in: mappedPins } },
              { $set: { resolved: true, updatedAt: new Date() } }
            );
          }

          const count = await Attendance.countDocuments();
          return NextResponse.json({
            success: true,
            syncedFrom: "cloud_database",
            message: `Terminal is on office LAN. Reconciled ${bulkOps.length} attendance records from stored biometric punches (${count} total records in database).`,
            summary: { processed: pendingPunches.length, updatedRecords: bulkOps.length },
          });
        }
        return NextResponse.json({ error: `Terminal sync error: ${err.message}` }, { status: 502 });
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { attendanceId, action, requestedCheckIn, requestedCheckOut, reason, decisionNote } = body;

    const conn = await connectToDatabase();
    if (conn) {
      const record = await Attendance.findById(attendanceId);
      if (!record) return NextResponse.json({ error: "Record not found" }, { status: 404 });

      if (action === "request_correction") {
        record.correction = {
          status: "Pending",
          requestedCheckIn,
          requestedCheckOut,
          reason,
          submittedAt: new Date(),
        };
        await record.save();
      } else if (action === "approve_correction") {
        if (record.correction?.requestedCheckIn) record.checkIn = record.correction.requestedCheckIn;
        if (record.correction?.requestedCheckOut) record.checkOut = record.correction.requestedCheckOut;
        record.status = "Present";
        record.confirmation = "Confirmed";
        if (record.correction) {
          record.correction.status = "Approved";
          record.correction.reviewedBy = session.name;
          record.correction.reviewNote = decisionNote;
          record.correction.reviewedAt = new Date();
        }
        await record.save();
      } else if (action === "advance_confirmation") {
        if (record.confirmation === "Awaiting Employee") record.confirmation = "Awaiting Manager";
        else if (record.confirmation === "Awaiting Manager") record.confirmation = "Awaiting HR";
        else if (record.confirmation === "Awaiting HR") record.confirmation = "Confirmed";
        await record.save();
      }
      return NextResponse.json({ success: true, record });
    } else {
      const store = getMockStore();
      const rec = store.attendances.find((a) => a._id === attendanceId);
      if (rec) {
        if (action === "advance_confirmation") {
          if (rec.confirmation === "Awaiting Employee") rec.confirmation = "Awaiting Manager";
          else if (rec.confirmation === "Awaiting Manager") rec.confirmation = "Awaiting HR";
          else if (rec.confirmation === "Awaiting HR") rec.confirmation = "Confirmed";
        } else if (action === "approve_correction") {
          rec.status = "Present";
          rec.confirmation = "Confirmed";
        }
      }
      return NextResponse.json({ success: true, record: rec || {} });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
