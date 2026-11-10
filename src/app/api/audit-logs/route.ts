import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";
import { getCurrentUser } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session || (session.role !== "super_admin" && session.role !== "hr_admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const conn = await connectToDatabase();
    if (conn) {
      const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(100);
      return NextResponse.json({ success: true, logs });
    } else {
      const store = getMockStore();
      return NextResponse.json({ success: true, logs: store.auditLogs });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
