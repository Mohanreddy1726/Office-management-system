import { DocumentRecord } from "@/models/Document";
import { Notification } from "@/models/Notification";
import { AuditLog } from "@/models/AuditLog";
import {
  ONBOARDING_LETTER_META,
  type OnboardingLetterType,
  buildLetterPayloadFromEmployee,
  encodeHtmlDataUrl,
  renderOnboardingLetterHtml,
} from "@/lib/letter-templates";

const LETTER_ORDER: OnboardingLetterType[] = ["loi", "offer", "appointment"];

/**
 * Auto-generates Letter of Intent, Offer Letter, and Appointment Letter
 * for a newly added (or existing) employee if not already attached.
 */
export async function ensureOnboardingLettersForEmployee(
  emp: any,
  issuedBy = "HR / Super Admin",
  actorUserId?: string,
  actorRole?: string
): Promise<{ created: number; documents: any[] }> {
  if (!emp?.employeeId) return { created: 0, documents: [] };

  const existing = await DocumentRecord.find(
    {
      employeeId: emp.employeeId,
      letterType: { $in: LETTER_ORDER },
    },
    "letterType"
  ).lean();
  const existingTypes = new Set(existing.map((d: any) => d.letterType));

  const payload = buildLetterPayloadFromEmployee(emp, issuedBy);
  const createdDocs: any[] = [];

  for (const letterType of LETTER_ORDER) {
    if (existingTypes.has(letterType)) continue;
    const meta = ONBOARDING_LETTER_META[letterType];
    const html = renderOnboardingLetterHtml(letterType, payload, { accepted: false });
    const byteLen = Buffer.byteLength(html, "utf8");
    const sizeLabel = `${Math.max(1, Math.round(byteLen / 1024))} KB`;
    const docId = `DOC-${letterType.toUpperCase()}-${emp.employeeId}`;

    const doc = await DocumentRecord.create({
      docId,
      title: meta.title,
      category: meta.category,
      confidentiality: meta.confidentiality,
      fileUrl: encodeHtmlDataUrl(html),
      fileSize: sizeLabel,
      fileType: "text/html",
      issueDate: payload.issueDate,
      employeeId: emp.employeeId,
      employeeName: emp.name,
      uploadedBy: issuedBy,
      status: "Pending Acceptance",
      acceptanceStatus: "Pending",
      letterType,
      letterData: payload,
      version: 1,
      systemGenerated: true,
      notes: `${meta.description} · Awaiting employee review & Terms & Conditions acceptance.`,
    });

    createdDocs.push(doc);
  }

  if (createdDocs.length > 0) {
    try {
      await Notification.create({
        title: `${createdDocs.length} Employment Letter${createdDocs.length === 1 ? "" : "s"} Ready — Review & Accept T&Cs`,
        description: `Your personalized ${createdDocs.map((d) => d.title).join(", ")} ${createdDocs.length === 1 ? "has" : "have"} been generated. Review each letter one at a time and agree to all Terms & Conditions.`,
        category: "Documents",
        type: "info",
        priority: "High",
        link: "/documents?tab=pending",
        targetUserId: emp.employeeId,
        targetRole: "employee",
        read: false,
        readBy: [],
        timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
      });
    } catch {}

    try {
      await AuditLog.create({
        auditId: `AU-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        user: issuedBy,
        userId: actorUserId || "ADM-001",
        role: actorRole || "super_admin",
        action: "Auto-Generated Employee Onboarding Letters",
        module: "Documents",
        record: `${emp.employeeId} - ${emp.name} (${createdDocs.map((d) => d.title).join(", ")})`,
        outcome: "Success",
      });
    } catch {}
  }

  return { created: createdDocs.length, documents: createdDocs };
}
