"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Download,
  Eye,
  Search,
  Clock,
  FolderOpen,
  Award,
  CreditCard,
  Briefcase,
  LayoutGrid,
  List,
  ExternalLink,
  FileUp,
  UserCheck,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/data/store";
import type { DocumentRecord } from "@/lib/data/types";
import {
  PageHeader,
  KpiCard,
  StatusBadge,
  Toolbar,
  TabsShell,
  EmptyState,
  Field,
} from "@/components/shared";
import { Person, Sel, Stat, useScope, useNames } from "@/components/form-bits";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CategoryMeta = {
  value: string;
  label: string;
  icon: typeof FileText;
  description: string;
  color: string;
};

const DOCUMENT_CATEGORIES: CategoryMeta[] = [
  {
    value: "Identity",
    label: "Identity & KYC",
    icon: CreditCard,
    description: "Passport, Aadhaar, PAN & ID cards",
    color: "text-blue-600 bg-blue-500/10 border-blue-200 dark:border-blue-800",
  },
  {
    value: "Contracts",
    label: "Contracts & Letters",
    icon: Briefcase,
    description: "Offer letters, NDAs & agreements",
    color: "text-emerald-600 bg-emerald-500/10 border-emerald-200 dark:border-emerald-800",
  },
  {
    value: "Payroll & Tax",
    label: "Payroll & Tax",
    icon: ShieldCheck,
    description: "Form 16, PF nomination & bank proofs",
    color: "text-amber-600 bg-amber-500/10 border-amber-200 dark:border-amber-800",
  },
  {
    value: "Certifications",
    label: "Certifications",
    icon: Award,
    description: "Degrees, licenses & training records",
    color: "text-purple-600 bg-purple-500/10 border-purple-200 dark:border-purple-800",
  },
];

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB

