"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/data/store";
import { TODAY, DEPARTMENTS } from "@/lib/data/seed";
import { PageHeader, KpiCard, StatusBadge, TabsShell, Field, Timeline, EmployeeAvatar } from "@/components/shared";
import { DataTable, exportCsv, type Column } from "@/components/data-table";
import { Person, Sel, useNames } from "@/components/form-bits";
import type { MailEntry, MailDirection } from "@/lib/data/types";
import { fmtDate, initials, avatarColor } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { AppShell } from "@/components/shell";
import {
  Inbox, Send, Mail, Download, AlarmClock, CheckCircle2, Clock,
  Search, LayoutGrid, List, Building2, Shield, ArrowUpRight, FileText,
  AlertTriangle, Check, X, ExternalLink, Truck, Package, RefreshCw,
  SlidersHorizontal, Radio
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function MailPage() {
  const { data, updateMail, setGmail } = useStore();
  const nameOf = useNames();

  const [tab, setTab] = useState<string>("all");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Slide-out Sheet
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);

  // Filtered rows
  const filteredMail = useMemo(() => {
    return data.mail.filter((m) => {
      // Tab filter
      if (tab === "in" && m.direction !== "Incoming") return false;
      if (tab === "out" && m.direction !== "Outgoing") return false;
      if (tab === "due") {
        if (!m.followUpAt || m.followUpAt > TODAY || m.status === "Closed") return false;
      }

      // Priority filter
      if (priorityFilter !== "all" && m.priority !== priorityFilter) return false;

      // Status filter
      if (statusFilter !== "all" && m.status !== statusFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const ownerName = nameOf(m.ownerId).toLowerCase();
        return (
          m.subject.toLowerCase().includes(q) ||
          m.refNo.toLowerCase().includes(q) ||
          m.sender.toLowerCase().includes(q) ||
          m.recipient.toLowerCase().includes(q) ||
          m.department.toLowerCase().includes(q) ||
          ownerName.includes(q)
        );
      }

      return true;
    });
  }, [data.mail, tab, priorityFilter, statusFilter, searchQuery, nameOf]);

  const currentMail = data.mail.find((m) => m.id === selectedMailId);

  // KPI figures
  const incomingCount = data.mail.filter((m) => m.direction === "Incoming").length;
  const outgoingCount = data.mail.filter((m) => m.direction === "Outgoing").length;
  const openCount = data.mail.filter((m) => m.status !== "Closed").length;
  const followUpDueCount = data.mail.filter((m) => m.followUpAt && m.followUpAt <= TODAY && m.status !== "Closed").length;

  // Table Columns
  const tableColumns: Column<MailEntry>[] = [
    {
      key: "r",
      header: "Ref No",
      sortValue: (r) => r.refNo,
      render: (r) => (
        <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono font-semibold text-foreground">
          {r.refNo}
        </code>
      ),
    },
    {
      key: "d",
      header: "Type",
      render: (r) =>
        r.direction === "Incoming" ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
            <Inbox className="h-3.5 w-3.5" /> In
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Send className="h-3.5 w-3.5" /> Out
          </span>
        ),
    },
    {
      key: "s",
      header: "Subject",
      render: (r) => (
        <div>
          <span
            className="font-semibold text-foreground hover:underline cursor-pointer block max-w-[280px] truncate"
            onClick={() => setSelectedMailId(r.id)}
          >
            {r.subject}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {r.sender} → {r.recipient}
          </span>
        </div>
      ),
    },
    {
      key: "dept",
      header: "Department",
      render: (r) => (
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-muted dark:text-muted-foreground">
          {r.department}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "owner",
      header: "Owner",
      render: (r) => (
        <Link href={`/employees/${r.ownerId}`} className="group flex items-center gap-1.5 hover:underline">
          <Person id={r.ownerId} />
          <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      ),
      hideOnMobile: true,
    },
    {
      key: "dt",
      header: "Date",
      sortValue: (r) => r.date,
      render: (r) => fmtDate(r.date),
    },
    { key: "p", header: "Priority", render: (r) => <StatusBadge status={r.priority} /> },
    { key: "st", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "act",
      header: "",
      render: (r) => (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setSelectedMailId(r.id)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <AppShell>
      <div>
        <PageHeader
          breadcrumb={["Operations", "Mail & Postal Log"]}
          title="Office Mail & Correspondence Register"
          description="Log and monitor incoming courier parcels, registered postal mail, formal notices, and integrated Gmail correspondence."
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs shadow-sm"
                onClick={() =>
                  exportCsv(
                    "mail-register.csv",
                    ["Ref No", "Direction", "Date", "Sender", "Recipient", "Subject", "Department", "Owner", "Priority", "Status", "Follow-up"],
                    data.mail.map((m) => [
                      m.refNo,
                      m.direction,
                      m.date,
                      m.sender,
                      m.recipient,
                      m.subject,
                      m.department,
                      nameOf(m.ownerId),
                      m.priority,
                      m.status,
                      m.followUpAt ?? "None",
                    ])
                  )
                }
              >
                <Download className="h-3.5 w-3.5" /> Export Register
              </Button>
            </>
          }
        />

        {/* Top KPI Cards Row */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Incoming Dispatches"
            value={String(incomingCount)}
            hint="Received packages & notices"
            icon={<Inbox className="h-4 w-4 text-blue-500" />}
            onClick={() => setTab("in")}
          />
          <KpiCard
            label="Outgoing Mail"
            value={String(outgoingCount)}
            hint="Dispatched courier & letters"
            icon={<Send className="h-4 w-4 text-emerald-500" />}
            onClick={() => setTab("out")}
          />
          <KpiCard
            label="Open / In Progress"
            value={String(openCount)}
            hint="Active correspondence items"
            icon={<Mail className="h-4 w-4 text-primary" />}
            onClick={() => setTab("all")}
          />
          <KpiCard
            label="Follow-ups Due"
            value={String(followUpDueCount)}
            hint={followUpDueCount > 0 ? "Urgent attention required" : "No pending deadlines"}
            icon={<AlarmClock className="h-4 w-4 text-amber-500" />}
            onClick={() => setTab("due")}
          />
        </div>

        {/* Tabs Shell */}
        <TabsShell
          tabs={[
            { key: "all", label: `All Mail (${data.mail.length})` },
            { key: "in", label: `Incoming (${incomingCount})` },
            { key: "out", label: `Outgoing (${outgoingCount})` },
            { key: "due", label: `Follow-ups Due (${followUpDueCount})` },
            { key: "gmail", label: "Gmail Cloud Sync" },
          ]}
          active={tab}
          onChange={(t) => {
            setTab(t);
            setSearchQuery("");
          }}
        >
          {tab !== "gmail" ? (
            <div className="space-y-4">
              {/* Filter Toolbar */}
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative w-56 sm:w-72">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search ref no, sender, subject, owner..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8.5 pl-8 text-xs"
                    />
                  </div>
                  <Sel
                    value={priorityFilter}
                    onChange={setPriorityFilter}
                    className="h-8.5 w-36 text-xs"
                    options={[
                      { value: "all", label: "All Priorities" },
                      { value: "Low", label: "Low" },
                      { value: "Normal", label: "Normal" },
                      { value: "High", label: "High" },
                      { value: "Urgent", label: "Urgent" },
                    ]}
                  />
                  <Sel
                    value={statusFilter}
                    onChange={setStatusFilter}
                    className="h-8.5 w-36 text-xs"
                    options={[
                      { value: "all", label: "All Statuses" },
                      { value: "Open", label: "Open" },
                      { value: "In Progress", label: "In Progress" },
                      { value: "Closed", label: "Closed" },
                    ]}
                  />
                  {(searchQuery || priorityFilter !== "all" || statusFilter !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        setPriorityFilter("all");
                        setStatusFilter("all");
                      }}
                      className="h-8.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Reset
                    </Button>
                  )}
                </div>

                {/* View Switcher */}
                <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
                  <Button
                    variant={view === "cards" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setView("cards")}
                    className="h-7 gap-1 px-2.5 text-xs font-medium"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Cards
                  </Button>
                  <Button
                    variant={view === "table" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setView("table")}
                    className="h-7 gap-1 px-2.5 text-xs font-medium"
                  >
                    <List className="h-3.5 w-3.5" />
                    Table
                  </Button>
                </div>
              </div>

              {/* CARDS VIEW */}
              {view === "cards" && (
                <div>
                  {filteredMail.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                      <Mail className="h-10 w-10 text-muted-foreground/60 mb-2" />
                      <p className="text-sm font-semibold text-foreground">No Mail Entries Found</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        No correspondence matches your active filters.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {filteredMail.map((mail) => (
                        <MailCard
                          key={mail.id}
                          mail={mail}
                          onView={() => setSelectedMailId(mail.id)}
                          onStatusChange={(newStatus) => {
                            updateMail(mail.id, { status: newStatus }, `Status updated to ${newStatus}`);
                            toast.success(`Mail status updated to ${newStatus}`);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TABLE VIEW */}
              {view === "table" && (
                <DataTable
                  columns={tableColumns}
                  rows={filteredMail}
                  rowKey={(r) => r.id}
                  pageSize={12}
                  onRowClick={(r) => setSelectedMailId(r.id)}
                  emptyTitle="No mail entries found"
                />
              )}
            </div>
          ) : (
            /* TAB 5: GMAIL INTEGRATION */
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 font-bold border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900">
                      <Mail className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground text-sm">Gmail Mailbox Cloud Ingestion</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{data.gmail.mailbox}</p>
                    </div>
                  </div>

                  <Switch
                    checked={data.gmail.connected}
                    onCheckedChange={(v) => {
                      setGmail(v);
                      toast.success(v ? "Gmail integration connected (demo)" : "Gmail integration paused");
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs">
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">Connection Status</span>
                    <p className="mt-1">
                      <StatusBadge status={data.gmail.connected ? "Active" : "Inactive"} />
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">Sync Frequency</span>
                    <p className="mt-1 font-semibold text-foreground">{data.gmail.frequency}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">Last Ingestion Run</span>
                    <p className="mt-1 font-semibold text-foreground">{data.gmail.lastSync}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">Granted Scopes</span>
                    <p className="mt-1 text-muted-foreground font-medium">{data.gmail.scopes.join(", ")}</p>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 text-xs text-muted-foreground dark:bg-muted/30">
                  <p className="font-medium text-foreground mb-1">Simulated Enterprise Connector</p>
                  <span>
                    When active, email correspondence to <code>{data.gmail.mailbox}</code> with tags like legal,
                    procurement, or notices automatically syncs into this log.
                  </span>
                </div>
              </div>

              {/* Ingestion Logs */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-foreground text-sm">Recent Sync Activities</h4>
                  <span className="text-xs text-muted-foreground">{data.gmail.logs.length} events</span>
                </div>
                <div className="pt-2">
                  <Timeline items={data.gmail.logs.map((l) => ({ at: l.at, title: l.event, note: l.status }))} />
                </div>
              </div>
            </div>
          )}
        </TabsShell>

        {/* SLIDE-OUT SHEET: Mail Details & Audit Timeline */}
        <Sheet open={!!currentMail} onOpenChange={(v) => !v && setSelectedMailId(null)}>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            {currentMail && (
              <MailDetailSheetContent
                mail={currentMail}
                onStatusChange={(st) => {
                  updateMail(currentMail.id, { status: st }, `Status updated to ${st}`);
                  toast.success(`Status updated to ${st}`);
                }}
              />
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AppShell>
  );
}

/* =========================================================================================
 * COMPONENT: MailCard (Rich custom card matching photo aesthetic)
 * ========================================================================================= */
function MailCard({
  mail,
  onView,
  onStatusChange,
}: {
  mail: MailEntry;
  onView: () => void;
  onStatusChange: (st: MailEntry["status"]) => void;
}) {
  const { data } = useStore();
  const nameOf = useNames();
  const emp = data.employees.find((e) => e.id === mail.ownerId);

  const isIncoming = mail.direction === "Incoming";
  const isUrgent = mail.priority === "Urgent" || mail.priority === "High";
  const isDue = mail.followUpAt && mail.followUpAt <= TODAY && mail.status !== "Closed";

  const priorityDot = {
    Urgent: "bg-rose-500",
    High: "bg-amber-500",
    Normal: "bg-blue-500",
    Low: "bg-slate-400",
  }[mail.priority] ?? "bg-slate-400";

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all duration-200 dark:bg-card dark:border-border hover:shadow-md">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Square Direction Avatar */}
            <div className="relative">
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl text-white font-bold shadow-sm",
                  isIncoming
                    ? "bg-gradient-to-br from-blue-500 to-indigo-600"
                    : "bg-gradient-to-br from-emerald-500 to-teal-600"
                )}
              >
                {isIncoming ? <Inbox className="h-6 w-6" /> : <Send className="h-6 w-6" />}
              </div>
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white dark:ring-slate-900",
                  priorityDot
                )}
                title={`Priority: ${mail.priority}`}
              />
            </div>

            <div className="min-w-0">
              <h4
                onClick={onView}
                className="font-semibold text-foreground text-[14px] truncate cursor-pointer hover:text-primary transition-colors"
                title={mail.subject}
              >
                {mail.subject}
              </h4>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <code className="rounded bg-slate-100 px-1.5 py-0.2 font-mono text-[11px] font-semibold text-slate-800 dark:bg-muted dark:text-muted-foreground">
                  {mail.refNo}
                </code>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  {mail.channel === "Physical" ? <Truck className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                  {mail.channel}
                </span>
              </div>
            </div>
          </div>

          <StatusBadge status={mail.status} />
        </div>

        {/* Divider */}
        <div className="my-3.5 border-t border-slate-100 dark:border-slate-800" />

        {/* Route Banner (Sender -> Recipient) */}
        <div className="mb-3.5 flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-foreground dark:bg-muted/30">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-semibold text-foreground truncate max-w-[120px]">{mail.sender}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-semibold text-foreground truncate max-w-[120px]">{mail.recipient}</span>
          </div>
          <span className="text-[11px] text-muted-foreground shrink-0">{fmtDate(mail.date)}</span>
        </div>

        {/* 3 Metric Boxes (photo style) */}
        <div className="grid grid-cols-3 gap-2">
          {/* Box 1: Department */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Department</p>
            <p className="mt-0.5 truncate text-[11px] font-bold text-slate-900 dark:text-white">
              {mail.department}
            </p>
          </div>

          {/* Box 2: Owner */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Assignee</p>
            <p className="mt-0.5 truncate text-[11px] font-bold text-primary">
              {emp?.name ? emp.name.split(" ")[0] : nameOf(mail.ownerId).split(" ")[0]}
            </p>
          </div>

          {/* Box 3: Priority */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Priority</p>
            <p
              className={cn(
                "mt-0.5 truncate text-[11px] font-bold",
                isUrgent ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-200"
              )}
            >
              {mail.priority}
            </p>
          </div>
        </div>

        {/* Notes quote banner */}
        {mail.notes && (
          <div className="mt-3.5 rounded-xl bg-slate-50 p-2.5 text-xs text-foreground dark:bg-muted/30">
            <p className="text-muted-foreground italic truncate">"{mail.notes}"</p>
          </div>
        )}

        {/* Follow-up Due Warning */}
        {isDue && (
          <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <AlarmClock className="h-3.5 w-3.5 shrink-0" />
            <span>Follow-up action due today ({fmtDate(mail.followUpAt)})</span>
          </div>
        )}
      </div>

      {/* Footer / Actions */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <button
          onClick={onView}
          className="text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
        >
          <Clock className="h-3 w-3" /> Audit History
        </button>

        <div className="flex items-center gap-1.5">
          {mail.status !== "Closed" ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs font-medium text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800"
              onClick={() => onStatusChange("Closed")}
            >
              <Check className="mr-1 h-3 w-3" /> Mark Closed
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onStatusChange("In Progress")}
            >
              Reopen
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onView}
          >
            Details
          </Button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================================
 * COMPONENT: MailDetailSheetContent
 * ========================================================================================= */
function MailDetailSheetContent({
  mail,
  onStatusChange,
}: {
  mail: MailEntry;
  onStatusChange: (st: MailEntry["status"]) => void;
}) {
  const { data } = useStore();
  const nameOf = useNames();
  const emp = data.employees.find((e) => e.id === mail.ownerId);

  return (
    <div className="space-y-6 pt-4">
      <SheetHeader>
        <div className="flex items-start justify-between gap-2">
          <SheetTitle className="text-base font-bold pr-2">{mail.subject}</SheetTitle>
          <StatusBadge status={mail.status} />
        </div>
      </SheetHeader>

      {/* Badges strip */}
      <div className="flex flex-wrap gap-2 text-xs">
        <code className="rounded bg-muted px-2 py-0.5 font-mono font-semibold">{mail.refNo}</code>
        <StatusBadge status={mail.direction} />
        <StatusBadge status={mail.priority} />
        <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-muted dark:text-muted-foreground">
          {mail.channel}
        </span>
      </div>

      {/* Route & Metadata */}
      <div className="space-y-2 rounded-xl border border-border p-3.5 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Sender:</span>
          <span className="font-semibold text-foreground">{mail.sender}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Recipient:</span>
          <span className="font-semibold text-foreground">{mail.recipient}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Department:</span>
          <span className="font-semibold text-foreground">{mail.department}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Dispatch Date:</span>
          <span className="font-semibold text-foreground">{fmtDate(mail.date)}</span>
        </div>
        {mail.followUpAt && (
          <div className="flex justify-between pt-1 border-t border-border">
            <span className="text-muted-foreground">Follow-up Target:</span>
            <span className="font-semibold text-amber-700 dark:text-amber-400">{fmtDate(mail.followUpAt)}</span>
          </div>
        )}
      </div>

      {/* Assignee / Owner */}
      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-muted/30">
        <EmployeeAvatar id={mail.ownerId} name={emp?.name || mail.ownerId} size={40} />
        <div>
          <p className="font-semibold text-foreground text-xs">Assigned Owner</p>
          <p className="text-sm font-semibold text-foreground">{emp?.name || nameOf(mail.ownerId)}</p>
          <p className="text-[11px] text-muted-foreground">{emp?.designation || "Staff"}</p>
        </div>
      </div>

      {/* Notes */}
      {mail.notes && (
        <div className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-muted/30">
          <p className="font-semibold text-foreground mb-1">Remarks & Details:</p>
          <p className="text-muted-foreground italic">"{mail.notes}"</p>
        </div>
      )}

      {/* Status Updater */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground">Update Current Status</label>
        <Sel
          value={mail.status}
          onChange={(v) => onStatusChange(v as MailEntry["status"])}
          options={["Open", "In Progress", "Closed"]}
        />
      </div>

      {/* Audit Timeline */}
      <div className="space-y-3 pt-2 border-t border-border">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Correspondence Timeline</h4>
        <Timeline
          items={[...mail.timeline].reverse().map((t) => ({
            at: t.at,
            title: t.event,
            by: t.by,
          }))}
        />
      </div>
    </div>
  );
}
