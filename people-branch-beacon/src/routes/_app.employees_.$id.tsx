import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/data/store";
import { PageHeader, EmptyState, StatusBadge, TabsShell, EmployeeAvatar, Field, Timeline } from "@/components/shared";
import { Stat, Person, useScope, Sel } from "@/components/form-bits";
import { fmtDate, inr, tenure, attColor } from "@/lib/format";
import { payslipFor } from "@/lib/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Mail, Phone, MapPin, Pencil } from "lucide-react";
import type { Employee, EmploymentStatus } from "@/lib/data/types";

export const Route = createFileRoute("/_app/employees_/$id")({
  head: () => ({ meta: [
    { title: "Employee profile — OfficeFlow" },
    { name: "description", content: "Employee profile with job, attendance, leave, payroll, documents and assets." },
    { property: "og:title", content: "Employee profile — OfficeFlow" },
    { property: "og:description", content: "Employee profile with job, attendance, leave, payroll, documents and assets." },
  ] }),
  component: Profile,
});

function Profile() {
  const { id } = Route.useParams();
  const { data, updateEmployee } = useStore();
  const { isAdmin, isEmployee, uid } = useScope();
  const [tab, setTab] = useState("overview");
  const [edit, setEdit] = useState(false);
  const e = data.employees.find((x) => x.id === id);
  if (!e) return <EmptyState title="Employee not found" action={<Link to="/employees" className="text-primary underline">Back to employees</Link>} />;
  if (isEmployee && e.id !== uid) return <EmptyState title="You can only view your own profile" />;
  const canSensitive = isAdmin || e.id === uid;
  const att = data.attendance.filter((a) => a.employeeId === e.id).sort((a, b) => b.date.localeCompare(a.date));
  const leaves = data.leaves.filter((l) => l.employeeId === e.id);
  const docs = data.documents.filter((d) => d.ownerId === e.id);
  const assets = data.assets.filter((a) => a.assignedTo === e.id);
  const goals = data.goals.filter((g) => g.employeeId === e.id);
  const reviews = data.reviews.filter((r) => r.employeeId === e.id);
  const reports = data.employees.filter((x) => x.managerId === e.id);
  const slip = payslipFor(e, data.salaryStructures);
  const history = data.audit.filter((a) => a.record.includes(e.name) || a.record.includes(e.id));

  const tabs = [
    { key: "overview", label: "Overview" }, { key: "job", label: "Job" }, { key: "attendance", label: "Attendance" }, { key: "leave", label: "Leave" },
    { key: "payroll", label: "Payroll", hidden: !canSensitive }, { key: "documents", label: "Documents" }, { key: "assets", label: "Assets" },
    { key: "performance", label: "Performance" }, { key: "team", label: "Team" }, { key: "history", label: "History", hidden: !isAdmin },
  ];

  return (
    <div>
      <Link to={isEmployee ? "/dashboard" : "/employees"} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back</Link>
      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4">
        <EmployeeAvatar id={e.id} name={e.name} size={64} />
        <div className="min-w-0 flex-1">
          <PageHeader title={e.name} description={`${e.designation} · ${e.department} · ${e.team}`} actions={isAdmin ? <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setEdit(true)}><Pencil className="h-3.5 w-3.5" /> Edit</Button> : undefined} />
          <div className="-mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{e.workEmail}</span>
            {e.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{e.phone}</span>}
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{e.branch}</span>
            <StatusBadge status={e.status} />
          </div>
        </div>
      </div>
      <TabsShell tabs={tabs} active={tab} onChange={setTab}>
        {tab === "overview" && <Card><Grid>
          <Stat label="Employee ID" value={e.id} /><Stat label="Joined" value={fmtDate(e.joiningDate)} /><Stat label="Tenure" value={tenure(e.joiningDate)} /><Stat label="Manager" value={<Person id={e.managerId} />} />
          <Stat label="Date of birth" value={canSensitive ? fmtDate(e.dob) : "Restricted"} /><Stat label="Gender" value={e.gender || "—"} /><Stat label="Personal email" value={canSensitive ? e.personalEmail || "—" : "Restricted"} /><Stat label="Emergency contact" value={canSensitive ? e.emergencyContact || "—" : "Restricted"} />
          <div className="col-span-2 md:col-span-4"><Stat label="Address" value={canSensitive ? e.address || "—" : "Restricted"} /></div>
        </Grid></Card>}
        {tab === "job" && <Card><Grid>
          <Stat label="Designation" value={e.designation} /><Stat label="Department" value={e.department} /><Stat label="Team" value={e.team} /><Stat label="Branch" value={e.branch} />
          <Stat label="Employment type" value={e.employmentType} /><Stat label="Probation" value={`${e.probationMonths} months`} /><Stat label="Status" value={<StatusBadge status={e.status} />} /><Stat label="Shift" value={data.shifts[0]?.name ?? "General"} />
        </Grid></Card>}
        {tab === "attendance" && <Card>
          <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10 lg:grid-cols-[repeat(16,minmax(0,1fr))]">
            {att.slice(0, 32).reverse().map((a) => <div key={a.id} title={`${a.date} · ${a.status}`} className={`flex h-12 flex-col items-center justify-center rounded border text-[10px] ${attColor(a.status)}`}><span className="font-semibold">{a.date.slice(8)}</span><span>{a.checkIn ?? "—"}</span></div>)}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Present {att.filter((a) => a.status === "Present").length} · Late {att.filter((a) => a.status === "Late").length} · Absent {att.filter((a) => a.status === "Absent").length} · Leave {att.filter((a) => a.status === "Leave").length}</p>
        </Card>}
        {tab === "leave" && <Card>
          <div className="mb-4 flex flex-wrap gap-3">{Object.entries(data.leaveBalances[e.id] ?? {}).map(([t, v]) => <div key={t} className="rounded-md border border-border px-3 py-2 text-xs"><p className="text-muted-foreground">{t}</p><p className="text-lg font-semibold">{v}</p></div>)}</div>
          <List items={leaves.map((l) => ({ k: l.id, left: `${l.type} · ${l.days} day(s)`, sub: `${fmtDate(l.startDate)} → ${fmtDate(l.endDate)}`, right: <StatusBadge status={l.status} /> }))} empty="No leave requests" />
        </Card>}
        {tab === "payroll" && <Card><Grid>
          <Stat label="Annual CTC" value={inr(e.annualCTC)} /><Stat label="Monthly gross" value={inr(e.monthlyGross)} /><Stat label="Net pay" value={inr(slip.net)} /><Stat label="Deductions" value={inr(slip.totalDeductions)} />
          <Stat label="Basic" value={inr(slip.basic)} /><Stat label="HRA" value={inr(slip.hra)} /><Stat label="Provident fund" value={inr(slip.pf)} /><Stat label="Bank" value={e.bankLast4 ? `••${e.bankLast4}` : "—"} />
        </Grid></Card>}
        {tab === "documents" && <Card><List items={docs.map((d) => ({ k: d.id, left: d.name, sub: `${d.category} · ${d.size}${d.expiresAt ? ` · expires ${fmtDate(d.expiresAt)}` : ""}`, right: <StatusBadge status={d.status} /> }))} empty="No documents on file" /></Card>}
        {tab === "assets" && <Card><List items={assets.map((a) => ({ k: a.id, left: a.name, sub: `${a.id} · ${a.serial}`, right: <StatusBadge status={a.condition} /> }))} empty="No assets issued" /></Card>}
        {tab === "performance" && <Card>
          <div className="space-y-3">{goals.map((g) => <div key={g.id} className="text-xs"><div className="mb-1 flex justify-between"><span className="font-medium">{g.title}</span><StatusBadge status={g.status} /></div><Progress value={g.progress} className="h-1.5" /></div>)}</div>
          {!goals.length && <p className="text-xs text-muted-foreground">No goals set.</p>}
          <div className="mt-4"><List items={reviews.map((r) => ({ k: r.id, left: data.reviewCycles.find((c) => c.id === r.cycleId)?.name ?? r.cycleId, sub: r.strengths ?? "", right: <StatusBadge status={r.stage} /> }))} empty="No reviews" /></div>
        </Card>}
        {tab === "team" && <Card>
          <p className="mb-2 text-xs text-muted-foreground">Reports to</p><Person id={e.managerId} />
          <p className="mb-2 mt-4 text-xs text-muted-foreground">Direct reports ({reports.length})</p>
          <div className="flex flex-wrap gap-3">{reports.map((r) => <Link key={r.id} to="/employees/$id" params={{ id: r.id }} className="hover:opacity-80"><Person id={r.id} /></Link>)}</div>
        </Card>}
        {tab === "history" && <Card><Timeline items={history.map((h) => ({ at: h.timestamp, title: h.action, by: h.user, note: h.details }))} /></Card>}
      </TabsShell>
      {edit && <EditDialog e={e} onClose={() => setEdit(false)} onSave={(patch) => { updateEmployee(e.id, patch, "Profile edited"); setEdit(false); toast.success("Profile updated"); }} />}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) { return <div className="rounded-lg border border-border bg-card p-4">{children}</div>; }
