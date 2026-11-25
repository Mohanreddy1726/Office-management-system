import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DocumentRecord } from "@/models/Document";
import { Employee } from "@/models/Employee";
import { AuditLog } from "@/models/AuditLog";
import { getCurrentUser } from "@/lib/auth";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const conn = await connectToDatabase();
    if (conn) {
      const isEmployee = session.role === "employee";
      const empId = session.employeeId || session.userId;

      if (isEmployee) {
        if (!empId) {
          return NextResponse.json({ success: true, documents: [], pendingCount: 0 });
        }
        // Employees see their own Approved (Verified) docs plus their own Pending/Rejected submissions for tracking
        const docs = await DocumentRecord.find({
          employeeId: empId,
          category: { $ne: "Company Policy" },
        })
          .sort({ createdAt: -1 })
          .lean();
        const pendingCount = docs.filter(
          (d: any) => d.status === "Pending" || d.status === "Pending Verification"
        ).length;
        return NextResponse.json({ success: true, documents: docs, pendingCount });
      }

      // HR / Admin / Super Admin / Manager: all employee-attached documents (no Company Policy docs)
      const docs = await DocumentRecord.find({
        employeeId: { $exists: true, $nin: [null, ""] },
        category: { $ne: "Company Policy" },
      })
        .sort({ createdAt: -1 })
        .lean();
      const pendingCount = docs.filter(
        (d: any) => d.status === "Pending" || d.status === "Pending Verification"
      ).length;
      return NextResponse.json({ success: true, documents: docs, pendingCount });
    } else {
      return NextResponse.json({ success: true, documents: [], pendingCount: 0 });
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
    const {
      title,
      category,
      fileUrl,
      fileSize,
      fileType,
      docNumber,
      confidentiality,
      issueDate,
      expiryDate,
      notes,
    } = body;

    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: "Document title is required" }, { status: 400 });
    }
    if (category === "Company Policy" || category === "Policies") {
      return NextResponse.json({ error: "Only employee documents are allowed" }, { status: 400 });
    }

    const isHrOrAdmin = session.role === "super_admin" || session.role === "hr_admin";
    const targetEmployeeId = isHrOrAdmin
      ? String(body.employeeId || "").trim()
      : String(session.employeeId || session.userId || "").trim();

    if (!targetEmployeeId || targetEmployeeId === "company") {
      return NextResponse.json({ error: "Document must be attached to an employee" }, { status: 400 });
    }

    const conn = await connectToDatabase();
    if (conn) {
      const emp = await Employee.findOne({ employeeId: targetEmployeeId }, "employeeId name").lean();
      if (!emp && isHrOrAdmin) {
        return NextResponse.json({ error: `Employee ${targetEmployeeId} not found` }, { status: 404 });
      }

      const count = await DocumentRecord.countDocuments();
      const docId = `DOC-${String(count + 1).padStart(3, "0")}-${Date.now().toString().slice(-4)}`;

      // HR / Super Admin uploads are automatically Verified; employee uploads require HR / Super Admin approval
      const status = isHrOrAdmin ? "Verified" : "Pending";

      const doc = await DocumentRecord.create({
        docId,
        title: String(title).trim(),
        category: category || "Identity",
        fileUrl: fileUrl || "",
        fileSize: fileSize || "—",
        fileType: fileType || "",
        docNumber: docNumber || undefined,
        confidentiality: confidentiality || "Internal",
        issueDate: issueDate || undefined,
        expiryDate: expiryDate || undefined,
        notes: notes || undefined,
        employeeId: targetEmployeeId,
        employeeName: emp?.name || session.name,
        uploadedBy: session.name,
        status,
        ...(isHrOrAdmin ? { verifiedBy: session.name, verifiedAt: new Date() } : {}),
      });

      try {
        await AuditLog.create({
          auditId: `AU-${Date.now()}`,
          user: session.name,
          userId: session.userId,
          role: session.role,
          action: isHrOrAdmin ? "Uploaded Employee Document (Verified)" : "Submitted Document for Approval",
          module: "Documents",
          record: `${title} (${targetEmployeeId})`,
          outcome: "Success",
        });
      } catch {}

      return NextResponse.json({ success: true, document: doc });
    } else {
      const newDoc = {
        _id: `doc-${Date.now()}`,
        docId: `DOC-${Date.now().toString().slice(-3)}`,
        title,
        category,
        fileUrl: fileUrl || "",
        fileSize: fileSize || "—",
        fileType: fileType || "",
        employeeId: targetEmployeeId,
        employeeName: session.name,
        uploadedBy: session.name,
        expiryDate,
        status: isHrOrAdmin ? "Verified" : "Pending",
      };
      return NextResponse.json({ success: true, document: newDoc });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (session.role !== "super_admin" && session.role !== "hr_admin") {
      return NextResponse.json({ error: "Only HR Admin or Super Admin can approve or reject documents." }, { status: 403 });
    }

    const body = await req.json();
    const { docId, action } = body;
    if (!docId) return NextResponse.json({ error: "docId is required" }, { status: 400 });

    const nextStatus = action === "verify" || action === "approve" ? "Verified" : "Rejected";

    const conn = await connectToDatabase();
    if (conn) {
      const doc = await DocumentRecord.findOne({
        $or: [
          { docId },
          { _id: mongoose.Types.ObjectId.isValid(docId) ? docId : null },
        ],
      });
      if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
      doc.status = nextStatus;
      doc.verifiedBy = session.name;
      doc.verifiedAt = new Date();
      await doc.save();

      try {
        await AuditLog.create({
          auditId: `AU-${Date.now()}`,
          user: session.name,
          userId: session.userId,
          role: session.role,
          action: `Document ${nextStatus}`,
          module: "Documents",
          record: `${doc.title} (${doc.employeeId || ""})`,
          outcome: "Success",
        });
      } catch {}

      return NextResponse.json({ success: true, document: doc });
    } else {
      return NextResponse.json({ success: true, document: { docId, status: nextStatus } });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
