import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Employee } from "@/models/Employee";
import { Attendance } from "@/models/Attendance";
import { BiometricDevice, BiometricMapping } from "@/models/Biometric";
import { Asset } from "@/models/Asset";
import { MailLog } from "@/models/MailLog";
import { Notification } from "@/models/Notification";
import { AuditLog } from "@/models/AuditLog";
import { getCurrentUser } from "@/lib/auth";
import { resetMockStore } from "@/lib/mock-db";
import bcrypt from "bcryptjs";

export async function POST() {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== "super_admin") {
      return NextResponse.json({ error: "Only Super Admin can reset data" }, { status: 403 });
    }

    const superAdminEmail = (process.env.SUPERADMIN_EMAIL || "superadmin@gvkedutech.com").toLowerCase().trim();
    const superAdminPassword = process.env.SUPERADMIN_PASSWORD || "Gvkedutech@123";

    const conn = await connectToDatabase();
    if (conn) {
      const passwordHash = await bcrypt.hash(superAdminPassword, 10);
      await User.deleteMany({});
      await User.create({
        email: superAdminEmail,
        passwordHash,
        name: "Super Admin",
        role: "super_admin",
        employeeId: "ADM-001",
        branch: "Headquarters",
        isActive: true,
      });

      await Employee.deleteMany({});
      await Attendance.deleteMany({});
      await BiometricDevice.deleteMany({});
      await BiometricMapping.deleteMany({});
      await Asset.deleteMany({});
      await MailLog.deleteMany({});
      await Notification.deleteMany({});
      await AuditLog.deleteMany({});

      await AuditLog.create({
        auditId: `AU-${Date.now()}`,
        user: session.name || "Super Admin",
        userId: session.userId,
        role: "super_admin",
        action: "Reset Environment",
        module: "Administration",
        record: "Database Reset",
        outcome: "Success",
        details: "Cleaned environment. Super admin account re-initialized.",
      });
    }

    resetMockStore();

    return NextResponse.json({
      success: true,
      message: "Environment reset successfully. Only Super Admin is active.",
    });
  } catch (error: any) {
    console.error("[Seed API Error]", error);
    return NextResponse.json({ error: error.message || "Failed to reset data" }, { status: 500 });
  }
}
