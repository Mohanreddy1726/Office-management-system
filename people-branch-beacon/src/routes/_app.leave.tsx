import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/data/store";
import { TODAY } from "@/lib/data/seed";
import { PageHeader, KpiCard, StatusBadge, TabsShell, Field, Timeline } from "@/components/shared";
import { DataTable, exportCsv, type Column } from "@/components/data-table";
import { Sel, Person, useScope, useNames, moduleSearch } from "@/components/form-bits";
import type { LeaveRequest, LeaveType } from "@/lib/data/types";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { CalendarDays, Download, Hourglass, Plus, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_app/leave")({
  head: () => ({ meta: [
    { title: "Leave Management — OfficeFlow" },
    { name: "description", content: "Apply for leave, review approvals, track balances and leave policies." },
    { property: "og:title", content: "Leave Management — OfficeFlow" },
    { property: "og:description", content: "Apply for leave, review approvals, track balances and leave policies." },
  ] }),
  validateSearch: moduleSearch,
  component: LeavePage,
});

const TYPES: LeaveType[] = ["Casual Leave", "Sick Leave", "Earned Leave", "Comp-Off", "Unpaid Leave", "Maternity Leave"];

function LeavePage() {
  const { data, applyLeave, decideLeave } = useStore();
  const { isAdmin, isManager, isEmployee, uid, inScope } = useScope();
  const nameOf = useNames();
  const search = Route.useSearch();
  const [tab, setTab] = useState(search.tab ?? (isEmployee ? "mine" : "approvals"));
  const [open, setOpen] = useState(search.open === "apply");
  const [view, setView] = useState<LeaveRequest | null>(null);
  const [statusF, setStatusF] = useState("all");

  const scoped = useMemo(() => data.leaves.filter((l) => inScope(l.employeeId)), [data.leaves, inScope]);
  const approvals = scoped.filter((l) => l.employeeId !== uid && ((isManager && ["Submitted", "Manager Review"].includes(l.status)) || (isAdmin && ["Submitted", "Manager Review", "HR Review"].includes(l.status))));
  const mine = data.leaves.filter((l) => l.employeeId === uid);
  const all = scoped.filter((l) => statusF === "all" || l.status === statusF);
  const bal = data.leaveBalances[uid] ?? {};
  const onLeaveToday = scoped.filter((l) => l.status === "Approved" && l.startDate <= TODAY && l.endDate >= TODAY);

  const cols: Column<LeaveRequest>[] = [
    { key: "emp", header: "Employee", sortValue: (r) => nameOf(r.employeeId), render: (r) => <Person id={r.employeeId} /> },
    { key: "type", header: "Type", render: (r) => r.type },
    { key: "dates", header: "Dates", sortValue: (r) => r.startDate, render: (r) => `${fmtDate(r.startDate)} → ${fmtDate(r.endDate)}` },
    { key: "days", header: "Days", render: (r) => r.days },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "act", header: "", render: (r) => {
      const can = r.employeeId !== uid && ((isManager && ["Submitted", "Manager Review"].includes(r.status)) || (isAdmin && ["Submitted", "Manager Review", "HR Review"].includes(r.status)));
      return can ? (
        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" className="h-7 text-xs" onClick={() => { decideLeave(r.id, "Approved", isManager ? "Recommended by manager" : "Approved by HR"); toast.success("Leave approved"); }}>Approve</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { decideLeave(r.id, "Rejected", "Business need"); toast.error("Leave rejected"); }}>Reject</Button>
        </div>
      ) : null;
    } },
  ];

  return (
    <div>
      <PageHeader
        title="Leave Management"
        description="Apply, approve and track leave with a full audit timeline."
        actions={<>
          {!isEmployee && <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => exportCsv("leave.csv", ["Employee", "Type", "Start", "End", "Days", "Status"], scoped.map((l) => [nameOf(l.employeeId), l.type, l.startDate, l.endDate, l.days, l.status]))}><Download className="h-3.5 w-3.5" /> Export</Button>}
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> Apply leave</Button>
        </>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Casual leave balance" value={String(bal["Casual Leave"] ?? 0)} icon={<CalendarDays className="h-4 w-4" />} />
        <KpiCard label="Earned leave balance" value={String(bal["Earned Leave"] ?? 0)} />
        {isEmployee
          ? <KpiCard label="My pending requests" value={String(mine.filter((l) => !["Approved", "Rejected"].includes(l.status)).length)} icon={<Hourglass className="h-4 w-4" />} />
          : <KpiCard label="Awaiting my approval" value={String(approvals.length)} icon={<Hourglass className="h-4 w-4" />} onClick={() => setTab("approvals")} />}
        <KpiCard label="On leave today" value={String(onLeaveToday.length)} icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>
      <TabsShell
        tabs={[
          { key: "approvals", label: `Approvals (${approvals.length})`, hidden: isEmployee },
          { key: "mine", label: "My leave" },
          { key: "all", label: isManager ? "Team leave" : "All requests", hidden: isEmployee },
          { key: "balances", label: "Balances" },
          { key: "policies", label: "Policies" },
        ]}
        active={tab}
        onChange={setTab}
      >
        {tab === "approvals" && <DataTable columns={cols} rows={approvals} rowKey={(r) => r.id} onRowClick={setView} emptyTitle="No pending approvals" emptyHint="You're all caught up." />}
        {tab === "mine" && <DataTable columns={cols.filter((c) => c.key !== "act")} rows={mine} rowKey={(r) => r.id} onRowClick={setView} emptyTitle="No leave requests yet" emptyHint="Use Apply leave to request time off." />}
        {tab === "all" && <DataTable columns={cols} rows={all} rowKey={(r) => r.id} onRowClick={setView}
          toolbar={<Sel value={statusF} onChange={setStatusF} className="h-8 w-44" options={[{ value: "all", label: "All statuses" }, "Submitted", "Manager Review", "HR Review", "Approved", "Rejected", "Clarification"]} />} />}
        {tab === "balances" && (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-[13px]">
              <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground"><tr><th className="px-3 py-2 text-left">Employee</th>{TYPES.slice(0, 4).map((t) => <th key={t} className="px-3 py-2 text-right">{t}</th>)}</tr></thead>
              <tbody>
                {data.employees.filter((e) => (isEmployee ? e.id === uid : inScope(e.id))).slice(0, 40).map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-3 py-2"><Person id={e.id} /></td>
                    {TYPES.slice(0, 4).map((t) => <td key={t} className="px-3 py-2 text-right tabular-nums">{data.leaveBalances[e.id]?.[t] ?? 0}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === "policies" && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.leavePolicies.map((p) => (
              <div key={p.id} className="rounded-lg border border-border bg-card p-4 text-xs">
                <p className="mb-2 text-sm font-semibold text-foreground">{p.type}</p>
                <dl className="grid grid-cols-2 gap-y-1.5 text-muted-foreground">
                  <dt>Entitlement</dt><dd className="text-foreground">{p.annualEntitlement} days/yr</dd>
                  <dt>Accrual</dt><dd className="text-foreground">{p.accrual}</dd>
                  <dt>Carry forward</dt><dd className="text-foreground">{p.carryForwardCap} days</dd>
                  <dt>Half day</dt><dd className="text-foreground">{p.halfDayEligible ? "Allowed" : "No"}</dd>
                  <dt>Eligibility</dt><dd className="text-foreground">{p.eligibility}</dd>
                </dl>
              </div>
            ))}
          </div>
        )}
      </TabsShell>

      <ApplyDialog open={open} onOpenChange={setOpen} balances={bal} onSubmit={(l) => { applyLeave(l); setOpen(false); toast.success("Leave request submitted"); }} />
      <Sheet open={!!view} onOpenChange={(v) => !v && setView(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {view && <>
            <SheetHeader><SheetTitle>{view.type}</SheetTitle></SheetHeader>
            <div className="mt-4 space-y-4 text-sm">
              <Person id={view.employeeId} />
              <p>{fmtDate(view.startDate)} → {fmtDate(view.endDate)} · {view.days} day(s)</p>
              <StatusBadge status={view.status} />
              <p className="text-muted-foreground">{view.reason}</p>
              <Timeline items={[...view.timeline].reverse().map((t) => ({ at: t.at, title: t.stage, by: nameOf(t.actor), note: t.note }))} />
            </div>
          </>}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ApplyDialog({ open, onOpenChange, onSubmit, balances }: { open: boolean; onOpenChange: (v: boolean) => void; balances: Record<string, number>; onSubmit: (l: Omit<LeaveRequest, "id" | "timeline" | "status">) => void }) {
  const { uid } = useScope();
  const [type, setType] = useState<string>("Casual Leave");
  const [start, setStart] = useState("2026-10-28");
  const [end, setEnd] = useState("2026-10-29");
  const [reason, setReason] = useState("");
  const days = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
  const balance = balances[type];
  const over = type !== "Unpaid Leave" && balance !== undefined && days > balance;
  const valid = days > 0 && reason.trim().length >= 3 && !over;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Apply for leave</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Field label="Leave type" hint={balance !== undefined ? `Available balance: ${balance} day(s)` : undefined}><Sel value={type} onChange={setType} options={TYPES} /></Field></div>
          <Field label="From"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="To" error={days <= 0 ? "End date must be after start" : over ? `Exceeds balance (${days} days)` : undefined}><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Reason" required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid} onClick={() => onSubmit({ employeeId: uid, type: type as LeaveType, startDate: start, endDate: end, days, reason })}>Submit {days > 0 ? `(${days} day${days > 1 ? "s" : ""})` : ""}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