function getTodayIso(): string {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function getCategoryMeta(cat: string): CategoryMeta {
  return DOCUMENT_CATEGORIES.find((c) => c.value === cat) ?? DOCUMENT_CATEGORIES[0];
}

function daysUntil(dateStr: string | undefined, todayIso: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date(todayIso);
  if (Number.isNaN(target.getTime()) || Number.isNaN(now.getTime())) return null;
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function isImageDocument(fileUrl?: string, fileType?: string, name?: string): boolean {
  if (fileType?.startsWith("image/")) return true;
  if (fileUrl?.startsWith("data:image/")) return true;
  if (name && /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)) return true;
  return false;
}

function isPdfDocument(fileUrl?: string, fileType?: string, name?: string): boolean {
  if (fileType === "application/pdf") return true;
  if (fileUrl?.startsWith("data:application/pdf")) return true;
  if (name && /\.pdf$/i.test(name)) return true;
  return false;
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const parts = dataUrl.split(",");
    if (parts.length < 2) return null;
    const header = parts[0];
    const mimeMatch = header.match(/data:([^;]+);base64/i);
    const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
    const binary = atob(parts.slice(1).join(","));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

function extensionFromType(fileUrl?: string, fileType?: string): string {
  const t = fileType || fileUrl?.match(/^data:([^;]+)/i)?.[1] || "";
  if (t.includes("pdf")) return ".pdf";
  if (t.includes("png")) return ".png";
  if (t.includes("jpeg") || t.includes("jpg")) return ".jpg";
  if (t.includes("webp")) return ".webp";
  if (t.includes("gif")) return ".gif";
  if (t.includes("wordprocessingml")) return ".docx";
  if (t.includes("msword")) return ".doc";
  return "";
}

function downloadDocumentFile(doc: Pick<DocumentRecord, "name" | "fileUrl" | "fileType">) {
  if (!doc.fileUrl) {
    toast.error("No file binary attached to this record.");
    return;
  }

  let href = doc.fileUrl;
  let revokeAfter = false;
  if (doc.fileUrl.startsWith("data:")) {
    const blob = dataUrlToBlob(doc.fileUrl);
    if (blob) {
      href = URL.createObjectURL(blob);
      revokeAfter = true;
    }
  }

  const ext = extensionFromType(doc.fileUrl, doc.fileType);
  const base = doc.name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "document";
  const filename = ext && !base.toLowerCase().endsWith(ext) ? `${base}${ext}` : base;

  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (revokeAfter) {
    setTimeout(() => URL.revokeObjectURL(href), 5000);
  }
  toast.success(`Downloading ${filename}`);
}

function openDocumentInNewTab(fileUrl?: string) {
  if (!fileUrl) return;
  if (fileUrl.startsWith("data:")) {
    const blob = dataUrlToBlob(fileUrl);
    if (blob) {
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      return;
    }
  }
  window.open(fileUrl, "_blank", "noopener,noreferrer");
}

function DocumentPreviewFrame({
  fileUrl,
  fileType,
  fileName,
  heightClass = "h-72",
}: {
  fileUrl?: string;
  fileType?: string;
  fileName: string;
  heightClass?: string;
}) {
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const isImg = isImageDocument(fileUrl, fileType, fileName);
  const isPdf = isPdfDocument(fileUrl, fileType, fileName);

  useEffect(() => {
    if (!fileUrl || !isPdf) {
      setPdfBlobUrl(null);
      return;
    }
    if (!fileUrl.startsWith("data:")) {
      setPdfBlobUrl(fileUrl);
      return;
    }
    const blob = dataUrlToBlob(fileUrl);
    if (!blob) {
      setPdfBlobUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setPdfBlobUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [fileUrl, isPdf]);

  if (!fileUrl) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
        <FileText className="mb-2 h-8 w-8 text-muted-foreground/60" />
        <p className="text-xs font-medium text-foreground">No document file attached</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Upload a PDF or image file to view an interactive document preview.
        </p>
      </div>
    );
  }

  if (isImg) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5">
          <span className="truncate text-[11px] font-medium text-muted-foreground">
            Image Preview · {fileName}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-[11px]"
            onClick={() => openDocumentInNewTab(fileUrl)}
          >
            <ExternalLink className="h-3 w-3" /> Open Full Size
          </Button>
        </div>
        <div className={`flex items-center justify-center bg-black/5 p-3 dark:bg-black/30 ${heightClass}`}>
          <img
            src={fileUrl}
            alt={fileName}
            className="max-h-full max-w-full rounded object-contain shadow-sm"
          />
        </div>
      </div>
    );
  }

  if (isPdf) {
    const iframeSrc = pdfBlobUrl || fileUrl;
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5">
          <span className="truncate text-[11px] font-medium text-muted-foreground">
            PDF Preview · {fileName}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-[11px]"
            onClick={() => openDocumentInNewTab(fileUrl)}
          >
            <ExternalLink className="h-3 w-3" /> Open PDF
          </Button>
        </div>
        <iframe
          src={iframeSrc}
          title={`Preview of ${fileName}`}
          className={`w-full border-0 bg-white ${heightClass}`}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-muted/25 px-4 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground">{fileName}</p>
          <p className="text-[11px] text-muted-foreground">
            {fileType || "Attached document"} · Inline browser preview is supported for images and PDFs.
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="ml-3 shrink-0 gap-1.5 text-xs"
        onClick={() => openDocumentInNewTab(fileUrl)}
      >
        <ExternalLink className="h-3.5 w-3.5" /> Open
      </Button>
    </div>
  );
}

