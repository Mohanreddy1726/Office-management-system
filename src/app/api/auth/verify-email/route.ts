import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Employee } from "@/models/Employee";
import { AuditLog } from "@/models/AuditLog";
import { sendCredentialsEmail, getAppUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Verification token is required" }, { status: 400 });
    }

    const conn = await connectToDatabase();
    if (!conn) {
      return NextResponse.json({ error: "Database service unavailable" }, { status: 503 });
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired verification link. Please request a new verification link from your administrator." },
        { status: 400 }
      );
    }

    // Capture initial password before clearing
    const plainPassword = user.initialPassword || "Gvkedutech@123";

    // Mark verified and active
    user.isEmailVerified = true;
    user.isActive = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.initialPassword = undefined;
    await user.save();

    // Look up Employee to get registered personal email and determine post-verification status
    let employee = null;
    if (user.employeeId) {
      employee = await Employee.findOne({ employeeId: user.employeeId });
    }
    if (!employee && user.email) {
      employee = await Employee.findOne({
        $or: [{ workEmail: user.email }, { email: user.email }, { personalEmail: user.email }],
      });
    }

    // Also update Employee status: Probation if probationEndDate exists, else Active
    if (employee) {
      const hasProbation = Boolean(employee.probationEndDate);
      employee.status = hasProbation ? "Probation" : "Active";
      await employee.save();
    } else if (user.employeeId) {
      await Employee.updateOne(
        { employeeId: user.employeeId },
        { $set: { status: "Active" } }
      );
    }

    // Trigger dispatch of Login Credentials Email to the registered personal email
    const appUrl = getAppUrl(req);
    const portalUrl = `${appUrl}/login`;
    const recipientEmail = employee?.personalEmail || user.email;

    await sendCredentialsEmail({
      name: user.name,
      toEmail: recipientEmail,
      loginEmail: user.email,
      password: plainPassword,
      role: user.role,
      portalUrl,
      employeeId: user.employeeId,
    });

    // Create Audit Log
    try {
      await AuditLog.create({
        auditId: `AU-${Date.now()}`,
        user: user.name,
        userId: user._id.toString(),
        role: user.role,
        action: "Email Verified & Credentials Dispatched",
        module: "Employees",
        record: `${user.email} (Role: ${user.role})`,
        outcome: "Success",
        details: `Employee verified email. Login credentials dispatched to ${recipientEmail} from gvkdigital01@gmail.com. Status set to ${employee?.status || "Active"}.`,
      });
    } catch (auditErr) {
      console.warn("Audit log error:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: "Email successfully verified and login credentials dispatched to your inbox.",
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        employeeId: user.employeeId,
      },
    });
  } catch (error: any) {
    console.error("[Email Verification API Error]", error);
    return NextResponse.json({ error: error.message || "Failed to verify email" }, { status: 500 });
  }
}
