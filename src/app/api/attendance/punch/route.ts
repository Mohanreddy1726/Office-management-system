import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { Employee } from "@/models/Employee";
import { AuditLog } from "@/models/AuditLog";
import { getCurrentUser } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { punchType } = body;

    const employeeId = session.employeeId || body.employeeId || "OF-1001";
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const timeStr = `${hours}:${minutes}`;

    const conn = await connectToDatabase();

    if (conn) {
      const employee = await Employee.findOne({ employeeId });
      let record = await Attendance.findOne({ employeeId, date: dateStr });

      if (punchType === "checkIn") {
        const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 15);
        const status = isLate ? "Late" : "Present";

        if (!record) {
          record = await Attendance.create({
            employeeId,
            employeeName: employee?.name || session.name,
            department: employee?.department || "General",
            date: dateStr,
            checkIn: timeStr,
            status,
            confirmation: "Awaiting Employee",
            branch: "Headquarters",
          });
        } else {
          record.checkIn = timeStr;
          record.status = status;
          await record.save();
        }
      } else if (punchType === "checkOut") {
        if (!record) return NextResponse.json({ error: "No clock-in found" }, { status: 400 });
        record.checkOut = timeStr;
        if (record.checkIn) {
          const [inH, inM] = record.checkIn.split(":").map(Number);
          const [outH, outM] = timeStr.split(":").map(Number);
          const diffMinutes = outH * 60 + outM - (inH * 60 + inM);
          record.totalHours = Math.max(0, Math.round((diffMinutes / 60) * 10) / 10);
        }
        await record.save();
      }
      return NextResponse.json({ success: true, record });
    } else {
      const store = getMockStore();
      let record = store.attendances.find((a) => a.employeeId === employeeId && a.date === dateStr);

      if (punchType === "checkIn") {
        if (!record) {
          record = {
            _id: `att-${Date.now()}`,
            employeeId,
            employeeName: session.name,
            department: "Engineering",
            date: dateStr,
            checkIn: timeStr,
            status: "Present",
            confirmation: "Awaiting Employee",
            branch: "Headquarters",
          };
          store.attendances.push(record);
        } else {
          record.checkIn = timeStr;
        }
      } else {
        if (!record) return NextResponse.json({ error: "No clock-in record found for today." }, { status: 400 });
        record.checkOut = timeStr;
        record.totalHours = 8.5;
      }
      return NextResponse.json({ success: true, record });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
