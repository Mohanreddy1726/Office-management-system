"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/data/store";
import { PageHeader, KpiCard, StatusBadge, TabsShell, Field } from "@/components/shared";
import { DataTable, type Column } from "@/components/data-table";
import { Person, Sel } from "@/components/form-bits";
import { BRANCHES, type Branch, type Joiner, type OnboardingTask, type Resignation, type FormerEmployee } from "@/lib/data/types";
import { DEPARTMENTS, TODAY } from "@/lib/data/seed";
import { fmtDate, initials } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AppShell } from "@/components/shell";
import {
  UserPlus, LogOut, ListChecks, History, Check, X,
  LayoutGrid, List, Mail, Calendar, Building2, Shield,
  ArrowUpRight, AlertCircle, FileCheck2, Clock, CheckCircle2,
  Send, UserCheck, Briefcase, Download, Plus, Phone, Sparkles, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function OnboardingPage() {
  const { data, addOnboardingTaskUpdate, addJoiner, addResignation, addOnboardingTask } = useStore();
  const [tab, setTab] = useState("joiners");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [q, setQ] = useState("");

  // Modal dialog states
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [resignOpen, setResignOpen] = useState(false);

  const filteredJoiners = useMemo(() => {
    if (!q.trim()) return data.joiners;
    const t = q.toLowerCase();
    return data.joiners.filter(
      (j) =>
        j.name.toLowerCase().includes(t) ||
        j.workEmail.toLowerCase().includes(t) ||
        j.department.toLowerCase().includes(t) ||
        j.designation.toLowerCase().includes(t)
    );
  }, [data.joiners, q]);

  const filteredTasks = useMemo(() => {
    if (!q.trim()) return data.onboardingTasks;
    const t = q.toLowerCase();
    return data.onboardingTasks.filter(
      (task) =>
        task.task.toLowerCase().includes(t) ||
        task.category.toLowerCase().includes(t) ||
        task.owner.toLowerCase().includes(t)
    );
  }, [data.onboardingTasks, q]);

  const filteredResignations = useMemo(() => {
    if (!q.trim()) return data.resignations;
    const t = q.toLowerCase();
    return data.resignations.filter((r) => r.reason.toLowerCase().includes(t) || r.status.toLowerCase().includes(t));
  }, [data.resignations, q]);

  const filteredFormer = useMemo(() => {
    if (!q.trim()) return data.formerEmployees;
    const t = q.toLowerCase();
    return data.formerEmployees.filter(
      (f) =>
        f.name.toLowerCase().includes(t) ||
        f.designation.toLowerCase().includes(t) ||
        f.department.toLowerCase().includes(t) ||
        f.reason.toLowerCase().includes(t)
    );
  }, [data.formerEmployees, q]);

  /* Table Columns */
  const joinerCols: Column<Joiner>[] = [
    {
      key: "n",
      header: "Name",
      sortValue: (r) => r.name,
      render: (r) => (
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 font-semibold text-white text-xs">
            {initials(r.name)}
          </span>
          <span>
            <span className="block font-medium">{r.name}</span>
            <span className="text-[11px] text-muted-foreground">{r.workEmail}</span>
          </span>
        </span>
      ),
    },
    { key: "d", header: "Role", render: (r) => `${r.designation} · ${r.department}` },
    { key: "b", header: "Branch", render: (r) => r.branch, hideOnMobile: true },
    { key: "j", header: "Joining", sortValue: (r) => r.joiningDate, render: (r) => fmtDate(r.joiningDate) },
    {
      key: "c",
      header: "Checklist",
      render: (r) => (
        <span className="flex w-36 items-center gap-2">
          <Progress value={r.checklistCompletion} className="h-1.5" />
          <span className="text-[11px] font-medium">{r.checklistCompletion}%</span>
        </span>
      ),
    },
  ];

  const taskCols: Column<OnboardingTask>[] = [
    { key: "e", header: "Employee", render: (r) => <Person id={r.employeeId} /> },
    { key: "t", header: "Task", render: (r) => r.task },
    { key: "c", header: "Category", render: (r) => r.category, hideOnMobile: true },
    { key: "o", header: "Owner", render: (r) => r.owner, hideOnMobile: true },
    { key: "d", header: "Due", sortValue: (r) => r.dueDate, render: (r) => fmtDate(r.dueDate) },
    {
      key: "s",
      header: "Status",
      render: (r) => (
        <Sel
          value={r.status}
          className="h-7 w-32"
          onChange={(v) => {
            addOnboardingTaskUpdate(r.id, v as OnboardingTask["status"]);
            toast.success(`Task marked ${v}`);
          }}
          options={["Pending", "In Progress", "Completed", "Blocked"]}
        />
      ),
    },
  ];

  const flag = (b: boolean) =>
    b ? (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
        <Check className="h-3.5 w-3.5 text-emerald-600" /> Done
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <X className="h-3.5 w-3.5 text-rose-500" /> Pending
      </span>
    );

  const resCols: Column<Resignation>[] = [
    { key: "e", header: "Employee", render: (r) => <Person id={r.employeeId} /> },
    { key: "r", header: "Resigned", render: (r) => fmtDate(r.resignationDate) },
    { key: "l", header: "Last day", sortValue: (r) => r.lastWorkingDay, render: (r) => fmtDate(r.lastWorkingDay) },
    { key: "m", header: "Manager", render: (r) => <StatusBadge status={r.managerApproval} /> },
    { key: "h", header: "HR", render: (r) => <StatusBadge status={r.hrApproval} /> },
    { key: "ho", header: "Handover", render: (r) => flag(r.handoverDone), hideOnMobile: true },
    { key: "a", header: "Assets", render: (r) => flag(r.assetReturnDone), hideOnMobile: true },
    { key: "f", header: "Finance", render: (r) => flag(r.financeClearance), hideOnMobile: true },
    { key: "s", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  const formerCols: Column<FormerEmployee>[] = [
    { key: "n", header: "Name", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "d", header: "Role", render: (r) => `${r.designation} · ${r.department}` },
    { key: "b", header: "Branch", render: (r) => r.branch },
    { key: "x", header: "Exit date", sortValue: (r) => r.exitDate, render: (r) => fmtDate(r.exitDate) },
    { key: "r", header: "Reason", render: (r) => r.reason },
    {
      key: "c",
      header: "Clearance",
      render: (r) => <StatusBadge status={r.clearanceDone ? "Completed" : "Pending"} />,
    },
  ];

  return (
    <AppShell>
      <div>
        <PageHeader
          title="Onboarding & Exit"
          description="Joiner checklists, exit clearance workflows, and complete employee lifecycle tracking."
        />

        {/* Top KPIs */}
        <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard
            label="Upcoming joiners"
            value={String(data.joiners.length)}
            icon={<UserPlus className="h-4 w-4" />}
            onClick={() => setTab("joiners")}
          />
          <KpiCard
            label="Open onboarding tasks"
            value={String(data.onboardingTasks.filter((t) => t.status !== "Completed").length)}
            icon={<ListChecks className="h-4 w-4" />}
            onClick={() => setTab("tasks")}
          />
          <KpiCard
            label="Employees in notice"
            value={String(data.resignations.filter((r) => r.status === "In Notice").length)}
            icon={<LogOut className="h-4 w-4" />}
            onClick={() => setTab("exits")}
          />
          <KpiCard
            label="Former employees"
            value={String(data.formerEmployees.length)}
            icon={<History className="h-4 w-4" />}
            onClick={() => setTab("former")}
          />
        </div>

        {/* Toolbar & View Toggle */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
          <Input
            placeholder="Search joiner, task, reason…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-8 w-64 text-xs"
          />

          <div className="flex items-center gap-2">
            {tab === "joiners" && (
              <Button
                size="sm"
                onClick={() => setScheduleOpen(true)}
                className="h-8 gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              >
                <UserPlus className="h-3.5 w-3.5" /> Schedule New Joiner
              </Button>
            )}
            {tab === "tasks" && (
              <Button
                size="sm"
                onClick={() => setTaskOpen(true)}
                className="h-8 gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" /> Create Onboarding Task
              </Button>
            )}
            {tab === "exits" && (
              <Button
                size="sm"
                onClick={() => setResignOpen(true)}
                className="h-8 gap-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
              >
                <LogOut className="h-3.5 w-3.5" /> Submit Resignation Request
              </Button>
            )}

            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
              <Button
                variant={view === "cards" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("cards")}
                className="h-7 gap-1.5 px-2.5 text-xs font-medium"
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Cards
              </Button>
              <Button
                variant={view === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("table")}
                className="h-7 gap-1.5 px-2.5 text-xs font-medium"
              >
                <List className="h-3.5 w-3.5" /> Table
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <TabsShell
          tabs={[
            { key: "joiners", label: `Upcoming joiners (${data.joiners.length})` },
            { key: "tasks", label: `Onboarding checklist (${data.onboardingTasks.length})` },
            { key: "exits", label: `Resignations & clearance (${data.resignations.length})` },
            { key: "former", label: `Former employees (${data.formerEmployees.length})` },
          ]}
          active={tab}
          onChange={setTab}
        >
          {/* TAB 1: JOINERS */}
          {tab === "joiners" &&
            (view === "cards" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {filteredJoiners.map((j) => (
                  <JoinerCard
                    key={j.id}
                    joiner={j}
                    onOpenTasks={() => setTab("tasks")}
                  />
                ))}
              </div>
            ) : (
              <DataTable columns={joinerCols} rows={filteredJoiners} rowKey={(r) => r.id} />
            ))}

          {/* TAB 2: ONBOARDING TASKS */}
          {tab === "tasks" &&
            (view === "cards" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {filteredTasks.map((t) => (
                  <OnboardingTaskCard
                    key={t.id}
                    task={t}
                    onStatusChange={(newStatus) => {
                      addOnboardingTaskUpdate(t.id, newStatus);
                      toast.success(`Task status updated to ${newStatus}`);
                    }}
                  />
                ))}
              </div>
            ) : (
              <DataTable columns={taskCols} rows={filteredTasks} rowKey={(r) => r.id} pageSize={12} />
            ))}

          {/* TAB 3: RESIGNATIONS */}
          {tab === "exits" &&
            (view === "cards" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {filteredResignations.map((r) => (
                  <ResignationCard key={r.id} resignation={r} />
                ))}
              </div>
            ) : (
              <DataTable columns={resCols} rows={filteredResignations} rowKey={(r) => r.id} />
            ))}

          {/* TAB 4: FORMER EMPLOYEES */}
          {tab === "former" &&
            (view === "cards" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {filteredFormer.map((f) => (
                  <FormerEmployeeCard key={f.id} emp={f} />
                ))}
              </div>
            ) : (
              <DataTable columns={formerCols} rows={filteredFormer} rowKey={(r) => r.id} />
            ))}
        </TabsShell>

        {/* Schedule Joiner Dialog */}
        <ScheduleJoinerDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          onSubmit={(j) => {
            addJoiner(j);
            setScheduleOpen(false);
            toast.success(`Scheduled onboarding for ${j.name}`);
          }}
        />

        {/* Create Task Dialog */}
        <CreateTaskDialog
          open={taskOpen}
          onOpenChange={setTaskOpen}
          onSubmit={(t) => {
            addOnboardingTask(t);
            setTaskOpen(false);
            toast.success(`Onboarding task "${t.task}" created`);
          }}
        />

        {/* Submit Resignation Dialog */}
        <SubmitResignationDialog
          open={resignOpen}
          onOpenChange={setResignOpen}
          onSubmit={(r) => {
            addResignation(r);
            setResignOpen(false);
            toast.success(`Resignation request registered`);
          }}
        />
      </div>
    </AppShell>
  );
}

