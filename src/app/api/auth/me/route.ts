import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Employee } from "@/models/Employee";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  let employee = null;
  if (session.employeeId) {
    try {
      await connectToDatabase();
      employee = await Employee.findOne({ employeeId: session.employeeId });
    } catch (e) {
      console.error("Failed to fetch employee details", e);
    }
  }

  return NextResponse.json({
    authenticated: true,
    user: session,
    employee,
  });
}
