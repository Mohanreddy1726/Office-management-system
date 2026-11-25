import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { LeaveRequest, LeaveBalance } from "@/models/Leave";
import { Employee } from "@/models/Employee";
import { AuditLog } from "@/models/AuditLog";
import { getCurrentUser } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";
import { validateLeavePolicyRequest } from "@/lib/policies";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    const roleHeader = req.headers.get("x-user-role");
    const role = session?.role || (roleHeader === "super_admin" || roleHeader === "hr_admin" ? roleHeader : null);
    const isEmployee = session?.role === "employee" && session?.employeeId;
    const currentEmpId = session?.employeeId || session?.userId;

    const conn = await connectToDatabase();
    if (conn) {
      const query: any = {};
      // Regular employees only see their own requests if explicitly authenticated as employee
      if (isEmployee) {
        query.employeeId = session.employeeId;
      }
      // Super Admin, HR Admin, Managers, and general reads see all requests
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

    // Ignore legacy batch leaves so stale localStorage cannot resurrect deleted records
    if (body.leaves) {
      return NextResponse.json({ success: true, message: "Batch recreation ignored" });
    }

    if (!body.startDate) {
      return NextResponse.json({ error: "startDate is required" }, { status: 400 });
    }
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

      const targetMonth = startDate.slice(0, 7);
      const existingMonthLeaves = await LeaveRequest.find({
        employeeId: applicantId,
        startDate: { $regex: `^${targetMonth}` },
      });

      const policyCheck = validateLeavePolicyRequest({
        startDate,
        days,
        type: leaveType,
        reasonCategory: body.reasonCategory || reason,
        joiningDate: emp?.joiningDate,
        existingLeaves: existingMonthLeaves.map((l: any) => ({
          id: l._id.toString(),
          employeeId: l.employeeId,
          type: (l.leaveType || l.type || "Casual Leave") as any,
          startDate: l.startDate,
          endDate: l.endDate,
          days: l.daysCount || l.days || 1,
          reason: l.reason || "",
          status: l.status,
          timeline: [],
        })),
        employeeId: applicantId,
      });

      const isAdminOverride = role === "super_admin" || role === "hr_admin";
      if (policyCheck.blockingError && !isAdminOverride) {
        return NextResponse.json({ error: policyCheck.blockingError }, { status: 400 });
      }

      const policyNote =
        policyCheck.warnings.length > 0
          ? `Policy note: ${policyCheck.warnings.join(" ")}`
          : "Application submitted for review";

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
            note: policyNote,
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
        : "");

    if (finalDecision === "Rejected" && (!noteText || noteText.trim().length < 3)) {
      return NextResponse.json(
        { error: "An explanation / reason is required to reject a leave application." },
        { status: 400 }
      );
    }

    const conn = await connectToDatabase();
    if (conn) {
      let leave: any = null;
      if (mongoose.Types.ObjectId.isValid(targetId)) {
        leave = await LeaveRequest.findById(targetId);
      }
      if (!leave) {
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
              const defaultTotal = key === "compOff" ? 0 : 10;
              bal[key].used = (bal[key].used || 0) + (leave.daysCount || leave.days || 1);
              bal[key].remaining = Math.max(0, (bal[key].total ?? defaultTotal) - bal[key].used);
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

export async function DELETE(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    const roleHeader = req.headers.get("x-user-role");
    const role = session?.role || (roleHeader === "super_admin" || roleHeader === "hr_admin" ? roleHeader : null);

    if (!session && !role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Leave ID is required" }, { status: 400 });
    }

    const conn = await connectToDatabase();
    if (conn) {
      let deletedDoc: any = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        deletedDoc = await LeaveRequest.findByIdAndDelete(id);
      }
      if (!deletedDoc) {
        deletedDoc = await LeaveRequest.findOneAndDelete({
          $or: [{ _id: id }, { employeeId: id }],
        });
      }

      if (deletedDoc) {
        try {
          await AuditLog.create({
            auditId: `AU-${Date.now()}`,
            user: session?.name || "Admin",
            userId: session?.userId || "ADM-001",
            role: session?.role || "super_admin",
            action: "Deleted Leave Application",
            module: "Leave",
            record: `${deletedDoc.employeeName} (${deletedDoc.employeeId}) - ${deletedDoc.leaveType}`,
            outcome: "Success",
          });
        } catch (auditErr) {
          console.warn("[Leave Delete Audit Warning]", auditErr);
        }
      }

      return NextResponse.json({ success: true, deleted: true, id });
    } else {
      const store = getMockStore();
      store.leaves = store.leaves.filter((l) => l._id !== id && l.id !== id);
      return NextResponse.json({ success: true, deleted: true, id });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
