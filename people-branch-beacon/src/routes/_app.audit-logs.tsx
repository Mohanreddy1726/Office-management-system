import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/data/store";
import { PageHeader, KpiCard, StatusBadge } from "@/components/shared";
import { DataTable, exportCsv, type Column } from "@/components/data-table";
import { Sel } from "@/components/form-bits";
import type { AuditEntry } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Download, ScrollText, ShieldAlert, Users } from "lucide-react";

export const Route = createFileRoute("/_app/audit-logs")({
  head: () => ({ meta: [
    { title: "Audit Logs — OfficeFlow" },
    { name: "description", content: "Tamper-evident history of every change made across OfficeFlow." },
    { property: "og:title", content: "Audit Logs — OfficeFlow" },
    { property: "og:description", content: "Tamper-evident history of every change made across OfficeFlow." },
  ] }),
  component: AuditPage,
});

function AuditPage() {
  const { data } = useStore();
  const [q, setQ] = useState("");
  const [mod, setMod] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [view, setView] = useState<AuditEntry | null>(null);
  const modules = [...new Set(data.audit.map((a) => a.module))].sort();
  const rows = data.audit.filter((a) => (mod === "all" || a.module === mod) && (outcome === "all" || a.outcome === outcome) && (!q || `${a.user} ${a.action} ${a.record}`.toLowerCase().includes(q.toLowerCase())));

  const cols: Column<AuditEntry>[] = [
    { key: "t", header: "Timestamp", sortValue: (r) => r.timestamp, render: (r) => <span className="tabular-nums text-xs">{r.timestamp}</span> },
    { key: "u", header: "User", sortValue: (r) => r.user, render: (r) => r.user },
    { key: "a", header: "Action", render: (r) => <span className="font-medium">{r.action}</span> },
    { key: "m", header: "Module", render: (r) => r.module },
    { key: "r", header: "Record", render: (r) => <span className="block max-w-[220px] truncate">{r.record}</span>, hideOnMobile: true },
    { key: "o", header: "Outcome", render: (r) => <StatusBadge status={r.outcome} /> },
  ];

  return (
    <div>
      <PageHeader title="Audit Logs" description="Every create, update, approval and configuration change is recorded here."
        actions={<Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => exportCsv("audit-log.csv", ["Timestamp", "User", "Action", "Module", "Record", "Outcome", "Reason"], rows.map((a) => [a.timestamp, a.user, a.action, a.module, a.record, a.outcome, a.reason ?? ""]))}><Download className="h-3.5 w-3.5" /> Export</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-3">
        <KpiCard label="Total events" value={String(data.audit.length)} icon={<ScrollText className="h-4 w-4" />} />
        <KpiCard label="Failures" value={String(data.audit.filter((a) => a.outcome === "Failure").length)} icon={<ShieldAlert className="h-4 w-4" />} />
        <KpiCard label="Distinct users" value={String(new Set(data.audit.map((a) => a.user)).size)} icon={<Users className="h-4 w-4" />} />
      </div>
      <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} onRowClick={setView} pageSize={15}
        toolbar={<div className="flex flex-wrap gap-2">
          <Input placeholder="Search user, action or record…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-64 text-xs" />
          <Sel value={mod} onChange={setMod} className="h-8 w-44" options={[{ value: "all", label: "All modules" }, ...modules]} />
          <Sel value={outcome} onChange={setOutcome} className="h-8 w-36" options={[{ value: "all", label: "All outcomes" }, "Success", "Failure"]} />
        </div>} />
      <Sheet open={!!view} onOpenChange={(v) => !v && setView(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {view && <>
            <SheetHeader><SheetTitle>{view.action}</SheetTitle></SheetHeader>
            <dl className="mt-4 grid grid-cols-[110px_1fr] gap-2 text-sm">
              {([["Timestamp", view.timestamp], ["User", view.user], ["Module", view.module], ["Record", view.record], ["Outcome", view.outcome], ["Reason", view.reason], ["Details", view.details], ["Old value", view.oldValue], ["New value", view.newValue]] as const).filter(([, v]) => v).map(([k, v]) => (
                <><dt key={k} className="text-xs text-muted-foreground">{k}</dt><dd className="text-xs">{v}</dd></>
              ))}
            </dl>
          </>}
        </SheetContent>
      </Sheet>
    </div>
  );
}
