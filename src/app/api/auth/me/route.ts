import { NextResponse } from "next/server";
import { getCurrentUser, AUTH_COOKIE_NAME } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Employee } from "@/models/Employee";
import { User } from "@/models/User";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  let employee = null;
  let isInactive = false;

  try {
    const conn = await connectToDatabase();
    if (conn) {
      if (session.employeeId) {
        employee = await Employee.findOne({ employeeId: session.employeeId });
      }
      if (!employee && session.email) {
        const emailPattern = new RegExp(`^${session.email.trim()}$`, "i");
        employee = await Employee.findOne({
          $or: [{ workEmail: emailPattern }, { email: emailPattern }, { personalEmail: emailPattern }],
        });
      }

      if (session.role !== "super_admin") {
        const u = await User.findOne({
          $or: [
            ...(session.employeeId ? [{ employeeId: session.employeeId }] : []),
            { email: session.email.toLowerCase().trim() },
          ],
        });
        if (u && !u.isActive) {
          isInactive = true;
        }
      }
    }
  } catch (e) {
    console.error("Failed to fetch employee details", e);
  }

  // If employee is inactive, revoke active session immediately
  if (session.role !== "super_admin" && (isInactive || employee?.status === "Inactive" || (employee?.status as string) === "Resigned")) {
    const res = NextResponse.json(
      { authenticated: false, error: "Account is inactive. Access revoked.", user: null },
      { status: 403 }
    );
    res.cookies.set(AUTH_COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return res;
  }

  return NextResponse.json({
    authenticated: true,
    user: session,
    employee,
  });
}
