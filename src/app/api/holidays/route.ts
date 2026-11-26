import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Holiday } from "@/models/Holiday";
import { Notification } from "@/models/Notification";
import { AuditLog } from "@/models/AuditLog";
import { getCurrentUser } from "@/lib/auth";
import { HOLIDAYS } from "@/lib/data/seed";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

let holidaysSeededChecked = false;

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const conn = await connectToDatabase();
    if (conn) {
      if (!holidaysSeededChecked) {
        try {
          const count = await Holiday.countDocuments();
          if (count === 0 && Array.isArray(HOLIDAYS) && HOLIDAYS.length > 0) {
            await Holiday.insertMany(
              HOLIDAYS.map((h) => ({
                holidayId: h.id,
                name: h.name,
                date: h.date,
                type: "Public",
                branches: h.branches,
                createdBy: "System",
              })),
              { ordered: false }
            ).catch(() => {});
          }
          holidaysSeededChecked = true;
        } catch {}
      }

      const holidays = await Holiday.find().sort({ date: 1 }).lean();
      return NextResponse.json({ success: true, holidays });
    } else {
      return NextResponse.json({
        success: true,
        holidays: HOLIDAYS.map((h) => ({ ...h, holidayId: h.id, type: "Public" })),
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (session.role !== "super_admin" && session.role !== "hr_admin") {
      return NextResponse.json(
        { error: "Only Super Admin or HR Admin can add holidays." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const name = String(body.name || "").trim();
    const date = String(body.date || "").trim();
    const type = String(body.type || "Public").trim();
    const description = body.description ? String(body.description).trim() : undefined;
    const branches =
      body.branches === "All" || !Array.isArray(body.branches) || body.branches.length === 0
        ? "All"
        : body.branches;

    if (!name || !date) {
      return NextResponse.json({ error: "Holiday name and date are required." }, { status: 400 });
    }

    const conn = await connectToDatabase();
    if (conn) {
      const count = await Holiday.countDocuments();
      const holidayId = `HOL-${String(count + 1).padStart(2, "0")}-${Date.now().toString().slice(-4)}`;

      const holiday = await Holiday.create({
        holidayId,
        name,
        date,
        type,
        branches,
        description,
        createdBy: session.name,
      });

      await Notification.create({
        id: `NT-HOL-${Date.now()}`,
        title: `Holiday Added: ${name}`,
        message: `${name} on ${date} (${branches === "All" ? "All Branches" : branches.join(", ")}) has been added to the official holiday calendar.`,
        description: `${name} on ${date} (${branches === "All" ? "All Branches" : branches.join(", ")}) has been added to the official holiday calendar.`,
        category: "Announcements",
        type: "info",
        priority: "Normal",
        targetRole: "all",
        link: "/holidays",
        read: false,
        readBy: [],
        timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
      }).catch(() => {});

      await AuditLog.create({
        auditId: `AU-${Date.now()}`,
        user: session.name,
        userId: session.userId,
        role: session.role,
        action: "Added Company Holiday",
        module: "Holidays",
        record: `${name} (${date})`,
        outcome: "Success",
      }).catch(() => {});

      return NextResponse.json({ success: true, holiday });
    } else {
      const holiday = {
        _id: `hol-${Date.now()}`,
        holidayId: `HOL-${Date.now().toString().slice(-3)}`,
        name,
        date,
        type,
        branches,
        description,
      };
      return NextResponse.json({ success: true, holiday });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (session.role !== "super_admin" && session.role !== "hr_admin") {
      return NextResponse.json(
        { error: "Only Super Admin or HR Admin can remove holidays." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Holiday ID is required." }, { status: 400 });
    }

    const conn = await connectToDatabase();
    if (conn) {
      const deleted = await Holiday.findOneAndDelete({
        $or: [
          { holidayId: id },
          ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: id }] : []),
        ],
      });

      if (deleted) {
        await AuditLog.create({
          auditId: `AU-${Date.now()}`,
          user: session.name,
          userId: session.userId,
          role: session.role,
          action: "Deleted Company Holiday",
          module: "Holidays",
          record: `${deleted.name} (${deleted.date})`,
          outcome: "Success",
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
