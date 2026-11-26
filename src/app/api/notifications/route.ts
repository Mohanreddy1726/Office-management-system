import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { Employee } from "@/models/Employee";
import { getCurrentUser } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";
import { ANNOUNCEMENTS, NOTIFICATIONS } from "@/lib/data/seed";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

let announcementsSeededChecked = false;

function extractUserKeys(session: any, req: NextRequest): string[] {
  return Array.from(
    new Set(
      [session?.userId, session?.employeeId, req.headers.get("x-user-id")]
        .filter(Boolean)
        .map((x) => String(x).trim())
    )
  );
}

function getNotifSortEpoch(n: any): number {
  const candidates = [n.createdAt, n.timestamp, n.publishAt];
  for (const c of candidates) {
    if (!c) continue;
    const ms = new Date(typeof c === "string" && c.includes(" ") && !c.includes("T") ? c.replace(" ", "T") : c).getTime();
    if (!Number.isNaN(ms)) return ms;
  }
  return 0;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    const roleHeader = req.headers.get("x-user-role");
    const role = session?.role || roleHeader || "employee";
    const userEmpId = session?.employeeId || session?.userId || req.headers.get("x-user-id") || "";
    const userKeys = extractUserKeys(session, req);
    let userBranch = session?.branch || req.headers.get("x-user-branch") || "Headquarters";
    let userDept = req.headers.get("x-user-department") || "";

    const isSuperOrHR = role === "super_admin" || role === "hr_admin";

    const conn = await connectToDatabase();
    if (conn) {
      // Auto-seed default company announcements once per server lifecycle if none exist
      if (!announcementsSeededChecked) {
        try {
          const annCount = await Notification.countDocuments({ isAnnouncement: true });
          if (annCount === 0 && Array.isArray(ANNOUNCEMENTS) && ANNOUNCEMENTS.length > 0) {
            for (const a of ANNOUNCEMENTS) {
              await Notification.create({
                id: a.id,
                title: a.title,
                message: a.message,
                description: a.message,
                category: "Announcements",
                type: a.priority === "High" ? "warning" : "info",
                priority: a.priority || "Normal",
                audience: a.audience || "All Employees",
                scope: a.scope,
                targetRole: a.audience === "Managers Only" ? "manager" : "all",
                targetBranch: a.audience === "Selected Branches" ? a.scope : undefined,
                targetDepartment: a.audience === "Selected Departments" ? a.scope : undefined,
                isAnnouncement: true,
                publishAt: a.publishAt,
                expiresAt: a.expiresAt || "",
                read: false,
                readBy: [],
                timestamp: `${a.publishAt} 09:00`,
              });
            }
          }
          announcementsSeededChecked = true;
        } catch (seedErr) {
          console.warn("[Notifications] Auto-seed failed:", seedErr);
        }
      }

      // Look up employee record for department / branch matching if not directly provided
      if (userEmpId && (!userDept || userBranch === "Headquarters")) {
        try {
          const emp = await Employee.findOne(
            {
              $or: [{ employeeId: userEmpId }, { email: session?.email?.toLowerCase().trim() }],
            },
            "branch department"
          ).lean();
          if (emp) {
            userBranch = emp.branch || userBranch;
            userDept = emp.department || userDept;
          }
        } catch {}
      }

      const allNotifs = await Notification.find().sort({ createdAt: -1 }).lean();

      const visible = allNotifs
        .filter((n: any) => {
          if (isSuperOrHR) return true;

          if (n.isAnnouncement) {
            const aud = (n.audience || "All Employees").toLowerCase().trim();
            if (aud === "all employees" || aud === "all" || !aud) return true;
            if (aud === "managers only") return role === "manager" || isSuperOrHR;
            if (aud.includes("branch")) {
              const scope = (n.scope || n.targetBranch || "").toLowerCase().trim();
              if (!scope) return true;
              return userBranch.toLowerCase().includes(scope) || scope.includes(userBranch.toLowerCase());
            }
            if (aud.includes("department") || aud.includes("dept")) {
              const scope = (n.scope || n.targetDepartment || "").toLowerCase().trim();
              if (!scope) return true;
              return userDept.toLowerCase().includes(scope) || scope.includes(userDept.toLowerCase());
            }
            return true;
          }

          // Standard notifications
          if (n.targetUserId && (n.targetUserId === userEmpId || (session && n.targetUserId === session.userId))) {
            return true;
          }
          if (n.targetRole && (n.targetRole === "all" || n.targetRole === role)) {
            return true;
          }
          if (!n.targetUserId && !n.targetRole) return true;
          return false;
        })
        .map((n: any) => {
          const isReadForUser = Array.isArray(n.readBy)
            ? userKeys.some((uk) => n.readBy.includes(uk))
            : Boolean(n.read);
          return {
            ...n,
            read: isReadForUser,
          };
        })
        .sort((a: any, b: any) => getNotifSortEpoch(b) - getNotifSortEpoch(a));

      const announcementsList = visible.filter((n: any) => n.isAnnouncement);
      const notificationsList = visible.filter((n: any) => !n.isAnnouncement);

      return NextResponse.json({
        success: true,
        notifications: visible,
        announcementsList,
        notificationsList,
      });
    } else {
      // In-memory fallback
      const store = getMockStore();
      if (!store.announcements || store.announcements.length === 0) {
        store.announcements = [...ANNOUNCEMENTS];
      }
      if (!store.notifications || store.notifications.length === 0) {
        store.notifications = [...NOTIFICATIONS];
      }

      const allAnns = store.announcements || [];
      const visibleAnns = isSuperOrHR
        ? allAnns
        : allAnns.filter((ann: any) => {
            const aud = (ann.audience || "All Employees").toLowerCase().trim();
            if (aud === "all employees" || aud === "all" || !aud) return true;
            if (aud === "managers only") return role === "manager";
            if (aud.includes("branch")) {
              const scope = (ann.scope || "").toLowerCase().trim();
              return !scope || userBranch.toLowerCase().includes(scope) || scope.includes(userBranch.toLowerCase());
            }
            if (aud.includes("department") || aud.includes("dept")) {
              const scope = (ann.scope || "").toLowerCase().trim();
              return !scope || userDept.toLowerCase().includes(scope) || scope.includes(userDept.toLowerCase());
            }
            return true;
          });

      const allNotifs = store.notifications || [];
      return NextResponse.json({
        success: true,
        notifications: [...visibleAnns, ...allNotifs],
        announcementsList: visibleAnns,
        notificationsList: allNotifs,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    const roleHeader = req.headers.get("x-user-role");
    const role = session?.role || roleHeader;

    // Permit Super Admin, HR Admin, or local demo execution
    if (role && role !== "super_admin" && role !== "hr_admin") {
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
      const id = isAnnouncement
        ? (body.id || `AN-${Date.now()}`)
        : (body.id || `NT-${Date.now()}`);

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
        readBy: session?.userId ? [session.userId] : [],
        timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
      });

      return NextResponse.json({ success: true, notification: notif });
    } else {
      const store = getMockStore();
      const notif = {
        _id: `notif-${Date.now()}`,
        id: isAnnouncement ? (body.id || `AN-${Date.now()}`) : (body.id || `NT-${Date.now()}`),
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
    const roleHeader = req.headers.get("x-user-role");
    const role = session?.role || roleHeader;

    if (role && role !== "super_admin" && role !== "hr_admin") {
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
      await Notification.deleteMany({
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
    const userKeys = extractUserKeys(session, req);
    if (userKeys.length === 0) userKeys.push("anonymous");

    const body = await req.json();
    const { id, markAllRead } = body;

    const conn = await connectToDatabase();
    if (conn) {
      if (markAllRead) {
        await Notification.updateMany({}, { $addToSet: { readBy: { $each: userKeys } } });
      } else if (id) {
        const rawId = String(id).replace(/^NT-ANN-/, "");
        await Notification.updateOne(
          {
            $or: [
              { id: String(id) },
              { id: rawId },
              ...(mongoose.Types.ObjectId.isValid(rawId) ? [{ _id: rawId }] : []),
            ],
          },
          { $addToSet: { readBy: { $each: userKeys } } }
        );
      }
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
