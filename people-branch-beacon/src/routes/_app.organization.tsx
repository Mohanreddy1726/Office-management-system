import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/data/store";
import { PageHeader, KpiCard, TabsShell, EmployeeAvatar, ChartCard } from "@/components/shared";
import { useScope } from "@/components/form-bits";
import { BRANCHES } from "@/lib/data/types";
import type { Employee } from "@/lib/data/types";
import { Building2, GitBranch, Users, MapPin, ChevronDown, ChevronRight } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export const Route = createFileRoute("/_app/organization")({
  head: () => ({ meta: [
    { title: "Organization & Team — OfficeFlow" },
    { name: "description", content: "Org chart, departments, teams and branch structure." },
    { property: "og:title", content: "Organization & Team — OfficeFlow" },
    { property: "og:description", content: "Org chart, departments, teams and branch structure." },
  ] }),
  component: OrgPage,
});

function OrgPage() {
  const { data } = useStore();
  const { isManager, uid } = useScope();
  const [tab, setTab] = useState("chart");
  const active = data.employees.filter((e) => e.status !== "Inactive" && e.status !== "Resigned");
  const roots = isManager ? active.filter((e) => e.id === uid) : active.filter((e) => !e.managerId || !active.some((m) => m.id === e.managerId));
  const depts = useMemo(() => {
    const m = new Map<string, Employee[]>();
    active.forEach((e) => m.set(e.department, [...(m.get(e.department) ?? []), e]));
    return [...m.entries()];
  }, [active]);
  const teams = useMemo(() => {
    const m = new Map<string, Employee[]>();
    active.forEach((e) => m.set(e.team, [...(m.get(e.team) ?? []), e]));
    return [...m.entries()];
  }, [active]);

  return (
    <div>
      <PageHeader title="Organization & Team" description="Reporting structure, departments, teams and branches." />
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Active employees" value={String(active.length)} icon={<Users className="h-4 w-4" />} />
        <KpiCard label="Departments" value={String(depts.length)} icon={<Building2 className="h-4 w-4" />} />
        <KpiCard label="Teams" value={String(teams.length)} icon={<GitBranch className="h-4 w-4" />} />
        <KpiCard label="Branches" value={String(BRANCHES.length)} icon={<MapPin className="h-4 w-4" />} />
      </div>
      <TabsShell tabs={[{ key: "chart", label: "Org chart" }, { key: "depts", label: "Departments" }, { key: "teams", label: "Teams" }, { key: "branches", label: "Branches" }]} active={tab} onChange={setTab}>
        {tab === "chart" && (
          <div className="rounded-lg border border-border bg-card p-4">
            {roots.map((r) => <OrgNode key={r.id} e={r} all={active} depth={0} />)}
          </div>
        )}
        {tab === "depts" && (
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <ChartCard title="Headcount by department">
              <div className="h-64"><ResponsiveContainer><BarChart data={depts.map(([d, l]) => ({ d, n: l.length }))} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" fontSize={11} /><YAxis dataKey="d" type="category" width={110} fontSize={11} /><Tooltip /><Bar dataKey="n" fill="var(--color-primary)" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>
            </ChartCard>
            <div className="space-y-2">
              {depts.map(([d, list]) => {
                const head = list.find((e) => !list.some((x) => x.id === e.managerId)) ?? list[0];
                return (
                  <div key={d} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm">
                    <div><p className="font-medium">{d}</p><p className="text-[11px] text-muted-foreground">Lead: {head?.name ?? "—"}</p></div>
                    <span className="text-xs text-muted-foreground">{list.length} people</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {tab === "teams" && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {teams.map(([t, list]) => (
              <div key={t} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-semibold">{t}</p>
                <p className="mb-3 text-[11px] text-muted-foreground">{list[0]?.department} · {list.length} members</p>
                <div className="flex -space-x-2">{list.slice(0, 8).map((e) => <Link key={e.id} to="/employees/$id" params={{ id: e.id }}><EmployeeAvatar id={e.id} name={e.name} size={28} /></Link>)}{list.length > 8 && <span className="ml-3 self-center text-xs text-muted-foreground">+{list.length - 8}</span>}</div>
              </div>
            ))}
          </div>
        )}
        {tab === "branches" && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {BRANCHES.map((b) => {
              const list = active.filter((e) => e.branch === b);
              return (
                <div key={b} className="rounded-lg border border-border bg-card p-4">
                  <p className="flex items-center gap-1.5 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary" /> {b}</p>
                  <p className="mt-2 text-2xl font-semibold">{list.length}</p>
                  <p className="text-[11px] text-muted-foreground">employees · {new Set(list.map((e) => e.department)).size} departments · {data.devices.filter((d) => d.branch === b).length} devices</p>
                </div>
              );
            })}
          </div>
        )}
      </TabsShell>
    </div>
  );
}

function OrgNode({ e, all, depth }: { e: Employee; all: Employee[]; depth: number }) {
  const reports = all.filter((x) => x.managerId === e.id);
  const [open, setOpen] = useState(depth < 2);
  return (
    <div style={{ marginLeft: depth ? 20 : 0 }} className={depth ? "border-l border-border pl-3" : ""}>
      <div className="flex items-center gap-2 py-1.5">
        {reports.length ? <button onClick={() => setOpen(!open)} className="text-muted-foreground" aria-label="Toggle reports">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button> : <span className="w-4" />}
        <EmployeeAvatar id={e.id} name={e.name} size={28} />
        <Link to="/employees/$id" params={{ id: e.id }} className="text-[13px] font-medium hover:text-primary">{e.name}</Link>
        <span className="text-[11px] text-muted-foreground">{e.designation}{reports.length ? ` · ${reports.length} reports` : ""}</span>
      </div>
      {open && reports.map((r) => <OrgNode key={r.id} e={r} all={all} depth={depth + 1} />)}
    </div>
  );
}
