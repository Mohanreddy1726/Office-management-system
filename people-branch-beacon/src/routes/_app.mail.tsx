import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/data/store";
import { TODAY, DEPARTMENTS } from "@/lib/data/seed";
import { PageHeader, KpiCard, StatusBadge, TabsShell, Field, Timeline } from "@/components/shared";
import { DataTable, exportCsv, type Column } from "@/components/data-table";
import { Person, Sel, useNames } from "@/components/form-bits";
import type { MailEntry } from "@/lib/data/types";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Inbox, Send, Mail, Plus, Download, AlarmClock } from "lucide-react";

export const Route = createFileRoute("/_app/mail")({
  head: () => ({ meta: [
    { title: "Mail Log — OfficeFlow" },
    { name: "description", content: "Register incoming and outgoing office mail with follow-ups and Gmail sync." },
    { property: "og:title", content: "Mail Log — OfficeFlow" },
    { property: "og:description", content: "Register incoming and outgoing office mail with follow-ups and Gmail sync." },
  ] }),
  component: MailPage,
});

function MailPage() {
  const { data, addMail, updateMail, setGmail } = useStore();
  const nameOf = useNames();
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const rows = data.mail.filter((m) => (tab === "all" || (tab === "in" ? m.direction === "Incoming" : tab === "out" ? m.direction === "Outgoing" : false)) && (!q || `${m.subject} ${m.refNo} ${m.sender}`.toLowerCase().includes(q.toLowerCase())));
  const current = data.mail.find((m) => m.id === view);

  const cols: Column<MailEntry>[] = [
    { key: "r", header: "Ref", sortValue: (r) => r.refNo, render: (r) => <code className="text-xs">{r.refNo}</code> },
    { key: "d", header: "Dir", render: (r) => (r.direction === "Incoming" ? <Inbox className="h-4 w-4 text-info" /> : <Send className="h-4 w-4 text-success" />) },
    { key: "s", header: "Subject", render: (r) => <span className="block max-w-[260px] truncate font-medium">{r.subject}</span> },
    { key: "f", header: "From → To", render: (r) => <span className="text-xs">{r.sender} → {r.recipient}</span>, hideOnMobile: true },
    { key: "dt", header: "Date", sortValue: (r) => r.date, render: (r) => fmtDate(r.date) },
    { key: "p", header: "Priority", render: (r) => <StatusBadge status={r.priority} /> },
    { key: "st", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Mail Log" description="Physical and email correspondence register with ownership and follow-ups."
        actions={<>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => exportCsv("mail-log.csv", ["Ref", "Direction", "Date", "Sender", "Recipient", "Subject", "Status"], data.mail.map((m) => [m.refNo, m.direction, m.date, m.sender, m.recipient, m.subject, m.status]))}><Download className="h-3.5 w-3.5" /> Export</Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> Register mail</Button>
        </>} />
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Incoming" value={String(data.mail.filter((m) => m.direction === "Incoming").length)} icon={<Inbox className="h-4 w-4" />} />
        <KpiCard label="Outgoing" value={String(data.mail.filter((m) => m.direction === "Outgoing").length)} icon={<Send className="h-4 w-4" />} />
        <KpiCard label="Open items" value={String(data.mail.filter((m) => m.status !== "Closed").length)} icon={<Mail className="h-4 w-4" />} />
        <KpiCard label="Follow-ups due" value={String(data.mail.filter((m) => m.followUpAt && m.followUpAt <= TODAY && m.status !== "Closed").length)} icon={<AlarmClock className="h-4 w-4" />} />
      </div>
      <TabsShell tabs={[{ key: "all", label: "All mail" }, { key: "in", label: "Incoming" }, { key: "out", label: "Outgoing" }, { key: "gmail", label: "Gmail integration" }]} active={tab} onChange={setTab}>
        {tab !== "gmail" ? (
          <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} onRowClick={(r) => setView(r.id)} pageSize={12}
            toolbar={<Input placeholder="Search subject, ref or sender…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-64 text-xs" />} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4 text-sm">
              <div className="flex items-center justify-between">
                <div><p className="font-semibold">Gmail mailbox sync</p><p className="text-xs text-muted-foreground">{data.gmail.mailbox}</p></div>
                <Switch checked={data.gmail.connected} onCheckedChange={(v) => { setGmail(v); toast.success(v ? "Gmail connected (demo)" : "Gmail disconnected"); }} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <dt className="text-muted-foreground">Status</dt><dd><StatusBadge status={data.gmail.connected ? "Active" : "Inactive"} /></dd>
                <dt className="text-muted-foreground">Last sync</dt><dd>{data.gmail.lastSync}</dd>
                <dt className="text-muted-foreground">Frequency</dt><dd>{data.gmail.frequency}</dd>
                <dt className="text-muted-foreground">Scopes</dt><dd>{data.gmail.scopes.join(", ")}</dd>
              </dl>
              <p className="mt-4 rounded-md bg-muted p-2 text-[11px] text-muted-foreground">Demo only — no real Google account is connected.</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="mb-3 text-sm font-semibold">Sync log</p>
              <Timeline items={data.gmail.logs.map((l) => ({ at: l.at, title: l.event, note: l.status }))} />
            </div>
          </div>
        )}
      </TabsShell>

      <Sheet open={!!current} onOpenChange={(v) => !v && setView(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {current && <>
            <SheetHeader><SheetTitle>{current.subject}</SheetTitle></SheetHeader>
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex flex-wrap gap-2"><code className="text-xs">{current.refNo}</code><StatusBadge status={current.direction} /><StatusBadge status={current.priority} /><StatusBadge status={current.channel} /></div>
              <p className="text-xs">{current.sender} → {current.recipient} · {fmtDate(current.date)}</p>
              <div className="text-xs"><span className="text-muted-foreground">Owner: </span><Person id={current.ownerId} /></div>
              <p className="rounded-md bg-muted p-3 text-xs">{current.notes || "No notes."}</p>
              <Field label="Status"><Sel value={current.status} onChange={(v) => { updateMail(current.id, { status: v as MailEntry["status"] }, `Status changed to ${v}`); toast.success("Status updated"); }} options={["Open", "In Progress", "Closed"]} /></Field>
              <Timeline items={[...current.timeline].reverse().map((t) => ({ at: t.at, title: t.event, by: t.by }))} />
            </div>
          </>}
        </SheetContent>
      </Sheet>
      <MailDialog open={open} onOpenChange={setOpen} onSubmit={(m) => { addMail(m); setOpen(false); toast.success("Mail registered"); }} />
      <span className="hidden">{nameOf("")}</span>
    </div>
  );
}

function MailDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (v: boolean) => void; onSubmit: (m: Omit<MailEntry, "id" | "refNo" | "timeline" | "channel">) => void }) {
  const { data } = useStore();
  const [direction, setDirection] = useState("Incoming");
  const [sender, setSender] = useState("");
  const [recipient, setRecipient] = useState("OfficeFlow HR");
  const [subject, setSubject] = useState("");
  const [dept, setDept] = useState(DEPARTMENTS[1]!);
  const [owner, setOwner] = useState(data.employees[0]?.id ?? "");
  const [priority, setPriority] = useState("Normal");
  const [follow, setFollow] = useState("");
  const [notes, setNotes] = useState("");
  const valid = sender.trim() && recipient.trim() && subject.trim().length >= 3;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Register mail</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Direction"><Sel value={direction} onChange={setDirection} options={["Incoming", "Outgoing"]} /></Field>
          <Field label="Priority"><Sel value={priority} onChange={setPriority} options={["Low", "Normal", "High", "Urgent"]} /></Field>
          <Field label="Sender" required><Input value={sender} onChange={(e) => setSender(e.target.value)} /></Field>
          <Field label="Recipient" required><Input value={recipient} onChange={(e) => setRecipient(e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Subject" required><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field></div>
          <Field label="Department"><Sel value={dept} onChange={setDept} options={DEPARTMENTS} /></Field>
          <Field label="Owner"><Sel value={owner} onChange={setOwner} options={data.employees.map((e) => ({ value: e.id, label: e.name }))} /></Field>
          <div className="col-span-2"><Field label="Follow-up date"><Input type="date" value={follow} onChange={(e) => setFollow(e.target.value)} /></Field></div>
          <div className="col-span-2"><Field label="Notes"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid} onClick={() => onSubmit({ direction: direction as MailEntry["direction"], date: TODAY, sender, recipient, subject, department: dept, ownerId: owner, priority: priority as MailEntry["priority"], status: "Open", followUpAt: follow || undefined, notes })}>Register</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
