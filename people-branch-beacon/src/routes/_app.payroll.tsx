import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/data/store";
import { CURRENT_PERIOD } from "@/lib/data/seed";
import { PageHeader, KpiCard, StatusBadge, TabsShell, ConfirmDialog, ChartCard } from "@/components/shared";
import { DataTable, exportCsv, type Column } from "@/components/data-table";
import { Person, useScope, useNames, moduleSearch } from "@/components/form-bits";
import type { Employee, PayrollRun, Reimbursement } from "@/lib/data/types";
import { inr, fmtDate } from "@/lib/format";
import { payslipFor } from "@/lib/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Download, IndianRupee, Lock, Play, Wallet, Users } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export const Route = createFileRoute("/_app/payroll")({
  head: () => ({ meta: [
    { title: "Payroll — OfficeFlow" },
    { name: "description", content: "Payroll runs, approvals, payslips, salary structures and reimbursements." },
    { property: "og:title", content: "Payroll — OfficeFlow" },
    { property: "og:description", content: "Payroll runs, approvals, payslips, salary structures and reimbursements." },
  ] }),
  validateSearch: moduleSearch,
  component: PayrollPage,
});

const NEXT: Record<string, PayrollRun["status"] | undefined> = { Draft: "Calculated", Calculated: "Awaiting Approval", "Awaiting Approval": "Approved", Approved: "Locked", Locked: "Payment Recorded" };
const NEXT_LABEL: Record<string, string> = { Draft: "Calculate", Calculated: "Submit for approval", "Awaiting Approval": "Approve", Approved: "Lock payroll", Locked: "Record payment" };

