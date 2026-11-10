"use client";

import { useState, useMemo } from "react";
import { AppShell } from "@/components/shell";
import { useStore } from "@/lib/data/store";
import { PageHeader, KpiCard, StatusBadge } from "@/components/shared";
import { DataTable, exportCsv, type Column } from "@/components/data-table";
import { Sel } from "@/components/form-bits";
import type { AuditEntry } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Download,
  ScrollText,
  ShieldAlert,
  Users,
  Layers,
  Table as TableIcon,
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  FileText,
  Filter,
  ArrowUpRight,
  Activity,
} from "lucide-react";

export default function AuditLogsPage() {
  const { data } = useStore();
  const [q, setQ] = useState("");
  const [mod, setMod] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [view, setView] = useState<AuditEntry | null>(null);

  const modules = useMemo(() => {
    return [...new Set(data.audit.map((a) => a.module))].sort();
  }, [data.audit]);

  const rows = useMemo(() => {
    return data.audit.filter((a) => {
      const matchMod = mod === "all" || a.module === mod;
      const matchOutcome = outcome === "all" || a.outcome === outcome;
      const searchTarget = `${a.user} ${a.action} ${a.record} ${a.module} ${a.reason ?? ""} ${a.details ?? ""}`.toLowerCase();
      const matchQ = !q || searchTarget.includes(q.toLowerCase());
      return matchMod && matchOutcome && matchQ;
    });
  }, [data.audit, mod, outcome, q]);

  const failureCount = data.audit.filter((a) => a.outcome === "Failure").length;
  const distinctUsers = new Set(data.audit.map((a) => a.user)).size;

  const cols: Column<AuditEntry>[] = [
    {
      key: "t",
      header: "Timestamp",
      sortValue: (r) => r.timestamp,
      render: (r) => (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {r.timestamp}
        </span>
      ),
    },
    {
      key: "u",
      header: "Actor",
      sortValue: (r) => r.user,
      render: (r) => <span className="font-semibold text-foreground">{r.user}</span>,
    },
    {
      key: "a",
      header: "Operation / Action",
      render: (r) => <span className="font-medium text-foreground">{r.action}</span>,
    },
    {
      key: "m",
      header: "Module",
      render: (r) => (
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
          {r.module}
        </span>
      ),
    },
    {
      key: "r",
      header: "Target Record",
      render: (r) => <span className="block max-w-[220px] truncate text-xs">{r.record}</span>,
      hideOnMobile: true,
    },
    { key: "o", header: "Outcome", render: (r) => <StatusBadge status={r.outcome} /> },
    {
      key: "act",
      header: "",
      render: (r) => (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1"
          onClick={() => setView(r)}
        >
          <Eye className="h-3 w-3" /> Inspect
        </Button>
      ),
    },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Audit Trail & Compliance Log"
          description="Immutable, tamper-evident chronological history of all employee state changes, biometric imports, approvals, and administrative actions."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border border-border bg-card p-0.5 shadow-sm">
                <Button
                  size="sm"
                  variant={viewMode === "cards" ? "default" : "ghost"}
                  className="h-8 px-3 text-xs gap-1.5"
                  onClick={() => setViewMode("cards")}
                >
                  <Layers className="h-3.5 w-3.5" /> Cards
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "table" ? "default" : "ghost"}
                  className="h-8 px-3 text-xs gap-1.5"
                  onClick={() => setViewMode("table")}
                >
                  <TableIcon className="h-3.5 w-3.5" /> Table
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-medium"
                onClick={() => {
                  exportCsv(
                    "audit-log-export.csv",
                    ["Timestamp", "Actor", "Action", "Module", "Target Record", "Outcome", "Reason", "Details"],
                    rows.map((a) => [
                      a.timestamp,
                      a.user,
                      a.action,
                      a.module,
                      a.record,
                      a.outcome,
                      a.reason ?? "",
                      a.details ?? "",
                    ])
                  );
                  toast.success("Audit log CSV exported");
                }}
              >
                <Download className="h-3.5 w-3.5" /> Export Audit CSV
              </Button>
            </div>
          }
        />

        {/* 3 Top KPI Cards */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          <KpiCard
            label="Total Logged Events"
            value={String(data.audit.length)}
            icon={<ScrollText className="h-4 w-4 text-primary" />}
            hint="Chronological entries"
          />
          <KpiCard
            label="Failed / Flagged Events"
            value={String(failureCount)}
            icon={<ShieldAlert className={`h-4 w-4 ${failureCount > 0 ? "text-rose-500" : "text-emerald-500"}`} />}
            hint={failureCount === 0 ? "Zero security failures" : "Exceptions captured"}
          />
          <KpiCard
            label="Distinct System Actors"
            value={String(distinctUsers)}
            icon={<Users className="h-4 w-4 text-indigo-500" />}
            hint="Users performing changes"
          />
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search actor, action, record ID, or reason..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-9 text-xs pl-9"
              />
            </div>
            <Sel
              value={mod}
              onChange={setMod}
              className="h-9 w-44 text-xs"
              options={[{ value: "all", label: "All Modules" }, ...modules.map((m) => ({ value: m, label: m }))]}
            />
            <Sel
              value={outcome}
              onChange={setOutcome}
              className="h-9 w-36 text-xs"
              options={[
                { value: "all", label: "All Outcomes" },
                { value: "Success", label: "Success" },
                { value: "Failure", label: "Failure" },
              ]}
            />
          </div>

          <span className="text-xs text-muted-foreground">
            Displaying <span className="font-semibold text-foreground">{rows.length}</span> audit records
          </span>
        </div>

        {/* Card or Table View */}
        {viewMode === "cards" ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rows.map((a) => {
              const initials = a.user
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();

              return (
                <div
                  key={a.id}
                  className="group flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-border cursor-pointer"
                  onClick={() => setView(a)}
                >
                  <div>
                    {/* Header matching user photo */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-white shadow-sm text-xs">
                            {initials}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${
                              a.outcome === "Success" ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground text-sm tracking-tight">{a.user}</h4>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                            <Clock className="h-3 w-3" /> {a.timestamp}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={a.outcome} />
                    </div>

                    {/* Action Title & Module */}
                    <div className="mt-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center rounded-md bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300">
                          {a.module}
                        </span>
                      </div>
                      <p className="mt-1.5 font-semibold text-foreground text-sm leading-snug">{a.action}</p>
                    </div>

                    {/* 3 KPI Metric Tiles */}
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-muted/40 p-2 text-center col-span-2">
                        <span className="text-[9px] font-semibold uppercase text-muted-foreground block tracking-wider">
                          Target Record
                        </span>
                        <span className="text-xs font-bold text-foreground block mt-0.5 truncate">
                          {a.record}
                        </span>
                      </div>
                      <div className="rounded-xl bg-muted/40 p-2 text-center">
                        <span className="text-[9px] font-semibold uppercase text-muted-foreground block tracking-wider">
                          Audit ID
                        </span>
                        <span className="text-xs font-mono font-bold text-foreground block mt-0.5 truncate">
                          {a.id}
                        </span>
                      </div>
                    </div>

                    {/* Reason / Details Note */}
                    {(a.reason || a.details) && (
                      <div className="mt-3 rounded-lg bg-muted/30 p-2.5 text-xs text-muted-foreground italic border border-border/40">
                        "{a.reason || a.details}"
                      </div>
                    )}
                  </div>

                  {/* Card Bottom */}
                  <div className="mt-4 border-t border-border/60 pt-3 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Click to inspect metadata</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 font-medium border-primary/30 text-primary hover:bg-primary/5"
                      onClick={(e) => {
                        e.stopPropagation();
                        setView(a);
                      }}
                    >
                      <Eye className="h-3 w-3" /> View Log Details
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} onRowClick={setView} pageSize={15} />
        )}

        {/* Slide-out Sheet for Detailed Audit Inspection */}
        <Sheet open={!!view} onOpenChange={(v) => !v && setView(null)}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            {view && (
              <div className="space-y-6 pt-4">
                <SheetHeader className="border-b border-border pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {view.module}
                    </span>
                    <StatusBadge status={view.outcome} />
                  </div>
                  <SheetTitle className="text-lg font-bold text-foreground leading-snug">
                    {view.action}
                  </SheetTitle>
                  <p className="text-xs text-muted-foreground font-mono">
                    Log Entry ID: {view.id} • {view.timestamp}
                  </p>
                </SheetHeader>

                {/* Actor & Target Summary Card */}
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
                        Executing Actor
                      </span>
                      <span className="font-semibold text-foreground text-sm">{view.user}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
                        System Module
                      </span>
                      <span className="font-medium text-foreground">{view.module}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
                        Target Record Identifier
                      </span>
                      <span className="font-mono text-foreground font-medium">{view.record}</span>
                    </div>
                  </div>
                </div>

                {/* Additional Metadata Details */}
                <div className="space-y-3 text-xs">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Audit Metadata & State Snapshot
                  </h4>

                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    {view.reason && (
                      <div>
                        <span className="text-muted-foreground font-medium block mb-1">Stated Reason:</span>
                        <p className="rounded-lg bg-muted/40 p-2.5 text-foreground italic">{view.reason}</p>
                      </div>
                    )}

                    {view.details && (
                      <div>
                        <span className="text-muted-foreground font-medium block mb-1">Operation Details:</span>
                        <p className="rounded-lg bg-muted/40 p-2.5 text-foreground">{view.details}</p>
                      </div>
                    )}

                    {view.oldValue && (
                      <div>
                        <span className="text-muted-foreground font-medium block mb-1">Previous Value:</span>
                        <pre className="rounded-lg bg-muted/40 p-2.5 font-mono text-[11px] overflow-x-auto text-rose-600">
                          {view.oldValue}
                        </pre>
                      </div>
                    )}

                    {view.newValue && (
                      <div>
                        <span className="text-muted-foreground font-medium block mb-1">New Applied Value:</span>
                        <pre className="rounded-lg bg-muted/40 p-2.5 font-mono text-[11px] overflow-x-auto text-emerald-600">
                          {view.newValue}
                        </pre>
                      </div>
                    )}

                    {!view.reason && !view.details && !view.oldValue && !view.newValue && (
                      <p className="text-muted-foreground italic text-center py-2">
                        No additional state diffs recorded for this entry.
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setView(null)}>
                    Close Inspector
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AppShell>
  );
}