function DocumentsPageInner() {
  const searchParams = useSearchParams();
  const openParam = searchParams.get("open");
  const tabParam = searchParams.get("tab");

  const { data, pendingDocumentsCount, addDocument, decideDocument, refreshDocuments } = useStore();
  const { isAdmin, isEmployee, uid, inScope } = useScope();
  const nameOf = useNames();

  const todayIso = useMemo(() => getTodayIso(), []);

  const [tab, setTab] = useState(tabParam ?? "approved");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [uploadOpen, setUploadOpen] = useState(openParam === "upload");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  useEffect(() => {
    refreshDocuments().catch(() => {});
  }, [refreshDocuments]);

  useEffect(() => {
    if (openParam === "upload") setUploadOpen(true);
  }, [openParam]);

  useEffect(() => {
    if (tabParam) setTab(tabParam);
  }, [tabParam]);

  // Only employee-attached documents exist in the vault (never company policies / unattached docs).
  // Non-admins only ever see Verified documents; pending/rejected remain hidden until HR/Super Admin approves.
  const employeeDocuments = useMemo(() => {
    return data.documents.filter((d) => {
      if (!d.ownerId || d.category === "Company Policy" || d.category === "Policies") return false;
      if (isEmployee) {
        return d.ownerId === uid && d.status === "Verified";
      }
      if (!isAdmin) {
        return inScope(d.ownerId) && d.status === "Verified";
      }
      return inScope(d.ownerId);
    });
  }, [data.documents, isAdmin, isEmployee, uid, inScope]);

  const approvedDocs = useMemo(
    () => employeeDocuments.filter((d) => d.status === "Verified"),
    [employeeDocuments]
  );
  const pendingDocs = useMemo(
    () => employeeDocuments.filter((d) => d.status === "Pending Verification"),
    [employeeDocuments]
  );
  const rejectedDocs = useMemo(
    () => employeeDocuments.filter((d) => d.status === "Rejected"),
    [employeeDocuments]
  );
  const expiringDocs = useMemo(
    () =>
      approvedDocs.filter((d) => {
        const diff = daysUntil(d.expiresAt, todayIso);
        return diff !== null && diff <= 60;
      }),
    [approvedDocs, todayIso]
  );

  const selectedDoc = useMemo(
    () => employeeDocuments.find((d) => d.id === selectedDocId) ?? null,
    [employeeDocuments, selectedDocId]
  );

  // Filter by active tab + search + category + status
  const filteredDocs = useMemo(() => {
    let base = employeeDocuments;
    if (tab === "approved") base = approvedDocs;
    else if (tab === "pending") base = pendingDocs;
    else if (tab === "expiring") base = expiringDocs;
    else if (tab === "rejected") base = rejectedDocs;

    const q = search.trim().toLowerCase();
    return base.filter((d) => {
      if (catFilter !== "all" && d.category !== catFilter) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (!q) return true;
      const empName = d.ownerId ? nameOf(d.ownerId).toLowerCase() : "";
      const empId = d.ownerId?.toLowerCase() ?? "";
      return (
        d.name.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        empName.includes(q) ||
        empId.includes(q) ||
        (d.docNumber && d.docNumber.toLowerCase().includes(q)) ||
        (d.uploadedBy && d.uploadedBy.toLowerCase().includes(q))
      );
    });
  }, [employeeDocuments, approvedDocs, pendingDocs, expiringDocs, rejectedDocs, tab, search, catFilter, statusFilter, nameOf]);

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of DOCUMENT_CATEGORIES) map[c.value] = 0;
    const countSource = isAdmin ? employeeDocuments : approvedDocs;
    for (const d of countSource) {
      map[d.category] = (map[d.category] || 0) + 1;
    }
    return map;
  }, [employeeDocuments, approvedDocs, isAdmin]);

  const handleApprove = async (doc: DocumentRecord) => {
    await decideDocument(doc.id, "Verified");
    toast.success(`Approved "${doc.name}" — now visible to ${nameOf(doc.ownerId ?? "")}.`);
  };

  const handleReject = async (doc: DocumentRecord) => {
    await decideDocument(doc.id, "Rejected");
    toast.error(`Rejected "${doc.name}".`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Documents"
        description={
          isAdmin
            ? "Upload employee documents directly or review and approve employee submissions before they publish."
            : "Your verified employee records. Uploaded documents require HR or Super Admin approval before appearing here."
        }
        actions={
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {isAdmin ? "Upload Employee Document" : "Submit Document for Approval"}
          </Button>
        }
      />

      {/* Employee pending approval notice (keeps unapproved docs hidden until HR/Super Admin approves) */}
      {isEmployee && pendingDocumentsCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              You have{" "}
              <strong>
                {pendingDocumentsCount} document{pendingDocumentsCount > 1 ? "s" : ""}
              </strong>{" "}
              awaiting HR / Super Admin approval. Once approved, they will appear in your vault below.
            </span>
          </div>
          <Badge variant="outline" className="border-amber-500/40 text-amber-800 dark:text-amber-300">
            Pending Review
          </Badge>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={isAdmin ? "Approved Employee Docs" : "Approved Documents"}
          value={String(approvedDocs.length)}
          hint="Verified employee files"
          icon={<CheckCircle2 className="h-4 w-4" />}
          onClick={() => setTab("approved")}
        />
        {isAdmin ? (
          <KpiCard
            label="Pending HR Approval"
            value={String(pendingDocs.length)}
            hint={pendingDocs.length > 0 ? "Awaiting your review" : "All caught up"}
            icon={<Clock className="h-4 w-4" />}
            onClick={() => setTab("pending")}
          />
        ) : (
          <KpiCard
            label="Awaiting HR Approval"
            value={String(pendingDocumentsCount)}
            hint="Appears after approval"
            icon={<Clock className="h-4 w-4" />}
          />
        )}
        <KpiCard
          label="Expiring in 60 Days"
          value={String(expiringDocs.length)}
          hint="IDs & certs needing renewal"
          icon={<AlertTriangle className="h-4 w-4" />}
          onClick={() => setTab("expiring")}
        />
        <KpiCard
          label={isAdmin ? "Employees With Docs" : "Categories Covered"}
          value={String(
            isAdmin
              ? new Set(employeeDocuments.map((d) => d.ownerId).filter(Boolean)).size
              : new Set(approvedDocs.map((d) => d.category)).size
          )}
          hint={isAdmin ? `Across ${data.employees.length} employees` : `Of ${DOCUMENT_CATEGORIES.length} document types`}
          icon={<UserCheck className="h-4 w-4" />}
        />
      </div>

      {/* Category Filter Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {DOCUMENT_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const active = catFilter === cat.value;
          return (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCatFilter(active ? "all" : cat.value)}
              className={`group flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all ${
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${cat.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="font-mono-num text-lg font-semibold text-foreground">
                  {categoryCounts[cat.value] ?? 0}
                </span>
              </div>
              <div className="mt-3">
                <p className="text-xs font-semibold text-foreground">{cat.label}</p>
                <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{cat.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Content Tabs & Toolbar */}
      <TabsShell
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "approved", label: `Approved Docs (${approvedDocs.length})` },
          { key: "pending", label: `Pending Approval (${pendingDocs.length})`, hidden: !isAdmin },
          { key: "expiring", label: `Expiring Soon (${expiringDocs.length})` },
          { key: "rejected", label: `Rejected (${rejectedDocs.length})`, hidden: !isAdmin },
          { key: "all", label: `All Employee Docs (${employeeDocuments.length})`, hidden: !isAdmin },
        ]}
      >
        <Toolbar
          left={
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search document name, employee, ID..."
                  className="h-8 w-64 pl-8 text-xs"
                />
              </div>
              <Sel
                value={catFilter}
                onChange={setCatFilter}
                options={[
                  { value: "all", label: "All Categories" },
                  ...DOCUMENT_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
                ]}
              />
              {isAdmin && (
                <Sel
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: "all", label: "All Statuses" },
                    { value: "Verified", label: "Verified" },
                    { value: "Pending Verification", label: "Pending Approval" },
                    { value: "Rejected", label: "Rejected" },
                  ]}
                />
              )}
              {(catFilter !== "all" || statusFilter !== "all" || search.trim() !== "") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={() => {
                    setCatFilter("all");
                    setStatusFilter("all");
                    setSearch("");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </>
          }
          right={
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewMode === "grid"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewMode === "table"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="h-3.5 w-3.5" /> Table
              </button>
            </div>
          }
        />

        {filteredDocs.length === 0 ? (
          <EmptyState
            title={
              tab === "pending"
                ? "No employee documents waiting for approval"
                : "No employee documents match your filter"
            }
            hint={
              isEmployee && pendingDocumentsCount > 0
                ? `${pendingDocumentsCount} submitted document(s) are pending HR / Super Admin approval.`
                : "Try adjusting your search or category filter, or upload a new employee document."
            }
            action={
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {isAdmin ? "Upload Employee Document" : "Upload Document"}
              </Button>
            }
          />
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDocs.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                todayIso={todayIso}
                isAdmin={isAdmin}
                onSelect={() => setSelectedDocId(doc.id)}
                onVerify={() => handleApprove(doc)}
                onReject={() => handleReject(doc)}
              />
            ))}
          </div>
        ) : (
          <DataTable
            rows={filteredDocs}
            rowKey={(r) => r.id}
            onRowClick={(r) => setSelectedDocId(r.id)}
            columns={[
              {
                key: "name",
                header: "Document",
                render: (r) => {
                  const meta = getCategoryMeta(r.category);
                  const Icon = meta.icon;
                  return (
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${meta.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-foreground">{r.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {r.category} {r.docNumber ? `· ${r.docNumber}` : ""}
                        </p>
                      </div>
                    </div>
                  );
                },
              },
              {
                key: "owner",
                header: "Employee",
                render: (r) => <Person id={r.ownerId} />,
              },
              {
                key: "uploaded",
                header: "Uploaded",
                render: (r) => (
                  <div>
                    <p className="text-xs text-foreground">{r.uploadedAt}</p>
                    <p className="text-[11px] text-muted-foreground">{r.uploadedBy}</p>
                  </div>
                ),
              },
              {
                key: "expires",
                header: "Expiry",
                render: (r) => {
                  if (!r.expiresAt) return <span className="text-xs text-muted-foreground">—</span>;
                  const diff = daysUntil(r.expiresAt, todayIso);
                  return (
                    <span
                      className={`font-mono-num text-xs ${
                        diff !== null && diff <= 30
                          ? "font-semibold text-red-600"
                          : diff !== null && diff <= 60
                            ? "font-medium text-amber-600"
                            : "text-foreground"
                      }`}
                    >
                      {r.expiresAt}
                    </span>
                  );
                },
              },
              {
                key: "size",
                header: "Size",
                render: (r) => <span className="font-mono-num text-xs text-muted-foreground">{r.size}</span>,
              },
              {
                key: "status",
                header: "Status",
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: "actions",
                header: "",
                render: (r) => (
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => setSelectedDocId(r.id)}
                    >
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </Button>
                    {r.fileUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Download"
                        onClick={() => downloadDocumentFile(r)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {isAdmin && r.status === "Pending Verification" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                          title="Approve"
                          onClick={() => handleApprove(r)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-600 hover:text-red-700"
                          title="Reject"
                          onClick={() => handleReject(r)}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </TabsShell>

      {/* Document Preview & Detail Drawer */}
      <Sheet open={!!selectedDoc} onOpenChange={(o) => !o && setSelectedDocId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selectedDoc && (
            <DocumentDetailSheetContent
              doc={selectedDoc}
              todayIso={todayIso}
              isAdmin={isAdmin}
              onVerify={() => handleApprove(selectedDoc)}
              onReject={() => handleReject(selectedDoc)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Upload Employee Document Modal */}
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        isAdmin={isAdmin}
        uid={uid}
        todayIso={todayIso}
        employees={data.employees}
        onAdd={addDocument}
      />
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-muted-foreground">Loading employee documents...</div>}>
      <DocumentsPageInner />
    </Suspense>
  );
}

/* ---------- Card Component ---------- */

function DocumentCard({
  doc,
  todayIso,
  isAdmin,
  onSelect,
  onVerify,
  onReject,
}: {
  doc: DocumentRecord;
  todayIso: string;
  isAdmin: boolean;
  onSelect: () => void;
  onVerify: () => void;
  onReject: () => void;
}) {
  const meta = getCategoryMeta(doc.category);
  const Icon = meta.icon;
  const diff = daysUntil(doc.expiresAt, todayIso);
  const expiringSoon = diff !== null && diff <= 60;
  const isImg = isImageDocument(doc.fileUrl, doc.fileType, doc.name);
  const isPdf = isPdfDocument(doc.fileUrl, doc.fileType, doc.name);

  return (
    <Card
      onClick={onSelect}
      className="group cursor-pointer overflow-hidden border-border bg-card transition-all hover:border-primary/40 hover:shadow-sm"
    >
      {/* Inline card preview thumbnail when fileUrl is present */}
      {doc.fileUrl && isImg ? (
        <div className="relative h-36 w-full overflow-hidden border-b border-border bg-muted/30">
          <img
            src={doc.fileUrl}
            alt={doc.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
          <div className="absolute right-2 top-2">
            <StatusBadge status={doc.status} />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-2.5">
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            {doc.fileUrl && isPdf ? (
              <>
                <FileText className="h-3.5 w-3.5 text-red-500" />
                <span>PDF Document · Click Preview</span>
              </>
            ) : (
              <>
                <FolderOpen className="h-3.5 w-3.5" />
                <span>{doc.fileUrl ? "Attached File" : "Metadata Record"}</span>
              </>
            )}
          </div>
          <StatusBadge status={doc.status} />
        </div>
      )}

      <CardContent className="flex flex-col justify-between p-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${meta.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <Badge variant="outline" className="mb-0.5 px-1.5 py-0 text-[10px] font-medium">
                  {doc.category}
                </Badge>
                <p className="text-[10px] text-muted-foreground">v{doc.version}</p>
              </div>
            </div>
            {doc.confidentiality && doc.confidentiality !== "Internal" && (
              <Badge variant="secondary" className="text-[10px]">
                {doc.confidentiality}
              </Badge>
            )}
          </div>

          <h3 className="mt-3 line-clamp-2 text-[13px] font-semibold leading-snug text-foreground group-hover:text-primary">
            {doc.name}
          </h3>

          {doc.docNumber && (
            <p className="mt-1 font-mono-num text-[11px] text-muted-foreground">Ref: {doc.docNumber}</p>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2.5">
            <Person id={doc.ownerId} />
            <span className="font-mono-num text-[11px] text-muted-foreground">{doc.size}</span>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Uploaded {doc.uploadedAt}</span>
            {doc.expiresAt && (
              <span
                className={
                  expiringSoon
                    ? "flex items-center gap-1 font-medium text-amber-600"
                    : "text-muted-foreground"
                }
              >
                {expiringSoon && <AlertTriangle className="h-3 w-3" />}
                Exp {doc.expiresAt}
              </span>
            )}
          </div>

          {isAdmin && doc.status === "Pending Verification" ? (
            <div className="flex gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="outline"
                className="h-7 flex-1 gap-1 border-emerald-500/40 text-xs text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
                onClick={onVerify}
              >
                <CheckCircle2 className="h-3 w-3" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 flex-1 gap-1 border-red-500/40 text-xs text-red-700 hover:bg-red-500/10 dark:text-red-400"
                onClick={onReject}
              >
                <XCircle className="h-3 w-3" /> Reject
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 flex-1 gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={onSelect}
              >
                <Eye className="h-3 w-3" /> Preview
              </Button>
              {doc.fileUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => downloadDocumentFile(doc)}
                >
                  <Download className="h-3 w-3" /> Download
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Detail & Preview Sheet ---------- */

function DocumentDetailSheetContent({
  doc,
  todayIso,
  isAdmin,
  onVerify,
  onReject,
}: {
  doc: DocumentRecord;
  todayIso: string;
  isAdmin: boolean;
  onVerify: () => void;
  onReject: () => void;
}) {
  const meta = getCategoryMeta(doc.category);
  const diff = daysUntil(doc.expiresAt, todayIso);

  return (
    <div className="space-y-5">
      <SheetHeader>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px]">
            {doc.category}
          </Badge>
          <StatusBadge status={doc.status} />
          {doc.confidentiality && (
            <Badge variant="secondary" className="text-[11px]">
              {doc.confidentiality}
            </Badge>
          )}
        </div>
        <SheetTitle className="text-base">{doc.name}</SheetTitle>
        <SheetDescription className="text-xs">
          Document ID: <span className="font-mono-num">{doc.id}</span> · Version {doc.version}
        </SheetDescription>
      </SheetHeader>

      {/* Interactive Document Preview */}
      <DocumentPreviewFrame
        fileUrl={doc.fileUrl}
        fileType={doc.fileType}
        fileName={doc.name}
        heightClass="h-[360px]"
      />

      {diff !== null && diff <= 60 && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs ${
            diff <= 0
              ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
              : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
          }`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {diff <= 0 ? "Document expired" : `Expires in ${diff} day${diff === 1 ? "" : "s"}`}
            </p>
            <p className="mt-0.5 opacity-90">
              {diff <= 0
                ? `Expired on ${doc.expiresAt}. Upload a renewed version.`
                : `Expiry date is ${doc.expiresAt}. Plan renewal before expiry.`}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4">
        <Stat label="Employee" value={<Person id={doc.ownerId} />} />
        <Stat label="Category" value={meta.label} />
        <Stat label="Uploaded By" value={doc.uploadedBy} />
        <Stat label="Uploaded On" value={doc.uploadedAt} />
        {doc.issueDate && <Stat label="Issue Date" value={doc.issueDate} />}
        <Stat label="Expiry Date" value={doc.expiresAt || "No expiry"} />
        {doc.docNumber && <Stat label="Document No." value={<span className="font-mono-num">{doc.docNumber}</span>} />}
        <Stat label="File Size" value={<span className="font-mono-num">{doc.size}</span>} />
        {doc.verifiedBy && <Stat label="Approved By" value={doc.verifiedBy} />}
      </div>

      {doc.notes && (
        <div className="rounded-xl border border-border bg-muted/20 p-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">Notes / Description</p>
          <p className="mt-1 text-xs leading-relaxed text-foreground">{doc.notes}</p>
        </div>
      )}

      <div className="space-y-2.5 border-t border-border pt-4">
        <div className="flex flex-wrap gap-2">
          <Button
            className="flex-1 gap-1.5 text-xs"
            disabled={!doc.fileUrl}
            onClick={() => downloadDocumentFile(doc)}
          >
            <Download className="h-3.5 w-3.5" />
            Download Document
          </Button>
          {doc.fileUrl && (
            <Button
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => openDocumentInNewTab(doc.fileUrl)}
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open Tab
            </Button>
          )}
        </div>

        {isAdmin && doc.status === "Pending Verification" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-1.5 border-emerald-500/40 text-xs text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
              onClick={onVerify}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve & Publish to Employee
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-1.5 border-red-500/40 text-xs text-red-700 hover:bg-red-500/10 dark:text-red-400"
              onClick={onReject}
            >
              <XCircle className="h-3.5 w-3.5" /> Reject Document
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Upload Employee Document Dialog with Live Preview ---------- */

function UploadDialog({
  open,
  onOpenChange,
  isAdmin,
  uid,
  todayIso,
  employees,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isAdmin: boolean;
  uid: string;
  todayIso: string;
  employees: { id: string; name: string; department: string }[];
  onAdd: (
    d: Omit<DocumentRecord, "id" | "version">
  ) => Promise<{ ok: boolean; error?: string; status?: DocumentRecord["status"] }>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Identity");
  const [owner, setOwner] = useState(() => (isAdmin ? employees[0]?.id || "" : uid));
  const [docNumber, setDocNumber] = useState("");
  const [confidentiality, setConfidentiality] = useState<DocumentRecord["confidentiality"]>("Strictly Confidential");
  const [issueDate, setIssueDate] = useState(todayIso);
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");

  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [fileType, setFileType] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [readingFile, setReadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!isAdmin) {
      setOwner(uid);
    } else if (!owner || !employees.some((e) => e.id === owner)) {
      setOwner(employees[0]?.id || "");
    }
  }, [open, isAdmin, uid, owner, employees]);

  const handleFileChange = (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      toast.error("File size exceeds 4 MB limit. Please upload a smaller image or PDF.");
      return;
    }

    setReadingFile(true);
    setFileName(f.name);
    setFileType(f.type || "");
    setFileSize(
      f.size >= 1024 * 1024
        ? `${(f.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(f.size / 1024))} KB`
    );
    if (!name.trim()) {
      setName(f.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " "));
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setFileUrl(reader.result);
      }
      setReadingFile(false);
    };
    reader.onerror = () => {
      toast.error("Could not read file for preview.");
      setReadingFile(false);
    };
    reader.readAsDataURL(f);
  };

  const resetForm = () => {
    setName("");
    setCategory("Identity");
    setOwner(isAdmin ? employees[0]?.id || "" : uid);
    setDocNumber("");
    setConfidentiality("Strictly Confidential");
    setIssueDate(todayIso);
    setExpiresAt("");
    setNotes("");
    setFileName("");
    setFileSize("");
    setFileType("");
    setFileUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Document title is required.");
      return;
    }
    const targetOwnerId = isAdmin ? owner : uid;
    if (!targetOwnerId) {
      toast.error("Please select an employee to attach this document to.");
      return;
    }
    if (!fileUrl) {
      toast.error("Please choose a file to upload and preview.");
      return;
    }

    setSubmitting(true);
    const result = await onAdd({
      name: name.trim(),
      category,
      ownerId: targetOwnerId,
      uploadedBy: isAdmin ? "HR / Admin" : employees.find((e) => e.id === uid)?.name || "Employee",
      uploadedAt: todayIso,
      expiresAt,
      size: fileSize || "1 KB",
      status: isAdmin ? "Verified" : "Pending Verification",
      docNumber: docNumber.trim() || undefined,
      confidentiality,
      issueDate: issueDate || undefined,
      notes: notes.trim() || undefined,
      fileUrl,
      fileType: fileType || undefined,
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error || "Failed to upload document.");
      return;
    }

    if (isAdmin) {
      toast.success("Employee document uploaded and attached immediately.");
    } else {
      toast.success("Submitted for HR / Super Admin approval. It will appear once approved.");
    }
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isAdmin ? "Upload Employee Document" : "Submit Document for HR Approval"}</DialogTitle>
          <DialogDescription>
            {isAdmin
              ? "Attach a verified document directly to an employee profile."
              : "Upload your document. It will be reviewed by HR or Super Admin before appearing in your Documents vault."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isAdmin && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Employee uploads require <strong>HR or Super Admin approval</strong> before they become visible in your portal.
              </span>
            </div>
          )}

          {/* File Selector Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 px-4 py-5 text-center transition-colors hover:border-primary/50 hover:bg-muted/40"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
            />
            {readingFile ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Generating live preview...</span>
              </div>
            ) : (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <FileUp className="h-5 w-5" />
                </div>
                <p className="mt-2 text-xs font-medium text-foreground">
                  {fileName ? `${fileName} (${fileSize})` : "Click to select PDF, PNG, or JPG (max 4 MB)"}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {fileName ? "Click to replace file" : "A live preview will render here before upload"}
                </p>
              </>
            )}
          </div>

          {/* Live Upload Preview */}
          {fileUrl && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Live Document Preview
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setFileUrl("");
                    setFileName("");
                    setFileSize("");
                    setFileType("");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <X className="h-3 w-3" /> Clear file
                </Button>
              </div>
              <DocumentPreviewFrame
                fileUrl={fileUrl}
                fileType={fileType}
                fileName={fileName || name || "Selected File"}
                heightClass="h-60"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Document Title" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Signed Offer Letter, PAN Card"
              />
            </Field>
            <Field label="Attach to Employee" required>
              {isAdmin ? (
                <Sel
                  className="w-full"
                  value={owner}
                  onChange={setOwner}
                  placeholder="Select employee..."
                  options={employees.map((e) => ({
                    value: e.id,
                    label: `${e.name} (${e.id}) · ${e.department}`,
                  }))}
                />
              ) : (
                <Input
                  value={`${employees.find((e) => e.id === uid)?.name || "Current Employee"} (${uid})`}
                  disabled
                  className="bg-muted/40 text-xs"
                />
              )}
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Category" required>
              <Sel
                className="w-full"
                value={category}
                onChange={setCategory}
                options={DOCUMENT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
              />
            </Field>
            <Field label="Confidentiality">
              <Sel
                className="w-full"
                value={confidentiality || "Strictly Confidential"}
                onChange={(v) => setConfidentiality(v as DocumentRecord["confidentiality"])}
                options={[
                  { value: "Internal", label: "Internal" },
                  { value: "Restricted", label: "Restricted" },
                  { value: "Strictly Confidential", label: "Strictly Confidential" },
                  { value: "Public", label: "Public" },
                ]}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Doc / Reference No.">
              <Input
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="Optional ID"
              />
            </Field>
            <Field label="Issue Date">
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </Field>
            <Field label="Expiry Date">
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </Field>
          </div>

          <Field label="Notes / Description">
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional remarks for HR or employee..."
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || readingFile}>
            {submitting ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {isAdmin ? "Upload & Attach" : "Submit for Approval"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
