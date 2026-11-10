import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/data/store";
import { PageHeader, KpiCard, StatusBadge, TabsShell } from "@/components/shared";
import { DataTable, type Column } from "@/components/data-table";
import { Person, Sel } from "@/components/form-bits";
import type { Joiner, OnboardingTask, Resignation, FormerEmployee } from "@/lib/data/types";
import { fmtDate } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { UserPlus, LogOut, ListChecks, History } from "lucide-react";
import { Check, X } from "lucide-react";

export const Route = createFileRoute("/_app/onboarding")({
  head: () => ({ meta: [
    { title: "Onboarding & Exit — OfficeFlow" },
    { name: "description", content: "New joiner checklists, resignations, clearance and former employees." },
    { property: "og:title", content: "Onboarding & Exit — OfficeFlow" },
    { property: "og:description", content: "New joiner checklists, resignations, clearance and former employees." },
  ] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const { data, addOnboardingTaskUpdate } = useStore();
  const [tab, setTab] = useState("joiners");

  const joinerCols: Column<Joiner>[] = [
    { key: "n", header: "Name", sortValue: (r) => r.name, render: (r) => <span><span className="block font-medium">{r.name}</span><span className="text-[11px] text-muted-foreground">{r.workEmail}</span></span> },
    { key: "d", header: "Role", render: (r) => `${r.designation} · ${r.department}` },
    { key: "b", header: "Branch", render: (r) => r.branch, hideOnMobile: true },
    { key: "j", header: "Joining", sortValue: (r) => r.joiningDate, render: (r) => fmtDate(r.joiningDate) },
    { key: "c", header: "Checklist", render: (r) => <span className="flex w-36 items-center gap-2"><Progress value={r.checklistCompletion} className="h-1.5" /><span className="text-[11px]">{r.checklistCompletion}%</span></span> },
  ];
  const taskCols: Column<OnboardingTask>[] = [
    { key: "e", header: "Employee", render: (r) => <Person id={r.employeeId} /> },
    { key: "t", header: "Task", render: (r) => r.task },
    { key: "c", header: "Category", render: (r) => r.category, hideOnMobile: true },
    { key: "o", header: "Owner", render: (r) => r.owner, hideOnMobile: true },
    { key: "d", header: "Due", sortValue: (r) => r.dueDate, render: (r) => fmtDate(r.dueDate) },
    { key: "s", header: "Status", render: (r) => (
      <Sel value={r.status} className="h-7 w-32" onChange={(v) => { addOnboardingTaskUpdate(r.id, v as OnboardingTask["status"]); toast.success(`Task marked ${v}`); }} options={["Pending", "In Progress", "Completed", "Blocked"]} />
    ) },
  ];
  const flag = (b: boolean) => (b ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-muted-foreground" />);
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
    { key: "c", header: "Clearance", render: (r) => <StatusBadge status={r.clearanceDone ? "Completed" : "Pending"} /> },
  ];

  return (
    <div>
      <PageHeader title="Onboarding & Exit" description="Joiner checklists, exit clearance and full employee lifecycle tracking." />
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Upcoming joiners" value={String(data.joiners.length)} icon={<UserPlus className="h-4 w-4" />} onClick={() => setTab("joiners")} />
        <KpiCard label="Open onboarding tasks" value={String(data.onboardingTasks.filter((t) => t.status !== "Completed").length)} icon={<ListChecks className="h-4 w-4" />} onClick={() => setTab("tasks")} />
        <KpiCard label="Employees in notice" value={String(data.resignations.filter((r) => r.status === "In Notice").length)} icon={<LogOut className="h-4 w-4" />} onClick={() => setTab("exits")} />
        <KpiCard label="Former employees" value={String(data.formerEmployees.length)} icon={<History className="h-4 w-4" />} onClick={() => setTab("former")} />
      </div>
      <TabsShell tabs={[{ key: "joiners", label: "Upcoming joiners" }, { key: "tasks", label: "Onboarding checklist" }, { key: "exits", label: "Resignations & clearance" }, { key: "former", label: "Former employees" }]} active={tab} onChange={setTab}>
        {tab === "joiners" && <DataTable columns={joinerCols} rows={data.joiners} rowKey={(r) => r.id} />}
        {tab === "tasks" && <DataTable columns={taskCols} rows={data.onboardingTasks} rowKey={(r) => r.id} pageSize={12} />}
        {tab === "exits" && <DataTable columns={resCols} rows={data.resignations} rowKey={(r) => r.id} />}
        {tab === "former" && <DataTable columns={formerCols} rows={data.formerEmployees} rowKey={(r) => r.id} />}
      </TabsShell>
    </div>
  );
}
