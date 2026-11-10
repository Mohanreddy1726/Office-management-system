"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users, UserCheck, CalendarCheck2, Plane, ClipboardList, HandCoins, UserPlus, Activity,
  Cake, FileClock, Building2, Plus, Upload, FileText, BadgeCheck, Wallet, CalendarClock,
  Briefcase, Package, Megaphone, Bell, Send, LogOut, CalendarDays,
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
    ["Submitted", "Manager Review", "HR Review"].includes(l.status)
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
  const { data, session, switchRole } = useStore();
  const router = useRouter();
  const mine = data.attendance.filter((a) => a.employeeId === me.id);
  const todayRec = mine.find((a) => a.date === TODAY);
  const month = mine.filter((a) => a.date.startsWith("2026-10"));
  const counts = {
    present: month.filter((a) => ["Present", "Late"].includes(a.status)).length,
    absent: month.filter((a) => a.status === "Absent").length,
    leave: month.filter((a) => a.status === "Leave").length,
    late: month.filter((a) => a.status === "Late").length,
  };
  const balances = data.leaveBalances[me.id] ?? {};
  const myLeaves = data.leaves.filter((l) => l.employeeId === me.id).slice(0, 5);
  const confirmPending = mine.filter((a) => a.confirmation === "Awaiting Employee");
  const latestRun = data.payrollRuns
    .filter((r) => r.status === "Payment Recorded")
    .sort((a, b) => b.period.localeCompare(a.period))[0];
  const slip = latestRun ? payslipFor(me, data.salaryStructures) : null;
  const myAssets = data.assets.filter((a) => a.assignedTo === me.id);
  const myDocs = data.documents.filter((d) => d.ownerId === me.id && d.status !== "Verified");

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-foreground">
            Hi {me.name.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {me.designation} · {me.department} · {me.branch} · {fmtDate(TODAY)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-border shadow-sm lg:col-span-1">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CalendarCheck2 className="h-4 w-4 text-primary" /> Today&apos;s attendance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="mt-0.5 text-lg font-semibold text-foreground">{todayRec?.status ?? "Not marked"}</p>
              </div>
              <StatusBadge status={todayRec?.confirmation ?? "Awaiting Employee"} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-muted/60 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Check-in</p>
                <p className="font-semibold">{todayRec?.checkIn ?? "—"}</p>
              </div>
              <div className="rounded-md bg-muted/60 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Check-out</p>
                <p className="font-semibold">{todayRec?.checkOut ?? "—"}</p>
              </div>
            </div>
            {confirmPending.length > 0 && (
              <Button
                size="sm"
                className="mt-3 w-full text-xs"
                onClick={() => router.push("/attendance?tab=confirmation")}
              >
                Confirm attendance ({confirmPending.length} pending)
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm lg:col-span-2">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="text-sm font-semibold">October summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            {[
              { label: "Present", value: counts.present, tone: "text-success" },
              { label: "Late arrivals", value: counts.late, tone: "text-warning" },
              { label: "On leave", value: counts.leave, tone: "text-info" },
              { label: "Absent", value: counts.absent, tone: "text-danger" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-background/60 px-3 py-3 text-center">
                <p className={`text-2xl font-semibold ${s.tone}`}>{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Plane className="h-4 w-4 text-primary" /> Leave balances
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 p-3">
            {Object.entries(balances)
              .filter(([, v]) => (v as number) > 0)
              .map(([type, v]) => (
                <div key={type} className="rounded-md border border-border px-3 py-2">
                  <p className="text-lg font-semibold text-foreground">{v as number}</p>
                  <p className="text-[10px] text-muted-foreground">{type.replace(" Leave", "")}</p>
                </div>
              ))}
            <Button
              size="sm"
              variant="outline"
              className="col-span-2 mt-1 text-xs"
              onClick={() => router.push("/leave?open=apply")}
            >
              Apply for leave
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Wallet className="h-4 w-4 text-primary" /> Latest payslip
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {slip && latestRun ? (
              <>
                <p className="text-xs text-muted-foreground">
                  {latestRun.period} · {latestRun.status}
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{inr(slip.net)}</p>
                <p className="text-[11px] text-muted-foreground">Net pay · gross {inr(slip.gross)}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full text-xs"
                  onClick={() => router.push("/payroll?tab=payslips")}
                >
                  View payslip
                </Button>
              </>
            ) : (
              <EmptyState title="No payslip yet" />
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Package className="h-4 w-4 text-primary" /> My assets
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {myAssets.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">No assets assigned.</p>
            ) : (
              myAssets.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5">
                  <span className="min-w-0 truncate text-xs font-medium">{a.name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{a.id}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="border-border shadow-sm xl:col-span-2">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="text-sm font-semibold">My leave requests</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {myLeaves.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">No leave requests yet.</p>
            ) : (
              myLeaves.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className="min-w-0 text-xs font-medium">
                    {l.type} · {fmtDate(l.startDate)} ({l.days}d)
                  </span>
                  <StatusBadge status={l.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Megaphone className="h-4 w-4 text-primary" /> Announcements
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[220px] space-y-2 overflow-y-auto p-3 scrollbar-thin">
            {data.announcements.slice(0, 3).map((a) => (
              <div key={a.id} className="rounded-md border border-border p-2.5">
                <p className="text-xs font-semibold text-foreground">{a.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{a.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-primary" /> Documents to submit
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {myDocs.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">All documents submitted.</p>
            ) : (
              myDocs.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className="min-w-0 truncate text-xs font-medium">{d.name}</span>
                  <StatusBadge status={d.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Bell className="h-4 w-4 text-primary" /> Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {data.notifications
              .filter((n) => !n.read)
              .slice(0, 4)
              .map((n) => (
                <button
                  key={n.id}
                  onClick={() => router.push("/notifications")}
                  className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-blue-soft/50"
                >
                  <p className="truncate text-xs font-medium text-foreground">{n.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{n.timestamp}</p>
                </button>
              ))}
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4 text-primary" /> Upcoming Holidays
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 space-y-1">
            {data.holidays.slice(0, 3).map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-2 px-2 py-1.5">
                <div>
                  <span className="min-w-0 truncate text-xs font-medium block text-foreground">{h.name}</span>
                  <span className="text-[10px] text-muted-foreground">{fmtDate(h.date)}</span>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {Array.isArray(h.branches) ? h.branches.join(", ") : h.branches}
                </Badge>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full text-xs"
              onClick={() => router.push("/leave")}
            >
              View leave calendar
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