function Grid({ children }: { children: React.ReactNode }) { return <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{children}</div>; }
function List({ items, empty }: { items: { k: string; left: string; sub: string; right: React.ReactNode }[]; empty: string }) {
  if (!items.length) return <p className="text-xs text-muted-foreground">{empty}</p>;
  return <div className="divide-y divide-border">{items.map((i) => <div key={i.k} className="flex items-center justify-between py-2.5 text-sm"><div><p className="font-medium">{i.left}</p><p className="text-[11px] text-muted-foreground">{i.sub}</p></div>{i.right}</div>)}</div>;
}

function EditDialog({ e, onClose, onSave }: { e: Employee; onClose: () => void; onSave: (p: Partial<Employee>) => void }) {
  const [designation, setDesignation] = useState(e.designation);
  const [phone, setPhone] = useState(e.phone);
  const [status, setStatus] = useState<string>(e.status);
  const [team, setTeam] = useState(e.team);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit {e.name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Designation"><Input value={designation} onChange={(x) => setDesignation(x.target.value)} /></Field>
          <Field label="Team"><Input value={team} onChange={(x) => setTeam(x.target.value)} /></Field>
          <Field label="Phone" error={phone && !/^[+\d\s-]{8,}$/.test(phone) ? "Invalid phone" : undefined}><Input value={phone} onChange={(x) => setPhone(x.target.value)} /></Field>
          <Field label="Status"><Sel value={status} onChange={setStatus} options={["Active", "Probation", "On Notice", "Resigned", "Inactive"]} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={designation.length < 2} onClick={() => onSave({ designation, phone, team, status: status as EmploymentStatus })}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
