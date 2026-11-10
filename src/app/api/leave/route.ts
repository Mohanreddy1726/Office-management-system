import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { LeaveRequest, LeaveBalance } from "@/models/Leave";
import { getCurrentUser } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const conn = await connectToDatabase();
    if (conn) {
      const query: any = {};
      if (session.role === "employee" && session.employeeId) {
        query.employeeId = session.employeeId;
      }
      const requests = await LeaveRequest.find(query).sort({ createdAt: -1 });
      let balance = await LeaveBalance.findOne({ employeeId: session.employeeId || "OF-1001" });
      if (!balance) balance = await LeaveBalance.create({ employeeId: session.employeeId || "OF-1001" });
      return NextResponse.json({ success: true, requests, balance });
    } else {
      const store = getMockStore();
      let reqs = store.leaves;
      if (session.role === "employee" && session.employeeId) {
        reqs = reqs.filter((r) => r.employeeId === session.employeeId);
      }
      const bal = store.leaveBalances[session.employeeId || "OF-1001"] || store.leaveBalances["OF-1001"];
      return NextResponse.json({ success: true, requests: reqs, balance: bal });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { leaveType, startDate, endDate, reason, isHalfDay } = body;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const days = isHalfDay ? 0.5 : Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

    const conn = await connectToDatabase();
    if (conn) {
      const leave = await LeaveRequest.create({
        employeeId: session.employeeId || "OF-1001",
        employeeName: session.name,
        department: "Engineering",
        leaveType,
        startDate,
        endDate,
        daysCount: days,
        isHalfDay: !!isHalfDay,
        reason,
        status: "Submitted",
      });
      return NextResponse.json({ success: true, leave });
    } else {
      const store = getMockStore();
      const newLeave = {
        _id: `lv-${Date.now()}`,
        employeeId: session.employeeId || "OF-1001",
        employeeName: session.name,
        department: "Engineering",
        leaveType,
        startDate,
        endDate,
        daysCount: days,
        isHalfDay: !!isHalfDay,
        reason,
        status: "Submitted",
        timeline: [{ stage: "Submitted", actor: session.name, at: new Date() }],
      };
      store.leaves.unshift(newLeave);
      return NextResponse.json({ success: true, leave: newLeave });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { leaveId, action, note } = body;

    const conn = await connectToDatabase();
    if (conn) {
      const leave = await LeaveRequest.findById(leaveId);
      if (!leave) return NextResponse.json({ error: "Leave not found" }, { status: 404 });
      leave.status = action === "approve" ? "HR Approved" : "Rejected";
      leave.decisionNote = note;
      await leave.save();
      return NextResponse.json({ success: true, leave });
    } else {
      const store = getMockStore();
      const leave = store.leaves.find((l) => l._id === leaveId);
      if (leave) {
        leave.status = action === "approve" ? "HR Approved" : "Rejected";
        leave.decisionNote = note;
      }
      return NextResponse.json({ success: true, leave });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
