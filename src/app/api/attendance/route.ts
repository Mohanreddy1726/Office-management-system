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
        employeeName: r.employeeName,
        department: r.department,
        branch: r.branch,
        date: r.date,
        shiftId: "SH-GEN",
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        workedMinutes: r.totalHours ? Math.round(r.totalHours * 60) : 0,
        lateMinutes: r.status === "Late" ? 30 : 0,
        status: (r.status === "On Leave" ? "Leave" : r.status === "Half-day" ? "Half Day" : r.status) as any,
        source: "Biometric" as const,
        confirmation: r.confirmation,
        deviceUsed: r.deviceUsed,
        correction: r.correction,
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
    const body = await req.json();
    const { action } = body;

    if (action !== "sync_biometric" && !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (action === "sync_biometric") {
      const targetIp = "192.168.29.201";
      const targetPort = 4370;

      try {
        const zk = new ZKLib(targetIp, targetPort, 10000, 4000, 0, "tcp");
        await zk.createSocket();
        const logsRes = await zk.getAttendances();
        const usersRes = await zk.getUsers().catch(() => ({ data: [] }));
        await zk.disconnect();

        const punches = logsRes.data || [];
        const conn = await connectToDatabase();
        if (conn) {
          const mappings = await BiometricMapping.find({ status: "Active" });
          const pinToMapping = new Map(mappings.map((m) => [String(m.biometricId), m]));
          const employees = await Employee.find({});
          const empMap = new Map(employees.map((e) => [e.employeeId, e]));

          // Group by (date, pin)
          const groups = new Map();
          for (const log of punches) {
            const d = new Date(log.recordTime);
            const istStr = d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
            const istDate = new Date(istStr);
            const y = istDate.getFullYear();
            const m = String(istDate.getMonth() + 1).padStart(2, "0");
            const day = String(istDate.getDate()).padStart(2, "0");
            const dateKey = `${y}-${m}-${day}`;
            const pin = String(log.deviceUserId);

            const key = `${dateKey}_${pin}`;
            if (!groups.has(key)) {
              groups.set(key, { date: dateKey, pin, punches: [] });
            }
            groups.get(key).punches.push(istDate);
          }

          let syncedToday = 0;
          for (const item of groups.values()) {
            item.punches.sort((a: Date, b: Date) => a.getTime() - b.getTime());
            const first = item.punches[0];
            const last = item.punches[item.punches.length - 1];

            const checkInTime = first.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
            const checkOutTime = item.punches.length > 1
              ? last.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
              : undefined;

            let totalHours = 0;
            if (checkOutTime && item.punches.length > 1) {
              const diffMs = last.getTime() - first.getTime();
              totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
            }

            const firstMinutes = first.getHours() * 60 + first.getMinutes();
            const isLate = firstMinutes > (9 * 60 + 30);
            const status = isLate ? "Late" : "Present";

            const mapping = pinToMapping.get(item.pin);
            if (mapping) {
              const emp = empMap.get(mapping.employeeId);
              await Attendance.updateOne(
                { employeeId: mapping.employeeId, date: item.date },
                {
                  $set: {
                    employeeId: mapping.employeeId,
                    employeeName: mapping.employeeName || emp?.name || "Employee",
                    department: emp?.department || "Operations",
                    branch: emp?.branch || "Hyderabad",
                    date: item.date,
                    checkIn: checkInTime,
                    checkOut: checkOutTime,
                    totalHours,
                    status,
                    confirmation: "Confirmed",
                    deviceUsed: "eSSL K30 Pro - Main Office",
                  },
                  $setOnInsert: { createdAt: new Date() },
                },
                { upsert: true }
              );
              syncedToday++;
            }
          }

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
        }

        return NextResponse.json({
          success: true,
          message: `Synced ${punches.length} punch records from eSSL K30 Pro.`,
        });
      } catch (err: any) {
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
