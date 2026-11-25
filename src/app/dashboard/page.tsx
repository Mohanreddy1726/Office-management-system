"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users, UserCheck, CalendarCheck2, Plane, ClipboardList, HandCoins, UserPlus, Activity,
  Cake, FileClock, Building2, Plus, Upload, FileText, BadgeCheck, Wallet, CalendarClock,
  Briefcase, Package, Megaphone, Bell, Send, LogOut, CalendarDays, Fingerprint, Clock,
  Eye, EyeOff, ChevronRight, CheckCircle2, ShieldCheck,
} from "lucide-react";
import { useStore } from "@/lib/data/store";
import { TODAY, CURRENT_PERIOD } from "@/lib/data/seed";
import { KpiCard, PageHeader, ChartCard, StatusBadge, EmployeeAvatar, EmptyState, Timeline } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { inr, fmtDate, tenure } from "@/lib/format";
import { payslipFor } from "@/lib/payroll";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { ROLE_LABELS, DEPARTMENT_LIST } from "@/lib/data/departments";
import { AppShell } from "@/components/shell";

const COLORS = ["#356AE6", "#16845B", "#D98E04", "#5B61D6", "#D64545", "#0E7490"];

export default function DashboardPage() {
  const { session, hydrated } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !session) {
      router.push("/login");
    }
  }, [hydrated, session, router]);

  if (!hydrated || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm font-medium text-muted-foreground">Loading workspace…</span>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}

function DashboardContent() {
  const { session, me, data } = useStore();
  if (session?.role === "employee") {
    const currentMe = me() || data.employees.find((e) => e.id === session.userId) || data.employees[0];
    return <EmployeeDashboard me={currentMe} />;
  }
  if (session?.role === "manager") return <ManagerDashboard />;
  return <AdminDashboard />;
}

/* ---------- Shared hooks ---------- */

function useBranchEmployees() {
  const { data, prefs } = useStore();
  return useMemo(
    () =>
      data.employees.filter(
        (e) =>
          (prefs.branch === "All Branches" ? true : e.branch === prefs.branch) &&
          e.status !== "Inactive" &&
          e.status !== "Resigned"
      ),
    [data.employees, prefs.branch]
  );
}

/* ---------- Super Admin / HR dashboard ---------- */

function AdminDashboard() {
  const { data, me } = useStore();
  const router = useRouter();
  const emps = useBranchEmployees();
  const today = data.attendance.filter((a) => a.date === TODAY);
  const present = today.filter((a) => ["Present", "Late"].includes(a.status)).length;
  const onLeave = today.filter((a) => a.status === "Leave").length;
  const pendingConfirm = data.attendance.filter((a) => a.confirmation.startsWith("Awaiting")).length;
  const pendingLeaves = data.leaves.filter((l) =>
    ["Submitted", "Manager Review", "HR Review", "Pending", "Pending Review"].includes(l.status)
  );
  const currentRun = data.payrollRuns.find((r) => r.period === CURRENT_PERIOD);
  const active = emps.filter((e) => e.status === "Active").length;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Charts data
  const headcountTrend = useMemo(() => {
    const months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
    return months.map((m, i) => {
      const end = new Date(`2026-${String(i + 5).padStart(2, "0")}-28T00:00:00Z`);
      const count = emps.filter((e) => new Date(e.joiningDate + "T00:00:00Z") <= end).length;
      return { month: m, headcount: count };
    });
  }, [emps]);

  const deptData = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of emps) map.set(e.department, (map.get(e.department) ?? 0) + 1);
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [emps]);

  const attDonut = useMemo(
    () => [
      { name: "Present", value: present },
      { name: "On Leave", value: onLeave },
      { name: "Absent", value: today.filter((a) => a.status === "Absent").length },
      { name: "Half Day", value: today.filter((a) => a.status === "Half Day").length },
      { name: "Late", value: today.filter((a) => a.status === "Late").length },
    ],
    [present, onLeave, today]
  );

  const payrollBars = data.payrollRuns.map((r) => ({
    period: r.period,
    Gross: r.gross,
    Net: r.net,
  }));

  const pendingApprovals = useMemo(() => {
    const items = pendingLeaves.map((l) => ({
      kind: "Leave",
      label: `${l.type}`,
      sub: `${nameOf(data, l.employeeId)} · ${fmtDate(l.startDate)}–${fmtDate(l.endDate)}`,
      link: "/leave?tab=approvals",
    }));
    const corr = data.corrections
      .filter((c) => ["Awaiting Manager", "Awaiting HR"].includes(c.status))
      .map((c) => ({
        kind: "Correction",
        label: "Attendance correction",
        sub: `${nameOf(data, c.employeeId)} · ${fmtDate(c.date)}`,
        link: "/attendance?tab=corrections",
      }));
    return [...items, ...corr].slice(0, 7);
  }, [pendingLeaves, data]);

  const birthdays = useMemo(() => {
    const anniv = (d: string, m: number) => new Date(d + "T00:00:00Z").getUTCMonth() === m;
    return emps
      .filter((e) => anniv(e.dob, 9))
      .map((e) => ({ e, day: new Date(e.dob + "T00:00:00Z").getUTCDate(), what: "Birthday" }))
      .concat(
        emps
          .filter((e) => anniv(e.joiningDate, 9))
          .map((e) => ({
            e,
            day: new Date(e.joiningDate + "T00:00:00Z").getUTCDate(),
            what: "Work anniversary",
          }))
      )
      .sort((a, b) => a.day - b.day)
      .slice(0, 6);
  }, [emps]);

  const probation = emps.filter((e) => e.status === "Probation").slice(0, 5);
  const expiring = data.documents
    .filter((d) => d.expiresAt)
    .filter(
      (d) =>
        (new Date(d.expiresAt! + "T00:00:00Z").getTime() -
          new Date(TODAY + "T00:00:00Z").getTime()) /
          86400000 <
        60
    )
    .slice(0, 5);

  const branchCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of data.employees) map.set(e.branch, (map.get(e.branch) ?? 0) + 1);
    return Array.from(map.entries());
  }, [data.employees]);

  const quickActions = [
    { label: "Add Employee", icon: Plus, to: "/employees?open=add" },
    { label: "Attendance Correction", icon: ClipboardList, to: "/attendance?open=correction" },
    { label: "Process Payroll", icon: Wallet, to: "/payroll?open=run" },
    { label: "Upload Document", icon: Upload, to: "/documents?open=upload" },
    { label: "View Approvals", icon: BadgeCheck, to: "/leave?tab=approvals" },
  ];

  const adminName = me()?.name?.split(" ")[0] || "Admin";

  return (
    <div>
      <PageHeader
        title={`Good morning, ${adminName}`}
        description={`Admin overview for ${fmtDate(TODAY)} — ${emps.length} people across the organization.`}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total employees"
          value={String(emps.length)}
          hint={`${active} active`}
          icon={<Users className="h-4 w-4" />}
          onClick={() => router.push("/employees")}
        />
        <KpiCard
          label="Present today"
          value={String(present)}
          hint={`${Math.round((present / Math.max(1, emps.length)) * 100)}% of workforce`}
          icon={<UserCheck className="h-4 w-4" />}
          trend={{ dir: "up", text: "+3 vs yesterday" }}
          onClick={() => router.push("/attendance")}
        />
        <KpiCard
          label="On leave today"
          value={String(onLeave)}
          hint="Approved leave"
          icon={<Plane className="h-4 w-4" />}
          onClick={() => router.push("/leave")}
        />
        <KpiCard
          label="Pending approvals"
          value={String(
            pendingLeaves.length +
              data.corrections.filter((c) => c.status.startsWith("Awaiting")).length
          )}
          hint="Leave + attendance corrections"
          icon={<BadgeCheck className="h-4 w-4" />}
          onClick={() => router.push("/leave?tab=approvals")}
        />
        <KpiCard
          label="Awaiting confirmation"
          value={String(pendingConfirm)}
          hint="Attendance workflow in progress"
          icon={<ClipboardList className="h-4 w-4" />}
          onClick={() => router.push("/attendance?tab=confirmation")}
        />
        <KpiCard
          label="Upcoming joiners"
          value={String(data.joiners.length)}
          hint="Next 2 weeks"
          icon={<UserPlus className="h-4 w-4" />}
          onClick={() => router.push("/onboarding")}
        />
        <KpiCard
          label="Payroll estimate"
          value={inr(currentRun?.gross ?? 0, { compact: true })}
          hint={`${CURRENT_PERIOD} · ${currentRun?.headcount ?? emps.length} employees`}
          icon={<HandCoins className="h-4 w-4" />}
          onClick={() => router.push("/payroll")}
        />
        <KpiCard
          label="Expiring documents"
          value={String(expiring.length)}
          hint="Within 60 days"
          icon={<FileClock className="h-4 w-4" />}
          onClick={() => router.push("/documents")}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Headcount trend" subtitle="Last 6 months" className="xl:col-span-2">
          {mounted ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={headcountTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="headcount" stroke="#356AE6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] w-full animate-pulse rounded bg-muted/40" />
          )}
        </ChartCard>
        <ChartCard title="Attendance today" subtitle="Status distribution">
          {mounted ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={attDonut}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {attDonut.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] w-full animate-pulse rounded bg-muted/40" />
          )}
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Department distribution" subtitle="Employee count by department">
          {mounted ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={deptData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 10 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="value" fill="#356AE6" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] w-full animate-pulse rounded bg-muted/40" />
          )}
        </ChartCard>
        <ChartCard title="Monthly payroll" subtitle="Gross vs net by period">
          {mounted ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={payrollBars} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => `${Math.round(v / 100000)}L`}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip formatter={(v) => inr(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="Gross" fill="#356AE6" radius={[4, 4, 0, 0]} barSize={18} />
                <Bar dataKey="Net" fill="#16845B" radius={[4, 4, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] w-full animate-pulse rounded bg-muted/40" />
          )}
        </ChartCard>
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="text-sm font-semibold">Branch-wise headcount</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 p-4">
            {branchCounts.map(([b, c]) => (
              <div key={b}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-foreground">{b}</span>
                  <span className="text-muted-foreground">{c}</span>
                </div>
                <Progress value={(c / data.employees.length) * 100} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="text-sm font-semibold">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
            {quickActions.map((a) => (
              <Button
                key={a.label}
                variant="outline"
                size="sm"
                className="justify-start gap-2 text-xs"
                onClick={() => router.push(a.to)}
              >
                <a.icon className="h-3.5 w-3.5 text-primary" /> {a.label}
              </Button>
            ))}
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="text-sm font-semibold">Pending approval queue</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {pendingApprovals.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">Nothing pending — all clear.</p>
            ) : (
              pendingApprovals.map((p, i) => (
                <button
                  key={i}
                  onClick={() => router.push(p.link)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left hover:bg-blue-soft/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-foreground">{p.label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{p.sub}</span>
                  </span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {p.kind}
                  </Badge>
                </button>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="text-sm font-semibold">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[260px] overflow-y-auto p-4 scrollbar-thin">
            <Timeline
              items={data.audit.slice(0, 6).map((a) => ({
                at: a.timestamp,
                title: a.action,
                by: a.user,
                note: a.record,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Cake className="h-4 w-4 text-primary" /> Birthdays & anniversaries
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {birthdays.length === 0 && (
              <p className="px-2 py-4 text-xs text-muted-foreground">None this month.</p>
            )}
            {birthdays.map(({ e, day, what }) => (
              <div key={e.id + what} className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
                <EmployeeAvatar id={e.id} name={e.name} size={26} />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{e.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  Oct {day} · {what}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="h-4 w-4 text-primary" /> Probation deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {probation.length === 0 ? (
              <EmptyState title="No employees on probation" />
            ) : (
              probation.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <EmployeeAvatar id={e.id} name={e.name} size={26} />
                    <span className="min-w-0 truncate text-xs font-medium">{e.name}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {fmtDate(endOfProbation(e.joiningDate, e.probationMonths))}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4 text-primary" /> Onboarding & exit
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {data.joiners.map((j) => (
              <div key={j.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5">
                <span className="min-w-0 truncate text-xs font-medium">
                  {j.name} joining {j.department}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{fmtDate(j.joiningDate)}</span>
              </div>
            ))}
            {data.resignations.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5">
                <span className="min-w-0 truncate text-xs font-medium">
                  {nameOf(data, r.employeeId)} — notice period
                </span>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function endOfProbation(joining: string, months: number) {
  const d = new Date(joining + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function nameOf(d: { employees: { id: string; name: string }[] }, id: string) {
  return d.employees.find((e) => e.id === id)?.name ?? id;
}

/* ---------- Manager dashboard ---------- */

function ManagerDashboard() {
  const { data, session, me } = useStore();
  const router = useRouter();
  const team = data.employees.filter((e) => e.managerId === session?.userId);
  const teamIds = new Set(team.map((t) => t.id));
  const today = data.attendance.filter((a) => a.date === TODAY && teamIds.has(a.employeeId));
  const present = today.filter((a) => ["Present", "Late"].includes(a.status)).length;
  const absent = today.filter((a) => a.status === "Absent").length;
  const onLeave = today.filter((a) => a.status === "Leave").length;
  const pendingLeaves = data.leaves.filter(
    (l) => ["Submitted", "Manager Review"].includes(l.status) && teamIds.has(l.employeeId)
  );
  const pendingCorr = data.corrections.filter(
    (c) => c.status === "Awaiting Manager" && teamIds.has(c.employeeId)
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const trend = useMemo(() => {
    const dates = [
      ...new Set(
        data.attendance
          .filter((a) => teamIds.has(a.employeeId) && !["Week Off", "Holiday"].includes(a.status))
          .map((a) => a.date)
      ),
    ]
      .sort()
      .slice(-14);
    return dates.map((d) => {
      const rows = data.attendance.filter((a) => a.date === d && teamIds.has(a.employeeId));
      const p = rows.filter((a) => ["Present", "Late"].includes(a.status)).length;
      return {
        date: d.slice(5),
        present: p,
        strength: rows.length ? Math.round((p / rows.length) * 100) : 0,
      };
    });
  }, [data.attendance, teamIds]);

  const upcoming = data.leaves
    .filter(
      (l) =>
        ["Approved", "Manager Review", "HR Review", "Submitted"].includes(l.status) &&
        teamIds.has(l.employeeId) &&
        l.startDate >= TODAY
    )
    .slice(0, 6);
  const goals = data.goals.filter((g) => teamIds.has(g.employeeId));
  const managerName = me()?.name || "Manager";

  return (
    <div>
      <PageHeader
        title={`Team dashboard — ${managerName}`}
        description={`You manage ${team.length} people. ${fmtDate(TODAY)}.`}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Team size"
          value={String(team.length)}
          hint="Active members"
          icon={<Users className="h-4 w-4" />}
          onClick={() => router.push("/employees")}
        />
        <KpiCard
          label="Present today"
          value={String(present)}
          hint={`${absent} absent · ${onLeave} on leave`}
          icon={<UserCheck className="h-4 w-4" />}
          onClick={() => router.push("/attendance")}
        />
        <KpiCard
          label="Pending approvals"
          value={String(pendingLeaves.length + pendingCorr.length)}
          hint="Leave + corrections"
          icon={<BadgeCheck className="h-4 w-4" />}
          onClick={() => router.push("/leave?tab=approvals")}
        />
        <KpiCard
          label="On leave today"
          value={String(onLeave)}
          hint="Approved leaves"
          icon={<CalendarDays className="h-4 w-4" />}
          onClick={() => router.push("/leave")}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Team attendance strength" subtitle="Last 14 working days (% present)">
          {mounted ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trend} margin={{ left: -20, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Area
                  type="monotone"
                  dataKey="strength"
                  stroke="#356AE6"
                  fill="#356AE6"
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] w-full animate-pulse rounded bg-muted/40" />
          )}
        </ChartCard>
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4 text-primary" /> Upcoming team leave
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {upcoming.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">No upcoming leave requests.</p>
            ) : (
              upcoming.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className="min-w-0 flex items-center gap-2.5">
                    <EmployeeAvatar id={l.employeeId} name={nameOf(data, l.employeeId)} size={26} />
                    <span className="min-w-0 truncate text-xs font-medium">{nameOf(data, l.employeeId)}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {fmtDate(l.startDate)} · {l.days}d
                  </span>
                  <StatusBadge status={l.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="border-border shadow-sm xl:col-span-2">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="text-sm font-semibold">Team goals progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {goals.slice(0, 5).map((g) => (
              <div key={g.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-foreground">
                    {g.title}{" "}
                    <span className="font-normal text-muted-foreground">· {nameOf(data, g.employeeId)}</span>
                  </span>
                  <span className="shrink-0">
                    <StatusBadge status={g.status} />
                  </span>
                </div>
                <Progress value={g.progress} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="text-sm font-semibold">Recent team activity</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[260px] overflow-y-auto p-4 scrollbar-thin">
            <Timeline
              items={data.audit.slice(0, 6).map((a) => ({
                at: a.timestamp,
                title: a.action,
                by: a.user,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ---------- Employee dashboard ---------- */

function EmployeeDashboard({ me }: { me: any }) {
  const { data, session } = useStore();
  const router = useRouter();
  const [showPay, setShowPay] = useState(true);

  const realTodayIso = useMemo(() => {
    try {
      return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    } catch {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }, []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const mine = useMemo(
    () => data.attendance.filter((a) => a.employeeId === me.id),
    [data.attendance, me.id]
  );

  const todayRec = useMemo(
    () => mine.find((a) => a.date === realTodayIso),
    [mine, realTodayIso]
  );

  const lastRec = useMemo(
    () =>
      [...mine]
        .filter((a) => a.date < realTodayIso && (a.checkIn || a.checkOut))
        .sort((a, b) => b.date.localeCompare(a.date))[0],
    [mine, realTodayIso]
  );

  const activePeriod = realTodayIso.slice(0, 7);

  const activeMonthLabel = useMemo(() => {
    try {
      return new Date(activePeriod + "-01T00:00:00Z").toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
    } catch {
      return activePeriod;
    }
  }, [activePeriod]);

  const month = useMemo(
    () => mine.filter((a) => a.date.startsWith(activePeriod)),
    [mine, activePeriod]
  );

  const counts = {
    present: month.filter((a) => ["Present", "Late"].includes(a.status)).length,
    absent: month.filter((a) => a.status === "Absent").length,
    leave: month.filter((a) => a.status === "Leave").length,
    late: month.filter((a) => a.status === "Late").length,
  };
  const workingDays = month.filter((a) => !["Week Off", "Holiday"].includes(a.status)).length;
  const attendanceRate = workingDays > 0 ? Math.round((counts.present / workingDays) * 100) : 0;

  const balances = data.leaveBalances[me.id] ?? {};
  const leaveBalanceEntries = Object.entries(balances).filter(([, v]) => (v as number) > 0);
  const totalLeaveDays = leaveBalanceEntries.reduce((sum, [, v]) => sum + (Number(v) || 0), 0);

  const myLeaves = data.leaves.filter((l) => l.employeeId === me.id).slice(0, 4);
  const confirmPending = mine.filter((a) => a.confirmation === "Awaiting Employee");
  const latestRun = data.payrollRuns
    .filter((r) => r.status === "Payment Recorded")
    .sort((a, b) => b.period.localeCompare(a.period))[0];
  const slip = latestRun ? payslipFor(me, data.salaryStructures) : null;
  const myAssets = data.assets.filter((a) => a.assignedTo === me.id);
  const myDocs = data.documents.filter((d) => d.ownerId === me.id && d.status !== "Verified");
  const unreadNotifs = data.notifications.filter((n) => !n.read);

  const userShift =
    data.shifts.find((s) => s.id === todayRec?.shiftId) ||
    data.shifts.find((s) => s.id === "SH-GEN") ||
    data.shifts[0];

  const workedLabel = useMemo(() => {
    if (!todayRec?.workedMinutes) return null;
    const hrs = Math.floor(todayRec.workedMinutes / 60);
    const mins = todayRec.workedMinutes % 60;
    return `${hrs}h ${mins}m`;
  }, [todayRec?.workedMinutes]);

  const visibleAnnouncements = useMemo(() => {
    const myBranch = me?.branch || session?.branch;
    const myDept = me?.department;

    return data.announcements.filter((ann) => {
      const aud = (ann.audience || "All Employees").toLowerCase().trim();
      if (aud === "all employees" || aud === "all" || !aud) return true;
      if (aud === "managers only") return false;
      if (aud.includes("branch")) {
        const scope = (ann.scope || "").toLowerCase().trim();
        return !scope || (myBranch || "").toLowerCase().includes(scope) || scope.includes((myBranch || "").toLowerCase());
      }
      if (aud.includes("dept") || aud.includes("department")) {
        const scope = (ann.scope || "").toLowerCase().trim();
        return !scope || (myDept || "").toLowerCase().includes(scope) || scope.includes((myDept || "").toLowerCase());
      }
      return true;
    });
  }, [data.announcements, me, session]);

  const upcomingHolidays = useMemo(() => {
    const myBranch = (me?.branch || session?.branch || "").toLowerCase();
    return data.holidays
      .filter((h) => {
        if (!Array.isArray(h.branches) || h.branches.length === 0) return true;
        return h.branches.some(
          (b: string) => b.toLowerCase().includes("all") || b.toLowerCase() === myBranch
        );
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);
  }, [data.holidays, me?.branch, session?.branch]);

  const quickActions = [
    {
      label: "Apply Leave",
      sub: "Request time off",
      icon: Plane,
      tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      onClick: () => router.push("/leave?open=apply"),
    },
    {
      label: "Attendance",
      sub: "Biometric logs",
      icon: Fingerprint,
      tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      onClick: () => router.push("/attendance"),
    },
    {
      label: "My Payslip",
      sub: "Salary & slips",
      icon: Wallet,
      tone: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
      onClick: () => router.push("/payroll?tab=payslips"),
    },
    {
      label: "Documents",
      sub: myDocs.length > 0 ? `${myDocs.length} pending` : "All verified",
      icon: FileText,
      tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      onClick: () => router.push("/documents"),
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Native Mobile-First Hero Welcome Card */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-indigo-500/5 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <EmployeeAvatar id={me.id} name={me.name} size={52} />
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
                {fmtDate(realTodayIso)}
              </p>
              <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {greeting}, {me.name.split(" ")[0]}
              </h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {me.designation} · {me.department}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="bg-background/70 text-[10px] font-medium">
                  {me.id}
                </Badge>
                <Badge variant="outline" className="bg-background/70 text-[10px] font-medium">
                  {me.branch}
                </Badge>
                {userShift && (
                  <Badge variant="outline" className="bg-background/70 text-[10px] font-medium">
                    {userShift.start} – {userShift.end}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {unreadNotifs.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 rounded-xl bg-background/80 text-xs font-medium"
                onClick={() => router.push("/notifications")}
              >
                <Bell className="h-3.5 w-3.5 text-primary" />
                {unreadNotifs.length} alert{unreadNotifs.length > 1 ? "s" : ""}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 rounded-xl bg-background/80 text-xs font-medium"
              onClick={() => router.push(`/employees/${me.id}`)}
            >
              My Profile <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tactile Self-Service Quick Actions */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {quickActions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.label}
              onClick={act.onClick}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-xs transition-all hover:border-primary/30 hover:shadow-sm active:scale-[0.98]"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${act.tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground sm:text-[13px]">{act.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">{act.sub}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Primary Row: Biometric Attendance Today + Monthly Summary */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden rounded-2xl border-border shadow-sm lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/70 bg-muted/20 px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Fingerprint className="h-4 w-4 text-primary" /> Today&apos;s Attendance
            </CardTitle>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-3 w-3" /> Biometric
            </span>
          </CardHeader>
          <CardContent className="p-4 space-y-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Status</p>
                <p className="mt-0.5 text-xl font-bold tracking-tight text-foreground">
                  {todayRec?.status ?? "Awaiting Punch"}
                </p>
                {todayRec?.lateMinutes ? (
                  <p className="mt-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                    Late by {todayRec.lateMinutes} mins
                  </p>
                ) : todayRec?.checkIn ? (
                  <p className="mt-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    Synced from biometric scanner
                  </p>
                ) : (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Auto-synced from office biometric device
                  </p>
                )}
              </div>
              {todayRec && <StatusBadge status={todayRec.confirmation} />}
            </div>

            {userShift && (
              <div className="flex items-center justify-between rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Clock className="h-3.5 w-3.5 text-primary" /> {userShift.name}
                </span>
                <span className="font-semibold text-primary">
                  {userShift.start} – {userShift.end}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Biometric In</p>
                <p className="mt-0.5 text-base font-bold tabular-nums text-foreground">
                  {todayRec?.checkIn ?? "—"}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Biometric Out</p>
                <p className="mt-0.5 text-base font-bold tabular-nums text-foreground">
                  {todayRec?.checkOut ?? "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
              <span>{todayRec?.deviceUsed || "Office Biometric Terminal"}</span>
              {workedLabel ? (
                <span className="font-semibold text-foreground">Worked: {workedLabel}</span>
              ) : !todayRec && lastRec ? (
                <span>
                  Last log: {fmtDate(lastRec.date)}
                </span>
              ) : null}
            </div>

            {confirmPending.length > 0 && (
              <Button
                size="sm"
                className="w-full rounded-xl text-xs font-semibold"
                onClick={() => router.push("/attendance?tab=confirmation")}
              >
                Confirm Biometric Attendance ({confirmPending.length} pending)
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-border shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/70 bg-muted/20 px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CalendarCheck2 className="h-4 w-4 text-primary" /> {activeMonthLabel} Summary
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-primary hover:text-primary"
              onClick={() => router.push("/attendance")}
            >
              View Log <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Present", value: counts.present, tone: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/8 border-emerald-500/20" },
                { label: "Late Arrivals", value: counts.late, tone: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/8 border-amber-500/20" },
                { label: "On Leave", value: counts.leave, tone: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/8 border-sky-500/20" },
                { label: "Absent", value: counts.absent, tone: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/8 border-rose-500/20" },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border px-3 py-3.5 text-center ${s.bg}`}>
                  <p className={`text-2xl font-bold tabular-nums ${s.tone}`}>{s.value}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Monthly Attendance Rate</span>
                <span className="font-bold text-foreground">
                  {attendanceRate}% ({counts.present}/{workingDays || 0} working days)
                </span>
              </div>
              <Progress value={attendanceRate} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Row: Leave Balances, Latest Payslip & Announcements */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden rounded-2xl border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/70 bg-muted/20 px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Plane className="h-4 w-4 text-primary" /> Leave Balances
            </CardTitle>
            <Badge variant="outline" className="text-[10px] font-semibold">
              {totalLeaveDays} days left
            </Badge>
          </CardHeader>
          <CardContent className="p-4">
            {leaveBalanceEntries.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No leave balance available.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {leaveBalanceEntries.map(([type, v]) => (
                  <div key={type} className="rounded-xl border border-border/80 bg-background/70 px-3 py-2.5">
                    <p className="text-xl font-bold tabular-nums text-foreground">{v as number}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{type.replace(" Leave", "")}</p>
                  </div>
                ))}
              </div>
            )}
            <Button
              size="sm"
              className="mt-3.5 w-full rounded-xl text-xs font-semibold"
              onClick={() => router.push("/leave?open=apply")}
            >
              Apply for Leave
            </Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/70 bg-muted/20 px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Wallet className="h-4 w-4 text-primary" /> Latest Payslip
            </CardTitle>
            {slip && (
              <button
                onClick={() => setShowPay((p) => !p)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={showPay ? "Hide salary amount" : "Show salary amount"}
                title={showPay ? "Hide amount" : "Show amount"}
              >
                {showPay ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            )}
          </CardHeader>
          <CardContent className="p-4">
            {slip && latestRun ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{latestRun.period}</span>
                  <StatusBadge status={latestRun.status} />
                </div>
                <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {showPay ? inr(slip.net) : "₹ ••••••"}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Net Pay · Gross {showPay ? inr(slip.gross) : "₹ ••••••"}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4 w-full rounded-xl text-xs font-semibold"
                  onClick={() => router.push("/payroll?tab=payslips")}
                >
                  View &amp; Download Payslip
                </Button>
              </>
            ) : (
              <EmptyState title="No payslip yet" />
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/70 bg-muted/20 px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Megaphone className="h-4 w-4 text-primary" /> Announcements
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-primary hover:text-primary"
              onClick={() => router.push("/notifications")}
            >
              All <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="max-h-[210px] space-y-2 overflow-y-auto p-3 scrollbar-thin">
            {visibleAnnouncements.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No announcements published.</p>
            ) : (
              visibleAnnouncements.slice(0, 4).map((a) => (
                <div key={a.id} className="rounded-xl border border-border/80 bg-background/70 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-foreground">{a.title}</p>
                    {a.priority === "High" && (
                      <span className="shrink-0 rounded-full bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold text-rose-600 dark:text-rose-400">
                        Urgent
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{a.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Third Row: My Leave Requests & Recent Alerts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="overflow-hidden rounded-2xl border-border shadow-sm xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/70 bg-muted/20 px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="h-4 w-4 text-primary" /> My Leave Requests
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-primary hover:text-primary"
              onClick={() => router.push("/leave")}
            >
              View All <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            {myLeaves.length === 0 ? (
              <p className="py-5 text-center text-xs text-muted-foreground">No leave requests submitted yet.</p>
            ) : (
              myLeaves.map((l) => {
                const rejReason =
                  l.decisionNote ||
                  l.timeline?.slice().reverse().find((t: any) => t.stage === "Rejected" && t.note)?.note;
                return (
                  <div key={l.id} className="rounded-xl border border-border/70 bg-background/60 p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-foreground">{l.type}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {fmtDate(l.startDate)} · {l.days} day{l.days > 1 ? "s" : ""}
                        </p>
                      </div>
                      <StatusBadge status={l.status} />
                    </div>
                    {l.status === "Rejected" && rejReason && (
                      <div className="rounded-lg border border-rose-200/80 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                        <span className="font-semibold">Note: </span>
                        <span className="italic">&ldquo;{rejReason}&rdquo;</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/70 bg-muted/20 px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Bell className="h-4 w-4 text-primary" /> Alerts
            </CardTitle>
            {unreadNotifs.length > 0 && (
              <Badge variant="outline" className="text-[10px] font-semibold">
                {unreadNotifs.length} unread
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-3 space-y-1.5">
            {unreadNotifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-5 text-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 mb-1" />
                <p className="text-xs font-medium text-foreground">You&apos;re all caught up</p>
                <p className="text-[11px] text-muted-foreground">No unread alerts</p>
              </div>
            ) : (
              unreadNotifs.slice(0, 4).map((n) => (
                <button
                  key={n.id}
                  onClick={() => router.push("/notifications")}
                  className="block w-full rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-left transition-colors hover:bg-muted/50"
                >
                  <p className="truncate text-xs font-semibold text-foreground">{n.title}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{n.timestamp}</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fourth Row: Documents, Assigned Assets & Upcoming Holidays */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="overflow-hidden rounded-2xl border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/70 bg-muted/20 px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-primary" /> Documents
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-primary hover:text-primary"
              onClick={() => router.push("/documents")}
            >
              Manage <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-3">
            {myDocs.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/8 px-3 py-3 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>All required documents are verified.</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {myDocs.slice(0, 4).map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 px-2.5 py-2">
                    <span className="min-w-0 truncate text-xs font-medium">{d.name}</span>
                    <StatusBadge status={d.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/70 bg-muted/20 px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Package className="h-4 w-4 text-primary" /> My Assets
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-primary hover:text-primary"
              onClick={() => router.push("/assets")}
            >
              View <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-3">
            {myAssets.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No company assets assigned.</p>
            ) : (
              <div className="space-y-1.5">
                {myAssets.slice(0, 4).map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 px-2.5 py-2">
                    <span className="min-w-0 truncate text-xs font-medium text-foreground">{a.name}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">{a.id}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/70 bg-muted/20 px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4 text-primary" /> Upcoming Holidays
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-primary hover:text-primary"
              onClick={() => router.push("/leave")}
            >
              Calendar <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-3 space-y-1.5">
            {upcomingHolidays.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No upcoming holidays listed.</p>
            ) : (
              upcomingHolidays.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 px-2.5 py-2">
                  <div className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-foreground">{h.name}</span>
                    <span className="text-[10px] text-muted-foreground">{fmtDate(h.date)}</span>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {Array.isArray(h.branches) ? h.branches.join(", ") : h.branches}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