function PayrollPage() {
  const { data, me, createPayrollRun, advancePayroll, reopenPayroll } = useStore();
  const { isEmployee, uid } = useScope();
  const nameOf = useNames();
  const search = Route.useSearch();
  const [tab, setTab] = useState(isEmployee ? "payslips" : search.tab ?? "runs");
  const [slip, setSlip] = useState<{ e: Employee; period: string } | null>(null);
  const [reopen, setReopen] = useState<PayrollRun | null>(null);
  const [q, setQ] = useState("");
  const current = data.payrollRuns.find((p) => p.period === CURRENT_PERIOD);
  const [runOpen, setRunOpen] = useState(search.open === "run" && !current);
  const actor = me()?.name ?? "Demo";

  const eligible = useMemo(() => data.employees.filter((e) => e.status !== "Inactive" && e.status !== "Resigned"), [data.employees]);
  const register = eligible.filter((e) => !q || e.name.toLowerCase().includes(q.toLowerCase()));

  const runCols: Column<PayrollRun>[] = [
    { key: "p", header: "Period", sortValue: (r) => r.period, render: (r) => <span className="font-medium">{new Date(r.period + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span> },
    { key: "h", header: "Headcount", render: (r) => r.headcount },
    { key: "g", header: "Gross", render: (r) => inr(r.gross) },
    { key: "d", header: "Deductions", render: (r) => inr(r.employeeDeductions), hideOnMobile: true },
    { key: "n", header: "Net pay", render: (r) => <span className="font-medium">{inr(r.net)}</span> },
    { key: "s", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "a", header: "", render: (r) => (
      <div className="flex gap-1.5">
        {NEXT[r.status] && <Button size="sm" className="h-7 text-xs" onClick={() => { advancePayroll(r.id, NEXT[r.status]!, actor); toast.success(`Payroll moved to ${NEXT[r.status]}`); }}>{NEXT_LABEL[r.status]}</Button>}
        {(r.status === "Locked" || r.status === "Approved") && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReopen(r)}>Reopen</Button>}
      </div>
    ) },
  ];

  const regCols: Column<Employee>[] = [
    { key: "e", header: "Employee", sortValue: (r) => r.name, render: (r) => <Person id={r.id} /> },
    { key: "d", header: "Department", render: (r) => r.department, hideOnMobile: true },
    { key: "g", header: "Gross", sortValue: (r) => r.monthlyGross, render: (r) => inr(r.monthlyGross) },
    { key: "ded", header: "Deductions", render: (r) => inr(payslipFor(r, data.salaryStructures).totalDeductions) },
    { key: "n", header: "Net", render: (r) => <span className="font-medium">{inr(payslipFor(r, data.salaryStructures).net)}</span> },
    { key: "v", header: "", render: (r) => <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSlip({ e: r, period: CURRENT_PERIOD })}>Payslip</Button> },
  ];

  const reimbCols: Column<Reimbursement>[] = [
    { key: "e", header: "Employee", render: (r) => <Person id={r.employeeId} /> },
    { key: "t", header: "Type", render: (r) => r.type },
    { key: "a", header: "Amount", render: (r) => inr(r.amount) },
    { key: "d", header: "Date", render: (r) => fmtDate(r.date) },
    { key: "p", header: "Payroll", render: (r) => r.payrollPeriod ?? "—" },
    { key: "s", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  const trend = [...data.payrollRuns].sort((a, b) => a.period.localeCompare(b.period)).map((r) => ({ period: r.period.slice(5), gross: Math.round(r.gross / 100000), net: Math.round(r.net / 100000) }));

  if (isEmployee) {
    const self = data.employees.find((e) => e.id === uid);
    const runs = data.payrollRuns.filter((r) => ["Locked", "Payment Recorded", "Approved"].includes(r.status));
    return (
      <div>
        <PageHeader title="My Payslips" description="Download and review your monthly payslips." />
        {self && <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard label="Monthly gross" value={inr(self.monthlyGross)} icon={<Wallet className="h-4 w-4" />} />
          <KpiCard label="Net take-home" value={inr(payslipFor(self, data.salaryStructures).net)} icon={<IndianRupee className="h-4 w-4" />} />
          <KpiCard label="Annual CTC" value={inr(self.annualCTC, { compact: true })} />
          <KpiCard label="Payment method" value={self.paymentMethod ?? "Bank transfer"} hint={self.bankLast4 ? `A/c ••${self.bankLast4}` : undefined} />
        </div>}
        <div className="space-y-2">
          {self && runs.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm">
              <span className="font-medium">{new Date(r.period + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span>
              <span className="flex items-center gap-3"><StatusBadge status={r.status} /><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSlip({ e: self, period: r.period })}>View payslip</Button></span>
            </div>
          ))}
        </div>
        <PayslipDialog slip={slip} onClose={() => setSlip(null)} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Payroll" description="Run, approve and lock monthly payroll. Calculations are illustrative demo figures."
        actions={<>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => exportCsv(`payroll-${CURRENT_PERIOD}.csv`, ["ID", "Name", "Gross", "Deductions", "Net"], eligible.map((e) => { const p = payslipFor(e, data.salaryStructures); return [e.id, e.name, p.gross, p.totalDeductions, p.net]; }))}><Download className="h-3.5 w-3.5" /> Bank file</Button>
          <Button size="sm" className="gap-1.5 text-xs" disabled={!!current} onClick={() => setRunOpen(true)}><Play className="h-3.5 w-3.5" /> {current ? "October run exists" : "Start October run"}</Button>
        </>} />
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Headcount" value={String(eligible.length)} icon={<Users className="h-4 w-4" />} />
        <KpiCard label="Monthly gross" value={inr(eligible.reduce((s, e) => s + e.monthlyGross, 0), { compact: true })} icon={<Wallet className="h-4 w-4" />} />
        <KpiCard label="Current run" value={current?.status ?? "Not started"} hint={current ? inr(current.net, { compact: true }) + " net" : undefined} />
        <KpiCard label="Pending reimbursements" value={String(data.reimbursements.filter((r) => r.status === "Pending").length)} />
      </div>
      <TabsShell tabs={[{ key: "runs", label: "Payroll runs" }, { key: "register", label: "Salary register" }, { key: "structures", label: "Salary structures" }, { key: "reimb", label: "Reimbursements" }]} active={tab} onChange={setTab}>
        {tab === "runs" && <div className="space-y-4">
          <DataTable columns={runCols} rows={data.payrollRuns} rowKey={(r) => r.id} />
          <ChartCard title="Payroll trend" subtitle="₹ lakhs per month">
            <div className="h-56"><ResponsiveContainer><BarChart data={trend}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="period" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="gross" fill="var(--color-primary)" radius={[4, 4, 0, 0]} /><Bar dataKey="net" fill="var(--color-success)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
          </ChartCard>
        </div>}
        {tab === "register" && <DataTable columns={regCols} rows={register} rowKey={(r) => r.id} pageSize={12} toolbar={<Input placeholder="Search employee…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-56 text-xs" />} />}
        {tab === "structures" && <div className="grid gap-3 lg:grid-cols-3">
          {data.salaryStructures.map((s) => (
            <div key={s.id} className="rounded-lg border border-border bg-card p-4 text-xs">
              <p className="text-sm font-semibold">{s.name}</p>
              <p className="mb-3 text-muted-foreground">{s.applicableTo} · from {fmtDate(s.effectiveFrom)}</p>
              {[["Earnings", s.earnings], ["Deductions", s.deductions], ["Employer", s.employerContributions]].map(([label, list]) => (
                <div key={label as string} className="mb-2">
                  <p className="mb-1 font-medium text-foreground">{label as string}</p>
                  {(list as { name: string; calc: string }[]).map((x) => <p key={x.name} className="flex justify-between text-muted-foreground"><span>{x.name}</span><span>{x.calc}</span></p>)}
                </div>
              ))}
            </div>
          ))}
        </div>}
        {tab === "reimb" && <DataTable columns={reimbCols} rows={data.reimbursements} rowKey={(r) => r.id} />}
      </TabsShell>

      <ConfirmDialog open={runOpen} onOpenChange={setRunOpen} title="Start October 2026 payroll?" description={`Creates a draft run for ${eligible.length} employees using locked attendance.`} confirmLabel="Create draft"
        onConfirm={() => { createPayrollRun(CURRENT_PERIOD); toast.success("Draft payroll created"); }} />
      <ConfirmDialog open={!!reopen} onOpenChange={(v) => !v && setReopen(null)} title="Reopen payroll?" description="Reopening moves the run back to Calculated. A reason is recorded in the audit log." confirmLabel="Reopen" destructive reasonField
        onConfirm={(reason) => { if (reopen) { reopenPayroll(reopen.id, reason ?? "No reason given"); toast.success("Payroll reopened"); } }} />
      <PayslipDialog slip={slip} onClose={() => setSlip(null)} />
      <span className="hidden">{nameOf(uid)}</span>
    </div>
  );
}

function PayslipDialog({ slip, onClose }: { slip: { e: Employee; period: string } | null; onClose: () => void }) {
  const { data } = useStore();
  if (!slip) return null;
  const p = payslipFor(slip.e, data.salaryStructures);
  const rows: [string, number, string][] = [["Basic", p.basic, "e"], ["HRA", p.hra, "e"], ["Special allowance", p.special, "e"], ["Provident fund", p.pf, "d"], ["ESI", p.esi, "d"], ["Professional tax", p.pt, "d"], ["TDS", p.tds, "d"]];
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Payslip — {new Date(slip.period + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</DialogTitle></DialogHeader>
        <div className="text-sm">
          <p className="font-medium">{slip.e.name} <span className="text-muted-foreground">· {slip.e.id}</span></p>
          <p className="mb-3 text-xs text-muted-foreground">{slip.e.designation} · {slip.e.department}</p>
          <div className="grid grid-cols-2 gap-4">
            {(["e", "d"] as const).map((k) => (
              <div key={k}>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{k === "e" ? "Earnings" : "Deductions"}</p>
                {rows.filter((r) => r[2] === k).map((r) => <p key={r[0]} className="flex justify-between text-xs"><span>{r[0]}</span><span className="tabular-nums">{inr(r[1])}</span></p>)}
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between rounded-md bg-blue-soft p-3 font-semibold text-primary"><span>Net pay</span><span>{inr(p.net)}</span></div>
          <Button variant="outline" size="sm" className="mt-3 w-full gap-1.5 text-xs" onClick={() => { window.print(); }}><Lock className="h-3.5 w-3.5" /> Print / save as PDF</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