/* ========================================================================== */
/*                           CUSTOM CARD COMPONENTS                           */
/* ========================================================================== */

function JoinerCard({
  joiner,
  onOpenTasks,
}: {
  joiner: Joiner;
  onOpenTasks: () => void;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="relative shrink-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-white text-base shadow-sm">
                {initials(joiner.name)}
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 ring-2 ring-card text-[9px] font-bold text-white">
                +
              </span>
            </div>

            <div className="min-w-0">
              <h3 className="font-semibold text-foreground text-base truncate">{joiner.name}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="inline-flex items-center gap-1 rounded-md border border-purple-200/70 bg-purple-50 px-2 py-0.5 font-medium text-purple-700">
                  <Shield className="h-3 w-3 shrink-0" />
                  <span className="truncate max-w-[130px]">{joiner.designation}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Building2 className="h-3 w-3 shrink-0" />
                  <span>{joiner.department} · {joiner.branch}</span>
                </span>
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 shrink-0">
            <Calendar className="h-3 w-3" />
            Joiner
          </span>
        </div>

        {/* Divider */}
        <div className="my-3 border-t border-border/60" />

        {/* Email */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Mail className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
          <span className="truncate">{joiner.workEmail}</span>
        </div>

        {/* Readiness progress bar */}
        <div className="mt-3.5 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-blue-900">Onboarding Readiness</span>
            <span className="font-bold text-blue-700">{joiner.checklistCompletion}% Ready</span>
          </div>
          <Progress value={joiner.checklistCompletion} className="mt-1.5 h-1.5 bg-blue-200/60" />
        </div>

        {/* 3 Metric KPI Boxes */}
        <div className="mt-3.5 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-border/80 bg-muted/30 p-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              JOINING
            </p>
            <p className="mt-1 text-xs font-bold text-foreground">{fmtDate(joiner.joiningDate)}</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-muted/30 p-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              BRANCH
            </p>
            <p className="mt-1 text-xs font-bold text-purple-600 truncate">{joiner.branch}</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-muted/30 p-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              STATUS
            </p>
            <p className="mt-1 text-xs font-bold text-emerald-600">Offered</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div>
        <div className="my-3 border-t border-border/60" />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            {joiner.checklistCompletion === 100 ? "Ready for day 1" : "Pre-onboarding in progress"}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.success(`Welcome email sent to ${joiner.workEmail}`)}
              className="h-8 gap-1 border-blue-200 bg-blue-50/50 text-xs font-medium text-blue-700 hover:bg-blue-100"
            >
              <Send className="h-3.5 w-3.5" /> Welcome Email
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenTasks}
              className="h-8 gap-1 text-xs font-medium bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200"
            >
              <ListChecks className="h-3.5 w-3.5" /> Checklist
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OnboardingTaskCard({
  task,
  onStatusChange,
}: {
  task: OnboardingTask;
  onStatusChange: (status: OnboardingTask["status"]) => void;
}) {
  const isDone = task.status === "Completed";
  const isBlocked = task.status === "Blocked";

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md",
        isDone
          ? "border-emerald-200/80 bg-emerald-50/20"
          : isBlocked
          ? "border-rose-200/80 bg-rose-50/20"
          : "border-border bg-card"
      )}
    >
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground mb-1.5">
              {task.category}
            </span>
            <h3 className="font-semibold text-foreground text-sm leading-snug">{task.task}</h3>
          </div>

          <StatusBadge status={task.status} />
        </div>

        {/* Assigned employee */}
        <div className="mt-3 flex items-center justify-between rounded-xl border border-border/80 bg-muted/20 p-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">For:</span>
            <Person id={task.employeeId} />
          </div>
        </div>

        {/* Schedule & Ownership */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
            <span>Due {fmtDate(task.dueDate)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
            <span className="truncate">Owner: {task.owner}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div>
        <div className="my-3 border-t border-border/60" />
        <div className="flex items-center justify-between gap-2">
          <Sel
            value={task.status}
            className="h-8 w-32"
            onChange={(v) => onStatusChange(v as OnboardingTask["status"])}
            options={["Pending", "In Progress", "Completed", "Blocked"]}
          />

          <Button
            size="sm"
            variant={isDone ? "outline" : "default"}
            onClick={() => onStatusChange(isDone ? "Pending" : "Completed")}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            {isDone ? (
              <>
                <X className="h-3.5 w-3.5" /> Reopen
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" /> Complete
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ResignationCard({ resignation }: { resignation: Resignation }) {
  const { data } = useStore();
  const emp = data.employees.find((e) => e.id === resignation.employeeId);

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="relative shrink-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 font-bold text-white text-base shadow-sm">
                {emp ? initials(emp.name) : "EX"}
              </div>
              <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full ring-2 ring-card bg-rose-500" />
            </div>

            <div className="min-w-0">
              <Link
                href={`/employees/${resignation.employeeId}`}
                className="group flex items-center gap-1 text-base font-semibold text-foreground hover:text-primary transition-colors"
              >
                <span className="truncate underline decoration-foreground/30 underline-offset-2 group-hover:decoration-primary">
                  {emp?.name ?? resignation.employeeId}
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </Link>
              <p className="text-xs text-muted-foreground truncate">
                {emp?.designation} · {emp?.department}
              </p>
            </div>
          </div>

          <StatusBadge status={resignation.status} />
        </div>

        {/* Reason Banner */}
        <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/50 p-2.5 text-xs text-amber-900">
          <span className="font-semibold">Reason:</span> {resignation.reason}
        </div>

        {/* Timeline Dates */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-border/80 bg-muted/20 p-2 text-center">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground">Resigned</p>
            <p className="font-medium text-foreground">{fmtDate(resignation.resignationDate)}</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-muted/20 p-2 text-center">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground">Last Working Day</p>
            <p className="font-medium text-rose-600">{fmtDate(resignation.lastWorkingDay)}</p>
          </div>
        </div>

        {/* 5 Clearance Pillars */}
        <div className="mt-3 space-y-1.5 rounded-xl border border-border/80 bg-muted/10 p-3 text-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            CLEARANCE CHECKPOINTS
          </p>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Manager Approval:</span>
            <StatusBadge status={resignation.managerApproval} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">HR Approval:</span>
            <StatusBadge status={resignation.hrApproval} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Work Handover:</span>
            {resignation.handoverDone ? (
              <span className="text-emerald-600 font-medium flex items-center gap-1">
                <Check className="h-3 w-3" /> Done
              </span>
            ) : (
              <span className="text-rose-500 font-medium flex items-center gap-1">
                <X className="h-3 w-3" /> Pending
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Asset Return:</span>
            {resignation.assetReturnDone ? (
              <span className="text-emerald-600 font-medium flex items-center gap-1">
                <Check className="h-3 w-3" /> Returned
              </span>
            ) : (
              <span className="text-rose-500 font-medium flex items-center gap-1">
                <X className="h-3 w-3" /> Pending
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Finance & F&F:</span>
            {resignation.financeClearance ? (
              <span className="text-emerald-600 font-medium flex items-center gap-1">
                <Check className="h-3 w-3" /> Cleared
              </span>
            ) : (
              <span className="text-rose-500 font-medium flex items-center gap-1">
                <X className="h-3 w-3" /> In Review
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div>
        <div className="my-3 border-t border-border/60" />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">{resignation.noticeDays} days notice</span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.success(`Exit interview scheduled for ${emp?.name}`)}
              className="h-8 gap-1 text-xs"
            >
              Exit Interview
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => toast.success(`Relieving letter generated for ${emp?.name}`)}
              className="h-8 gap-1 text-xs bg-slate-100 hover:bg-slate-200 border border-slate-200"
            >
              <FileCheck2 className="h-3.5 w-3.5" /> Relieving Letter
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormerEmployeeCard({ emp }: { emp: FormerEmployee }) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-600 font-bold text-white text-base shadow-sm shrink-0">
              {initials(emp.name)}
            </div>

            <div className="min-w-0">
              <h3 className="font-semibold text-foreground text-base truncate">{emp.name}</h3>
              <p className="text-xs text-muted-foreground">
                {emp.designation} · {emp.department}
              </p>
              <p className="text-[11px] text-muted-foreground">{emp.branch}</p>
            </div>
          </div>

          <StatusBadge status={emp.clearanceDone ? "Cleared" : "Pending"} />
        </div>

        {/* Divider */}
        <div className="my-3 border-t border-border/60" />

        {/* Reason banner */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-800">
          <span className="font-semibold">Departure reason:</span> {emp.reason}
        </div>

        {/* Exit date info */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-border/80 bg-muted/20 p-2 text-center">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground">Exit Date</p>
            <p className="font-medium text-foreground">{fmtDate(emp.exitDate)}</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-muted/20 p-2 text-center">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground">Full & Final</p>
            <p className="font-medium text-emerald-600">Settled</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div>
        <div className="my-3 border-t border-border/60" />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">Archive record</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.success(`Experience certificate downloaded for ${emp.name}`)}
            className="h-8 gap-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" /> Experience Letter
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/*                       COMPREHENSIVE ONBOARDING DIALOGS                     */
/* ========================================================================== */

function ScheduleJoinerDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (j: Omit<Joiner, "id" | "checklistCompletion"> & { checklistCompletion?: number }) => void;
}) {
  const { data } = useStore();
  const [activeTab, setActiveTab] = useState<"candidate" | "role" | "setup">("candidate");

  // Candidate
  const [name, setName] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Role & Placement
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState(DEPARTMENTS[0] || "Engineering");
  const [branch, setBranch] = useState<Branch>("Hyderabad");
  const [joiningDate, setJoiningDate] = useState("2026-11-15");
  const [ctc, setCtc] = useState("1200000");

  // Pre-onboarding & Buddy
  const [buddy, setBuddy] = useState(data.employees[0]?.id || "");
  const [allocLaptop, setAllocLaptop] = useState(true);
  const [allocDesk, setAllocDesk] = useState(true);
  const [allocBadge, setAllocBadge] = useState(true);
  const [allocWelcome, setAllocWelcome] = useState(true);

  const workEmail = name
    ? `${name.trim().toLowerCase().replace(/\s+/g, ".")}@gvkedutech.com`
    : "employee@gvkedutech.com";

  const validCandidate = name.trim().length >= 3 && personalEmail.includes("@");
  const validRole = designation.trim().length >= 2 && joiningDate.length >= 8;
  const validAll = validCandidate && validRole;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Schedule New Joiner</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Register candidate offer, assign day-1 mentor, and initialize pre-boarding readiness.
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("candidate")}
            className={cn(
              "flex-1 rounded-lg py-1.5 transition-all text-center",
              activeTab === "candidate" ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            1. Candidate Info
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("role")}
            className={cn(
              "flex-1 rounded-lg py-1.5 transition-all text-center",
              activeTab === "role" ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            2. Role & Offer
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("setup")}
            className={cn(
              "flex-1 rounded-lg py-1.5 transition-all text-center",
              activeTab === "setup" ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            3. Day-1 Readiness
          </button>
        </div>

        {/* Tab 1: Candidate Info */}
        {activeTab === "candidate" && (
          <div className="grid grid-cols-2 gap-3 py-2 text-xs">
            <div className="col-span-2">
              <Field label="Candidate Full Name" required>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sravya Srikanth"
                  className="h-9"
                />
              </Field>
            </div>
            <Field label="Personal Email" required hint="For sending offer and welcome packet">
              <Input
                type="email"
                value={personalEmail}
                onChange={(e) => setPersonalEmail(e.target.value)}
                placeholder="sravya@gmail.com"
                className="h-9"
              />
            </Field>
            <Field label="Mobile Phone" required>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="h-9"
              />
            </Field>
            <div className="col-span-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs dark:bg-blue-950/20 dark:border-blue-900">
              <span className="font-semibold text-blue-900 dark:text-blue-300">Generated Work Email:</span>
              <p className="font-mono text-blue-800 dark:text-blue-200 mt-0.5">{workEmail}</p>
            </div>
          </div>
        )}

        {/* Tab 2: Role & Offer */}
        {activeTab === "role" && (
          <div className="grid grid-cols-2 gap-3 py-2 text-xs">
            <Field label="Designation / Job Title" required>
              <Input
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="Senior Full Stack Engineer"
                className="h-9"
              />
            </Field>
            <Field label="Department">
              <Sel value={department} onChange={setDepartment} options={DEPARTMENTS} />
            </Field>
            <Field label="Assigned Branch">
              <Sel value={branch} onChange={(v) => setBranch(v as Branch)} options={BRANCHES} />
            </Field>
            <Field label="Target Joining Date" required>
              <Input
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="h-9"
              />
            </Field>
            <div className="col-span-2">
              <Field label="Annual Offered CTC (₹)" hint="Zero PF & Zero ESI applied by company policy">
                <Input
                  value={ctc}
                  onChange={(e) => setCtc(e.target.value.replace(/\D/g, ""))}
                  placeholder="1200000"
                  className="h-9 font-semibold"
                />
              </Field>
            </div>
          </div>
        )}

        {/* Tab 3: Day-1 Readiness */}
        {activeTab === "setup" && (
          <div className="space-y-3 py-2 text-xs">
            <Field label="Assigned Onboarding Buddy / Mentor" hint="Peer colleague who guides joiner through first 30 days">
              <Sel
                value={buddy}
                onChange={setBuddy}
                options={data.employees.map((e) => ({
                  value: e.id,
                  label: `${e.name} (${e.designation}) · ${e.branch}`,
                }))}
              />
            </Field>

            <div className="rounded-xl border border-border p-3 space-y-2">
              <span className="font-semibold text-foreground text-xs uppercase tracking-wider block">
                Pre-boarding Equipment Allocation
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-muted/40">
                  <Checkbox checked={allocLaptop} onCheckedChange={(c) => setAllocLaptop(Boolean(c))} />
                  <span>MacBook / Laptop Provisioning</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-muted/40">
                  <Checkbox checked={allocDesk} onCheckedChange={(c) => setAllocDesk(Boolean(c))} />
                  <span>Workstation & Monitor Setup</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-muted/40">
                  <Checkbox checked={allocBadge} onCheckedChange={(c) => setAllocBadge(Boolean(c))} />
                  <span>RFID Access Card & Biometric Tag</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-muted/40">
                  <Checkbox checked={allocWelcome} onCheckedChange={(c) => setAllocWelcome(Boolean(c))} />
                  <span>Welcome Swag Kit & ID Lanyard</span>
                </label>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2 border-t border-border">
          {activeTab !== "candidate" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab(activeTab === "setup" ? "role" : "candidate")}
              className="text-xs"
            >
              Previous Step
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
              Cancel
            </Button>
          )}

          {activeTab !== "setup" ? (
            <Button
              size="sm"
              onClick={() => setActiveTab(activeTab === "candidate" ? "role" : "setup")}
              className="text-xs"
            >
              Next Step
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={!validAll}
              onClick={() => {
                const eq: string[] = [];
                if (allocLaptop) eq.push("Laptop");
                if (allocDesk) eq.push("Desk");
                if (allocBadge) eq.push("RFID Badge");
                if (allocWelcome) eq.push("Welcome Kit");

                onSubmit({
                  name,
                  designation,
                  department,
                  branch,
                  joiningDate,
                  workEmail,
                  personalEmail,
                  phone,
                  buddy,
                  ctc: Number(ctc) || 0,
                  equipmentAllocation: eq,
                  checklistCompletion: 25,
                });
              }}
              className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              Confirm & Schedule Joiner
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateTaskDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (t: Omit<OnboardingTask, "id">) => void;
}) {
  const { data } = useStore();
  const [emp, setEmp] = useState(data.joiners[0]?.id || data.employees[0]?.id || "");
  const [taskName, setTaskName] = useState("");
  const [category, setCategory] = useState("IT Setup");
  const [owner, setOwner] = useState("IT Admin");
  const [dueDate, setDueDate] = useState("2026-11-18");

  const valid = taskName.trim().length >= 4 && emp && owner;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ListChecks className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Create Onboarding Task</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Assign a milestone or verification checklist item for a joiner.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2 text-xs">
          <div className="col-span-2">
            <Field label="Assign Task To Employee / Joiner" required>
              <Sel
                value={emp}
                onChange={setEmp}
                options={[
                  ...data.joiners.map((j) => ({ value: j.id, label: `✨ Joiner: ${j.name} (${j.designation})` })),
                  ...data.employees.map((e) => ({ value: e.id, label: `${e.name} (${e.id}) · ${e.department}` })),
                ]}
              />
            </Field>
          </div>

          <div className="col-span-2">
            <Field label="Task Description / Milestone" required>
              <Input
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="e.g. Issue MacBook Pro M3 & configure GitHub / AWS access"
                className="h-9"
              />
            </Field>
          </div>

          <Field label="Task Category">
            <Sel
              value={category}
              onChange={setCategory}
              options={["IT Setup", "HR Paperwork", "Compliance", "Team Welcome", "Manager 1-on-1", "Training"]}
            />
          </Field>

          <Field label="Responsible Owner">
            <Sel
              value={owner}
              onChange={setOwner}
              options={["IT Admin", "HR Operations", "Hiring Manager", "Assigned Buddy", "Finance Team"]}
            />
          </Field>

          <div className="col-span-2">
            <Field label="Target Due Date" required>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
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
            onClick={() =>
              onSubmit({
                employeeId: emp,
                task: taskName,
                category,
                owner,
                dueDate,
                status: "Pending",
              })
            }
            className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubmitResignationDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (r: Omit<Resignation, "id" | "managerApproval" | "hrApproval" | "handoverDone" | "assetReturnDone" | "documentClearance" | "financeClearance" | "settlementDone" | "accountDeactivated" | "status"> & Partial<Resignation>) => void;
}) {
  const { data } = useStore();
  const [emp, setEmp] = useState(data.employees[0]?.id || "");
  const [resignDate, setResignDate] = useState(TODAY);
  const [lastDay, setLastDay] = useState("2026-11-30");
  const [category, setCategory] = useState("Career Growth");
  const [reason, setReason] = useState("");
  const [handoverLead, setHandoverLead] = useState(data.employees[1]?.id || "");
  const [personalEmail, setPersonalEmail] = useState("");
  const [personalPhone, setPersonalPhone] = useState("");

  const noticeDays = Math.max(1, Math.round((new Date(lastDay).getTime() - new Date(resignDate).getTime()) / 86400000));
  const valid = emp && reason.trim().length >= 5 && noticeDays > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
              <LogOut className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-rose-600 dark:text-rose-400">
                Submit Resignation & Exit Request
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Initiate employee separation, exit clearance checklist, and notice period workflow.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2 text-xs">
          <div className="col-span-2">
            <Field label="Employee Submitting Separation" required>
              <Sel
                value={emp}
                onChange={setEmp}
                options={data.employees
                  .filter((e) => e.status !== "Inactive" && e.status !== "Resigned")
                  .map((e) => ({
                    value: e.id,
                    label: `${e.name} (${e.designation}) · ${e.department} · ${e.branch}`,
                  }))}
              />
            </Field>
          </div>

          <Field label="Formal Resignation Date" required>
            <Input
              type="date"
              value={resignDate}
              onChange={(e) => setResignDate(e.target.value)}
              className="h-9"
            />
          </Field>

          <Field
            label="Requested Last Working Day"
            required
            hint={`Notice duration: ${noticeDays} day(s)`}
          >
            <Input
              type="date"
              value={lastDay}
              onChange={(e) => setLastDay(e.target.value)}
              className="h-9"
            />
          </Field>

          <Field label="Primary Reason Category">
            <Sel
              value={category}
              onChange={setCategory}
              options={[
                "Career Growth",
                "Better Compensation",
                "Higher Education",
                "Relocation",
                "Personal / Family",
                "Health Reasons",
                "Work-Life Balance",
                "Other",
              ]}
            />
          </Field>

          <Field label="Assigned Handover Lead" hint="Colleague taking over duties">
            <Sel
              value={handoverLead}
              onChange={setHandoverLead}
              options={data.employees
                .filter((e) => e.id !== emp)
                .map((e) => ({
                  value: e.id,
                  label: `${e.name} (${e.department})`,
                }))}
            />
          </Field>

          <div className="col-span-2">
            <Field label="Detailed Reason & Feedback" required hint="Will be reviewed by HR and Reporting Manager">
              <Textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Provide details regarding the decision to depart, feedback on experience..."
              />
            </Field>
          </div>

          <Field label="Personal Email (Post-exit contact)">
            <Input
              type="email"
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              placeholder="personal@gmail.com"
              className="h-9"
            />
          </Field>

          <Field label="Personal Phone">
            <Input
              value={personalPhone}
              onChange={(e) => setPersonalPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="h-9"
            />
          </Field>
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!valid}
            onClick={() =>
              onSubmit({
                employeeId: emp,
                resignationDate: resignDate,
                lastWorkingDay: lastDay,
                noticeDays,
                reason: `${category}: ${reason}`,
                reasonCategory: category,
                handoverColleagueId: handoverLead,
                personalEmail: personalEmail || undefined,
                personalPhone: personalPhone || undefined,
                comments: reason,
              })
            }
            className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold"
          >
            Submit Resignation Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
