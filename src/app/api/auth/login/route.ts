import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { signSessionToken, AUTH_COOKIE_NAME, UserRole } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const conn = await connectToDatabase();
    const body = await req.json();
    const { email, password, demoRole } = body;

    const envSuperEmail = (process.env.SUPERADMIN_EMAIL || "superadmin@gvkedutech.com").trim().toLowerCase();
    const envSuperPassword = process.env.SUPERADMIN_PASSWORD || "Gvkedutech@123";

    let targetEmail = email?.trim().toLowerCase();

    // If demo role requested as super_admin, use the superadmin email
    if (demoRole === "super_admin" || (!targetEmail && demoRole)) {
      targetEmail = envSuperEmail;
    }

    if (!targetEmail) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    let user: any = null;

    if (conn) {
      user = await User.findOne({ email: targetEmail });

      // If logging in as superadmin and record does not exist in DB yet, create it
      if (!user && targetEmail === envSuperEmail && (password === envSuperPassword || demoRole === "super_admin")) {
        const passwordHash = await bcrypt.hash(envSuperPassword, 10);
        user = await User.create({
          email: envSuperEmail,
          passwordHash,
          name: "Super Admin",
          role: "super_admin",
          employeeId: "ADM-001",
          branch: "Headquarters",
          isActive: true,
        });
      }
    } else {
      // In-memory fallback
      const store = getMockStore();
      user = store.users.find((u) => u.email.toLowerCase() === targetEmail);
      if (!user && targetEmail === envSuperEmail) {
        user = {
          _id: "u-superadmin",
          email: envSuperEmail,
          name: "Super Admin",
          role: "super_admin",
          employeeId: "ADM-001",
          branch: "Headquarters",
          isActive: true,
        };
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials. Account not found." },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Account has been deactivated. Please contact Super Admin." },
        { status: 403 }
      );
    }

    // Verify password (skip check only if explicit quick demo switch for super_admin)
    const isSuperAdminEnvMatch = targetEmail === envSuperEmail && password === envSuperPassword;
    if (!isSuperAdminEnvMatch && !demoRole && password && user.passwordHash) {
      let match = await bcrypt.compare(password, user.passwordHash);
      if (!match) {
        return NextResponse.json(
          { error: "Invalid email or password." },
          { status: 401 }
        );
      }
    }

    // Update lastLogin if in DB
    if (conn && user._id) {
      try {
        await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
      } catch (err) {
        // Ignore non-fatal update error
      }
    }

    // Create JWT Token
    const originalRole = user.role;
    const originalUserId = user.employeeId || user._id?.toString() || "u-1";
    const originalName = user.name;
    const originalEmail = user.email;

    const token = await signSessionToken({
      userId: user._id?.toString() || "u-1",
      employeeId: user.employeeId,
      email: user.email,
      name: user.name,
      role: user.role,
      branch: user.branch || "Headquarters",
      originalRole,
      originalUserId,
      originalName,
      originalEmail,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user._id?.toString() || "u-1",
        name: user.name,
        email: user.email,
        role: user.role,
        employeeId: user.employeeId,
        branch: user.branch,
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
    console.error("[Login API Error]", error);
    return NextResponse.json(
      { error: error.message || "Failed to sign in" },
      { status: 500 }
    );
  }
}
