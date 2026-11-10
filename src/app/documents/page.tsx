"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/data/store";
import { TODAY } from "@/lib/data/seed";
import { PageHeader, KpiCard, StatusBadge, TabsShell, Field, EmployeeAvatar } from "@/components/shared";
import { DataTable, exportCsv, type Column } from "@/components/data-table";
import { Person, Sel, useScope, useNames } from "@/components/form-bits";
import type { DocumentRecord } from "@/lib/data/types";
import { fmtDate, daysUntil, initials, avatarColor } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { AppShell } from "@/components/shell";
import {
  FileText, Upload, ShieldCheck, Clock, FileWarning, Download,
  Check, X, Search, LayoutGrid, List, Building2, Shield,
  ArrowUpRight, Eye, FileCheck2, AlertTriangle, FileSpreadsheet,
  CheckCircle2, FolderLock, ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";

const DOCUMENT_CATEGORIES = [
  "Identity",
  "Address Proof",
  "Education",
  "Offer Letters",
  "Employment",
  "Policies",
  "Exit",
  "Certificate",
  "Others",
];

export default function DocumentsPage() {
  const { data, addDocument, decideDocument, me } = useStore();
  const { isAdmin, isEmployee, uid, inScope } = useScope();
  const nameOf = useNames();

  const [tab, setTab] = useState<string>("all");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals & Slide-out Sheet
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailDoc, setDetailDoc] = useState<DocumentRecord | null>(null);

  // Scoped documents
  const visibleDocuments = useMemo(() => {
    return data.documents.filter(
      (d) => d.ownerId === null || (isEmployee ? d.ownerId === uid : inScope(d.ownerId))
    );
  }, [data.documents, isEmployee, uid, inScope]);

  // Tab & Search filtered documents
  const filteredDocuments = useMemo(() => {
    return visibleDocuments.filter((d) => {
      // Tab filter
      if (tab === "pending" && d.status !== "Pending Verification") return false;
      if (tab === "expiring") {
        const days = daysUntil(d.expiresAt);
        if (days === undefined || days > 60 || days < 0) return false;
      }
      if (tab === "policies" && d.ownerId !== null) return false;
      if (tab === "mine" && d.ownerId !== uid) return false;

      // Category filter
      if (categoryFilter !== "all" && d.category !== categoryFilter) return false;

      // Status filter
      if (statusFilter !== "all" && d.status !== statusFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const ownerName = d.ownerId ? nameOf(d.ownerId).toLowerCase() : "company policy";
        return (
          d.name.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q) ||
          ownerName.includes(q)
        );
      }

      return true;
    });
  }, [visibleDocuments, tab, categoryFilter, statusFilter, searchQuery, uid, nameOf]);

  // Quick KPI subsets
  const pendingDocs = useMemo(
    () => visibleDocuments.filter((d) => d.status === "Pending Verification"),
    [visibleDocuments]
  );

  const expiringDocs = useMemo(() => {
    return visibleDocuments.filter((d) => {
      const n = daysUntil(d.expiresAt);
      return n !== undefined && n <= 60 && n >= 0;
    });
  }, [visibleDocuments]);

  const policyDocs = useMemo(
    () => visibleDocuments.filter((d) => d.ownerId === null),
    [visibleDocuments]
  );

  const myDocs = useMemo(
    () => visibleDocuments.filter((d) => d.ownerId === uid),
    [visibleDocuments, uid]
  );

  // Table Columns
  const tableColumns: Column<DocumentRecord>[] = [
    {
      key: "n",
      header: "Document Name",
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <span className="font-semibold text-foreground hover:underline cursor-pointer" onClick={() => setDetailDoc(r)}>
              {r.name}
            </span>
            <span className="block text-[11px] text-muted-foreground">
              v{r.version} · {r.size}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "c",
      header: "Category",
      render: (r) => (
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-muted dark:text-muted-foreground">
          {r.category}
        </span>
      ),
    },
    {
      key: "o",
      header: "Belongs To",
      render: (r) =>
        r.ownerId ? (
          <Link href={`/employees/${r.ownerId}`} className="group flex items-center gap-1.5 hover:underline">
            <Person id={r.ownerId} />
            <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            <Building2 className="h-3 w-3" /> Company Policy
          </span>
        ),
      hideOnMobile: true,
    },
    {
      key: "u",
      header: "Uploaded",
      sortValue: (r) => r.uploadedAt,
      render: (r) => fmtDate(r.uploadedAt.slice(0, 10)),
      hideOnMobile: true,
    },
    {
      key: "x",
      header: "Expiry Date",
      render: (r) => {
        const n = daysUntil(r.expiresAt);
        if (!r.expiresAt) return <span className="text-muted-foreground">—</span>;
        const isExpiring = n !== undefined && n <= 60 && n >= 0;
        return (
          <span className={cn("font-medium", isExpiring ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>
            {fmtDate(r.expiresAt)}
            {isExpiring && ` (${n}d left)`}
          </span>
        );
      },
    },
    { key: "s", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "act",
      header: "",
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setDetailDoc(r)}
          >
            Preview
          </Button>
          {isAdmin && r.status === "Pending Verification" && (
            <>
              <Button
                size="sm"
                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  decideDocument(r.id, "Verified");
                  toast.success(`Document verified`);
                }}
              >
                Verify
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                onClick={() => {
                  decideDocument(r.id, "Rejected");
                  toast.error(`Document marked as rejected`);
                }}
              >
                Reject
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs gap-1"
            onClick={() => toast.info(`Downloading ${r.name} (demo)`)}
          >
            <Download className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <div>
        <PageHeader
          breadcrumb={["Operations", "Document Repository"]}
          title="Document Repository & Compliance"
          description="Central archive for employee identity proofs, educational degrees, offer letters, NDAs, and corporate HR policies."
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs shadow-sm"
                onClick={() =>
                  exportCsv(
                    "document-manifest.csv",
                    ["Document ID", "Name", "Category", "Owner ID", "Owner Name", "Version", "Size", "Uploaded At", "Expires At", "Status"],
                    visibleDocuments.map((d) => [
                      d.id,
                      d.name,
                      d.category,
                      d.ownerId ?? "Company",
                      d.ownerId ? nameOf(d.ownerId) : "All Employees",
                      String(d.version),
                      d.size,
                      d.uploadedAt,
                      d.expiresAt ?? "None",
                      d.status,
                    ])
                  )
                }
              >
                <Download className="h-3.5 w-3.5" /> Export Manifest
              </Button>
              <Button
                size="sm"
                className="gap-1.5 text-xs shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => setUploadOpen(true)}
              >
                <Upload className="h-3.5 w-3.5" /> Upload Document
              </Button>
            </>
          }
        />

        {/* Top KPI Cards Row */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total Documents"
            value={String(visibleDocuments.length)}
            hint="Active repository files"
            icon={<FileText className="h-4 w-4 text-primary" />}
            onClick={() => setTab("all")}
          />
          <KpiCard
            label="Pending Verification"
            value={String(pendingDocs.length)}
            hint={pendingDocs.length > 0 ? "Requires compliance check" : "All files verified"}
            icon={<Clock className="h-4 w-4 text-amber-500" />}
            onClick={() => setTab("pending")}
          />
          <KpiCard
            label="Expiring in 60 Days"
            value={String(expiringDocs.length)}
            hint={expiringDocs.length > 0 ? "Upcoming renewals due" : "No expirations imminent"}
            icon={<FileWarning className="h-4 w-4 text-rose-500" />}
            onClick={() => setTab("expiring")}
          />
          <KpiCard
            label="Company Policies"
            value={String(policyDocs.length)}
            hint="Handbook & guidelines"
            icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />}
            onClick={() => setTab("policies")}
          />
        </div>

        {/* Tabs Shell */}
        <TabsShell
          tabs={[
            { key: "all", label: `All Documents (${visibleDocuments.length})` },
            { key: "pending", label: `Pending Verification (${pendingDocs.length})` },
            { key: "expiring", label: `Expiring Soon (${expiringDocs.length})` },
            { key: "policies", label: `Company Policies (${policyDocs.length})` },
            { key: "mine", label: `My Documents (${myDocs.length})` },
          ]}
          active={tab}
          onChange={(t) => {
            setTab(t);
            setSearchQuery("");
          }}
        >
          <div className="space-y-4">
            {/* Filter Toolbar */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-56 sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search document name, employee, tag..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8.5 pl-8 text-xs"
                  />
                </div>
                <Sel
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  className="h-8.5 w-40 text-xs"
                  options={[{ value: "all", label: "All Categories" }, ...DOCUMENT_CATEGORIES]}
                />
                <Sel
                  value={statusFilter}
                  onChange={setStatusFilter}
                  className="h-8.5 w-40 text-xs"
                  options={[
                    { value: "all", label: "All Statuses" },
                    { value: "Verified", label: "Verified" },
                    { value: "Pending Verification", label: "Pending Verification" },
                    { value: "Rejected", label: "Rejected" },
                  ]}
                />
                {(searchQuery || categoryFilter !== "all" || statusFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setCategoryFilter("all");
                      setStatusFilter("all");
                    }}
                    className="h-8.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Reset
                  </Button>
                )}
              </div>

              {/* View Switcher */}
              <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
                <Button
                  variant={view === "cards" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("cards")}
                  className="h-7 gap-1 px-2.5 text-xs font-medium"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Cards
                </Button>
                <Button
                  variant={view === "table" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("table")}
                  className="h-7 gap-1 px-2.5 text-xs font-medium"
                >
                  <List className="h-3.5 w-3.5" />
                  Table
                </Button>
              </div>
            </div>

            {/* CARDS VIEW */}
            {view === "cards" && (
              <div>
                {filteredDocuments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground/60 mb-2" />
                    <p className="text-sm font-semibold text-foreground">No Documents Found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      No files match the active filters or search criteria.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredDocuments.map((doc) => (
                      <DocumentCard
                        key={doc.id}
                        doc={doc}
                        isAdmin={isAdmin}
                        onVerify={() => {
                          decideDocument(doc.id, "Verified");
                          toast.success(`Document verified`);
                        }}
                        onReject={() => {
                          decideDocument(doc.id, "Rejected");
                          toast.error(`Document rejected`);
                        }}
                        onPreview={() => setDetailDoc(doc)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TABLE VIEW */}
            {view === "table" && (
              <DataTable
                columns={tableColumns}
                rows={filteredDocuments}
                rowKey={(r) => r.id}
                pageSize={12}
                onRowClick={setDetailDoc}
                emptyTitle="No documents match your query"
              />
            )}
          </div>
        </TabsShell>

        {/* MODAL: Upload Document */}
        <UploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onSubmit={(newDoc) => {
            addDocument({
              ...newDoc,
              uploadedBy: me()?.name || "HR Admin",
            });
            setUploadOpen(false);
            toast.success("Document uploaded successfully — marked for verification");
          }}
        />

        {/* SLIDE-OUT SHEET: Document Details */}
        <Sheet open={!!detailDoc} onOpenChange={(v) => !v && setDetailDoc(null)}>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            {detailDoc && (
              <DocumentDetailSheetContent
                doc={detailDoc}
                isAdmin={isAdmin}
                onVerify={() => {
                  decideDocument(detailDoc.id, "Verified");
                  toast.success(`Document verified`);
                  setDetailDoc(null);
                }}
                onReject={() => {
                  decideDocument(detailDoc.id, "Rejected");
                  toast.error(`Document rejected`);
                  setDetailDoc(null);
                }}
              />
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AppShell>
  );
}

/* =========================================================================================
 * COMPONENT: DocumentCard (Rich custom card matching photo aesthetic)
 * ========================================================================================= */
function DocumentCard({
  doc,
  isAdmin,
  onVerify,
  onReject,
  onPreview,
}: {
  doc: DocumentRecord;
  isAdmin: boolean;
  onVerify: () => void;
  onReject: () => void;
  onPreview: () => void;
}) {
  const { data } = useStore();
  const nameOf = useNames();
  const emp = doc.ownerId ? data.employees.find((e) => e.id === doc.ownerId) : null;

  const daysLeft = daysUntil(doc.expiresAt);
  const isExpiringSoon = daysLeft !== undefined && daysLeft <= 60 && daysLeft >= 0;

  // Icon badge color by category
  const badgeStyle = {
    Identity: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
    "Offer Letters": "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900",
    Education: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    Policies: "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900",
    Employment: "bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900",
  }[doc.category] ?? "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800";

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all duration-200 dark:bg-card dark:border-border hover:shadow-md">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl border font-bold shadow-sm", badgeStyle)}>
              <FileText className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <h4
                onClick={onPreview}
                className="font-semibold text-foreground text-[14px] truncate cursor-pointer hover:text-primary transition-colors"
                title={doc.name}
              >
                {doc.name}
              </h4>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-muted dark:text-muted-foreground">
                  {doc.category}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  v{doc.version} · {doc.size}
                </span>
              </div>
            </div>
          </div>

          <StatusBadge status={doc.status} />
        </div>

        {/* Divider */}
        <div className="my-3.5 border-t border-slate-100 dark:border-slate-800" />

        {/* Owner / Affiliation Banner */}
        <div className="mb-3.5 flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-foreground dark:bg-muted/30">
          <div className="flex items-center gap-2 truncate">
            {doc.ownerId ? (
              <Link href={`/employees/${doc.ownerId}`} className="flex items-center gap-1.5 hover:underline truncate">
                <EmployeeAvatar id={doc.ownerId} name={emp?.name || doc.ownerId} size={22} />
                <span className="font-semibold text-foreground truncate">{emp?.name || nameOf(doc.ownerId)}</span>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-700 dark:text-indigo-400">
                <Building2 className="h-3.5 w-3.5" /> Company-Wide Policy
              </span>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground shrink-0">{fmtDate(doc.uploadedAt.slice(0, 10))}</span>
        </div>

        {/* 3 Metric Boxes (photo style) */}
        <div className="grid grid-cols-3 gap-2">
          {/* Box 1: Category */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Format</p>
            <p className="mt-0.5 truncate text-[11px] font-bold text-slate-900 dark:text-white">
              {doc.name.endsWith(".png") || doc.name.endsWith(".jpg") ? "IMAGE" : "PDF DOC"}
            </p>
          </div>

          {/* Box 2: Size */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">File Size</p>
            <p className="mt-0.5 text-xs font-bold text-primary">{doc.size}</p>
          </div>

          {/* Box 3: Expiry Status */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Expiry</p>
            <p
              className={cn(
                "mt-0.5 truncate text-[11px] font-bold",
                isExpiringSoon ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-200"
              )}
            >
              {doc.expiresAt ? (isExpiringSoon ? `${daysLeft}d left` : fmtDate(doc.expiresAt)) : "No Expiry"}
            </p>
          </div>
        </div>

        {/* Expiring Soon Alert Callout */}
        {isExpiringSoon && (
          <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>Document expires in {daysLeft} days — renewal needed</span>
          </div>
        )}
      </div>

      {/* Footer / Actions */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <button
          onClick={onPreview}
          className="text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
        >
          <Eye className="h-3 w-3" /> Quick Preview
        </button>

        <div className="flex items-center gap-1.5">
          {isAdmin && doc.status === "Pending Verification" ? (
            <>
              <Button
                size="sm"
                className="h-7 px-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                onClick={onVerify}
              >
                <Check className="mr-1 h-3 w-3" /> Verify
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                onClick={onReject}
              >
                Reject
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs font-medium gap-1 text-slate-700 dark:text-slate-300"
              onClick={() => toast.info(`Downloading ${doc.name} (demo)`)}
            >
              <Download className="h-3 w-3" /> Download
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================================
 * COMPONENT: DocumentDetailSheetContent
 * ========================================================================================= */
function DocumentDetailSheetContent({
  doc,
  isAdmin,
  onVerify,
  onReject,
}: {
  doc: DocumentRecord;
  isAdmin: boolean;
  onVerify: () => void;
  onReject: () => void;
}) {
  const { data } = useStore();
  const nameOf = useNames();
  const emp = doc.ownerId ? data.employees.find((e) => e.id === doc.ownerId) : null;
  const daysLeft = daysUntil(doc.expiresAt);

  return (
    <div className="space-y-6 pt-4">
      <SheetHeader>
        <div className="flex items-center justify-between">
          <SheetTitle className="text-base font-bold truncate pr-4">{doc.name}</SheetTitle>
          <StatusBadge status={doc.status} />
        </div>
      </SheetHeader>

      {/* Visual Document Banner Preview */}
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-slate-50/60 p-8 text-center dark:bg-muted/20">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
          <FileText className="h-8 w-8" />
        </div>
        <p className="font-semibold text-foreground text-sm">{doc.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {doc.category} · Version {doc.version} · {doc.size}
        </p>
        <Button
          size="sm"
          className="mt-4 gap-1.5 text-xs shadow-sm"
          onClick={() => toast.info(`Opening ${doc.name} (demo viewer)`)}
        >
          <Download className="h-3.5 w-3.5" /> Download Full Document
        </Button>
      </div>

      {/* Document Metadata Details */}
      <div className="space-y-2.5 rounded-xl border border-border p-3.5 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Document Identifier:</span>
          <span className="font-mono font-semibold text-foreground">{doc.id}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Category:</span>
          <span className="font-semibold text-foreground">{doc.category}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Owner / Assignee:</span>
          <span className="font-semibold text-foreground">
            {doc.ownerId ? `${emp?.name || nameOf(doc.ownerId)} (${doc.ownerId})` : "Company-Wide Policy"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Uploaded By:</span>
          <span className="font-semibold text-foreground">{doc.uploadedBy}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Upload Timestamp:</span>
          <span className="font-semibold text-foreground">{doc.uploadedAt}</span>
        </div>
        {doc.expiresAt && (
          <div className="flex justify-between pt-1 border-t border-border">
            <span className="text-muted-foreground">Expiration Date:</span>
            <span className="font-semibold text-foreground">
              {fmtDate(doc.expiresAt)} {daysLeft !== undefined && `(${daysLeft} days remaining)`}
            </span>
          </div>
        )}
      </div>

      {/* Compliance & Verification Actions */}
      {isAdmin && doc.status === "Pending Verification" && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-xs font-semibold text-foreground">Administrative Verification</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={onVerify}
            >
              <Check className="mr-1.5 h-3.5 w-3.5" /> Verify Document
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-rose-600 border-rose-200"
              onClick={onReject}
            >
              <X className="mr-1.5 h-3.5 w-3.5" /> Reject Document
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================================
 * DIALOG: UploadDialog
 * ========================================================================================= */
function UploadDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (d: Omit<DocumentRecord, "id" | "version" | "uploadedBy">) => void;
}) {
  const { data } = useStore();
  const { isEmployee, uid, isAdmin } = useScope();

  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const [category, setCategory] = useState("Identity");
  const [docNumber, setDocNumber] = useState("");
  const [owner, setOwner] = useState(uid);
  const [confidentiality, setConfidentiality] = useState<"Public" | "Internal" | "Restricted" | "Strictly Confidential">("Internal");
  const [issueDate, setIssueDate] = useState(TODAY);
  const [expires, setExpires] = useState("");
  const [notes, setNotes] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      if (!docName) setDocName(f.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const valid = (file || docName.trim().length >= 3) && category;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Upload Document & Compliance Dossier</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Secure enterprise document repository with confidentiality tagging and expiry tracking.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2 text-xs">
          <div className="col-span-2">
            <Field
              label="File Attachment"
              required
              hint="Supports PDF, PNG, JPG, DOCX (browser demo storage up to 10 MB)"
            >
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.docx"
                onChange={handleFileChange}
                className="h-10 file:mr-2 file:rounded-md file:border-0 file:bg-primary/10 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-primary"
              />
            </Field>
          </div>

          <div className="col-span-2">
            <Field label="Document Display Title" required>
              <Input
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="e.g. Passport — Karthik Reddy"
                className="h-9"
              />
            </Field>
          </div>

          <Field label="Document Category">
            <Sel value={category} onChange={setCategory} options={DOCUMENT_CATEGORIES} />
          </Field>

          <Field label="Document Number / ID (optional)" hint="e.g. PAN, Aadhaar or Degree Roll #">
            <Input
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              placeholder="e.g. ABCDE1234F / 1092837"
              className="h-9 font-mono"
            />
          </Field>

          {!isEmployee && (
            <Field label="Belongs To / Record Owner">
              <Sel
                value={owner}
                onChange={setOwner}
                options={[
                  ...(isAdmin ? [{ value: "company", label: "🏢 Company Policy (All Employees)" }] : []),
                  ...data.employees.map((e) => ({ value: e.id, label: `${e.name} (${e.id}) · ${e.department}` })),
                ]}
              />
            </Field>
          )}

          <Field label="Confidentiality Classification">
            <Sel
              value={confidentiality}
              onChange={(v) => setConfidentiality(v as "Public" | "Internal" | "Restricted" | "Strictly Confidential")}
              options={["Public", "Internal", "Restricted", "Strictly Confidential"]}
            />
          </Field>

          <Field label="Issue / Effective Date">
            <Input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="h-9"
            />
          </Field>

          <Field label="Expiration Date (optional)" hint="Triggers compliance renewal alert">
            <Input
              type="date"
              value={expires}
              min={TODAY}
              onChange={(e) => setExpires(e.target.value)}
              className="h-9"
            />
          </Field>

          <div className="col-span-2">
            <Field label="Verification Remarks / Issuing Authority (optional)">
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Verified by HR Operations / Issued by Ministry of External Affairs"
                className="h-9"
              />
            </Field>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!valid}
            onClick={() => {
              const sizeStr = file ? `${Math.max(1, Math.round(file.size / 1024))} KB` : "340 KB";
              onSubmit({
                name: docName || file?.name || "Uploaded Document",
                category,
                subType: docNumber || undefined,
                docNumber: docNumber || undefined,
                confidentiality,
                ownerId: owner === "company" ? null : owner,
                uploadedAt: `${TODAY} 10:00`,
                status: "Pending Verification",
                size: sizeStr,
                expiresAt: expires || undefined,
              });
            }}
            className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            Upload Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
