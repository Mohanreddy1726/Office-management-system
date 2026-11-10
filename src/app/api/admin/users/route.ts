import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { AuditLog } from "@/models/AuditLog";
import { getCurrentUser } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conn = await connectToDatabase();
    if (conn) {
      const users = await User.find({})
        .select("-passwordHash")
        .sort({ createdAt: -1 });

      const mapped = users.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        employeeId: u.employeeId || "",
        branchScope: u.branch || "All",
        status: u.isActive ? "Active" : "Deactivated",
        lastActivity: u.lastLogin ? new Date(u.lastLogin).toISOString().slice(0, 16).replace("T", " ") : "—",
      }));

      return NextResponse.json({ success: true, users: mapped });
    } else {
      const store = getMockStore();
      const mapped = store.users.map((u) => ({
        id: u._id || u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        employeeId: u.employeeId || "",
        branchScope: u.branch || "All",
        status: u.isActive ? "Active" : "Deactivated",
        lastActivity: "—",
      }));
      return NextResponse.json({ success: true, users: mapped });
    }
  } catch (error: any) {
    console.error("[Users GET API Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden. Only Super Admin can manage user access." }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, role, password, branchScope, employeeId, isActive } = body;

    if (!email || !name) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const userRole = role || "employee";
    const plainPw = password || "GvkUser@123";
    const passwordHash = await bcrypt.hash(plainPw, 10);
    const branch = Array.isArray(branchScope) ? branchScope[0] : (branchScope || "Headquarters");

    const conn = await connectToDatabase();
    if (conn) {
      const existing = await User.findOne({ email: cleanEmail });
      if (existing) {
        return NextResponse.json({ error: "A user with this email address already exists." }, { status: 400 });
      }

      const created = await User.create({
        name: name.trim(),
        email: cleanEmail,
        passwordHash,
        role: userRole,
        employeeId: employeeId || undefined,
        branch,
        isActive: isActive !== false,
      });

      await AuditLog.create({
        auditId: `AU-${Date.now()}`,
        user: session.name,
        userId: session.userId,
        role: session.role,
        action: "Created User Account",
        module: "Administration",
        record: `${created.name} (${created.email}) - Role: ${created.role}`,
        outcome: "Success",
      });

      return NextResponse.json({
        success: true,
        user: {
          id: created._id.toString(),
          name: created.name,
          email: created.email,
          role: created.role,
          employeeId: created.employeeId || "",
          branchScope: created.branch,
          status: created.isActive ? "Active" : "Deactivated",
          lastActivity: "Just now",
        },
      });
    } else {
      const store = getMockStore();
      const newUser = {
        _id: `u-${Date.now()}`,
        name: name.trim(),
        email: cleanEmail,
        role: userRole,
        employeeId: employeeId || "",
        branch,
        isActive: isActive !== false,
      };
      store.users.push(newUser);
      return NextResponse.json({
        success: true,
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          employeeId: newUser.employeeId,
          branchScope: newUser.branch,
          status: "Active",
          lastActivity: "Just now",
        },
      });
    }
  } catch (error: any) {
    console.error("[Users POST API Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden. Only Super Admin can modify user access." }, { status: 403 });
    }

    const body = await req.json();
    const { id, role, status, password, name, branchScope } = body;

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const conn = await connectToDatabase();
    if (conn) {
      const user = await User.findById(id);
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Check if trying to deactivate the primary super admin
      const envSuper = (process.env.SUPERADMIN_EMAIL || "superadmin@gvkedutech.com").toLowerCase();
      if (user.email.toLowerCase() === envSuper && status === "Deactivated") {
        return NextResponse.json({ error: "Cannot deactivate the primary Super Admin account." }, { status: 400 });
      }

      const updateData: any = {};
      if (role) updateData.role = role;
      if (status !== undefined) updateData.isActive = status === "Active";
      if (name) updateData.name = name.trim();
      if (branchScope) updateData.branch = Array.isArray(branchScope) ? branchScope[0] : branchScope;
      if (password) {
        updateData.passwordHash = await bcrypt.hash(password, 10);
      }

      await User.updateOne({ _id: id }, { $set: updateData });

      await AuditLog.create({
        auditId: `AU-${Date.now()}`,
        user: session.name,
        userId: session.userId,
        role: session.role,
        action: "Updated User Account",
        module: "Administration",
        record: `${user.email} - Changes: ${Object.keys(updateData).join(", ")}`,
        outcome: "Success",
      });

      return NextResponse.json({ success: true, message: "User updated successfully" });
    } else {
      const store = getMockStore();
      const u = store.users.find((x) => (x._id || x.id) === id);
      if (u) {
        if (role) u.role = role;
        if (status !== undefined) u.isActive = status === "Active";
        if (name) u.name = name;
      }
      return NextResponse.json({ success: true, message: "User updated" });
    }
  } catch (error: any) {
    console.error("[Users PATCH API Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden. Only Super Admin can delete user accounts." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const conn = await connectToDatabase();
    if (conn) {
      const user = await User.findById(id);
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const envSuper = (process.env.SUPERADMIN_EMAIL || "superadmin@gvkedutech.com").toLowerCase();
      if (user.email.toLowerCase() === envSuper) {
        return NextResponse.json({ error: "Cannot delete the primary Super Admin account." }, { status: 400 });
      }

      await User.deleteOne({ _id: id });

      await AuditLog.create({
        auditId: `AU-${Date.now()}`,
        user: session.name,
        userId: session.userId,
        role: session.role,
        action: "Deleted User Account",
        module: "Administration",
        record: `${user.name} (${user.email})`,
        outcome: "Success",
      });

      return NextResponse.json({ success: true, message: "User account deleted successfully." });
    } else {
      const store = getMockStore();
      store.users = store.users.filter((x) => (x._id || x.id) !== id);
      return NextResponse.json({ success: true, message: "User deleted" });
    }
  } catch (error: any) {
    console.error("[Users DELETE API Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
