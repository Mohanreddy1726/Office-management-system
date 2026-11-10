import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getCurrentUser, signSessionToken, AUTH_COOKIE_NAME, UserRole } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Employee } from "@/models/Employee";
import { getMockStore } from "@/lib/mock-db";

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const body = await req.json();
    const { targetRole, targetUserId, targetEmail, targetName } = body;

    const originalRole: UserRole = (session.originalRole || session.role) as UserRole;
    const originalUserId: string = session.originalUserId || session.employeeId || session.userId;
    const originalName: string = session.originalName || session.name;
    const originalEmail: string = session.originalEmail || session.email;

    // 1. Check permissions based on originalRole
    if (originalRole === "employee") {
      return NextResponse.json(
        { error: "Forbidden. Employee accounts do not have account switching privileges." },
        { status: 403 }
      );
    }

    if (originalRole === "hr_admin") {
      // HR Admin can ONLY switch between their HR Admin account and their OWN Employee account
      if (targetRole !== "hr_admin" && targetRole !== "employee") {
        return NextResponse.json(
          { error: "Forbidden. HR Admin can only switch between HR Admin and their own Employee account." },
          { status: 403 }
        );
      }
    }

    if (originalRole === "manager") {
      // Manager can ONLY switch between their Manager account and their OWN Employee account
      if (targetRole !== "manager" && targetRole !== "employee") {
        return NextResponse.json(
          { error: "Forbidden. Manager can only switch between Manager and their own Employee account." },
          { status: 403 }
        );
      }
    }

    // 2. Resolve target identity
    const conn = await connectToDatabase();
    let targetPayload = {
      userId: targetUserId || session.userId,
      employeeId: targetUserId || session.employeeId,
      email: targetEmail || session.email,
      name: targetName || session.name,
      role: (targetRole || "employee") as UserRole,
      branch: session.branch || "Headquarters",
    };

    // If restoring back to original Super Admin
    if (targetRole === "super_admin" && originalRole === "super_admin") {
      const envSuperEmail = (process.env.SUPERADMIN_EMAIL || "superadmin@gvkedutech.com").trim().toLowerCase();
      targetPayload = {
        userId: originalUserId || "ADM-001",
        employeeId: "ADM-001",
        email: envSuperEmail,
        name: "Super Admin",
        role: "super_admin",
        branch: "Headquarters",
      };
    }
    // If HR Admin or Manager switching to their own employee account
    else if (targetRole === "employee" && (originalRole === "hr_admin" || originalRole === "manager")) {
      let empRecord: any = null;
      if (conn) {
        empRecord = await Employee.findOne({
          $or: [
            { employeeId: originalUserId },
            { email: originalEmail },
            { workEmail: originalEmail },
          ],
        });
      }

      if (empRecord) {
        targetPayload = {
          userId: empRecord.employeeId,
          employeeId: empRecord.employeeId,
          email: empRecord.workEmail || empRecord.email || originalEmail,
          name: empRecord.name || originalName,
          role: "employee",
          branch: empRecord.branch || session.branch || "Headquarters",
        };
      } else {
        targetPayload = {
          userId: originalUserId,
          employeeId: originalUserId,
          email: originalEmail,
          name: originalName,
          role: "employee",
          branch: session.branch || "Headquarters",
        };
      }
    }
    // If HR Admin or Manager switching back to their admin/manager account
    else if (
      (targetRole === "hr_admin" && originalRole === "hr_admin") ||
      (targetRole === "manager" && originalRole === "manager")
    ) {
      targetPayload = {
        userId: originalUserId,
        employeeId: originalUserId,
        email: originalEmail,
        name: originalName,
        role: originalRole,
        branch: session.branch || "Headquarters",
      };
    }
    // If Super Admin switching into another user's account
    else if (originalRole === "super_admin") {
      let targetUser: any = null;
      let targetEmp: any = null;

      if (conn) {
        if (targetUserId) {
          const conditions: any[] = [{ employeeId: targetUserId }];
          if (mongoose.Types.ObjectId.isValid(targetUserId)) {
            conditions.push({ _id: targetUserId });
          }
          targetUser = await User.findOne({ $or: conditions });
          targetEmp = await Employee.findOne({ employeeId: targetUserId });
        } else if (targetEmail) {
          targetUser = await User.findOne({ email: targetEmail.toLowerCase().trim() });
          targetEmp = await Employee.findOne({ $or: [{ email: targetEmail }, { workEmail: targetEmail }] });
        }
      } else {
        const store = getMockStore();
        targetUser = store.users.find((u) => u.employeeId === targetUserId || u.email === targetEmail);
        targetEmp = store.employees.find((e) => e.employeeId === targetUserId || e.workEmail === targetEmail);
      }

      const resolvedName = targetUser?.name || targetEmp?.name || targetName || "User";
      const resolvedEmail = targetUser?.email || targetEmp?.workEmail || targetEmp?.email || targetEmail || "";
      const resolvedEmpId = targetUser?.employeeId || targetEmp?.employeeId || targetUserId || "";
      const resolvedBranch = targetUser?.branch || targetEmp?.branch || "Headquarters";

      targetPayload = {
        userId: resolvedEmpId || targetUser?._id?.toString() || targetUserId || "ADM-001",
        employeeId: resolvedEmpId,
        email: resolvedEmail,
        name: resolvedName,
        role: (targetRole || targetUser?.role || "employee") as UserRole,
        branch: resolvedBranch,
      };
    }

    // 3. Create new JWT preserving original credentials
    const token = await signSessionToken({
      ...targetPayload,
      originalRole,
      originalUserId,
      originalName,
      originalEmail,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        ...targetPayload,
        originalRole,
        originalUserId,
        originalName,
      },
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    console.error("[Auth Switch API Error]", error);
    return NextResponse.json({ error: error.message || "Failed to switch account" }, { status: 500 });
  }
}
