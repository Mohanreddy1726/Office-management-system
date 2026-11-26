import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { getCurrentUser } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";
import { reconcileAllActiveMappings, syncLiveBiometricHardware, dispatchBiometricSyncThroughBridge } from "@/lib/biometric-sync";
import { classifyLoginTime } from "@/lib/policies";

export const dynamic = "force-dynamic";

function formatAttendanceRecord(r: any) {
  const loginClass = r.checkIn ? classifyLoginTime(r.checkIn) : null;
  const mappedStatus =
    r.status === "On Leave" ? "Leave" : r.status === "Half-day" ? "Half Day" : r.status || "Present";
  return {
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
    lateMinutes: loginClass ? loginClass.lateMinutes : r.status === "Late" ? 15 : 0,
    status: mappedStatus as any,
    source: "Biometric" as const,
    confirmation: r.confirmation || "Confirmed",
    deviceUsed: r.deviceUsed || "eSSL K30 Pro - Main Office",
    correction: r.correction || {},
  };
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
      const rawRecords = await Attendance.find(query).sort({ date: -1, checkIn: 1 }).lean();
      const records = rawRecords.map(formatAttendanceRecord);
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
      if (conn) {
        // Attempt live terminal connection
        const liveResult = await syncLiveBiometricHardware();
        if (liveResult.success) {
          const rawRecords = await Attendance.find({}).sort({ date: -1, checkIn: 1 });
          const records = rawRecords.map(formatAttendanceRecord);
          return NextResponse.json({
            success: true,
            records,
            message:
              liveResult.updatedRecords > 0
                ? `Synced ${liveResult.recentLogsChecked ?? liveResult.totalLogs} recent punches (${liveResult.updatedRecords} updated, ${liveResult.skippedOldLogs ?? 0} old skipped).`
                : `Already up to date (${liveResult.recentLogsChecked ?? 0} recent punches checked, ${liveResult.skippedOldLogs ?? 0} old skipped).`,
            summary: {
              processed: liveResult.recentLogsChecked ?? liveResult.totalLogs,
              skippedOld: liveResult.skippedOldLogs ?? 0,
              updatedRecords: liveResult.updatedRecords,
            },
          });
        }

        // If hardware is not directly reachable on LAN (e.g. running on Vercel cloud), trigger Office Biometric Bridge
        const bridgeResult = await dispatchBiometricSyncThroughBridge({
          action: "sync_biometric",
          requestedBy: session?.name || "Admin",
          timeoutMs: 12000,
        });

        if (bridgeResult.reached && bridgeResult.summary) {
          const s = bridgeResult.summary;
          const rawRecords = await Attendance.find({}).sort({ date: -1, checkIn: 1 });
          const records = rawRecords.map(formatAttendanceRecord);
          return NextResponse.json({
            success: true,
            records,
            syncedFrom: "office_bridge",
            terminalReachable: true,
            message:
              (s.updatedRecords ?? 0) > 0
                ? `Synced ${s.recentLogsChecked ?? s.totalLogs ?? 0} recent punches via Office Bridge (${s.updatedRecords} updated, ${s.skippedOldLogs ?? 0} old skipped).`
                : `Already up to date via Office Bridge (${s.recentLogsChecked ?? 0} recent punches checked, ${s.skippedOldLogs ?? 0} old skipped).`,
            summary: {
              processed: s.recentLogsChecked ?? s.totalLogs ?? 0,
              skippedOld: s.skippedOldLogs ?? 0,
              updatedRecords: s.updatedRecords ?? 0,
            },
          });
        }

        // Fallback: reconcile stored unresolved punches from MongoDB Atlas and inform user honestly
        const cloudResult = await reconcileAllActiveMappings();
        const rawRecords = await Attendance.find({}).sort({ date: -1, checkIn: 1 });
        const records = rawRecords.map(formatAttendanceRecord);
        const totalCount = await Attendance.countDocuments();
        return NextResponse.json({
          success: true,
          records,
          syncedFrom: "cloud_database",
          terminalReachable: false,
          message: cloudResult.updatedRecords > 0
            ? `Reconciled ${cloudResult.updatedRecords} attendance records from MongoDB (${totalCount} total). ${bridgeResult.error || ""}`
            : `Loaded ${records.length} stored records from MongoDB. Live machine not synced: ${bridgeResult.error || liveResult.error}`,
          summary: { processed: cloudResult.processedPunches, updatedRecords: cloudResult.updatedRecords },
        });
      }
      return NextResponse.json(
        { error: "Database unavailable. Could not connect to MongoDB Atlas for biometric sync." },
        { status: 503 }
      );
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
