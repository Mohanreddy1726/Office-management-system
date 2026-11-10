"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/data/store";
import { PageHeader, KpiCard, TabsShell, ChartCard } from "@/components/shared";
import { useScope } from "@/components/form-bits";
import { BRANCHES, type Employee } from "@/lib/data/types";
import {
  Building2, GitBranch, Users, MapPin, ChevronDown, ChevronRight,
  ArrowUpRight, Shield, Layers, UserCheck, Activity,
  Fingerprint, Search, Sparkles
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { initials } from "@/lib/format";
import { AppShell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export default function OrganizationPage() {
  const { data } = useStore();
  const { isManager, uid } = useScope();
  const router = useRouter();
  const [tab, setTab] = useState("chart");
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active = useMemo(
    () => data.employees.filter((e) => e.status !== "Inactive" && e.status !== "Resigned"),
    [data.employees]
  );

  const roots = useMemo(() => {
    if (isManager) return active.filter((e) => e.id === uid);
    return active.filter((e) => !e.managerId || !active.some((m) => m.id === e.managerId));
  }, [active, isManager, uid]);

  const depts = useMemo(() => {
    const m = new Map<string, Employee[]>();
    active.forEach((e) => m.set(e.department, [...(m.get(e.department) ?? []), e]));
    return Array.from(m.entries());
  }, [active]);

  const teams = useMemo(() => {
    const m = new Map<string, Employee[]>();
    active.forEach((e) => {
      const t = e.team && e.team !== "Unassigned" ? e.team : `${e.department} Team`;
      m.set(t, [...(m.get(t) ?? []), e]);
    });
    return Array.from(m.entries());
  }, [active]);

  const filteredDepts = useMemo(() => {
    if (!search.trim()) return depts;
    const q = search.toLowerCase();
    return depts.filter(([d, list]) => d.toLowerCase().includes(q) || list.some((e) => e.name.toLowerCase().includes(q)));
  }, [depts, search]);

  const filteredTeams = useMemo(() => {
    if (!search.trim()) return teams;
    const q = search.toLowerCase();
    return teams.filter(([t, list]) => t.toLowerCase().includes(q) || list.some((e) => e.name.toLowerCase().includes(q)));
  }, [teams, search]);

  return (
    <AppShell>
      <div>
        <PageHeader
          title="Organization & Team"
          description="Visual org chart, leadership structure, departmental hierarchy, and regional branch networks."
        />

        {/* Top Summary KPIs */}
        <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard label="Active employees" value={String(active.length)} icon={<Users className="h-4 w-4" />} />
          <KpiCard label="Departments" value={String(depts.length)} icon={<Building2 className="h-4 w-4" />} onClick={() => setTab("depts")} />
          <KpiCard label="Teams & Squads" value={String(teams.length)} icon={<GitBranch className="h-4 w-4" />} onClick={() => setTab("teams")} />
          <KpiCard label="Office Branches" value={String(BRANCHES.length)} icon={<MapPin className="h-4 w-4" />} onClick={() => setTab("branches")} />
        </div>

        {/* Tabs */}
        <TabsShell
          tabs={[
            { key: "chart", label: "Interactive Org Chart" },
            { key: "depts", label: `Departments (${depts.length})` },
            { key: "teams", label: `Teams & Squads (${teams.length})` },
            { key: "branches", label: `Office Branches (${BRANCHES.length})` },
          ]}
          active={tab}
          onChange={setTab}
        >
          {/* TAB 1: VISUAL ORG CHART */}
          {tab === "chart" && (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> Company Reporting Hierarchy
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Click arrow to expand direct reports and inspect supervisory hierarchy.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Active Leadership</span>
                </div>
              </div>

              <div className="space-y-3">
                {roots.map((r) => (
                  <OrgNodeCard key={r.id} e={r} all={active} depth={0} />
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: DEPARTMENTS */}
          {tab === "depts" && (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
                {/* Recharts Headcount Distribution */}
                <ChartCard title="Headcount by Department" subtitle="Active personnel allocation across teams">
                  {mounted ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={depts.map(([d, l]) => ({ d, n: l.length }))}
                          layout="vertical"
                          margin={{ left: 15, right: 15, top: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                          <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                          <YAxis
                            dataKey="d"
                            type="category"
                            width={110}
                            fontSize={11}
                            stroke="hsl(var(--muted-foreground))"
                          />
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          <Bar dataKey="n" fill="#356AE6" radius={[0, 4, 4, 0]} barSize={16} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-72 w-full animate-pulse rounded bg-muted/40" />
                  )}
                </ChartCard>

                {/* Department Cards Grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Input
                      placeholder="Filter department or lead…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-8 w-60 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">{filteredDepts.length} departments</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {filteredDepts.map(([d, list]) => {
                      const head = list.find((e) => !list.some((x) => x.id === e.managerId)) ?? list[0];
                      const pct = Math.round((list.length / Math.max(1, active.length)) * 100);

                      return (
                        <div
                          key={d}
                          className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-primary">
                                  <Building2 className="h-4 w-4" />
                                </span>
                                <div>
                                  <h4 className="font-semibold text-foreground text-sm">{d}</h4>
                                  <p className="text-[11px] text-muted-foreground">{list.length} members ({pct}%)</p>
                                </div>
                              </div>
                            </div>

                            {/* Lead Info */}
                            <div className="mt-3 flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 p-2 text-xs">
                              <span className="text-muted-foreground">Department Lead:</span>
                              <Link
                                href={`/employees/${head?.id}`}
                                className="font-medium text-foreground hover:text-primary flex items-center gap-1"
                              >
                                {head?.name ?? "—"} <ArrowUpRight className="h-3 w-3 opacity-60" />
                              </Link>
                            </div>

                            {/* Stacked Member Avatars */}
                            <div className="mt-3 flex items-center justify-between">
                              <div className="flex -space-x-2">
                                {list.slice(0, 6).map((e) => (
                                  <Link
                                    key={e.id}
                                    href={`/employees/${e.id}`}
                                    title={`${e.name} · ${e.designation}`}
                                    className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 ring-2 ring-card text-[10px] font-bold text-white hover:z-10 transition-transform hover:scale-110"
                                  >
                                    {initials(e.name)}
                                  </Link>
                                ))}
                                {list.length > 6 && (
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 ring-2 ring-card text-[10px] font-medium text-slate-700">
                                    +{list.length - 6}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 pt-2 border-t border-border/60">
                            <Progress value={pct} className="h-1.5" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TEAMS & SQUADS */}
          {tab === "teams" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Input
                  placeholder="Filter team name or member…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 w-64 text-xs"
                />
                <span className="text-xs text-muted-foreground">{filteredTeams.length} functional teams</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredTeams.map(([t, list]) => {
                  const lead = list.find((e) => !list.some((x) => x.id === e.managerId)) ?? list[0];
                  return (
                    <div
                      key={t}
                      className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200/70 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                              <GitBranch className="h-3 w-3 shrink-0" /> {list[0]?.department}
                            </span>
                            <h4 className="mt-1.5 font-bold text-foreground text-base">{t}</h4>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3" /> {list[0]?.branch}
                            </p>
                          </div>
                          <span className="rounded-full bg-blue-soft border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary">
                            {list.length} members
                          </span>
                        </div>

                        {/* Divider */}
                        <div className="my-3 border-t border-border/60" />

                        {/* Team Lead */}
                        <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/20 p-2.5 text-xs">
                          <span className="text-muted-foreground">Team Lead:</span>
                          <Link
                            href={`/employees/${lead?.id}`}
                            className="font-semibold text-foreground hover:text-primary flex items-center gap-1"
                          >
                            {lead?.name} <ArrowUpRight className="h-3 w-3 opacity-60" />
                          </Link>
                        </div>

                        {/* Member Avatars Stack */}
                        <div className="mt-4">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                            TEAM ROSTER
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {list.map((e) => (
                              <Link
                                key={e.id}
                                href={`/employees/${e.id}`}
                                title={`${e.name} · ${e.designation}`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-2 py-1 text-xs text-foreground hover:bg-muted transition-colors"
                              >
                                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-600 font-bold text-white text-[9px]">
                                  {initials(e.name)}
                                </span>
                                <span className="truncate max-w-[100px]">{e.name.split(" ")[0]}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                        <span>100% active allocation</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/employees?dept=${encodeURIComponent(list[0]?.department || "all")}`)}
                          className="h-7 text-xs text-primary hover:text-primary/90"
                        >
                          View in directory <ArrowUpRight className="ml-1 h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: OFFICE BRANCHES */}
          {tab === "branches" && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {BRANCHES.map((b) => {
                const list = active.filter((e) => e.branch === b);
                const deptCount = new Set(list.map((e) => e.department)).size;
                const devices = data.devices.filter((d) => d.branch === b);
                const isHq = b === "Hyderabad";

                return (
                  <div
                    key={b}
                    className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
                  >
                    <div>
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl",
                            isHq ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-slate-100 text-slate-700"
                          )}>
                            <MapPin className="h-5 w-5" />
                          </span>
                          <div>
                            <h4 className="font-bold text-foreground text-base">{b}</h4>
                            <span className="text-[11px] text-muted-foreground">
                              {isHq ? "Headquarters Facility" : "Regional Branch"}
                            </span>
                          </div>
                        </div>
                        {isHq && (
                          <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                            HQ
                          </span>
                        )}
                      </div>

                      {/* Divider */}
                      <div className="my-3 border-t border-border/60" />

                      {/* Headcount Stat */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          ON-SITE WORKFORCE
                        </p>
                        <p className="mt-1 text-3xl font-extrabold text-foreground tracking-tight">
                          {list.length}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {Math.round((list.length / Math.max(1, active.length)) * 100)}% of total team
                        </p>
                      </div>

                      {/* Facility details */}
                      <div className="mt-4 space-y-2 rounded-xl border border-border/80 bg-muted/20 p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> Departments:
                          </span>
                          <span className="font-semibold text-foreground">{deptCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Fingerprint className="h-3.5 w-3.5 text-muted-foreground" /> Biometric Devices:
                          </span>
                          <span className="font-semibold text-emerald-600 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {devices.length || 1} online
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-4 pt-3 border-t border-border/60">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/employees?branch=${encodeURIComponent(b)}`)}
                        className="w-full text-xs font-medium justify-between"
                      >
                        <span>Filter branch employees</span>
                        <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsShell>
      </div>
    </AppShell>
  );
}

/* ---------- Interactive Org Node Component ---------- */

function OrgNodeCard({ e, all, depth }: { e: Employee; all: Employee[]; depth: number }) {
  const reports = all.filter((x) => x.managerId === e.id);
  const [open, setOpen] = useState(depth < 2);

  const isExecutive = depth === 0;

  return (
    <div
      style={{ marginLeft: depth ? 24 : 0 }}
      className={cn("transition-all", depth ? "border-l-2 border-border/80 pl-4 my-2" : "my-2")}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 transition-all shadow-sm",
          isExecutive
            ? "border-primary/40 bg-blue-50/20"
            : reports.length > 0
            ? "border-border bg-card hover:border-primary/30"
            : "border-border/80 bg-background/80"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {reports.length > 0 ? (
            <button
              onClick={() => setOpen(!open)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
              aria-label="Toggle reports"
            >
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-7 shrink-0 flex items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            </span>
          )}

          {/* Square Avatar */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white text-xs shadow-sm">
            {initials(e.name)}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/employees/${e.id}`}
                className="font-semibold text-foreground text-sm hover:text-primary transition-colors flex items-center gap-1 group"
              >
                <span className="truncate">{e.name}</span>
                <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
              {isExecutive && (
                <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold text-blue-700">
                  LEADERSHIP
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {e.designation} · {e.department} · {e.branch}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {reports.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
              <Users className="h-3 w-3" /> {reports.length} direct reports
            </span>
          )}

          <Button
            size="sm"
            variant="ghost"
            asChild
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            <Link href={`/employees/${e.id}`}>
              Profile <ArrowUpRight className="ml-1 h-3 w-3 opacity-60" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Children reporting tree */}
      {open && reports.length > 0 && (
        <div className="mt-2 space-y-2">
          {reports.map((r) => (
            <OrgNodeCard key={r.id} e={r} all={all} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
