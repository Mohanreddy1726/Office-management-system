import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/data/store";
import { PageHeader, KpiCard, ChartCard } from "@/components/shared";
import { exportCsv } from "@/components/data-table";
import { useScope } from "@/components/form-bits";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, TrendingDown, Users, Clock, Wallet } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({ meta: [
    { title: "Analytics & Reports — OfficeFlow" },
    { name: "description", content: "Headcount, attendance, leave, payroll and attrition analytics with exportable reports." },
    { property: "og:title", content: "Analytics & Reports — OfficeFlow" },
    { property: "og:description", content: "Headcount, attendance, leave, payroll and attrition analytics with exportable reports." },
  ] }),
  component: AnalyticsPage,
});

const COLORS = ["var(--color-primary)", "var(--color-success)", "var(--color-warning)", "var(--color-info)", "var(--color-danger)", "var(--color-muted-foreground)"];

function AnalyticsPage() {
  const { data } = useStore();
  const { inScope } = useScope();
  const emps = data.employees.filter((e) => inScope(e.id) && e.status !== "Inactive");
  const att = data.attendance.filter((a) => inScope(a.employeeId));

  const byDept = useMemo(() => Object.entries(emps.reduce<Record<string, number>>((m, e) => ({ ...m, [e.department]: (m[e.department] ?? 0) + 1 }), {})).map(([name, value]) => ({ name, value })), [emps]);
  const byBranch = useMemo(() => Object.entries(emps.reduce<Record<string, number>>((m, e) => ({ ...m, [e.branch]: (m[e.branch] ?? 0) + 1 }), {})).map(([name, value]) => ({ name, value })), [emps]);
  const daily = useMemo(() => {
    const m = new Map<string, { d: string; present: number; absent: number; late: number }>();
    att.forEach((a) => {
      const r = m.get(a.date) ?? { d: a.date.slice(8), present: 0, absent: 0, late: 0 };
      if (a.status === "Present") r.present++; else if (a.status === "Late") { r.late++; r.present++; } else if (a.status === "Absent") r.absent++;
      m.set(a.date, r);
    });
    return [...m.entries()].sort().map(([, v]) => v).filter((v) => v.present + v.absent > 0);
  }, [att]);
  const leaveMix = useMemo(() => Object.entries(data.leaves.filter((l) => inScope(l.employeeId)).reduce<Record<string, number>>((m, l) => ({ ...m, [l.type]: (m[l.type] ?? 0) + l.days }), {})).map(([name, value]) => ({ name, value })), [data.leaves, inScope]);
  const payroll = [...data.payrollRuns].sort((a, b) => a.period.localeCompare(b.period)).map((r) => ({ p: r.period.slice(5), net: Math.round(r.net / 100000) }));
  const worked = att.filter((a) => a.workedMinutes);
  const avgHrs = worked.length ? worked.reduce((s, a) => s + (a.workedMinutes ?? 0), 0) / worked.length / 60 : 0;
  const attritionPct = ((data.formerEmployees.length / Math.max(1, emps.length + data.formerEmployees.length)) * 100).toFixed(1);

  const reports: [string, () => void][] = [
    ["Headcount report", () => exportCsv("headcount.csv", ["ID", "Name", "Department", "Branch", "Status", "Joined"], emps.map((e) => [e.id, e.name, e.department, e.branch, e.status, e.joiningDate]))],
    ["Attendance report", () => exportCsv("attendance.csv", ["Employee", "Date", "Status", "In", "Out"], att.map((a) => [a.employeeId, a.date, a.status, a.checkIn ?? "", a.checkOut ?? ""]))],
    ["Leave report", () => exportCsv("leave.csv", ["Employee", "Type", "Start", "End", "Days", "Status"], data.leaves.map((l) => [l.employeeId, l.type, l.startDate, l.endDate, l.days, l.status]))],
    ["Payroll summary", () => exportCsv("payroll.csv", ["Period", "Headcount", "Gross", "Net", "Status"], data.payrollRuns.map((r) => [r.period, r.headcount, r.gross, r.net, r.status]))],
  ];

  return (
    <div>
      <PageHeader title="Analytics & Reports" description="Workforce insights computed live from the demo data." />
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Headcount" value={String(emps.length)} icon={<Users className="h-4 w-4" />} />
        <KpiCard label="Avg. hours / day" value={avgHrs.toFixed(1)} icon={<Clock className="h-4 w-4" />} />
        <KpiCard label="Attrition (YTD)" value={`${attritionPct}%`} icon={<TrendingDown className="h-4 w-4" />} />
        <KpiCard label="Monthly payroll" value={inr(emps.reduce((s, e) => s + e.monthlyGross, 0), { compact: true })} icon={<Wallet className="h-4 w-4" />} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Attendance trend — October" subtitle="Present vs absent per day">
          <div className="h-64"><ResponsiveContainer><LineChart data={daily}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="d" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend /><Line dataKey="present" stroke="var(--color-success)" strokeWidth={2} dot={false} /><Line dataKey="late" stroke="var(--color-warning)" strokeWidth={2} dot={false} /><Line dataKey="absent" stroke="var(--color-danger)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
        </ChartCard>
        <ChartCard title="Headcount by department">
          <div className="h-64"><ResponsiveContainer><BarChart data={byDept}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={10} interval={0} angle={-15} height={50} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </ChartCard>
        <ChartCard title="Leave days by type">
          <div className="h-64"><ResponsiveContainer><PieChart><Pie data={leaveMix} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>{leaveMix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div>
        </ChartCard>
        <ChartCard title="Branch distribution">
          <div className="h-64"><ResponsiveContainer><PieChart><Pie data={byBranch} dataKey="value" nameKey="name" outerRadius={85}>{byBranch.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div>
        </ChartCard>
        <ChartCard title="Net payroll trend" subtitle="₹ lakhs" className="lg:col-span-2">
          <div className="h-56"><ResponsiveContainer><BarChart data={payroll}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="p" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="net" fill="var(--color-success)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </ChartCard>
      </div>
      <div className="mt-4 rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Downloadable reports</p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {reports.map(([label, fn]) => (
            <Button key={label} variant="outline" className="justify-between text-xs" onClick={() => { fn(); toast.success(`${label} downloaded`); }}>{label}<Download className="h-3.5 w-3.5" /></Button>
          ))}
        </div>
      </div>
    </div>
  );
}
