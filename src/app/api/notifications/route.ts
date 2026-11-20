import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { Employee } from "@/models/Employee";
import { getCurrentUser } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";
import mongoose from "mongoose";

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const conn = await connectToDatabase();
    if (conn) {
      const allNotifs = await Notification.find().sort({ createdAt: -1 });

      const isSuperOrHR = session.role === "super_admin" || session.role === "hr_admin";
      const userEmpId = session.employeeId || session.userId;

      // Look up employee record for department / branch matching
      let userBranch = session.branch || "Headquarters";
      let userDept = "";
      if (userEmpId) {
        const emp = await Employee.findOne({
          $or: [{ employeeId: userEmpId }, { email: session.email?.toLowerCase().trim() }],
        });
        if (emp) {
          userBranch = emp.branch || userBranch;
          userDept = emp.department || "";
        }
      }

      const visible = allNotifs.filter((n: any) => {
        if (isSuperOrHR) return true;

        if (n.isAnnouncement) {
          const aud = n.audience || "All Employees";
          if (aud === "All Employees" || aud === "all") return true;
          if (aud === "Managers Only") return session.role === "manager";
          if (aud === "Selected Branches") {
            const scope = (n.scope || n.targetBranch || "").toLowerCase().trim();
            return !scope || scope === userBranch.toLowerCase().trim();
          }
          if (aud === "Selected Departments") {
            const scope = (n.scope || n.targetDepartment || "").toLowerCase().trim();
            return !scope || scope === userDept.toLowerCase().trim();
          }
          return true;
        }

        // Standard notification
        if (n.targetUserId && (n.targetUserId === userEmpId || n.targetUserId === session.userId)) {
          return true;
        }
        if (n.targetRole && (n.targetRole === "all" || n.targetRole === session.role)) {
          return true;
        }
        if (!n.targetUserId && !n.targetRole) return true;
        return false;
      });

      const announcementsList = visible.filter((n: any) => n.isAnnouncement);
      const notificationsList = visible.filter((n: any) => !n.isAnnouncement);

      return NextResponse.json({
        success: true,
        notifications: visible,
        announcementsList,
        notificationsList,
      });
    } else {
      const store = getMockStore();
      const all = store.notifications || [];
      return NextResponse.json({
        success: true,
        notifications: all,
        announcementsList: store.announcements || [],
        notificationsList: all,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session || (session.role !== "super_admin" && session.role !== "hr_admin")) {
      return NextResponse.json({ error: "Forbidden. Admin privileges required." }, { status: 403 });
    }

    const body = await req.json();
    const {
      title,
      message,
      description,
      audience,
      scope,
      priority,
      publishAt,
      expiresAt,
      isAnnouncement,
      type,
      category,
      link,
      targetRole,
      targetUserId,
    } = body;

    if (!title || (!message && !description)) {
      return NextResponse.json({ error: "Title and message are required" }, { status: 400 });
    }

    const conn = await connectToDatabase();
    if (conn) {
      const id = isAnnouncement ? `AN-${Date.now()}` : `NT-${Date.now()}`;
      const notif = await Notification.create({
        id,
        title,
        message: message || description,
        description: description || message,
        category: category || (isAnnouncement ? "Announcements" : "System"),
        type: type || (priority === "High" ? "warning" : "info"),
        priority: priority || "Normal",
        audience: audience || "All Employees",
        scope: scope || undefined,
        targetRole: targetRole || (audience === "Managers Only" ? "manager" : "all"),
        targetBranch: audience === "Selected Branches" ? scope : undefined,
        targetDepartment: audience === "Selected Departments" ? scope : undefined,
        targetUserId: targetUserId || undefined,
        isAnnouncement: Boolean(isAnnouncement),
        publishAt: publishAt || new Date().toISOString().slice(0, 10),
        expiresAt: expiresAt || "",
        link: link || "/notifications",
        read: false,
        readBy: [session.userId],
        timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
      });

      return NextResponse.json({ success: true, notification: notif });
    } else {
      const store = getMockStore();
      const notif = {
        _id: `notif-${Date.now()}`,
        id: isAnnouncement ? `AN-${Date.now()}` : `NT-${Date.now()}`,
        title,
        message: message || description,
        description: description || message,
        category: category || (isAnnouncement ? "Announcements" : "System"),
        priority: priority || "Normal",
        audience: audience || "All Employees",
        scope,
        isAnnouncement: Boolean(isAnnouncement),
        publishAt: publishAt || new Date().toISOString().slice(0, 10),
        expiresAt: expiresAt || "",
        createdAt: new Date(),
      };
      if (isAnnouncement) {
        if (!store.announcements) store.announcements = [];
        store.announcements.unshift(notif);
      } else {
        if (!store.notifications) store.notifications = [];
        store.notifications.unshift(notif);
      }
      return NextResponse.json({ success: true, notification: notif });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session || (session.role !== "super_admin" && session.role !== "hr_admin")) {
      return NextResponse.json({ error: "Forbidden. Admin privileges required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");
    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ error: "Notification/Announcement ID is required" }, { status: 400 });
    }

    const conn = await connectToDatabase();
    if (conn) {
      await Notification.deleteOne({
        $or: [
          { id },
          { _id: mongoose.Types.ObjectId.isValid(id) ? id : null },
        ],
      });
      return NextResponse.json({ success: true, message: "Deleted successfully" });
    } else {
      const store = getMockStore();
      if (store.notifications) {
        store.notifications = store.notifications.filter((n: any) => n.id !== id && n._id !== id);
      }
      if (store.announcements) {
        store.announcements = store.announcements.filter((a: any) => a.id !== id && a._id !== id);
      }
      return NextResponse.json({ success: true, message: "Deleted from store" });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, markAllRead } = body;

    const conn = await connectToDatabase();
    if (conn) {
      if (markAllRead) {
        await Notification.updateMany({}, { $addToSet: { readBy: session.userId } });
      } else if (id) {
        await Notification.updateOne(
          { $or: [{ id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }] },
          { $addToSet: { readBy: session.userId }, $set: { read: true } }
        );
      }
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
