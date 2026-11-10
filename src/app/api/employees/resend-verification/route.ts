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
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { employeeId, email } = body;

    if (!employeeId && !email) {
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
        employee = await Employee.findOne({ employeeId });
      }
      if (!employee && email) {
        employee = await Employee.findOne({
          $or: [
            { personalEmail: email.toLowerCase().trim() },
            { workEmail: email.toLowerCase().trim() },
            { email: email.toLowerCase().trim() },
          ],
        });
      }

      // Find user
      let user = null;
      if (employeeId) {
        user = await User.findOne({ employeeId });
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
      if (!user && email) {
        user = await User.findOne({ email: email.toLowerCase().trim() });
      }

      if (!employee && !user) {
        return NextResponse.json(
          { error: `Employee not found for ID '${employeeId || email}'` },
          { status: 404 }
        );
      }

      // Generate a fresh 32-byte cryptographic token
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const verificationExpires = new Date(Date.now() + 48 * 3600 * 1000); // 48 hours validity

      const empName = employee?.name || user?.name || "Employee";
      const empId = employee?.employeeId || user?.employeeId || employeeId;
      const recipient =
        employee?.personalEmail ||
        employee?.workEmail ||
        user?.email ||
        email;

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
      } else if (employee) {
        const tempPassword = `GvkEdu@${Math.floor(1000 + Math.random() * 9000)}`;
        const passwordHash = await bcrypt.hash(tempPassword, 10);
        user = await User.create({
          email: (employee.workEmail || recipient).toLowerCase().trim(),
          passwordHash,
          initialPassword: tempPassword,
          name: employee.name,
          role: "employee",
          employeeId: employee.employeeId,
          branch: employee.branch || "Headquarters",
          isActive: false,
          isEmailVerified: false,
          emailVerificationToken: verificationToken,
          emailVerificationExpires: verificationExpires,
        });
      }

      // Update Employee status back to Pending Verification
      if (employee) {
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
          user: session.name || "Administrator",
          userId: session.userId,
          role: session.role,
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

      return NextResponse.json({
        success: true,
        message: `Verification link successfully resent to ${recipient}`,
        recipient,
        employeeId: empId,
        emailSent: emailResult.success,
        verificationUrl,
        error: emailResult.error,
      });
    } else {
      // In-memory fallback
      const store = getMockStore();
      const emp = store.employees.find(
        (e: any) => e.id === employeeId || e.workEmail === email
      );
      if (emp) {
        emp.status = "Pending Verification";
      }

      const mockToken = crypto.randomBytes(32).toString("hex");
      const appUrl = getAppUrl(req);
      const verificationUrl = `${appUrl}/verify-email?token=${mockToken}`;
      const recipient = emp?.personalEmail || emp?.workEmail || email;

      const emailResult = await sendVerificationEmail({
        name: emp?.name || "Employee",
        toEmail: recipient,
        verificationUrl,
        employeeId: emp?.id || employeeId,
      });

      return NextResponse.json({
        success: true,
        message: `Verification link sent to ${recipient}`,
        recipient,
        emailSent: emailResult.success,
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
