import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DocumentRecord } from "@/models/Document";
import { Employee } from "@/models/Employee";
import { Notification } from "@/models/Notification";
import { AuditLog } from "@/models/AuditLog";
import { getCurrentUser } from "@/lib/auth";
import { ensureOnboardingLettersForEmployee } from "@/lib/onboarding-letters";
import {
  buildLetterPayloadFromEmployee,
  encodeHtmlDataUrl,
  renderOnboardingLetterHtml,
  type OnboardingLetterType,
} from "@/lib/letter-templates";
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
          (d: any) =>
            d.status === "Pending" ||
            d.status === "Pending Verification" ||
            d.status === "Pending Acceptance"
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

    // HR / Super Admin action: auto-generate missing onboarding letters for an existing employee
    if (body?.action === "generate_onboarding_letters") {
      if (session.role !== "super_admin" && session.role !== "hr_admin") {
        return NextResponse.json({ error: "Only HR Admin or Super Admin can generate onboarding letters." }, { status: 403 });
      }
      const empId = String(body.employeeId || "").trim();
      if (!empId) return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
      const conn = await connectToDatabase();
      if (!conn) return NextResponse.json({ error: "Database connection required" }, { status: 503 });
      const emp = await Employee.findOne({ employeeId: empId }).lean();
      if (!emp) return NextResponse.json({ error: `Employee ${empId} not found` }, { status: 404 });
      const res = await ensureOnboardingLettersForEmployee(emp, session.name || "HR / Super Admin", session.userId, session.role);
      return NextResponse.json({ success: true, created: res.created, documents: res.documents });
    }

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

    const body = await req.json();
    const { docId, action, agreedToAllTerms, signatureName } = body;
    if (!docId) return NextResponse.json({ error: "docId is required" }, { status: 400 });

    const conn = await connectToDatabase();

    // Employee action: Review & Accept Terms & Conditions on an auto-generated onboarding letter
    if (action === "accept_letter") {
      if (!agreedToAllTerms) {
        return NextResponse.json(
          { error: "You must review and agree to all Terms & Conditions before confirming this document." },
          { status: 400 }
        );
      }
      if (!conn) {
        return NextResponse.json({ error: "Database connection required" }, { status: 503 });
      }

      const doc: any = await DocumentRecord.findOne({
        $or: [
          { docId },
          { _id: mongoose.Types.ObjectId.isValid(docId) ? docId : null },
        ],
      });
      if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

      const callerEmpId = session.employeeId || session.userId;
      if (doc.employeeId !== callerEmpId) {
        return NextResponse.json(
          { error: "Only the assigned employee can accept Terms & Conditions for this letter from their portal." },
          { status: 403 }
        );
      }

      if (!["loi", "offer", "appointment"].includes(doc.letterType || "")) {
        return NextResponse.json({ error: "This document is not an onboarding letter requiring T&C acceptance." }, { status: 400 });
      }

      if (doc.status === "Verified" && doc.acceptanceStatus === "Accepted") {
        return NextResponse.json({ error: "This letter has already been accepted and finalized." }, { status: 400 });
      }

      const emp = await Employee.findOne({ employeeId: doc.employeeId }).lean();
      const payload =
        doc.letterData && typeof doc.letterData === "object" && doc.letterData.name
          ? doc.letterData
          : buildLetterPayloadFromEmployee(
              emp || { employeeId: doc.employeeId, name: doc.employeeName || session.name },
              doc.uploadedBy || "HR / Super Admin"
            );

      const acceptedBy = String(signatureName || session.name || emp?.name || doc.employeeName || callerEmpId).trim();
      const acceptedAtDate = new Date();
      const acceptedAtDisplay = acceptedAtDate.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      const finalHtml = renderOnboardingLetterHtml(
        doc.letterType as OnboardingLetterType,
        payload,
        {
          accepted: true,
          acceptedBy,
          acceptedAt: acceptedAtDisplay,
          issuedBy: doc.uploadedBy || payload.issuedBy || "HR / Super Admin",
          docId: doc.docId,
        }
      );

      const byteLen = Buffer.byteLength(finalHtml, "utf8");
      doc.fileUrl = encodeHtmlDataUrl(finalHtml);
      doc.fileType = "text/html";
      doc.fileSize = `${Math.max(1, Math.round(byteLen / 1024))} KB`;
      doc.status = "Verified";
      doc.acceptanceStatus = "Accepted";
      doc.acceptedBy = acceptedBy;
      doc.acceptedAt = acceptedAtDate;
      doc.verifiedBy = "System (Digital T&C Acceptance)";
      doc.verifiedAt = acceptedAtDate;
      doc.version = Number(doc.version || 1) + 1;
      doc.systemGenerated = true;
      doc.notes = `Digitally approved & accepted by ${acceptedBy} on ${acceptedAtDisplay}. Replaced with final system-generated letter (signatures not required).`;
      await doc.save();

      try {
        await AuditLog.create({
          auditId: `AU-${Date.now()}`,
          user: acceptedBy,
          userId: session.userId,
          role: session.role,
          action: "Accepted T&Cs & Finalized Onboarding Letter",
          module: "Documents",
          record: `${doc.title} (${doc.employeeId})`,
          outcome: "Success",
          details: `Replaced draft with system-generated final letter without signatures (${doc.docId})`,
        });
      } catch {}

      try {
        await Notification.create({
          title: `${doc.title} Approved by ${doc.employeeName || acceptedBy}`,
          description: `${doc.employeeName || acceptedBy} (${doc.employeeId}) agreed to all Terms & Conditions. Final system-generated ${doc.title} has been issued without physical signatures.`,
          category: "Documents",
          type: "success",
          priority: "Normal",
          link: "/documents",
          targetRole: "hr_admin",
          read: false,
          readBy: [],
          timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
        });
      } catch {}

      const remainingPendingLetters = await DocumentRecord.countDocuments({
        employeeId: doc.employeeId,
        status: "Pending Acceptance",
      });

      return NextResponse.json({
        success: true,
        document: doc,
        remainingPendingLetters,
      });
    }

    if (session.role !== "super_admin" && session.role !== "hr_admin") {
      return NextResponse.json({ error: "Only HR Admin or Super Admin can approve or reject documents." }, { status: 403 });
    }

    const nextStatus = action === "verify" || action === "approve" ? "Verified" : "Rejected";

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
