"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  RefreshCw,
  Plus,
  ArrowUpRight,
  Sparkles,
  FileCheck2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/shell";
import { useStore } from "@/lib/data/store";
import type { DocumentRecord } from "@/lib/data/types";
import {
  PageHeader,
  KpiCard,
  StatusBadge,
  TabsShell,
  EmptyState,
  Field,
} from "@/components/shared";
import { Person, Sel, Stat, useScope, useNames } from "@/components/form-bits";
import { DataTable, exportCsv, type Column } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
  shortLabel: string;
  icon: typeof FileText;
  description: string;
  color: string;
};

const DOCUMENT_CATEGORIES: CategoryMeta[] = [
  {
    value: "Identity",
    label: "Identity & KYC",
    shortLabel: "Identity",
    icon: CreditCard,
    description: "Passport, Aadhaar, PAN & ID cards",
    color: "text-blue-600 bg-blue-500/10 border-blue-200 dark:border-blue-800 dark:text-blue-400",
  },
  {
    value: "Contracts",
    label: "Contracts & Letters",
    shortLabel: "Contracts",
    icon: Briefcase,
    description: "Offer letters, NDAs & agreements",
    color: "text-emerald-600 bg-emerald-500/10 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400",
  },
  {
    value: "Payroll & Tax",
    label: "Payroll & Tax",
    shortLabel: "Payroll",
    icon: ShieldCheck,
    description: "Form 16, PF nomination & bank proofs",
    color: "text-amber-600 bg-amber-500/10 border-amber-200 dark:border-amber-800 dark:text-amber-400",
  },
  {
    value: "Certifications",
    label: "Certifications",
    shortLabel: "Certs",
    icon: Award,
    description: "Degrees, licenses & training records",
    color: "text-purple-600 bg-purple-500/10 border-purple-200 dark:border-purple-800 dark:text-purple-400",
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

function extractBase64Body(dataUrl?: string): string {
  if (!dataUrl || !dataUrl.startsWith("data:")) return "";
  const idx = dataUrl.indexOf(",");
  return idx >= 0 ? dataUrl.slice(idx + 1).trimStart() : "";
}

function isImageDocument(fileUrl?: string, fileType?: string, name?: string): boolean {
  if (fileType?.startsWith("image/")) return true;
  if (fileUrl?.startsWith("data:image/")) return true;
  if (name && /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)) return true;
  const b64 = extractBase64Body(fileUrl);
  if (b64.startsWith("/9j/") || b64.startsWith("iVBOR") || b64.startsWith("R0lGOD") || b64.startsWith("UklGR")) {
    return true;
  }
  return false;
}

function isPdfDocument(fileUrl?: string, fileType?: string, name?: string): boolean {
  if (fileType === "application/pdf") return true;
  if (fileUrl?.startsWith("data:application/pdf")) return true;
  if (name && /\.pdf$/i.test(name)) return true;
  const b64 = extractBase64Body(fileUrl);
  if (b64.startsWith("JVBERi0")) return true;
  return false;
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  try {
    const parts = dataUrl.split(",");
    if (parts.length < 2) return null;
    const binary = atob(parts.slice(1).join(","));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const parts = dataUrl.split(",");
    if (parts.length < 2) return null;
    const header = parts[0];
    const mimeMatch = header.match(/data:([^;]+);base64/i);
    const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
    const bytes = dataUrlToUint8Array(dataUrl);
    if (!bytes) return null;
    return new Blob([bytes.buffer as ArrayBuffer], { type: mime });
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

function PdfCanvasPreview({
  fileUrl,
  fileName,
  heightClass,
  fallbackUrl,
}: {
  fileUrl: string;
  fileName: string;
  heightClass: string;
  fallbackUrl: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let pdfDoc: any = null;

    const renderPdf = async () => {
      setLoading(true);
      setError(false);
      setPageCount(0);

      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }

      try {
        if (typeof (Promise as any).withResolvers !== "function") {
          (Promise as any).withResolvers = function <T>() {
            let resolve!: (value: T | PromiseLike<T>) => void;
            let reject!: (reason?: unknown) => void;
            const promise = new Promise<T>((res, rej) => {
              resolve = res;
              reject = rej;
            });
            return { promise, resolve, reject };
          };
        }

        const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (pdfjsLib.GlobalWorkerOptions) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        }

        const bytes = fileUrl.startsWith("data:") ? dataUrlToUint8Array(fileUrl) : null;
        const loadingTask = bytes
          ? pdfjsLib.getDocument({ data: bytes })
          : pdfjsLib.getDocument({ url: fileUrl });

        pdfDoc = await loadingTask.promise;
        if (cancelled) return;

        const total = pdfDoc.numPages || 1;
        setPageCount(total);

        const targetWidth = Math.max(containerRef.current?.clientWidth ? containerRef.current.clientWidth - 16 : 320, 260);
        const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

        for (let pageNum = 1; pageNum <= total; pageNum++) {
          if (cancelled) break;
          const page = await pdfDoc.getPage(pageNum);
          if (cancelled) break;

          const baseViewport = page.getViewport({ scale: 1 });
          const fitScale = targetWidth / Math.max(baseViewport.width, 1);
          const renderViewport = page.getViewport({ scale: fitScale * dpr });

          const wrapper = document.createElement("div");
          wrapper.className = "w-full overflow-hidden rounded-lg border border-border/70 bg-white shadow-xs";

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(renderViewport.width);
          canvas.height = Math.floor(renderViewport.height);
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.style.display = "block";

          const ctx = canvas.getContext("2d");
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;
          }

          if (cancelled) break;
          wrapper.appendChild(canvas);
          containerRef.current?.appendChild(wrapper);
        }

        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };

    renderPdf();

    return () => {
      cancelled = true;
      if (pdfDoc && typeof pdfDoc.destroy === "function") {
        pdfDoc.destroy().catch(() => {});
      }
    };
  }, [fileUrl]);

  if (error) {
    return (
      <div className="space-y-3 bg-muted/15 p-4 text-center">
        <iframe
          src={fallbackUrl}
          title={`Preview of ${fileName}`}
          className={`hidden w-full border-0 bg-white sm:block ${heightClass}`}
        />
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-4 py-6 sm:hidden">
          <FileText className="mb-2 h-8 w-8 text-rose-500" />
          <p className="text-xs font-medium text-foreground">{fileName}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Tap Open PDF below to view in your device reader.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3 gap-1.5 rounded-xl text-xs"
            onClick={() => openDocumentInNewTab(fileUrl)}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open PDF
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-neutral-100/90 dark:bg-neutral-900/70">
      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Rendering PDF preview...</span>
        </div>
      )}
      {pageCount > 0 && (
        <div className="flex items-center justify-between border-b border-border/60 bg-background/70 px-3 py-1 text-[10px] font-medium text-muted-foreground">
          <span>Rendered for mobile & desktop</span>
          <span className="font-mono-num">{pageCount} page{pageCount > 1 ? "s" : ""}</span>
        </div>
      )}
      <div
        ref={containerRef}
        className={cn(
          "flex flex-col items-center gap-2.5 overflow-y-auto overscroll-contain p-2 sm:p-3",
          heightClass
        )}
      />
    </div>
  );
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
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
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
      <div className="overflow-hidden rounded-2xl border border-border bg-muted/20 shadow-xs">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3.5 py-2">
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
            <ExternalLink className="h-3 w-3" /> Full Size
          </Button>
        </div>
        <div className={`flex items-center justify-center bg-black/5 p-3 dark:bg-black/30 ${heightClass}`}>
          <img
            src={fileUrl}
            alt={fileName}
            className="max-h-full max-w-full rounded-lg object-contain shadow-sm"
          />
        </div>
      </div>
    );
  }

  if (isPdf) {
    const fallbackSrc = pdfBlobUrl || fileUrl;
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-muted/20 shadow-xs">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3.5 py-2">
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
        <PdfCanvasPreview
          fileUrl={fileUrl}
          fileName={fileName}
          heightClass={heightClass}
          fallbackUrl={fallbackSrc}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/25 px-4 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
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
        className="ml-3 shrink-0 gap-1.5 rounded-xl text-xs"
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
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [uploadOpen, setUploadOpen] = useState(openParam === "upload");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshDocuments();
    toast.success("Documents synchronized with database");
    setRefreshing(false);
  };

  const handleApprove = async (doc: DocumentRecord) => {
    await decideDocument(doc.id, "Verified");
    toast.success(`Approved "${doc.name}" — now visible to ${nameOf(doc.ownerId ?? "")}.`);
  };

  const handleReject = async (doc: DocumentRecord) => {
    await decideDocument(doc.id, "Rejected");
    toast.error(`Rejected "${doc.name}".`);
  };

  const tableColumns: Column<DocumentRecord>[] = [
    {
      key: "name",
      header: "Document",
      sortValue: (r) => r.name,
      render: (r) => {
        const meta = getCategoryMeta(r.category);
        const Icon = meta.icon;
        const isImg = isImageDocument(r.fileUrl, r.fileType, r.name);
        return (
          <div className="flex items-center gap-2.5">
            {r.fileUrl && isImg ? (
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/30">
                <img src={r.fileUrl} alt={r.name} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", meta.color)}>
                <Icon className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{r.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {meta.label} {r.docNumber ? `· ${r.docNumber}` : ""}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "owner",
      header: "Employee",
      sortValue: (r) => (r.ownerId ? nameOf(r.ownerId) : ""),
      render: (r) =>
        r.ownerId ? (
          <Link
            href={`/employees/${r.ownerId}`}
            onClick={(e) => e.stopPropagation()}
            className="group inline-flex items-center gap-1.5 hover:underline"
          >
            <Person id={r.ownerId} />
            <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "uploaded",
      header: "Uploaded",
      sortValue: (r) => r.uploadedAt,
      hideOnMobile: true,
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
      sortValue: (r) => r.expiresAt || "9999-12-31",
      hideOnMobile: true,
      render: (r) => {
        if (!r.expiresAt) return <span className="text-xs text-muted-foreground">—</span>;
        const diff = daysUntil(r.expiresAt, todayIso);
        return (
          <span
            className={cn(
              "font-mono-num text-xs",
              diff !== null && diff <= 30
                ? "font-semibold text-rose-600 dark:text-rose-400"
                : diff !== null && diff <= 60
                  ? "font-medium text-amber-600 dark:text-amber-400"
                  : "text-foreground"
            )}
          >
            {r.expiresAt}
          </span>
        );
      },
    },
    {
      key: "size",
      header: "Size",
      hideOnMobile: true,
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
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setSelectedDocId(r.id)}
          >
            <Eye className="h-3.5 w-3.5" /> Preview
          </Button>
          {r.fileUrl && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title="Download document"
              onClick={() => downloadDocumentFile(r)}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          )}
          {isAdmin && r.status === "Pending Verification" && (
            <>
              <Button
                size="sm"
                className="h-7 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-700"
                onClick={() => handleApprove(r)}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-rose-200 px-2.5 text-xs text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/40"
                onClick={() => handleReject(r)}
              >
                Reject
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const employeesWithDocsCount = useMemo(
    () => new Set(employeeDocuments.map((d) => d.ownerId).filter(Boolean)).size,
    [employeeDocuments]
  );

  const categoriesCoveredCount = useMemo(
    () => new Set(approvedDocs.map((d) => d.category)).size,
    [approvedDocs]
  );

  const hasActiveFilters = catFilter !== "all" || statusFilter !== "all" || search.trim() !== "";

  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-0">
        {/* Mobile-First Premium Hero Header (< sm) */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-indigo-500/5 p-4 shadow-sm sm:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  <Sparkles className="h-2.5 w-2.5" />
                  {isAdmin ? "HR Document Desk" : "Verified Vault"}
                </span>
                <h1 className="truncate text-lg font-bold tracking-tight text-foreground">
                  {isEmployee ? "My Documents" : "Employee Documents"}
                </h1>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={refreshing}
              onClick={handleRefresh}
              className="h-9 w-9 shrink-0 rounded-xl bg-background/80"
              aria-label="Sync documents"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
          </div>

          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
            {isAdmin
              ? "Attach verified files to employees or review pending submissions before they publish."
              : "Your HR-verified employment files. New uploads appear once HR or Super Admin approves them."}
          </p>

          <div className="mt-3.5 flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setUploadOpen(true)}
              className="h-10 flex-1 gap-1.5 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-sm active:scale-[0.98]"
            >
              <Upload className="h-4 w-4" />
              {isAdmin ? "Upload Employee Doc" : "Submit Document"}
            </Button>
          </div>
        </div>

        {/* Mobile 2x2 Interactive Summary Tiles (< sm) */}
        <div className="grid grid-cols-2 gap-2.5 sm:hidden">
          <button
            type="button"
            onClick={() => setTab("approved")}
            className={cn(
              "flex items-center gap-2.5 rounded-2xl border bg-card p-3 text-left shadow-xs transition-all active:scale-[0.98]",
              tab === "approved" ? "border-primary/40 ring-1 ring-primary/20" : "border-border/80"
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground">Approved</p>
              <p className="font-mono-num text-lg font-bold leading-tight text-foreground">
                {approvedDocs.length}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => isAdmin && setTab("pending")}
            className={cn(
              "flex items-center gap-2.5 rounded-2xl border bg-card p-3 text-left shadow-xs transition-all active:scale-[0.98]",
              tab === "pending" ? "border-primary/40 ring-1 ring-primary/20" : "border-border/80"
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-muted-foreground">
                {isAdmin ? "Needs Review" : "Pending HR"}
              </p>
              <p className="font-mono-num text-lg font-bold leading-tight text-foreground">
                {isAdmin ? pendingDocs.length : pendingDocumentsCount}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTab("expiring")}
            className={cn(
              "flex items-center gap-2.5 rounded-2xl border bg-card p-3 text-left shadow-xs transition-all active:scale-[0.98]",
              tab === "expiring" ? "border-primary/40 ring-1 ring-primary/20" : "border-border/80"
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground">Expiring</p>
              <p className="font-mono-num text-lg font-bold leading-tight text-foreground">
                {expiringDocs.length}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2.5 rounded-2xl border border-border/80 bg-card p-3 shadow-xs">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <UserCheck className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-muted-foreground">
                {isAdmin ? "Employees" : "Categories"}
              </p>
              <p className="font-mono-num text-lg font-bold leading-tight text-foreground">
                {isAdmin ? employeesWithDocsCount : categoriesCoveredCount}
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Standard Module Header (sm+) */}
        <div className="hidden sm:block">
          <PageHeader
            breadcrumb={["People", "Document Vault"]}
            title={isEmployee ? "My Verified Documents" : "Employee Document Vault"}
            description={
              isAdmin
                ? "Upload verified employee documents directly or review and approve employee submissions before they publish."
                : "Access your HR-verified employment records. Uploaded documents appear once approved by HR or Super Admin."
            }
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={refreshing}
                  onClick={handleRefresh}
                  className="gap-1.5 text-xs shadow-sm"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> Refresh
                </Button>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs shadow-sm"
                    onClick={() =>
                      exportCsv(
                        "employee-documents.csv",
                        ["Doc ID", "Title", "Category", "Employee ID", "Employee", "Uploaded By", "Uploaded On", "Expiry", "Size", "Status"],
                        employeeDocuments.map((d) => [
                          d.id,
                          d.name,
                          d.category,
                          d.ownerId || "",
                          d.ownerId ? nameOf(d.ownerId) : "",
                          d.uploadedBy,
                          d.uploadedAt,
                          d.expiresAt || "",
                          d.size,
                          d.status,
                        ])
                      )
                    }
                  >
                    <Download className="h-3.5 w-3.5" /> Export CSV
                  </Button>
                )}
                <Button
                  size="sm"
                  className="gap-1.5 bg-primary text-xs text-primary-foreground shadow-sm hover:bg-primary/90"
                  onClick={() => setUploadOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {isAdmin ? "Upload Document" : "Submit Document"}
                </Button>
              </>
            }
          />
        </div>

        {/* Employee pending approval banner (keeps unapproved uploads hidden until HR/Super Admin approves) */}
        {isEmployee && pendingDocumentsCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-200 sm:mb-5 sm:rounded-xl">
            <div className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                You have{" "}
                <strong>
                  {pendingDocumentsCount} uploaded document{pendingDocumentsCount > 1 ? "s" : ""}
                </strong>{" "}
                awaiting HR / Super Admin approval. They will appear in your vault once approved.
              </span>
            </div>
            <Badge variant="outline" className="border-amber-500/40 text-amber-800 dark:text-amber-300">
              Pending Approval
            </Badge>
          </div>
        )}

        {/* Desktop Top KPI Cards Row (matches leave & assets modules) */}
        <div className="mb-6 hidden grid-cols-2 gap-3 sm:grid xl:grid-cols-4">
          <KpiCard
            label={isAdmin ? "Approved Employee Docs" : "Approved Documents"}
            value={String(approvedDocs.length)}
            hint="Verified employee files"
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            onClick={() => setTab("approved")}
          />
          {isAdmin ? (
            <KpiCard
              label="Pending HR Approval"
              value={String(pendingDocs.length)}
              hint={pendingDocs.length > 0 ? "Awaiting your review" : "All caught up"}
              icon={<Clock className="h-4 w-4 text-amber-500" />}
              onClick={() => setTab("pending")}
            />
          ) : (
            <KpiCard
              label="Awaiting HR Approval"
              value={String(pendingDocumentsCount)}
              hint="Hidden until HR approves"
              icon={<Clock className="h-4 w-4 text-amber-500" />}
            />
          )}
          <KpiCard
            label="Expiring in 60 Days"
            value={String(expiringDocs.length)}
            hint="IDs & certs needing renewal"
            icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}
            onClick={() => setTab("expiring")}
          />
          <KpiCard
            label={isAdmin ? "Employees Covered" : "Categories Covered"}
            value={String(isAdmin ? employeesWithDocsCount : categoriesCoveredCount)}
            hint={
              isAdmin
                ? `Across ${data.employees.length} active employees`
                : `Of ${DOCUMENT_CATEGORIES.length} document categories`
            }
            icon={<UserCheck className="h-4 w-4 text-primary" />}
          />
        </div>

        {/* Mobile Horizontal Category Pill Strip (< sm) */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none sm:hidden">
          <button
            type="button"
            onClick={() => setCatFilter("all")}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              catFilter === "all"
                ? "border-primary bg-primary text-primary-foreground shadow-xs"
                : "border-border bg-card text-muted-foreground"
            )}
          >
            All Categories
            <span className="font-mono-num text-[10px] opacity-80">
              {isAdmin ? employeeDocuments.length : approvedDocs.length}
            </span>
          </button>
          {DOCUMENT_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = catFilter === cat.value;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCatFilter(active ? "all" : cat.value)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-xs"
                    : "border-border bg-card text-muted-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {cat.shortLabel}
                <span className="font-mono-num text-[10px] opacity-80">
                  {categoryCounts[cat.value] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tabs Shell */}
        <TabsShell
          active={tab}
          onChange={setTab}
          tabs={[
            { key: "pending", label: `Pending Approval (${pendingDocs.length})`, hidden: !isAdmin },
            { key: "approved", label: `Approved Docs (${approvedDocs.length})` },
            { key: "expiring", label: `Expiring Soon (${expiringDocs.length})` },
            { key: "rejected", label: `Rejected (${rejectedDocs.length})`, hidden: !isAdmin },
            { key: "all", label: `All Employee Docs (${employeeDocuments.length})`, hidden: !isAdmin },
          ]}
        >
          <div className="space-y-4">
            {/* Mobile Clean Search & Status Bar (< sm) */}
            <div className="space-y-2.5 sm:hidden">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search document, employee, ID..."
                  className="h-10 rounded-xl border-border bg-card pl-10 pr-9 text-xs shadow-xs"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Sel
                    value={statusFilter}
                    onChange={setStatusFilter}
                    className="h-9 flex-1 rounded-xl text-xs"
                    options={[
                      { value: "all", label: "All Statuses" },
                      { value: "Verified", label: "Verified" },
                      { value: "Pending Verification", label: "Pending Approval" },
                      { value: "Rejected", label: "Rejected" },
                    ]}
                  />
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl px-3 text-xs"
                      onClick={() => {
                        setCatFilter("all");
                        setStatusFilter("all");
                        setSearch("");
                      }}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Desktop Filter Toolbar Card (sm+ — matches assets/leave pages) */}
            <div className="hidden flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm sm:flex sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-56 lg:w-72">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search document title, employee, ID..."
                    className="h-8.5 pl-8 text-xs"
                  />
                </div>
                <Sel
                  value={catFilter}
                  onChange={setCatFilter}
                  className="h-8.5 w-44 text-xs"
                  options={[
                    { value: "all", label: "All Categories" },
                    ...DOCUMENT_CATEGORIES.map((c) => ({
                      value: c.value,
                      label: `${c.label} (${categoryCounts[c.value] ?? 0})`,
                    })),
                  ]}
                />
                {isAdmin && (
                  <Sel
                    value={statusFilter}
                    onChange={setStatusFilter}
                    className="h-8.5 w-40 text-xs"
                    options={[
                      { value: "all", label: "All Statuses" },
                      { value: "Verified", label: "Verified" },
                      { value: "Pending Verification", label: "Pending Approval" },
                      { value: "Rejected", label: "Rejected" },
                    ]}
                  />
                )}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8.5 text-xs text-muted-foreground"
                    onClick={() => {
                      setCatFilter("all");
                      setStatusFilter("all");
                      setSearch("");
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>

              <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
                <Button
                  type="button"
                  variant={viewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className="h-7 gap-1 px-2.5 text-xs font-medium"
                >
                  <List className="h-3.5 w-3.5" /> Table
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="h-7 gap-1 px-2.5 text-xs font-medium"
                >
                  <LayoutGrid className="h-3.5 w-3.5" /> Cards
                </Button>
              </div>
            </div>

            {/* Content Area */}
            {filteredDocs.length === 0 ? (
              <EmptyState
                title={
                  tab === "pending"
                    ? "No employee documents waiting for approval"
                    : "No employee documents found"
                }
                hint={
                  isEmployee && pendingDocumentsCount > 0
                    ? `${pendingDocumentsCount} submitted document(s) are pending HR / Super Admin approval.`
                    : "Adjust your search or category filter, or upload a new employee document."
                }
                action={
                  <Button size="sm" onClick={() => setUploadOpen(true)}>
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    {isAdmin ? "Upload Employee Document" : "Submit Document"}
                  </Button>
                }
              />
            ) : (
              <>
                {/* Mobile always shows premium stacked rounded-2xl Cards */}
                <div className="grid grid-cols-1 gap-3.5 sm:hidden">
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

                {/* Desktop (sm+) renders Table (default, matching all modules) or Cards */}
                <div className="hidden sm:block">
                  {viewMode === "table" ? (
                    <DataTable
                      rows={filteredDocs}
                      rowKey={(r) => r.id}
                      onRowClick={(r) => setSelectedDocId(r.id)}
                      columns={tableColumns}
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
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
                  )}
                </div>
              </>
            )}
          </div>
        </TabsShell>

        {/* Document Preview & Detail Drawer */}
        <Sheet open={!!selectedDoc} onOpenChange={(o) => !o && setSelectedDocId(null)}>
          <SheetContent className="w-full max-w-none overflow-y-auto overscroll-contain p-4 sm:max-w-xl sm:p-6">
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
    </AppShell>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="p-6 text-xs text-muted-foreground">Loading employee documents...</div>
        </AppShell>
      }
    >
      <DocumentsPageInner />
    </Suspense>
  );
}

/* ---------- Premium Document Card (Mobile-first + Desktop Card View) ---------- */

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
      className="group cursor-pointer overflow-hidden rounded-2xl border-border/80 bg-card shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99] sm:rounded-xl"
    >
      {/* Visual Preview Header */}
      {doc.fileUrl && isImg ? (
        <div className="relative h-40 w-full overflow-hidden border-b border-border bg-muted/30 sm:h-36">
          <img
            src={doc.fileUrl}
            alt={doc.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute left-3 top-2.5 flex items-center gap-1.5">
            <span className="rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-semibold text-foreground shadow-xs backdrop-blur-md">
              IMG · {doc.size}
            </span>
          </div>
          <div className="absolute right-2.5 top-2.5">
            <StatusBadge status={doc.status} className="shadow-xs backdrop-blur-md" />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between border-b border-border/70 bg-gradient-to-r from-muted/40 via-muted/20 to-transparent px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            {doc.fileUrl && isPdf ? (
              <>
                <span className="inline-flex items-center rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                  PDF
                </span>
                <span>Tap to preview · {doc.size}</span>
              </>
            ) : (
              <>
                <FolderOpen className="h-3.5 w-3.5 text-primary" />
                <span>{doc.fileUrl ? `Attached · ${doc.size}` : "Metadata Record"}</span>
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
              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", meta.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <Badge variant="outline" className="mb-0.5 px-1.5 py-0 text-[10px] font-medium">
                  {meta.label}
                </Badge>
                <p className="text-[10px] text-muted-foreground">
                  v{doc.version} {doc.docNumber ? `· ${doc.docNumber}` : ""}
                </p>
              </div>
            </div>
            {doc.confidentiality && doc.confidentiality !== "Internal" && (
              <Badge variant="secondary" className="text-[10px]">
                {doc.confidentiality}
              </Badge>
            )}
          </div>

          <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-primary">
            {doc.name}
          </h3>

          <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2.5">
            <Person id={doc.ownerId} />
            <span className="text-[11px] text-muted-foreground">{doc.uploadedAt}</span>
          </div>
        </div>

        <div className="mt-3 space-y-2.5">
          {doc.expiresAt && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Expiry Date</span>
              <span
                className={cn(
                  "font-mono-num",
                  expiringSoon
                    ? "flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground"
                )}
              >
                {expiringSoon && <AlertTriangle className="h-3 w-3" />}
                {doc.expiresAt}
              </span>
            </div>
          )}

          {isAdmin && doc.status === "Pending Verification" ? (
            <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                className="h-9 flex-1 gap-1.5 rounded-xl bg-emerald-600 text-xs font-medium text-white hover:bg-emerald-700 sm:h-8 sm:rounded-lg"
                onClick={onVerify}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 flex-1 gap-1.5 rounded-xl border-rose-500/40 text-xs font-medium text-rose-600 hover:bg-rose-500/10 sm:h-8 sm:rounded-lg dark:text-rose-400"
                onClick={onReject}
              >
                <XCircle className="h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="secondary"
                className="h-9 flex-1 gap-1.5 rounded-xl text-xs font-medium sm:h-8 sm:rounded-lg"
                onClick={onSelect}
              >
                <Eye className="h-3.5 w-3.5" /> Preview
              </Button>
              {doc.fileUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5 rounded-xl px-3 text-xs font-medium sm:h-8 sm:rounded-lg"
                  onClick={() => downloadDocumentFile(doc)}
                >
                  <Download className="h-3.5 w-3.5" /> Download
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
      <SheetHeader className="text-left">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[11px]">
            {meta.label}
          </Badge>
          <StatusBadge status={doc.status} />
          {doc.confidentiality && (
            <Badge variant="secondary" className="text-[11px]">
              {doc.confidentiality}
            </Badge>
          )}
        </div>
        <SheetTitle className="text-base font-bold">{doc.name}</SheetTitle>
        <SheetDescription className="text-xs">
          Document ID: <span className="font-mono-num">{doc.id}</span> · Version {doc.version}
        </SheetDescription>
      </SheetHeader>

      {/* Interactive Document Preview */}
      <DocumentPreviewFrame
        fileUrl={doc.fileUrl}
        fileType={doc.fileType}
        fileName={doc.name}
        heightClass="h-[300px] sm:h-[360px]"
      />

      {diff !== null && diff <= 60 && (
        <div
          className={cn(
            "flex items-start gap-2.5 rounded-2xl border p-3.5 text-xs",
            diff <= 0
              ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400"
              : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
          )}
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

      <div className="grid grid-cols-2 gap-4 rounded-2xl border border-border bg-muted/20 p-4">
        <Stat label="Employee" value={<Person id={doc.ownerId} />} />
        <Stat label="Category" value={meta.label} />
        <Stat label="Uploaded By" value={doc.uploadedBy} />
        <Stat label="Uploaded On" value={doc.uploadedAt} />
        {doc.issueDate && <Stat label="Issue Date" value={doc.issueDate} />}
        <Stat label="Expiry Date" value={doc.expiresAt || "No expiry"} />
        {doc.docNumber && (
          <Stat label="Document No." value={<span className="font-mono-num">{doc.docNumber}</span>} />
        )}
        <Stat label="File Size" value={<span className="font-mono-num">{doc.size}</span>} />
        {doc.verifiedBy && <Stat label="Approved By" value={doc.verifiedBy} />}
      </div>

      {doc.notes && (
        <div className="rounded-2xl border border-border bg-muted/20 p-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">Notes / Description</p>
          <p className="mt-1 text-xs leading-relaxed text-foreground">{doc.notes}</p>
        </div>
      )}

      <div className="space-y-2.5 border-t border-border pt-4">
        <div className="flex flex-wrap gap-2">
          <Button
            className="h-10 flex-1 gap-1.5 rounded-xl text-xs font-semibold sm:h-9 sm:rounded-lg"
            disabled={!doc.fileUrl}
            onClick={() => downloadDocumentFile(doc)}
          >
            <Download className="h-4 w-4" />
            Download Document
          </Button>
          {doc.fileUrl && (
            <Button
              variant="outline"
              className="h-10 gap-1.5 rounded-xl text-xs font-medium sm:h-9 sm:rounded-lg"
              onClick={() => openDocumentInNewTab(doc.fileUrl)}
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open Tab
            </Button>
          )}
        </div>

        {isAdmin && doc.status === "Pending Verification" && (
          <div className="flex gap-2">
            <Button
              className="h-10 flex-1 gap-1.5 rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 sm:h-9 sm:rounded-lg"
              onClick={onVerify}
            >
              <CheckCircle2 className="h-4 w-4" /> Approve & Publish
            </Button>
            <Button
              variant="outline"
              className="h-10 flex-1 gap-1.5 rounded-xl border-rose-500/40 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 sm:h-9 sm:rounded-lg dark:text-rose-400"
              onClick={onReject}
            >
              <XCircle className="h-4 w-4" /> Reject
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
      <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[90dvh] overflow-y-auto overscroll-contain rounded-2xl p-4 sm:w-full sm:max-w-2xl sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle>{isAdmin ? "Upload Employee Document" : "Submit Document for HR Approval"}</DialogTitle>
          <DialogDescription>
            {isAdmin
              ? "Attach a verified document directly to an employee profile."
              : "Upload your document. It will be reviewed by HR or Super Admin before appearing in your Documents vault."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isAdmin && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Employee uploads require <strong>HR or Super Admin approval</strong> before they become visible in your portal.
              </span>
            </div>
          )}

          {/* File Selector Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-gradient-to-b from-muted/30 to-muted/10 px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/40"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx"
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
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
                  <FileUp className="h-5 w-5" />
                </div>
                <p className="mt-2.5 text-xs font-semibold text-foreground">
                  {fileName ? `${fileName} (${fileSize})` : "Tap to select PDF, PNG, or JPG (max 4 MB)"}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {fileName ? "Tap to replace file" : "A live preview will appear below before uploading"}
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
                heightClass="h-56 sm:h-60"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Document Title" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Signed Offer Letter, PAN Card"
                className="h-10 rounded-xl sm:h-9 sm:rounded-md"
              />
            </Field>
            <Field label="Attach to Employee" required>
              {isAdmin ? (
                <Sel
                  className="h-10 w-full rounded-xl sm:h-9 sm:rounded-md"
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
                  className="h-10 rounded-xl bg-muted/40 text-xs sm:h-9 sm:rounded-md"
                />
              )}
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Category" required>
              <Sel
                className="h-10 w-full rounded-xl sm:h-9 sm:rounded-md"
                value={category}
                onChange={setCategory}
                options={DOCUMENT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
              />
            </Field>
            <Field label="Confidentiality">
              <Sel
                className="h-10 w-full rounded-xl sm:h-9 sm:rounded-md"
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
                className="h-10 rounded-xl sm:h-9 sm:rounded-md"
              />
            </Field>
            <Field label="Issue Date">
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="h-10 rounded-xl sm:h-9 sm:rounded-md"
              />
            </Field>
            <Field label="Expiry Date">
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="h-10 rounded-xl sm:h-9 sm:rounded-md"
              />
            </Field>
          </div>

          <Field label="Notes / Description">
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional remarks for HR or employee..."
              className="h-10 rounded-xl sm:h-9 sm:rounded-md"
            />
          </Field>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting} className="rounded-xl sm:rounded-md">
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || readingFile} className="rounded-xl sm:rounded-md">
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
