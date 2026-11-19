import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { MailLog } from "@/models/MailLog";
import { getCurrentUser } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    const roleHeader = req.headers.get("x-user-role");
    const role = session?.role || (roleHeader === "super_admin" || roleHeader === "hr_admin" ? roleHeader : null);
    if (!session && !role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const conn = await connectToDatabase();
    if (conn) {
      const logs = await MailLog.find().sort({ createdAt: -1 });
      return NextResponse.json({ success: true, logs });
    } else {
      const store = getMockStore();
      return NextResponse.json({ success: true, logs: store.mails });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    const roleHeader = req.headers.get("x-user-role");
    const role = session?.role || (roleHeader === "super_admin" || roleHeader === "hr_admin" ? roleHeader : null);
    if (!session && !role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      direction = "Incoming",
      channel = "Physical Courier",
      sender,
      recipient,
      subject,
      department = "Operations",
      priority = "Normal",
      trackingNumber,
      trackingNo,
      notes,
      ownerId,
      ownerName,
      followUpAt,
      followUpDate,
    } = body;

    if (!sender || !recipient || !subject) {
      return NextResponse.json({ error: "Sender, recipient, and subject are required" }, { status: 400 });
    }

    const year = new Date().getFullYear();
    const prefix = direction === "Incoming" ? "IN" : "OUT";

    const conn = await connectToDatabase();
    if (conn) {
      const count = await MailLog.countDocuments();
      const refNo = `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;
      const mail = await MailLog.create({
        refNo,
        direction,
        channel: channel || "Physical Courier",
        sender,
        recipient,
        subject,
        department: department || "Operations",
        priority: priority || "Normal",
        trackingNumber: trackingNumber || trackingNo || "",
        ownerId: ownerId || "OF-1001",
        ownerName: ownerName || session?.name || "Admin",
        followUpDate: followUpDate || followUpAt || "",
        status: direction === "Incoming" ? "Received" : "Dispatched",
        timeline: [
          {
            at: new Date(),
            event: direction === "Incoming" ? "Received and registered" : "Dispatched and logged",
            by: session?.name || "Admin",
          },
        ],
      });
      return NextResponse.json({ success: true, mail });
    } else {
      const store = getMockStore();
      const refNo = `${prefix}-${year}-${String(store.mails.length + 1).padStart(4, "0")}`;
      const newMail = {
        _id: `ml-${Date.now()}`,
        refNo,
        direction,
        channel: channel || "Physical Courier",
        sender,
        recipient,
        subject,
        department: department || "Operations",
        priority: priority || "Normal",
        trackingNumber: trackingNumber || trackingNo || "",
        status: direction === "Incoming" ? "Received" : "Dispatched",
        createdAt: new Date(),
      };
      store.mails.unshift(newMail);
      return NextResponse.json({ success: true, mail: newMail });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    const roleHeader = req.headers.get("x-user-role");
    const role = session?.role || (roleHeader === "super_admin" || roleHeader === "hr_admin" ? roleHeader : null);
    if (!session && !role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, patch, event } = body;
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    const conn = await connectToDatabase();
    if (conn) {
      const mail = await MailLog.findOne({
        $or: [{ _id: mongoose.Types.ObjectId.isValid(id) ? id : null }, { refNo: id }],
      });
      if (!mail) return NextResponse.json({ error: "Mail not found" }, { status: 404 });

      if (patch) {
        if (patch.status) mail.status = patch.status;
        if (patch.priority) mail.priority = patch.priority;
        if (patch.trackingNo || patch.trackingNumber) {
          mail.trackingNumber = patch.trackingNo || patch.trackingNumber;
        }
        if (patch.followUpAt || patch.followUpDate) {
          mail.followUpDate = patch.followUpAt || patch.followUpDate;
        }
      }

      if (event) {
        mail.timeline.push({
          at: new Date(),
          event,
          by: session?.name || "Admin",
        });
      }

      await mail.save();
      return NextResponse.json({ success: true, mail });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    const roleHeader = req.headers.get("x-user-role");
    const role = session?.role || (roleHeader === "super_admin" || roleHeader === "hr_admin" ? roleHeader : null);
    if (!session && !role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    const conn = await connectToDatabase();
    if (conn) {
      await MailLog.deleteOne({
        $or: [{ _id: mongoose.Types.ObjectId.isValid(id) ? id : null }, { refNo: id }],
      });
      return NextResponse.json({ success: true, message: "Mail log deleted" });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
