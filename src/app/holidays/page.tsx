"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/data/store";
import { BRANCHES, type Branch, type Holiday } from "@/lib/data/types";
import { GVK_POLICY } from "@/lib/policies";
import { fmtDate } from "@/lib/format";
import { PageHeader, KpiCard, TabsShell, Field, EmptyState, ConfirmDialog } from "@/components/shared";
import { Sel, useScope } from "@/components/form-bits";
import { DataTable, exportCsv, type Column } from "@/components/data-table";
import { AppShell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CalendarDays,
  Plus,
  Search,
  RefreshCw,
  Download,
  Trash2,
  MapPin,
  Sparkles,
  LayoutGrid,
  List,
  Clock,
  CheckCircle2,
  Sun,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const HOLIDAY_TYPES = ["Public", "National", "Regional", "Company"] as const;

function getTodayIso(): string {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function getWeekdayName(dateStr: string): string {
  try {
    return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-IN", {
      weekday: "long",
      timeZone: "UTC",
    });
  } catch {
    return "";
  }
}

function getDaysDiff(dateStr: string, todayIso: string): number {
  const a = new Date(dateStr + "T00:00:00Z").getTime();
  const b = new Date(todayIso + "T00:00:00Z").getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((a - b) / 86400000);
}

function formatCountdown(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `In ${days} days`;
  if (days === -1) return "Yesterday";
  return `${Math.abs(days)}d ago`;
}

