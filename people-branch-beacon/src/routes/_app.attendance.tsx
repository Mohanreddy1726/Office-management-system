import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/data/store";
import { TODAY } from "@/lib/data/seed";
import { PageHeader, KpiCard, StatusBadge, TabsShell, Field, ConfirmDialog } from "@/components/shared";
import { DataTable, exportCsv, type Column } from "@/components/data-table";
import { Sel, Person, useScope, useNames, moduleSearch } from "@/components/form-bits";
import type { AttendanceRecord, AttendanceCorrection } from "@/lib/data/types";
import { fmtDate, attColor } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CalendarCheck2, Clock, Download, Lock, Plus, UserX, Plane } from "lucide-react";

export const Route = createFileRoute("/_app/attendance")({
  head: () => ({ meta: [
    { title: "Attendance — OfficeFlow" },
    { name: "description", content: "Daily attendance register, monthly calendar, corrections and confirmation workflow." },
    { property: "og:title", content: "Attendance — OfficeFlow" },
    { property: "og:description", content: "Daily attendance register, monthly calendar, corrections and confirmation workflow." },
  ] }),
  validateSearch: moduleSearch,
  component: AttendancePage,
});

function AttendancePage() {
  const { data, advanceAttendance, disputeAttendance, bulkConfirmAttendance, lockAttendance, addCorrection, decideCorrection } = useStore();
  const { isAdmin, isManager, isEmployee, uid, inScope } = useScope();
  const nameOf = useNames();
  const search = Route.useSearch();
  const [tab, setTab] = useState(search.tab === "confirmation" ? "confirm" : search.tab ?? "daily");
  const [date, setDate] = useState(TODAY);
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [corrOpen, setCorrOpen] = useState(search.open === "correction");
  const [lockOpen, setLockOpen] = useState(false);

  const daily = useMemo(() => data.attendance.filter((a) => a.date === date && inScope(a.employeeId) && (status === "all" || a.status === status)),
    [data.attendance, date, status, inScope]);
  const pendingConfirm = data.attendance.filter((a) => inScope(a.employeeId) && a.confirmation.startsWith("Awaiting") && (
    (isEmployee && a.confirmation === "Awaiting Employee") || (isManager && a.confirmation === "Awaiting Manager") || (isAdmin && a.confirmation !== "Awaiting Employee")));
  const corrections = data.corrections.filter((c) => inScope(c.employeeId));

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const columns: Column<AttendanceRecord>[] = [
    ...(!isEmployee ? [{ key: "sel", header: "", render: (r: AttendanceRecord) => <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} /> }] : []),
    { key: "emp", header: "Employee", sortValue: (r) => nameOf(r.employeeId), render: (r) => <Person id={r.employeeId} /> },
    { key: "shift", header: "Shift", render: (r) => data.shifts.find((s) => s.id === r.shiftId)?.name ?? r.shiftId, hideOnMobile: true },
    { key: "in", header: "In", render: (r) => r.checkIn ?? "—" },
    { key: "out", header: "Out", render: (r) => r.checkOut ?? "—" },
    { key: "hrs", header: "Worked", render: (r) => (r.workedMinutes ? `${Math.floor(r.workedMinutes / 60)}h ${r.workedMinutes % 60}m` : "—"), hideOnMobile: true },
    { key: "late", header: "Late", render: (r) => (r.lateMinutes ? `${r.lateMinutes}m` : "—") },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "confirm", header: "Confirmation", render: (r) => <StatusBadge status={r.confirmation} /> },
    { key: "src", header: "Source", render: (r) => r.source, hideOnMobile: true },
  ];

  const confirmCols: Column<AttendanceRecord>[] = [
    { key: "emp", header: "Employee", render: (r) => <Person id={r.employeeId} /> },
    { key: "date", header: "Date", sortValue: (r) => r.date, render: (r) => fmtDate(r.date) },
    { key: "punch", header: "Punches", render: (r) => `${r.checkIn ?? "—"} – ${r.checkOut ?? "—"}` },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "stage", header: "Stage", render: (r) => <StatusBadge status={r.confirmation} /> },
    { key: "act", header: "Action", render: (r) => (
      <div className="flex gap-1.5">
        <Button size="sm" className="h-7 text-xs" onClick={() => { advanceAttendance(r.id); toast.success("Attendance confirmed and forwarded"); }}>Confirm</Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { disputeAttendance(r.id); toast.warning("Marked as disputed"); }}>Dispute</Button>
      </div>
    ) },
  ];

  const corrCols: Column<AttendanceCorrection>[] = [
    { key: "emp", header: "Employee", render: (r) => <Person id={r.employeeId} /> },
    { key: "date", header: "Date", sortValue: (r) => r.date, render: (r) => fmtDate(r.date) },
    { key: "orig", header: "Original", render: (r) => `${r.originalIn ?? "—"} – ${r.originalOut ?? "—"}` },
    { key: "req", header: "Requested", render: (r) => `${r.requestedIn} – ${r.requestedOut}` },
    { key: "reason", header: "Reason", render: (r) => <span className="block max-w-[220px] truncate">{r.reason}</span>, hideOnMobile: true },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "act", header: "", render: (r) => {
      const canAct = (isManager && r.status === "Awaiting Manager") || (isAdmin && (r.status === "Awaiting HR" || r.status === "Awaiting Manager"));
      if (!canAct) return r.decisionNote ? <span className="text-[11px] text-muted-foreground">{r.decisionNote}</span> : null;
      return (
        <div className="flex gap-1.5">
          <Button size="sm" className="h-7 text-xs" onClick={() => { decideCorrection(r.id, isManager ? "Approved" : "Approved", "Verified"); toast.success("Correction approved"); }}>Approve</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { decideCorrection(r.id, "Rejected", "Insufficient evidence"); toast.error("Correction rejected"); }}>Reject</Button>
        </div>
      );
    } },
  ];

  const mine = data.attendance.filter((a) => a.employeeId === uid);
  const today = data.attendance.filter((a) => a.date === TODAY && inScope(a.employeeId));

  return (
    <div>
      <PageHeader
        title="Attendance"
        description={isEmployee ? "Your attendance, confirmations and correction requests." : "Biometric-fed register with confirmation workflow and corrections."}
        actions={<>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => exportCsv(`attendance-${date}.csv`, ["Employee", "Date", "In", "Out", "Status", "Confirmation"], daily.map((r) => [nameOf(r.employeeId), r.date, r.checkIn ?? "", r.checkOut ?? "", r.status, r.confirmation]))}><Download className="h-3.5 w-3.5" /> Export</Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setCorrOpen(true)}><Plus className="h-3.5 w-3.5" /> Request correction</Button>
        </>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Present today" value={String(today.filter((a) => ["Present", "Late"].includes(a.status)).length)} icon={<CalendarCheck2 className="h-4 w-4" />} />
        <KpiCard label="Late arrivals" value={String(today.filter((a) => a.status === "Late").length)} icon={<Clock className="h-4 w-4" />} />
        <KpiCard label="On leave" value={String(today.filter((a) => a.status === "Leave").length)} icon={<Plane className="h-4 w-4" />} />
        <KpiCard label="Absent" value={String(today.filter((a) => a.status === "Absent").length)} icon={<UserX className="h-4 w-4" />} />
      </div>
      <TabsShell
        tabs={[
          { key: "daily", label: "Daily register" },
          { key: "month", label: "Monthly calendar" },
          { key: "confirm", label: `Confirmations (${pendingConfirm.length})` },
          { key: "corrections", label: `Corrections (${corrections.length})` },
          { key: "shifts", label: "Shifts & holidays" },
        ]}
        active={tab}
        onChange={setTab}
      >
        {tab === "daily" && (
          <DataTable columns={columns} rows={daily} rowKey={(r) => r.id} pageSize={15} emptyTitle="No attendance for this date"
            toolbar={<div className="flex flex-wrap items-center gap-2">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-40 text-xs" />
              <Sel value={status} onChange={setStatus} className="h-8 w-40" options={[{ value: "all", label: "All statuses" }, "Present", "Late", "Absent", "Leave", "Half Day", "Week Off", "Holiday"]} />
              {!isEmployee && selected.size > 0 && <>
                <Button size="sm" className="h-8 text-xs" onClick={() => { bulkConfirmAttendance([...selected]); setSelected(new Set()); toast.success(`${selected.size} records confirmed`); }}>Confirm {selected.size} selected</Button>
                {isAdmin && <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setLockOpen(true)}><Lock className="h-3 w-3" /> Lock</Button>}
              </>}
            </div>} />
        )}
        {tab === "month" && <MonthCalendar records={isEmployee ? mine : data.attendance.filter((a) => inScope(a.employeeId))} isEmployee={isEmployee} />}
        {tab === "confirm" && <DataTable columns={confirmCols} rows={pendingConfirm} rowKey={(r) => r.id} emptyTitle="Nothing awaiting your confirmation" emptyHint="All attendance at your stage is confirmed." />}
        {tab === "corrections" && <DataTable columns={corrCols} rows={corrections} rowKey={(r) => r.id} emptyTitle="No correction requests" />}
        {tab === "shifts" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="mb-3 text-sm font-semibold">Shifts</p>
              <div className="space-y-2">
                {data.shifts.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-md border border-border p-3 text-xs">
                    <div><p className="font-medium text-foreground">{s.name}</p><p className="text-muted-foreground">{s.start}–{s.end} · {s.graceMinutes}m grace · Off: {s.weeklyOffs.join(", ")}</p></div>
                    <span className="text-muted-foreground">{s.branches.join(", ")}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="mb-3 text-sm font-semibold">Holidays 2026</p>
              <div className="space-y-2">
                {data.holidays.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-md border border-border p-3 text-xs">
                    <span className="font-medium text-foreground">{h.name}</span>
                    <span className="text-muted-foreground">{fmtDate(h.date)} · {h.branches === "All" ? "All branches" : h.branches.join(", ")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </TabsShell>

      <CorrectionDialog open={corrOpen} onOpenChange={setCorrOpen} onSubmit={(c) => { addCorrection(c); setCorrOpen(false); toast.success("Correction submitted for manager review"); }} />
      <ConfirmDialog open={lockOpen} onOpenChange={setLockOpen} title="Lock selected attendance?" description="Locked records feed payroll and can't be edited without reopening." confirmLabel="Lock records" reasonField
        onConfirm={() => { lockAttendance([...selected]); setSelected(new Set()); toast.success("Attendance locked"); }} />
    </div>
  );
}

function MonthCalendar({ records, isEmployee }: { records: AttendanceRecord[]; isEmployee: boolean }) {
  const days = Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
  const offset = new Date("2026-10-01T00:00:00Z").getUTCDay();
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-3 text-sm font-semibold">October 2026 — {isEmployee ? "your attendance" : "team summary (present / total)"}</p>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <span key={d}>{d}</span>)}
        {Array.from({ length: offset }).map((_, i) => <span key={`e${i}`} />)}
        {days.map((d, i) => {
          const recs = records.filter((r) => r.date === d);
          if (isEmployee) {
            const r = recs[0];
            return (
              <div key={d} className={`flex h-16 flex-col items-center justify-center rounded-md border text-xs ${r ? attColor(r.status) : "border-border bg-muted/40"}`}>
                <span className="font-semibold">{i + 1}</span>
                <span className="text-[10px]">{r?.status ?? (d > TODAY ? "" : "—")}</span>
              </div>
            );
          }
          const present = recs.filter((r) => ["Present", "Late", "Half Day"].includes(r.status)).length;
          return (
            <div key={d} className="flex h-16 flex-col items-center justify-center rounded-md border border-border bg-background text-xs">
              <span className="font-semibold text-foreground">{i + 1}</span>
              {recs.length > 0 && <span className="text-[10px] text-success">{present}/{recs.length}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CorrectionDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (v: boolean) => void; onSubmit: (c: Omit<AttendanceCorrection, "id" | "submittedAt" | "status">) => void }) {
  const { data } = useStore();
  const { isEmployee, uid, inScope } = useScope();
  const [emp, setEmp] = useState(uid);
  const [date, setDate] = useState(TODAY);
  const [inT, setIn] = useState("09:30");
  const [outT, setOut] = useState("18:30");
  const [reason, setReason] = useState("");
  const rec = data.attendance.find((a) => a.employeeId === emp && a.date === date);
  const valid = reason.trim().length >= 5 && inT < outT;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Request attendance correction</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {!isEmployee && <div className="col-span-2"><Field label="Employee"><Sel value={emp} onChange={setEmp} options={data.employees.filter((e) => inScope(e.id)).map((e) => ({ value: e.id, label: e.name }))} /></Field></div>}
          <div className="col-span-2"><Field label="Date" hint={rec ? `Recorded: ${rec.checkIn ?? "—"} – ${rec.checkOut ?? "—"} (${rec.status})` : "No punch recorded"}><Input type="date" value={date} max={TODAY} onChange={(e) => setDate(e.target.value)} /></Field></div>
          <Field label="Correct check-in"><Input type="time" value={inT} onChange={(e) => setIn(e.target.value)} /></Field>
          <Field label="Correct check-out" error={inT >= outT ? "Must be after check-in" : undefined}><Input type="time" value={outT} onChange={(e) => setOut(e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Reason" required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Biometric reader didn't register my punch" /></Field></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid} onClick={() => onSubmit({ employeeId: emp, date, originalIn: rec?.checkIn, originalOut: rec?.checkOut, requestedIn: inT, requestedOut: outT, reason, submittedBy: uid })}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
