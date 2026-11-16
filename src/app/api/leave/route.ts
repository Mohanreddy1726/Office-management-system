import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { LeaveRequest, LeaveBalance } from "@/models/Leave";
import { Employee } from "@/models/Employee";
import { AuditLog } from "@/models/AuditLog";
import { getCurrentUser } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    const roleHeader = req.headers.get("x-user-role");
    const role = session?.role || (roleHeader === "super_admin" || roleHeader === "hr_admin" ? roleHeader : null);

    if (!session && !role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isEmployee = session?.role === "employee" && session?.employeeId;
    const currentEmpId = session?.employeeId || session?.userId;

    const conn = await connectToDatabase();
    if (conn) {
      const query: any = {};
      // Regular employees only see their own requests
      if (isEmployee) {
        query.employeeId = session.employeeId;
      }
      // Super Admin, HR Admin, and Managers see all requests
      const rawRequests = await LeaveRequest.find(query).sort({ createdAt: -1 });

      const requests = rawRequests.map((r: any) => {
        const id = r._id.toString();
        const rawStatus = r.status || "Submitted";
        const normalizedStatus =
          rawStatus === "HR Approved" || rawStatus === "Manager Approved" ? "Approved" : rawStatus;

        return {
          id,
          _id: id,
          employeeId: r.employeeId,
          employeeName: r.employeeName || "Employee",
          department: r.department || "Operations",
          branch: r.branch || "Headquarters",
          type: r.leaveType || r.type || "Casual Leave",
          leaveType: r.leaveType || r.type || "Casual Leave",
          startDate: r.startDate,
          endDate: r.endDate,
          days: r.days || r.daysCount || 1,
          daysCount: r.daysCount || r.days || 1,
          isHalfDay: !!r.isHalfDay,
          halfDay: r.halfDay,
          reason: r.reason || "Personal Leave",
          reasonCategory: r.reasonCategory || "Personal / Family",
          handoverEmployeeId: r.handoverEmployeeId,
          emergencyContact: r.emergencyContact,
          documentNote: r.documentNote,
          status: normalizedStatus,
          managerDecision: r.managerDecision,
          managerNote: r.managerNote,
          decisionNote: r.decisionNote,
          reviewedBy: r.reviewedBy,
          reviewedAt: r.reviewedAt,
          timeline:
            Array.isArray(r.timeline) && r.timeline.length > 0
              ? r.timeline.map((t: any) => ({
                  stage: t.stage,
                  actor: t.actor,
                  at:
                    typeof t.at === "string"
                      ? t.at
                      : t.at
                      ? new Date(t.at).toISOString().slice(0, 16).replace("T", " ")
                      : new Date().toISOString().slice(0, 16).replace("T", " "),
                  note: t.note,
                }))
              : [
                  {
                    stage: "Submitted",
                    actor: r.employeeName || r.employeeId,
                    at: r.startDate || new Date().toISOString().slice(0, 10),
                    note: "Application submitted",
                  },
                ],
          createdAt: r.createdAt,
        };
      });

      let balance = null;
      if (currentEmpId) {
        balance = await LeaveBalance.findOne({ employeeId: currentEmpId });
        if (!balance) {
          balance = await LeaveBalance.create({ employeeId: currentEmpId });
        }
      }

      return NextResponse.json({ success: true, requests, balance });
    } else {
      const store = getMockStore();
      let reqs = store.leaves;
      if (isEmployee) {
        reqs = reqs.filter((r) => r.employeeId === session.employeeId);
      }
      const bal = store.leaveBalances[currentEmpId || "OF-1001"] || store.leaveBalances["OF-1001"];
      return NextResponse.json({ success: true, requests: reqs, balance: bal });
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

    if (!session && !role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Support batch sync of local offline leaves
    if (Array.isArray(body.leaves)) {
      const conn = await connectToDatabase();
      if (!conn) {
        return NextResponse.json({ success: true, synced: 0 });
      }

      let createdCount = 0;
      for (const item of body.leaves) {
        const applicantId = item.employeeId || session?.employeeId || session?.userId;
        if (!applicantId) continue;

        // Check if an identical leave request already exists
        const exists = await LeaveRequest.findOne({
          employeeId: applicantId,
          startDate: item.startDate,
          endDate: item.endDate,
          reason: item.reason,
        });

        if (!exists) {
          const emp = await Employee.findOne({ employeeId: applicantId });
          await LeaveRequest.create({
            employeeId: applicantId,
            employeeName: emp?.name || item.employeeName || session?.name || "Employee",
            department: emp?.department || "Operations",
            branch: emp?.branch || "Headquarters",
            leaveType: item.type || item.leaveType || "Casual Leave",
            type: item.type || item.leaveType || "Casual Leave",
            startDate: item.startDate,
            endDate: item.endDate,
            daysCount: item.days || 1,
            days: item.days || 1,
            isHalfDay: !!item.isHalfDay || !!item.halfDay,
            halfDay: item.halfDay,
            reason: item.reason,
            reasonCategory: item.reasonCategory,
            handoverEmployeeId: item.handoverEmployeeId,
            emergencyContact: item.emergencyContact,
            documentNote: item.documentNote,
            status: item.status || "Submitted",
            timeline: item.timeline || [
              {
                stage: "Submitted",
                actor: emp?.name || session?.name || applicantId,
                at: new Date(),
                note: "Application submitted for review",
              },
            ],
          });
          createdCount++;
        }
      }
      return NextResponse.json({ success: true, synced: createdCount });
    }

    // Single leave submission
    const applicantId = body.employeeId || session?.employeeId || session?.userId || "OF-1001";
    const leaveType = body.type || body.leaveType || "Casual Leave";
    const startDate = body.startDate;
    const endDate = body.endDate || startDate;
    const days = body.days !== undefined ? Number(body.days) : body.isHalfDay ? 0.5 : 1;
    const isHalfDay = !!body.isHalfDay || !!body.halfDay;
    const reason = body.reason || "Personal Leave";

    const conn = await connectToDatabase();
    if (conn) {
      const emp = await Employee.findOne({ employeeId: applicantId });
      const empName = emp?.name || session?.name || "Employee";
      const empDept = emp?.department || "Operations";
      const empBranch = emp?.branch || "Headquarters";

      const leave = await LeaveRequest.create({
        employeeId: applicantId,
        employeeName: empName,
        department: empDept,
        branch: empBranch,
        leaveType,
        type: leaveType,
        startDate,
        endDate,
        daysCount: days,
        days,
        isHalfDay,
        halfDay: body.halfDay,
        reason,
        reasonCategory: body.reasonCategory,
        handoverEmployeeId: body.handoverEmployeeId,
        emergencyContact: body.emergencyContact,
        documentNote: body.documentNote,
        status: "Submitted",
        timeline: [
          {
            stage: "Submitted",
            actor: empName,
            at: new Date(),
            note: "Application submitted for review",
          },
        ],
      });

      // Audit Log
      try {
        await AuditLog.create({
          auditId: `AU-${Date.now()}`,
          user: session?.name || empName,
          userId: session?.userId || applicantId,
          role: session?.role || "employee",
          action: "Submitted Leave Application",
          module: "Leave",
          record: `${empName} (${applicantId}) - ${leaveType} (${days}d)`,
          outcome: "Success",
          details: `${startDate} to ${endDate} | Reason: ${reason}`,
        });
      } catch (auditErr) {
        console.warn("[Leave Audit Log Warning]", auditErr);
      }

      return NextResponse.json({
        success: true,
        leave: {
          id: leave._id.toString(),
          _id: leave._id.toString(),
          employeeId: leave.employeeId,
          employeeName: leave.employeeName,
          department: leave.department,
          branch: leave.branch,
          type: leave.leaveType,
          startDate: leave.startDate,
          endDate: leave.endDate,
          days: leave.daysCount,
          halfDay: leave.halfDay,
          reason: leave.reason,
          reasonCategory: leave.reasonCategory,
          handoverEmployeeId: leave.handoverEmployeeId,
          emergencyContact: leave.emergencyContact,
          documentNote: leave.documentNote,
          status: leave.status,
          timeline: leave.timeline,
          createdAt: leave.createdAt,
        },
      });
    } else {
      const store = getMockStore();
      const newLeave = {
        _id: `LV-${Date.now()}`,
        id: `LV-${Date.now()}`,
        employeeId: applicantId,
        employeeName: session?.name || "Employee",
        department: "Operations",
        branch: "Headquarters",
        type: leaveType,
        leaveType,
        startDate,
        endDate,
        days,
        daysCount: days,
        isHalfDay,
        halfDay: body.halfDay,
        reason,
        status: "Submitted",
        timeline: [{ stage: "Submitted", actor: session?.name || applicantId, at: new Date() }],
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
    const roleHeader = req.headers.get("x-user-role");
    const role = session?.role || (roleHeader === "super_admin" || roleHeader === "hr_admin" ? roleHeader : null);

    if (!session && !role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { leaveId, id, action, decision, status, note, decisionNote } = body;
    const targetId = leaveId || id;

    if (!targetId) {
      return NextResponse.json({ error: "Leave ID is required" }, { status: 400 });
    }

    const finalDecision =
      decision || status || (action === "approve" ? "Approved" : action === "reject" ? "Rejected" : "Approved");
    const noteText =
      note ||
      decisionNote ||
      (finalDecision === "Approved"
        ? session?.role === "manager"
          ? "Approved by Manager"
          : "Approved by HR Admin"
        : "Rejected as per operational constraints");

    const conn = await connectToDatabase();
    if (conn) {
      let leave: any = null;
      if (mongoose.Types.ObjectId.isValid(targetId)) {
        leave = await LeaveRequest.findById(targetId);
      }
      if (!leave) {
        // Fallback search by string id or employeeId
        leave = await LeaveRequest.findOne({
          $or: [{ _id: targetId }, { employeeId: targetId }],
        }).sort({ createdAt: -1 });
      }

      if (!leave) {
        return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
      }

      leave.status = finalDecision;
      leave.decisionNote = noteText;
      leave.reviewedBy = session?.name || "Admin";
      leave.reviewedAt = new Date();
      leave.timeline.push({
        stage: finalDecision,
        actor: session?.name || "Admin",
        at: new Date(),
        note: noteText,
      });
      await leave.save();

      // If approved, update LeaveBalance
      if (finalDecision === "Approved") {
        try {
          const bal = await LeaveBalance.findOne({ employeeId: leave.employeeId });
          if (bal) {
            const key =
              leave.leaveType === "Casual Leave"
                ? "casualLeave"
                : leave.leaveType === "Sick Leave"
                ? "sickLeave"
                : "compOff";
            if (bal[key]) {
              bal[key].used = (bal[key].used || 0) + (leave.daysCount || leave.days || 1);
              bal[key].remaining = Math.max(0, (bal[key].total || 12) - bal[key].used);
              await bal.save();
            }
          }
        } catch (balErr) {
          console.warn("[LeaveBalance Update Warning]", balErr);
        }
      }

      // Audit Log
      try {
        await AuditLog.create({
          auditId: `AU-${Date.now()}`,
          user: session?.name || "Admin",
          userId: session?.userId || "ADM-001",
          role: session?.role || "super_admin",
          action: `Leave Application ${finalDecision}`,
          module: "Leave",
          record: `${leave.employeeName} (${leave.employeeId}) - ${leave.leaveType}`,
          outcome: "Success",
          details: `Decision: ${finalDecision} | Note: ${noteText}`,
        });
      } catch (auditErr) {
        console.warn("[Leave Audit Log Warning]", auditErr);
      }

      return NextResponse.json({ success: true, leave });
    } else {
      const store = getMockStore();
      const leave = store.leaves.find((l) => l._id === targetId || l.id === targetId);
      if (leave) {
        leave.status = finalDecision;
        leave.decisionNote = noteText;
      }
      return NextResponse.json({ success: true, leave });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
