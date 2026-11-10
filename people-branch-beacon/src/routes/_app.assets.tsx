import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/data/store";
import { TODAY } from "@/lib/data/seed";
import { PageHeader, KpiCard, StatusBadge, Field, Timeline } from "@/components/shared";
import { DataTable, exportCsv, type Column } from "@/components/data-table";
import { Person, Sel, useScope, useNames } from "@/components/form-bits";
import { BRANCHES } from "@/lib/data/types";
import type { Asset, Branch } from "@/lib/data/types";
import { fmtDate, inr, daysUntil } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Boxes, Laptop, Wrench, PackageCheck, Plus, Download } from "lucide-react";

export const Route = createFileRoute("/_app/assets")({
  head: () => ({ meta: [
    { title: "Assets — OfficeFlow" },
    { name: "description", content: "Company asset inventory, assignments, returns and warranty tracking." },
    { property: "og:title", content: "Assets — OfficeFlow" },
    { property: "og:description", content: "Company asset inventory, assignments, returns and warranty tracking." },
  ] }),
  component: AssetsPage,
});

function AssetsPage() {
  const { data, addAsset, issueAsset, returnAsset } = useStore();
  const { isAdmin, isEmployee, uid, inScope } = useScope();
  const nameOf = useNames();
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [issueTo, setIssueTo] = useState("");
  const [cond, setCond] = useState("Good");

  const base = isEmployee ? data.assets.filter((a) => a.assignedTo === uid) : isAdmin ? data.assets : data.assets.filter((a) => a.assignedTo && inScope(a.assignedTo));
  const rows = base.filter((a) => (status === "all" || a.status === status) && (!q || `${a.name} ${a.id} ${a.serial}`.toLowerCase().includes(q.toLowerCase())));
  const current = data.assets.find((a) => a.id === view);

  const cols: Column<Asset>[] = [
    { key: "i", header: "Asset", sortValue: (r) => r.id, render: (r) => <span><span className="block font-medium">{r.name}</span><span className="text-[11px] text-muted-foreground">{r.id} · {r.serial}</span></span> },
    { key: "c", header: "Category", render: (r) => r.category },
    { key: "b", header: "Branch", render: (r) => r.branch, hideOnMobile: true },
    { key: "a", header: "Assigned to", render: (r) => <Person id={r.assignedTo} /> },
    { key: "w", header: "Warranty", render: (r) => { const n = daysUntil(r.warrantyExpiry); return <span className={n !== undefined && n < 0 ? "text-danger" : ""}>{fmtDate(r.warrantyExpiry)}</span>; }, hideOnMobile: true },
    { key: "cd", header: "Condition", render: (r) => <StatusBadge status={r.condition} /> },
    { key: "s", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader title={isEmployee ? "My Assets" : "Assets"} description={isEmployee ? "Equipment currently issued to you." : "Track inventory, assignments and returns across branches."}
        actions={isAdmin ? <>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => exportCsv("assets.csv", ["ID", "Name", "Category", "Serial", "Branch", "Assigned", "Status"], data.assets.map((a) => [a.id, a.name, a.category, a.serial, a.branch, nameOf(a.assignedTo), a.status]))}><Download className="h-3.5 w-3.5" /> Export</Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddOpen(true)}><Plus className="h-3.5 w-3.5" /> Add asset</Button>
        </> : undefined} />
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Total assets" value={String(base.length)} icon={<Boxes className="h-4 w-4" />} />
        <KpiCard label="Assigned" value={String(base.filter((a) => a.status === "Assigned").length)} icon={<Laptop className="h-4 w-4" />} />
        <KpiCard label="Available" value={String(base.filter((a) => a.status === "Available").length)} icon={<PackageCheck className="h-4 w-4" />} />
        <KpiCard label="Under maintenance" value={String(base.filter((a) => a.status === "Under Maintenance" || a.status === "Damaged").length)} icon={<Wrench className="h-4 w-4" />} />
      </div>
      <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} onRowClick={(r) => { setView(r.id); setIssueTo(""); }} pageSize={12} emptyTitle={isEmployee ? "No assets issued to you" : "No assets match"}
        toolbar={<div className="flex flex-wrap gap-2"><Input placeholder="Search name, ID or serial…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-56 text-xs" /><Sel value={status} onChange={setStatus} className="h-8 w-44" options={[{ value: "all", label: "All statuses" }, "Available", "Assigned", "Under Maintenance", "Damaged", "Retired"]} /></div>} />

      <Sheet open={!!current} onOpenChange={(v) => !v && setView(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {current && <>
            <SheetHeader><SheetTitle>{current.name}</SheetTitle></SheetHeader>
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex gap-2"><StatusBadge status={current.status} /><StatusBadge status={current.condition} /></div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <dt className="text-muted-foreground">Asset ID</dt><dd>{current.id}</dd>
                <dt className="text-muted-foreground">Model</dt><dd>{current.brandModel}</dd>
                <dt className="text-muted-foreground">Serial</dt><dd>{current.serial}</dd>
                <dt className="text-muted-foreground">Purchased</dt><dd>{fmtDate(current.purchaseDate)} · {inr(current.purchaseValue)}</dd>
                <dt className="text-muted-foreground">Warranty</dt><dd>{fmtDate(current.warrantyExpiry)}</dd>
                <dt className="text-muted-foreground">Assigned to</dt><dd><Person id={current.assignedTo} /></dd>
              </dl>
              {isAdmin && current.status === "Available" && (
                <div className="space-y-2 rounded-md border border-border p-3">
                  <Field label="Issue to employee"><Sel value={issueTo} onChange={setIssueTo} placeholder="Select employee" options={data.employees.filter((e) => e.status !== "Inactive").map((e) => ({ value: e.id, label: e.name }))} /></Field>
                  <Button size="sm" className="w-full text-xs" disabled={!issueTo} onClick={() => { issueAsset(current.id, issueTo, "Issued via asset desk"); toast.success(`Issued to ${nameOf(issueTo)}`); }}>Issue asset</Button>
                </div>
              )}
              {isAdmin && current.status === "Assigned" && (
                <div className="space-y-2 rounded-md border border-border p-3">
                  <Field label="Return condition"><Sel value={cond} onChange={setCond} options={["Excellent", "Good", "Fair", "Poor"]} /></Field>
                  <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => { returnAsset(current.id, cond as Asset["condition"], "Returned to IT"); toast.success("Asset returned"); }}>Record return</Button>
                </div>
              )}
              <div><p className="mb-2 text-xs font-semibold">History</p><Timeline items={[...current.history].reverse().map((h) => ({ at: h.date, title: h.action + (h.employeeId ? ` — ${nameOf(h.employeeId)}` : ""), note: h.note }))} /></div>
            </div>
          </>}
        </SheetContent>
      </Sheet>
      <AddAssetDialog open={addOpen} onOpenChange={setAddOpen} onSubmit={(a) => { addAsset(a); setAddOpen(false); toast.success("Asset added"); }} />
    </div>
  );
}

function AddAssetDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (v: boolean) => void; onSubmit: (a: Omit<Asset, "id" | "history" | "status">) => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Laptop");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [branch, setBranch] = useState<string>("Hyderabad");
  const [value, setValue] = useState("65000");
  const [warranty, setWarranty] = useState("2029-10-22");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add asset</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Asset name" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dell Latitude 5440" /></Field>
          <Field label="Category"><Sel value={category} onChange={setCategory} options={["Laptop", "Monitor", "Phone", "Headset", "Access Card", "Furniture", "Other"]} /></Field>
          <Field label="Brand / model"><Input value={model} onChange={(e) => setModel(e.target.value)} /></Field>
          <Field label="Serial number" required><Input value={serial} onChange={(e) => setSerial(e.target.value)} /></Field>
          <Field label="Branch"><Sel value={branch} onChange={setBranch} options={BRANCHES} /></Field>
          <Field label="Purchase value (₹)"><Input value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} /></Field>
          <div className="col-span-2"><Field label="Warranty expiry"><Input type="date" value={warranty} onChange={(e) => setWarranty(e.target.value)} /></Field></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={name.length < 3 || serial.length < 3} onClick={() => onSubmit({ name, category, brandModel: model || name, serial, branch: branch as Branch, assignedTo: null, purchaseDate: TODAY, purchaseValue: Number(value) || 0, warrantyExpiry: warranty, condition: "Excellent" })}>Add asset</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
