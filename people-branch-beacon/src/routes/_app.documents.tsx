import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/data/store";
import { TODAY } from "@/lib/data/seed";
import { PageHeader, KpiCard, StatusBadge, TabsShell, Field } from "@/components/shared";
import { DataTable, type Column } from "@/components/data-table";
import { Person, Sel, useScope, moduleSearch } from "@/components/form-bits";
import type { DocumentRecord } from "@/lib/data/types";
import { fmtDate, daysUntil } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileText, Upload, ShieldCheck, Clock, FileWarning } from "lucide-react";

export const Route = createFileRoute("/_app/documents")({
  head: () => ({ meta: [
    { title: "Documents — OfficeFlow" },
    { name: "description", content: "Employee and company documents with verification and expiry tracking." },
    { property: "og:title", content: "Documents — OfficeFlow" },
    { property: "og:description", content: "Employee and company documents with verification and expiry tracking." },
  ] }),
  validateSearch: moduleSearch,
  component: DocumentsPage,
});

const CATEGORIES = ["Identity", "Address Proof", "Education", "Offer Letter", "Contract", "Payslip", "Policy", "Certificate", "Other"];

function DocumentsPage() {
  const { data, addDocument, decideDocument, me } = useStore();
  const { isAdmin, isEmployee, uid, inScope } = useScope();
  const search = Route.useSearch();
  const [tab, setTab] = useState("all");
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(search.open === "upload");

  const visible = useMemo(() => data.documents.filter((d) => d.ownerId === null || (isEmployee ? d.ownerId === uid : inScope(d.ownerId))), [data.documents, isEmployee, uid, inScope]);
  const filtered = visible.filter((d) => (cat === "all" || d.category === cat) && (!q || d.name.toLowerCase().includes(q.toLowerCase())));
  const pending = visible.filter((d) => d.status === "Pending Verification");
  const expiring = visible.filter((d) => { const n = daysUntil(d.expiresAt); return n !== undefined && n <= 60; });
  const policies = visible.filter((d) => d.ownerId === null);

  const cols: Column<DocumentRecord>[] = [
    { key: "n", header: "Document", sortValue: (r) => r.name, render: (r) => <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><span><span className="block font-medium">{r.name}</span><span className="text-[11px] text-muted-foreground">v{r.version} · {r.size}</span></span></span> },
    { key: "c", header: "Category", render: (r) => r.category },
    { key: "o", header: "Owner", render: (r) => (r.ownerId ? <Person id={r.ownerId} /> : <span className="text-muted-foreground">Company</span>), hideOnMobile: true },
    { key: "u", header: "Uploaded", sortValue: (r) => r.uploadedAt, render: (r) => fmtDate(r.uploadedAt.slice(0, 10)), hideOnMobile: true },
    { key: "x", header: "Expires", render: (r) => { const n = daysUntil(r.expiresAt); return r.expiresAt ? <span className={n !== undefined && n <= 60 ? "font-medium text-danger" : ""}>{fmtDate(r.expiresAt)}{n !== undefined && n <= 60 ? ` (${n}d)` : ""}</span> : "—"; } },
    { key: "s", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "a", header: "", render: (r) => (
      <div className="flex gap-1.5">
        {isAdmin && r.status === "Pending Verification" && <>
          <Button size="sm" className="h-7 text-xs" onClick={() => { decideDocument(r.id, "Verified"); toast.success("Document verified"); }}>Verify</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { decideDocument(r.id, "Rejected"); toast.error("Document rejected"); }}>Reject</Button>
        </>}
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toast.info(`Downloading ${r.name} (demo)`)}>Download</Button>
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Documents" description="Central repository for employee records and company policies."
        actions={<Button size="sm" className="gap-1.5 text-xs" onClick={() => setOpen(true)}><Upload className="h-3.5 w-3.5" /> Upload document</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Documents" value={String(visible.length)} icon={<FileText className="h-4 w-4" />} />
        <KpiCard label="Pending verification" value={String(pending.length)} icon={<Clock className="h-4 w-4" />} onClick={() => setTab("pending")} />
        <KpiCard label="Expiring in 60 days" value={String(expiring.length)} icon={<FileWarning className="h-4 w-4" />} onClick={() => setTab("expiring")} />
        <KpiCard label="Company policies" value={String(policies.length)} icon={<ShieldCheck className="h-4 w-4" />} onClick={() => setTab("policies")} />
      </div>
      <TabsShell tabs={[{ key: "all", label: "All documents" }, { key: "pending", label: `Pending (${pending.length})` }, { key: "expiring", label: `Expiring (${expiring.length})` }, { key: "policies", label: "Policies" }]} active={tab} onChange={setTab}>
        <DataTable columns={cols} rows={tab === "pending" ? pending : tab === "expiring" ? expiring : tab === "policies" ? policies : filtered} rowKey={(r) => r.id} pageSize={12}
          toolbar={tab === "all" ? <div className="flex flex-wrap gap-2"><Input placeholder="Search documents…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-56 text-xs" /><Sel value={cat} onChange={setCat} className="h-8 w-44" options={[{ value: "all", label: "All categories" }, ...CATEGORIES]} /></div> : undefined} />
      </TabsShell>
      <UploadDialog open={open} onOpenChange={setOpen} onSubmit={(d) => { addDocument({ ...d, uploadedBy: me()?.name ?? "Demo" }); setOpen(false); toast.success("Document uploaded — pending verification"); }} />
    </div>
  );
}

function UploadDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (v: boolean) => void; onSubmit: (d: Omit<DocumentRecord, "id" | "version" | "uploadedBy">) => void }) {
  const { data } = useStore();
  const { isEmployee, uid, isAdmin } = useScope();
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("Identity");
  const [owner, setOwner] = useState(uid);
  const [expires, setExpires] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Upload document</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="File" required hint="PDF, JPG or PNG up to 10 MB (stored only in this browser demo)"><Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
          <Field label="Category"><Sel value={category} onChange={setCategory} options={CATEGORIES} /></Field>
          {!isEmployee && <Field label="Belongs to"><Sel value={owner} onChange={setOwner} options={[...(isAdmin ? [{ value: "company", label: "Company (policy)" }] : []), ...data.employees.map((e) => ({ value: e.id, label: e.name }))]} /></Field>}
          <Field label="Expiry date (optional)"><Input type="date" value={expires} min={TODAY} onChange={(e) => setExpires(e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!file || (file?.size ?? 0) > 10 * 1024 * 1024} onClick={() => file && onSubmit({ name: file.name, category, ownerId: owner === "company" ? null : owner, uploadedAt: `${TODAY} 10:00`, status: "Pending Verification", size: `${Math.max(1, Math.round(file.size / 1024))} KB`, expiresAt: expires || undefined })}>Upload</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
