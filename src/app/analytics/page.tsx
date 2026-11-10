"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/shell";
import { useStore } from "@/lib/data/store";
import { PageHeader, KpiCard, ChartCard } from "@/components/shared";
import { exportCsv } from "@/components/data-table";
import { useScope } from "@/components/form-bits";
import { inr, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Download,
  TrendingDown,
  Users,
  Clock,
  Wallet,
  FileSpreadsheet,
  Building2,
  Calendar,
  Layers,
  ShieldCheck,
  CheckCircle2,
  PieChart as PieIcon,
  BarChart3,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";

const COLORS = [
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#8b5cf6", // Purple
  "#64748b", // Slate
];

export default function AnalyticsPage() {
  const { data } = useStore();
  const { inScope, role, isAdmin } = useScope();

  const emps = useMemo(
    () => data.employees.filter((e) => inScope(e.id) && e.status !== "Inactive"),
    [data.employees, inScope]
  );

  const att = useMemo(
    () => data.attendance.filter((a) => inScope(a.employeeId)),
    [data.attendance, inScope]
  );

  const byDept = useMemo(() => {
    const counts = emps.reduce<Record<string, number>>((acc, e) => {
      acc[e.department] = (acc[e.department] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [emps]);

  const byBranch = useMemo(() => {
    const counts = emps.reduce<Record<string, number>>((acc, e) => {
      acc[e.branch] = (acc[e.branch] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [emps]);

  const daily = useMemo(() => {
    const m = new Map<string, { d: string; present: number; absent: number; late: number }>();
    att.forEach((a) => {
      const day = a.date.slice(8);
      const r = m.get(a.date) ?? { d: `Day ${day}`, present: 0, absent: 0, late: 0 };
      if (a.status === "Present") {
        r.present++;
      } else if (a.status === "Late") {
        r.late++;
        r.present++;
      } else if (a.status === "Absent") {
        r.absent++;
      }
      m.set(a.date, r);
    });
    return [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v)
      .filter((v) => v.present + v.absent > 0);
  }, [att]);

  const leaveMix = useMemo(() => {
    const counts = data.leaves
      .filter((l) => inScope(l.employeeId))
      .reduce<Record<string, number>>((m, l) => {
        m[l.type] = (m[l.type] ?? 0) + l.days;
        return m;
      }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [data.leaves, inScope]);

  const payroll = useMemo(() => {
    return [...data.payrollRuns]
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((r) => ({
        p: new Date(r.period + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        gross: Math.round(r.gross / 100000),
        net: Math.round(r.net / 100000),
      }));
  }, [data.payrollRuns]);

  const worked = att.filter((a) => a.workedMinutes);
  const avgHrs = worked.length
    ? worked.reduce((s, a) => s + (a.workedMinutes ?? 0), 0) / worked.length / 60
    : 8.2;

  const totalPossible = Math.max(1, emps.length + data.formerEmployees.length);
  const attritionPct = ((data.formerEmployees.length / totalPossible) * 100).toFixed(1);
  const totalMonthlyPayroll = emps.reduce((s, e) => s + e.monthlyGross, 0);

  // Pre-configured executive export reports
  const exportReports = [
    {
      id: "headcount",
      title: "Headcount & Staff Register",
      description: "Complete employee master data including departments, roles, branch assignments, and joining dates.",
      records: emps.length,
      category: "Personnel",
      action: () =>
        exportCsv(
          "headcount-report.csv",
          ["ID", "Name", "Work Email", "Phone", "Department", "Designation", "Branch", "Status", "Joined"],
          emps.map((e) => [
            e.id,
            e.name,
            e.workEmail,
            e.phone,
            e.department,
            e.designation,
            e.branch,
            e.status,
            e.joiningDate,
          ])
        ),
    },
    {
      id: "attendance",
      title: "Biometric Attendance & Punch Audit",
      description: "Daily swipe logs, check-in/out timestamps, hours worked, late flags, and attendance review stages.",
      records: att.length,
      category: "Attendance",
      action: () =>
        exportCsv(
          "attendance-punch-log.csv",
          ["Employee ID", "Date", "Status", "Check In", "Check Out", "Worked Minutes", "Source", "Confirmation"],
          att.map((a) => [
            a.employeeId,
            a.date,
            a.status,
            a.checkIn ?? "—",
            a.checkOut ?? "—",
            a.workedMinutes ? String(a.workedMinutes) : "—",
            a.source,
            a.confirmation,
          ])
        ),
    },
    {
      id: "leaves",
      title: "Leave & Absence Records",
      description: "All historical and pending leave applications with dates, leave types, durations, and approval timelines.",
      records: data.leaves.length,
      category: "Time Off",
      action: () =>
        exportCsv(
          "leaves-absence-report.csv",
          ["Employee ID", "Leave Type", "Start Date", "End Date", "Total Days", "Reason", "Status"],
          data.leaves.map((l) => [l.employeeId, l.type, l.startDate, l.endDate, l.days, l.reason, l.status])
        ),
    },
    {
      id: "payroll",
      title: "Payroll Summary & Bank Register",
      description: "Periodical payroll runs, gross wage outlays, statutory deductions, net payouts, and authorization state.",
      records: data.payrollRuns.length,
      category: "Finance",
      action: () =>
        exportCsv(
          "payroll-summary.csv",
          ["Period", "Headcount", "Gross (₹)", "Deductions (₹)", "Employer Contribution (₹)", "Net Payout (₹)", "Status"],
          data.payrollRuns.map((r) => [
            r.period,
            r.headcount,
            r.gross,
            r.employeeDeductions,
            r.employerContributions,
            r.net,
            r.status,
          ])
        ),
    },
    {
      id: "assets",
      title: "IT Equipment & Asset Custody Log",
      description: "Company hardware inventory, serial numbers, assignments, warranty expirations, and device conditions.",
      records: data.assets.length,
      category: "IT Assets",
      action: () =>
        exportCsv(
          "assets-inventory.csv",
          ["Asset ID", "Name", "Category", "Serial No", "Condition", "Assigned To", "Status", "Warranty Till"],
          data.assets.map((a) => [
            a.id,
            a.name,
            a.category,
            a.serial,
            a.condition,
            a.assignedTo ?? "Unassigned",
            a.status,
            a.warrantyExpiry,
          ])
        ),
    },
    {
      id: "exits",
      title: "Attrition & Exit Clearance Archive",
      description: "Former employee records, separation reasons, relieving dates, and department handover status.",
      records: data.formerEmployees.length,
      category: "Retention",
      action: () =>
        exportCsv(
          "attrition-exits-archive.csv",
          ["ID", "Name", "Department", "Designation", "Relieved Date", "Reason", "Handover Status"],
          data.formerEmployees.map((f) => [
            f.id,
            f.name,
            f.department,
            f.designation,
            f.exitDate,
            f.reason ?? "Resignation",
            "Clearance Complete",
          ])
        ),
    },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Analytics & Workforce Reports"
          description="Executive insights, attendance patterns, leave distributions, payroll trends, and downloadable compliance packages."
          actions={
            <Button
              size="sm"
              className="gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              onClick={() => {
                exportReports[0].action();
                toast.success("Executive Master CSV downloaded");
              }}
            >
              <Download className="h-3.5 w-3.5" /> Download Master Bundle
            </Button>
          }
        />

        {/* 4 Top KPI Cards */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard
            label="Active Workforce"
            value={`${emps.length} Employees`}
            icon={<Users className="h-4 w-4 text-primary" />}
            hint="Active headcount in scope"
          />
          <KpiCard
            label="Avg. Daily Work Hours"
            value={`${avgHrs.toFixed(1)} hrs`}
            icon={<Clock className="h-4 w-4 text-indigo-500" />}
            hint="Biometric logged duration"
          />
          <KpiCard
            label="Annual Attrition Rate"
            value={`${attritionPct}%`}
            icon={<TrendingDown className="h-4 w-4 text-emerald-600" />}
            hint={`${data.formerEmployees.length} exits recorded YTD`}
          />
          <KpiCard
            label="Monthly Payroll Outlay"
            value={inr(totalMonthlyPayroll, { compact: true })}
            icon={<Wallet className="h-4 w-4 text-amber-500" />}
            hint="Combined salary base"
          />
        </div>

        {/* Charts Section */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Chart 1: Attendance Daily Trend */}
          <ChartCard
            title="Attendance Dynamics — Current Month"
            subtitle="Daily breakdown of Present, Late Arrivals, and Absent personnel"
          >
            <div className="h-64 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="d" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="present"
                    name="Present"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="late"
                    name="Late Arrivals"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="absent"
                    name="Absent"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* Chart 2: Headcount by Department */}
          <ChartCard
            title="Headcount by Department"
            subtitle="Personnel distribution across organizational units"
          >
            <div className="h-64 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDept} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    fontSize={10}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="value" name="Headcount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* Chart 3: Leave Distribution */}
          <ChartCard
            title="Leave Utilization by Category"
            subtitle="Cumulative days taken across all active leave policies"
          >
            <div className="h-64 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={leaveMix}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {leaveMix.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* Chart 4: Branch Distribution */}
          <ChartCard
            title="Branch Office Distribution"
            subtitle="Workforce allocation across company locations"
          >
            <div className="h-64 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byBranch}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {byBranch.map((_, i) => (
                      <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* Chart 5: Net Payroll Trend (Full Width) */}
          <ChartCard
            title="Monthly Payroll Expenditure Trend"
            subtitle="Gross wage liability vs net employee disbursements (₹ in Lakhs)"
            className="lg:col-span-2"
          >
            <div className="h-60 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={payroll} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="p" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `₹${v}L`} />
                  <Tooltip
                    formatter={(val: number) => [`₹${val} Lakhs`, ""]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="gross" name="Gross Payroll" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="net" name="Net Disbursed" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {/* Downloadable Standard Reports Cards */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold tracking-tight text-foreground">
                Downloadable Compliance & Audit Reports
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Standard audit-ready CSV exports prepared for compliance, HR audits, and external payroll filing.
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {exportReports.length} Reports Ready
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {exportReports.map((r) => (
              <div
                key={r.id}
                className="group flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-border"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold shadow-xs">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {r.category}
                    </span>
                  </div>

                  <h4 className="mt-3 font-semibold text-foreground text-sm tracking-tight">{r.title}</h4>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {r.description}
                  </p>

                  <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/40 p-2.5 text-xs">
                    <span className="text-muted-foreground font-medium">Record Count</span>
                    <span className="font-bold text-foreground">{r.records} entries</span>
                  </div>
                </div>

                <div className="mt-4 border-t border-border/60 pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs font-medium gap-1.5 hover:bg-primary/5 hover:border-primary/40 hover:text-primary transition"
                    onClick={() => {
                      r.action();
                      toast.success(`${r.title} exported`);
                    }}
                  >
                    <Download className="h-3.5 w-3.5" /> Download CSV
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}