export default function HolidaysPage() {
  const { data, session, refreshHolidays, addHoliday, deleteHoliday } = useStore();
  const { isAdmin, isEmployee, uid } = useScope();

  const todayIso = useMemo(() => getTodayIso(), []);
  const myEmp = useMemo(
    () => data.employees.find((e) => e.id === uid || e.id === session?.employeeId),
    [data.employees, uid, session?.employeeId]
  );
  const myBranch = (myEmp?.branch || session?.branch || "").toLowerCase();

  const [tab, setTab] = useState<string>("upcoming");
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [view, setView] = useState<"table" | "cards">("table");
  const [refreshing, setRefreshing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null);

  useEffect(() => {
    refreshHolidays().catch(() => {});
  }, [refreshHolidays]);

  // Scope holidays: employees see All-branch holidays + their own branch; admins see all
  const scopedHolidays = useMemo(() => {
    return [...data.holidays]
      .filter((h) => {
        if (isAdmin) return true;
        if (!h.branches || h.branches === "All") return true;
        if (Array.isArray(h.branches)) {
          if (h.branches.length === 0) return true;
          return h.branches.some(
            (b) => b.toLowerCase() === "all" || (myBranch && b.toLowerCase() === myBranch)
          );
        }
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data.holidays, isAdmin, myBranch]);

  const upcomingHolidays = useMemo(
    () => scopedHolidays.filter((h) => h.date >= todayIso),
    [scopedHolidays, todayIso]
  );
  const pastHolidays = useMemo(
    () => scopedHolidays.filter((h) => h.date < todayIso).reverse(),
    [scopedHolidays, todayIso]
  );

  const nextHoliday = upcomingHolidays[0] ?? null;
  const nextDays = nextHoliday ? getDaysDiff(nextHoliday.date, todayIso) : null;

  const filteredHolidays = useMemo(() => {
    let base = scopedHolidays;
    if (tab === "upcoming") base = upcomingHolidays;
    else if (tab === "past") base = pastHolidays;

    const q = search.trim().toLowerCase();
    return base.filter((h) => {
      if (branchFilter !== "all") {
        if (h.branches !== "All" && Array.isArray(h.branches) && !h.branches.includes(branchFilter as Branch)) {
          return false;
        }
      }
      if (!q) return true;
      return (
        h.name.toLowerCase().includes(q) ||
        h.date.includes(q) ||
        (h.type && h.type.toLowerCase().includes(q)) ||
        (h.description && h.description.toLowerCase().includes(q))
      );
    });
  }, [scopedHolidays, upcomingHolidays, pastHolidays, tab, search, branchFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshHolidays();
    toast.success("Holiday calendar synced with database");
    setRefreshing(false);
  };

  const columns: Column<Holiday>[] = [
    {
      key: "date",
      header: "Date",
      sortValue: (r) => r.date,
      render: (r) => {
        const diff = getDaysDiff(r.date, todayIso);
        const isPast = diff < 0;
        return (
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg border text-center",
                isPast
                  ? "border-border bg-muted/40 text-muted-foreground"
                  : "border-primary/25 bg-primary/10 text-primary"
              )}
            >
              <span className="text-[9px] font-bold uppercase leading-none">
                {new Date(r.date + "T00:00:00Z").toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" })}
              </span>
              <span className="font-mono-num text-xs font-bold leading-tight">
                {r.date.slice(8, 10)}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">{fmtDate(r.date)}</p>
              <p className="text-[11px] text-muted-foreground">{getWeekdayName(r.date)}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "name",
      header: "Holiday / Occasion",
      sortValue: (r) => r.name,
      render: (r) => (
        <div>
          <p className="font-semibold text-foreground">{r.name}</p>
          {r.description && <p className="max-w-xs truncate text-[11px] text-muted-foreground">{r.description}</p>}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      hideOnMobile: true,
      render: (r) => (
        <Badge variant="outline" className="text-[11px]">
          {r.type || "Public"}
        </Badge>
      ),
    },
    {
      key: "branches",
      header: "Applicable Branches",
      render: (r) =>
        r.branches === "All" || !Array.isArray(r.branches) ? (
          <Badge className="bg-emerald-500/10 text-[11px] font-medium text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300">
            All Branches
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">{r.branches.join(", ")}</span>
        ),
    },
    {
      key: "timing",
      header: "Timeline",
      render: (r) => {
        const diff = getDaysDiff(r.date, todayIso);
        return (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
              diff === 0
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : diff > 0
                  ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {formatCountdown(diff)}
          </span>
        );
      },
    },
    ...(isAdmin
      ? [
          {
            key: "actions",
            header: "",
            render: (r: Holiday) => (
              <div className="flex justify-end">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-rose-600"
                  title="Remove holiday"
                  onClick={() => setDeleteTarget(r)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-0">
        {/* Mobile-First Premium Hero Header (< sm) */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-amber-500/5 p-4 shadow-sm sm:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Sun className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  <Sparkles className="h-2.5 w-2.5" />
                  Official Calendar
                </span>
                <h1 className="truncate text-lg font-bold tracking-tight text-foreground">
                  Company Holidays
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
              aria-label="Refresh holidays"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
          </div>

          {nextHoliday && nextDays !== null ? (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-primary/20 bg-background/80 px-3 py-2 text-xs">
              <div className="min-w-0">
                <span className="text-[10px] font-medium uppercase text-muted-foreground">Next Holiday</span>
                <p className="truncate font-semibold text-foreground">{nextHoliday.name}</p>
              </div>
              <Badge className="shrink-0 bg-primary/15 text-primary hover:bg-primary/20">
                {fmtDate(nextHoliday.date)} · {formatCountdown(nextDays)}
              </Badge>
            </div>
          ) : (
            <p className="mt-2.5 text-xs text-muted-foreground">
              Official public, national, and branch-level holiday schedule.
            </p>
          )}

          {isAdmin && (
            <div className="mt-3">
              <Button
                size="sm"
                onClick={() => setAddOpen(true)}
                className="h-10 w-full gap-1.5 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-sm"
              >
                <Plus className="h-4 w-4" /> Add Company Holiday
              </Button>
            </div>
          )}
        </div>

        {/* Desktop Header */}
        <div className="hidden sm:block">
          <PageHeader
            breadcrumb={["Time & Attendance", "Holidays"]}
            title="Company Holiday Calendar"
            description={
              isEmployee
                ? `View official GVK Edutech public, national, and branch holidays (${GVK_POLICY.publicHolidaysPerYear} public holidays/year + ${GVK_POLICY.monthlyHolidaysPerMonth} monthly day off).`
                : "Manage official public, national, regional, and company holidays visible across all employee portals."
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
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs shadow-sm"
                  onClick={() =>
                    exportCsv(
                      "company-holidays.csv",
                      ["Date", "Weekday", "Holiday", "Type", "Branches", "Notes"],
                      scopedHolidays.map((h) => [
                        h.date,
                        getWeekdayName(h.date),
                        h.name,
                        h.type || "Public",
                        h.branches === "All" ? "All Branches" : h.branches.join("; "),
                        h.description || "",
                      ])
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
                {isAdmin && (
                  <Button
                    size="sm"
                    onClick={() => setAddOpen(true)}
                    className="gap-1.5 bg-primary text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Holiday
                  </Button>
                )}
              </>
            }
          />
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 gap-2.5 sm:mb-6 sm:gap-3 xl:grid-cols-4">
          <KpiCard
            label="Total Holidays"
            value={String(scopedHolidays.length)}
            hint="Active calendar entries"
            icon={<CalendarDays className="h-4 w-4 text-primary" />}
            onClick={() => setTab("all")}
          />
          <KpiCard
            label="Upcoming Holidays"
            value={String(upcomingHolidays.length)}
            hint="Remaining this year"
            icon={<Clock className="h-4 w-4 text-blue-500" />}
            onClick={() => setTab("upcoming")}
          />
          <KpiCard
            label="Next Holiday"
            value={nextHoliday ? formatCountdown(nextDays ?? 0) : "None"}
            hint={nextHoliday ? `${nextHoliday.name} · ${fmtDate(nextHoliday.date)}` : "No upcoming dates"}
            icon={<Sun className="h-4 w-4 text-amber-500" />}
          />
          <KpiCard
            label="Policy Entitlement"
            value={`${GVK_POLICY.publicHolidaysPerYear} + ${GVK_POLICY.monthlyHolidaysPerMonth}/mo`}
            hint="Public holidays + 1 off/month"
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          />
        </div>

        {/* Tabs Shell */}
        <TabsShell
          active={tab}
          onChange={setTab}
          tabs={[
            { key: "upcoming", label: `Upcoming (${upcomingHolidays.length})` },
            { key: "all", label: `All Holidays (${scopedHolidays.length})` },
            { key: "past", label: `Past (${pastHolidays.length})` },
          ]}
        >
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:rounded-xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-64 lg:w-72">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search holiday name or date..."
                    className="h-9 rounded-xl pl-8 text-xs sm:h-8.5 sm:rounded-md"
                  />
                </div>
                {isAdmin && (
                  <Sel
                    value={branchFilter}
                    onChange={setBranchFilter}
                    className="h-9 w-full rounded-xl text-xs sm:h-8.5 sm:w-44 sm:rounded-md"
                    options={[
                      { value: "all", label: "All Branches" },
                      ...BRANCHES.map((b) => ({ value: b, label: b })),
                    ]}
                  />
                )}
              </div>

              <div className="hidden items-center rounded-lg border border-border bg-muted/40 p-0.5 sm:flex">
                <Button
                  variant={view === "table" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("table")}
                  className="h-7 gap-1 px-2.5 text-xs font-medium"
                >
                  <List className="h-3.5 w-3.5" /> Table
                </Button>
                <Button
                  variant={view === "cards" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("cards")}
                  className="h-7 gap-1 px-2.5 text-xs font-medium"
                >
                  <LayoutGrid className="h-3.5 w-3.5" /> Cards
                </Button>
              </div>
            </div>

            {filteredHolidays.length === 0 ? (
              <EmptyState
                title="No holidays found"
                hint={
                  tab === "upcoming"
                    ? "No upcoming holidays scheduled yet."
                    : "Adjust your search or branch filter."
                }
                action={
                  isAdmin ? (
                    <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 text-xs">
                      <Plus className="h-3.5 w-3.5" /> Add Holiday
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                {/* Mobile Stacked Cards */}
                <div className="grid grid-cols-1 gap-3 sm:hidden">
                  {filteredHolidays.map((h) => (
                    <HolidayCard
                      key={h.id}
                      holiday={h}
                      todayIso={todayIso}
                      isAdmin={isAdmin}
                      onDelete={() => setDeleteTarget(h)}
                    />
                  ))}
                </div>

                {/* Desktop Table / Cards */}
                <div className="hidden sm:block">
                  {view === "table" ? (
                    <DataTable
                      columns={columns}
                      rows={filteredHolidays}
                      rowKey={(r) => r.id}
                      pageSize={15}
                      emptyTitle="No holidays found"
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                      {filteredHolidays.map((h) => (
                        <HolidayCard
                          key={h.id}
                          holiday={h}
                          todayIso={todayIso}
                          isAdmin={isAdmin}
                          onDelete={() => setDeleteTarget(h)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* GVK Holiday Policy Footer Card */}
            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-xs">
              <p className="font-semibold text-foreground">
                GVK Edutech Holiday &amp; Comp-Off Policy (Appointment Letter · Annexure C)
              </p>
              <p className="mt-1 leading-relaxed text-muted-foreground">
                Employees receive <strong>{GVK_POLICY.publicHolidaysPerYear} public holidays</strong> per calendar year plus{" "}
                <strong>{GVK_POLICY.monthlyHolidaysPerMonth} monthly day off</strong> (sanctioned by Regional Director / Operations Head) in addition to Sundays. Prior-approved attendance on any Sunday or official holiday earns either a <strong>Comp-Off</strong> or <strong>1 day&apos;s Gross Salary</strong> encashment.
              </p>
            </div>
          </div>
        </TabsShell>

        {/* Add Holiday Dialog (HR / Super Admin only) */}
        {isAdmin && (
          <AddHolidayDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            todayIso={todayIso}
            onSubmit={async (payload) => {
              const res = await addHoliday(payload);
              if (!res.ok) {
                toast.error(res.error || "Could not add holiday.");
                return false;
              }
              toast.success(`Added "${payload.name}" (${fmtDate(payload.date)}) to holiday calendar.`);
              return true;
            }}
          />
        )}

        {/* Delete Holiday Confirmation */}
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(v) => !v && setDeleteTarget(null)}
          title={`Remove "${deleteTarget?.name || ""}"?`}
          description="This will remove the holiday from the official company calendar for all employees."
          confirmLabel="Remove Holiday"
          destructive
          onConfirm={async () => {
            if (!deleteTarget) return;
            const res = await deleteHoliday(deleteTarget.id);
            if (!res.ok) {
              toast.error(res.error || "Failed to remove holiday.");
              return;
            }
            toast.success(`Removed "${deleteTarget.name}".`);
            setDeleteTarget(null);
          }}
        />
      </div>
    </AppShell>
  );
}

function HolidayCard({
  holiday,
  todayIso,
  isAdmin,
  onDelete,
}: {
  holiday: Holiday;
  todayIso: string;
  isAdmin: boolean;
  onDelete: () => void;
}) {
  const diff = getDaysDiff(holiday.date, todayIso);
  const isPast = diff < 0;

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-2xl border p-4 shadow-sm transition-all sm:rounded-xl",
        isPast ? "border-border/60 bg-muted/20 opacity-80" : "border-border bg-card hover:border-primary/35"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border",
              diff === 0
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : isPast
                  ? "border-border bg-muted text-muted-foreground"
                  : "border-primary/25 bg-primary/10 text-primary"
            )}
          >
            <span className="text-[10px] font-bold uppercase leading-none">
              {new Date(holiday.date + "T00:00:00Z").toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" })}
            </span>
            <span className="font-mono-num text-base font-bold leading-tight">
              {holiday.date.slice(8, 10)}
            </span>
          </div>

          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-foreground">{holiday.name}</h4>
            <p className="text-[11px] text-muted-foreground">
              {getWeekdayName(holiday.date)} · {fmtDate(holiday.date)}
            </p>
          </div>
        </div>

        <Badge
          variant={diff >= 0 ? "default" : "secondary"}
          className={cn(
            "shrink-0 text-[10px]",
            diff === 0
              ? "bg-emerald-600 text-white"
              : diff > 0
                ? "bg-primary/15 text-primary hover:bg-primary/20"
                : ""
          )}
        >
          {formatCountdown(diff)}
        </Badge>
      </div>

      {holiday.description && (
        <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{holiday.description}</p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-[11px]">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {holiday.branches === "All" || !Array.isArray(holiday.branches)
              ? "All Branches"
              : holiday.branches.join(", ")}
          </span>
          {holiday.type && (
            <Badge variant="outline" className="ml-1 px-1.5 py-0 text-[9px]">
              {holiday.type}
            </Badge>
          )}
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-rose-600"
          >
            <Trash2 className="h-3 w-3" /> Remove
          </button>
        )}
      </div>
    </div>
  );
}

function AddHolidayDialog({
  open,
  onOpenChange,
  todayIso,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  todayIso: string;
  onSubmit: (h: Omit<Holiday, "id">) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayIso);
  const [type, setType] = useState<string>("Public");
  const [scope, setScope] = useState<"All" | "Custom">("All");
  const [branches, setBranches] = useState<Branch[]>(["Hyderabad"]);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleBranch = (b: Branch, checked: boolean) => {
    setBranches((prev) =>
      checked ? (prev.includes(b) ? prev : [...prev, b]) : prev.filter((x) => x !== b)
    );
  };

  const valid = name.trim().length >= 2 && Boolean(date) && (scope === "All" || branches.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[90dvh] overflow-y-auto overscroll-contain rounded-2xl p-4 sm:w-full sm:max-w-lg sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base font-bold">Add Official Holiday</DialogTitle>
          <DialogDescription className="text-xs">
            Publish a public, regional, or company holiday visible immediately to employees.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1 text-xs">
          <Field label="Holiday Name / Occasion" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sankranti, Republic Day, Founders Day"
              className="h-10 rounded-xl sm:h-9 sm:rounded-md"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Holiday Date" required>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-xl sm:h-9 sm:rounded-md"
              />
            </Field>
            <Field label="Holiday Type">
              <Sel
                value={type}
                onChange={setType}
                className="h-10 w-full rounded-xl sm:h-9 sm:rounded-md"
                options={[...HOLIDAY_TYPES]}
              />
            </Field>
          </div>

          <Field label="Applicable Branches">
            <Sel
              value={scope}
              onChange={(v) => setScope(v as "All" | "Custom")}
              className="h-10 w-full rounded-xl sm:h-9 sm:rounded-md"
              options={[
                { value: "All", label: "All Branches (Company-wide)" },
                { value: "Custom", label: "Selected Branches Only" },
              ]}
            />
          </Field>

          {scope === "Custom" && (
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/20 p-3">
              {BRANCHES.map((b) => (
                <label key={b} className="flex cursor-pointer items-center gap-2 text-xs">
                  <Checkbox
                    checked={branches.includes(b)}
                    onCheckedChange={(v) => toggleBranch(b, v === true)}
                  />
                  <span>{b}</span>
                </label>
              ))}
            </div>
          )}

          <Field label="Notes / Description">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional instructions or branch closure note"
              className="h-10 rounded-xl sm:h-9 sm:rounded-md"
            />
          </Field>
        </div>

        <DialogFooter className="gap-2 border-t border-border pt-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="rounded-xl sm:rounded-md">
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!valid || submitting}
            className="gap-1.5 rounded-xl bg-primary font-semibold text-primary-foreground sm:rounded-md"
            onClick={async () => {
              setSubmitting(true);
              const ok = await onSubmit({
                name: name.trim(),
                date,
                type,
                branches: scope === "All" ? "All" : branches,
                description: description.trim() || undefined,
              });
              setSubmitting(false);
              if (ok) {
                setName("");
                setDescription("");
                onOpenChange(false);
              }
            }}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" /> Add Holiday
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
