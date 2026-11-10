import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { MailLog } from "@/models/MailLog";
import { getCurrentUser } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { direction, channel, sender, recipient, subject, department, priority, trackingNumber } = body;
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
        trackingNumber,
        status: direction === "Incoming" ? "Received" : "Dispatched",
        timeline: [{ at: new Date(), event: "Logged", by: session.name }],
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
        trackingNumber,
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
