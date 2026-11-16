import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Employee } from "@/models/Employee";
import { User } from "@/models/User";
import { AuditLog } from "@/models/AuditLog";
import { getCurrentUser } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";
import { sendVerificationEmail, getAppUrl } from "@/lib/email";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    const roleHeader = req.headers.get("x-user-role");
    const role = session?.role || (roleHeader === "super_admin" || roleHeader === "hr_admin" ? roleHeader : null);
    if (!role || (role !== "super_admin" && role !== "hr_admin")) {
      return NextResponse.json(
        { error: "Forbidden. Only administrators can resend verification emails." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { employeeId, email, personalEmail, workEmail, name } = body;
    const targetEmail = (personalEmail || email || workEmail || "").toLowerCase().trim();

    if (!employeeId && !targetEmail) {
      return NextResponse.json(
        { error: "Employee ID or Email address is required" },
        { status: 400 }
      );
    }

    const conn = await connectToDatabase();
    if (conn) {
      // Find employee
      let employee = null;
      if (employeeId) {
        employee = await Employee.findOne({
          $or: [{ employeeId: employeeId }, { id: employeeId }],
        });
      }
      if (!employee && targetEmail) {
        employee = await Employee.findOne({
          $or: [
            { personalEmail: targetEmail },
            { workEmail: targetEmail },
            { email: targetEmail },
          ],
        });
      }

      // Find user
      let user = null;
      if (employeeId) {
        user = await User.findOne({
          $or: [{ employeeId: employeeId }, { id: employeeId }],
        });
      }
      if (!user && employee) {
        user = await User.findOne({
          $or: [
            { employeeId: employee.employeeId },
            { email: employee.workEmail?.toLowerCase().trim() },
            { email: employee.email?.toLowerCase().trim() },
          ],
        });
      }
      if (!user && targetEmail) {
        user = await User.findOne({ email: targetEmail });
      }

      // Generate a fresh 32-byte cryptographic token
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const verificationExpires = new Date(Date.now() + 48 * 3600 * 1000); // 48 hours validity

      const empName = employee?.name || user?.name || name || "Employee";
      const empId = employee?.employeeId || user?.employeeId || employeeId || `OF-${Date.now().toString().slice(-4)}`;
      const recipient =
        employee?.personalEmail ||
        targetEmail ||
        employee?.workEmail ||
        user?.email;

      if (!recipient) {
        return NextResponse.json(
          { error: "No valid email address found to send verification to" },
          { status: 400 }
        );
      }

      // Update or create User
      if (user) {
        user.emailVerificationToken = verificationToken;
        user.emailVerificationExpires = verificationExpires;
        user.isEmailVerified = false;
        user.isActive = false; // Inactive until verified
        await user.save();
      } else {
        const tempPassword = `GvkEdu@${Math.floor(1000 + Math.random() * 9000)}`;
        const passwordHash = await bcrypt.hash(tempPassword, 10);
        user = await User.create({
          email: recipient.toLowerCase().trim(),
          passwordHash,
          initialPassword: tempPassword,
          name: empName,
          role: "employee",
          employeeId: empId,
          branch: employee?.branch || "Headquarters",
          isActive: false,
          isEmailVerified: false,
          emailVerificationToken: verificationToken,
          emailVerificationExpires: verificationExpires,
        });
      }

      // If Employee document is missing, recreate it so it stays persistent
      if (!employee) {
        employee = await Employee.create({
          employeeId: empId,
          name: empName,
          email: recipient.toLowerCase().trim(),
          workEmail: recipient.toLowerCase().trim(),
          personalEmail: recipient.toLowerCase().trim(),
          phone: "0000000000",
          designation: "Employee",
          department: "General",
          branch: user?.branch || "Headquarters",
          status: "Pending Verification",
          joiningDate: new Date().toISOString().split("T")[0],
          salary: {
            annualCtc: 0,
            monthlyGross: 0,
            basic: 0,
            hra: 0,
            specialAllowance: 0,
            professionalTax: 0,
            pfEmployee: 0,
            pfEmployer: 0,
            esiEmployee: 0,
            esiEmployer: 0,
            takeHomeMonthly: 0,
          },
          shift: {
            shiftName: "General Shift",
            startTime: "09:30",
            endTime: "18:30",
            gracePeriodMinutes: 15,
            halfDayThresholdHours: 4.5,
            fullDayHours: 9,
          },
          leaveBalance: {
            casualLeave: 12,
            sickLeave: 12,
            earnedLeave: 15,
          },
        });
      } else {
        employee.status = "Pending Verification";
        await employee.save();
      }

      // Construct verification URL pointing to the deployed site
      const appUrl = getAppUrl(req);
      const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`;

      // Dispatch verification email
      const emailResult = await sendVerificationEmail({
        name: empName,
        toEmail: recipient,
        verificationUrl,
        employeeId: empId,
      });

      // Audit Log
      try {
        await AuditLog.create({
          auditId: `AU-${Date.now()}`,
          user: session?.name || "Administrator",
          userId: session?.userId || "admin",
          role: role,
          action: "Resent Email Verification Link",
          module: "Employees",
          record: `${empId} - ${empName}`,
          outcome: emailResult.success ? "Success" : "Warning",
          details: `Verification link resent to ${recipient} via ${appUrl} (gvkdigital01@gmail.com). Status: ${
            emailResult.success ? "Dispatched" : emailResult.error || "Failed"
          }`,
        });
      } catch (auditErr) {
        console.warn("Audit log creation error:", auditErr);
      }

      if (!emailResult.success) {
        console.error("[Resend Verification Email Error]", emailResult.error);
        return NextResponse.json(
          {
            error: `Failed to dispatch email to ${recipient}: ${emailResult.error}`,
            emailSent: false,
            recipient,
            employeeId: empId,
            verificationUrl,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Verification link successfully resent to ${recipient}`,
        recipient,
        employeeId: empId,
        emailSent: true,
        verificationUrl,
      });
    } else {
      // In-memory fallback
      const store = getMockStore();
      const emp = store.employees.find(
        (e: any) => e.id === employeeId || e.workEmail === targetEmail || e.personalEmail === targetEmail
      );
      if (emp) {
        emp.status = "Pending Verification";
      }

      const mockToken = crypto.randomBytes(32).toString("hex");
      const appUrl = getAppUrl(req);
      const verificationUrl = `${appUrl}/verify-email?token=${mockToken}`;
      const recipient = emp?.personalEmail || emp?.workEmail || targetEmail;

      const emailResult = await sendVerificationEmail({
        name: emp?.name || name || "Employee",
        toEmail: recipient,
        verificationUrl,
        employeeId: emp?.id || employeeId,
      });

      if (!emailResult.success) {
        return NextResponse.json(
          {
            error: `Failed to dispatch email to ${recipient}: ${emailResult.error}`,
            emailSent: false,
            recipient,
            verificationUrl,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Verification link sent to ${recipient}`,
        recipient,
        emailSent: true,
        verificationUrl,
      });
    }
  } catch (error: any) {
    console.error("[Resend Verification API Error]", error);
    return NextResponse.json(
      { error: error.message || "Failed to resend verification link" },
      { status: 500 }
    );
  }
}
