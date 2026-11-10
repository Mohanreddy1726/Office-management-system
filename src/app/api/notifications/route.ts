import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { getCurrentUser } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const conn = await connectToDatabase();
    if (conn) {
      const notifs = await Notification.find().sort({ createdAt: -1 });
      return NextResponse.json({ success: true, notifications: notifs });
    } else {
      const store = getMockStore();
      return NextResponse.json({ success: true, notifications: store.notifications });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session || (session.role !== "super_admin" && session.role !== "hr_admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { title, message, type } = body;

    const conn = await connectToDatabase();
    if (conn) {
      const notif = await Notification.create({
        title,
        message,
        type: type || "info",
        targetRole: "all",
        isAnnouncement: true,
        readBy: [session.userId],
      });
      return NextResponse.json({ success: true, notification: notif });
    } else {
      const store = getMockStore();
      const notif = {
        _id: `notif-${Date.now()}`,
        title,
        message,
        type: type || "info",
        isAnnouncement: true,
        createdAt: new Date(),
      };
      store.notifications.unshift(notif);
      return NextResponse.json({ success: true, notification: notif });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
