"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/data/store";
import { TODAY, DEPARTMENTS } from "@/lib/data/seed";
import { PageHeader, KpiCard, StatusBadge, TabsShell, Field, EmployeeAvatar } from "@/components/shared";
import { Sel, useScope } from "@/components/form-bits";
import type { NotificationItem, Announcement } from "@/lib/data/types";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AppShell } from "@/components/shell";
import {
  Bell, CheckCheck, Trash2, Plus, Megaphone, ArrowUpRight,
  CheckCircle2, AlertTriangle, Calendar, Clock, ShieldCheck,
  Wallet, FileText, Check, Sparkles, Filter, Info
} from "lucide-react";
import { cn } from "@/lib/utils";

const NOTIFICATION_TABS = [
  { key: "all", label: "All Alerts" },
  { key: "unread", label: "Unread" },
  { key: "approvals", label: "Approvals" },
  { key: "attendance", label: "Attendance & Leave" },
  { key: "payroll", label: "Payroll & Docs" },
  { key: "announcements", label: "Announcements" },
];

export default function NotificationsPage() {
  const { data, session, markRead, markAllRead, clearNotifications, addAnnouncement, deleteAnnouncement, me } = useStore();
  const { isSuperAdmin, isAdmin, isEmployee, role } = useScope();

  const [activeTab, setActiveTab] = useState<string>("all");
  const [announcementOpen, setAnnouncementOpen] = useState(false);

  const unreadCount = data.notifications.filter((n) => !n.read).length;
  const highPriorityCount = data.notifications.filter((n) => n.priority === "High").length;

  // Filtered announcements based on audience & role
  const visibleAnnouncements = useMemo(() => {
    if (isAdmin) return data.announcements;
    const myEmp = data.employees.find((e) => e.id === session?.employeeId || e.id === session?.userId);
    const myBranch = myEmp?.branch || session?.branch;
    const myDept = myEmp?.department;

    return data.announcements.filter((ann) => {
      const aud = (ann.audience || "All Employees").toLowerCase().trim();
      if (aud === "all employees" || aud === "all" || !aud) return true;
      if (aud === "managers only") return role === "manager";
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
  }, [data.announcements, isAdmin, session, role, data.employees]);

  // Filtered notifications — always sorted with most recent on top
  const filteredNotifications = useMemo(() => {
    const parseTs = (ts?: string) => {
      if (!ts) return 0;
      const ms = new Date(ts.includes(" ") && !ts.includes("T") ? ts.replace(" ", "T") : ts).getTime();
      return Number.isNaN(ms) ? 0 : ms;
    };
    return data.notifications
      .filter((n) => {
        if (activeTab === "unread") return !n.read;
        if (activeTab === "approvals") return n.category === "Approvals";
        if (activeTab === "attendance") return n.category === "Attendance";
        if (activeTab === "payroll") return n.category === "Payroll" || n.category === "Documents";
        return true;
      })
      .sort((a, b) => parseTs(b.timestamp) - parseTs(a.timestamp));
  }, [data.notifications, activeTab]);

  return (
    <AppShell>
      <div className="min-w-0 space-y-4 sm:space-y-0">
        {/* Mobile-First Header (< sm) */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-sky-500/5 p-4 shadow-sm sm:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Bell className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Inbox &amp; Broadcasts
                </span>
                <h1 className="truncate text-lg font-bold tracking-tight text-foreground">
                  Notifications
                </h1>
              </div>
            </div>
            {unreadCount > 0 && (
              <Badge className="shrink-0 bg-primary text-[11px] font-bold text-primary-foreground">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            System notices, workflow approvals, and official company announcements.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={unreadCount === 0}
              className="h-9 flex-1 gap-1.5 rounded-xl bg-background/80 text-xs shadow-xs"
              onClick={() => {
                markAllRead();
                toast.success("All notifications marked as read");
              }}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark All Read
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-xl border-rose-200 bg-background/80 text-xs text-rose-600 shadow-xs hover:bg-rose-50 dark:border-rose-900"
              onClick={() => {
                clearNotifications();
                toast.info("Cleared all notifications");
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                className="h-9 w-full gap-1.5 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-sm"
                onClick={() => setAnnouncementOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" /> Publish Announcement
              </Button>
            )}
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden sm:block">
          <PageHeader
            breadcrumb={["Operations", "Notifications & Announcements"]}
            title="Notifications & Company Announcements"
            description="System notices, workflow approvals, biometric alerts, payroll publications, and official company broadcasts."
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={unreadCount === 0}
                  className="gap-1.5 text-xs shadow-sm"
                  onClick={() => {
                    markAllRead();
                    toast.success("All notifications marked as read");
                  }}
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark All Read
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-rose-200 text-xs text-rose-600 shadow-sm hover:bg-rose-50 dark:border-rose-900"
                  onClick={() => {
                    clearNotifications();
                    toast.info("Cleared all notifications");
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear Feed
                </Button>
                {isAdmin && (
                  <Button
                    size="sm"
                    className="gap-1.5 bg-primary text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                    onClick={() => setAnnouncementOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" /> Publish Announcement
                  </Button>
                )}
              </>
            }
          />
        </div>

        {/* Top Metric KPI Cards */}
        <div className="grid grid-cols-2 gap-2.5 sm:mb-6 sm:gap-3 xl:grid-cols-4">
          <KpiCard
            label="Unread Alerts"
            value={String(unreadCount)}
            hint={unreadCount > 0 ? "Requires review" : "All caught up"}
            icon={<Bell className="h-4 w-4 text-primary" />}
            onClick={() => setActiveTab("unread")}
          />
          <KpiCard
            label="Total Alerts"
            value={String(data.notifications.length)}
            hint="Recorded system logs"
            icon={<Clock className="h-4 w-4 text-blue-500" />}
            onClick={() => setActiveTab("all")}
          />
          <KpiCard
            label="Company Announcements"
            value={String(visibleAnnouncements.length)}
            hint="Official broadcasts active"
            icon={<Megaphone className="h-4 w-4 text-amber-500" />}
            onClick={() => setActiveTab("announcements")}
          />
          <KpiCard
            label="High Priority"
            value={String(highPriorityCount)}
            hint="Immediate response needed"
            icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}
          />
        </div>

        {/* Tabs Shell */}
        <TabsShell
          tabs={[
            { key: "all", label: `All Alerts (${data.notifications.length})` },
            { key: "unread", label: `Unread (${unreadCount})` },
            { key: "approvals", label: "Approvals" },
            { key: "attendance", label: "Attendance & Leaves" },
            { key: "payroll", label: "Payroll & Docs" },
            { key: "announcements", label: `Announcements (${visibleAnnouncements.length})` },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        >
          {activeTab !== "announcements" ? (
            <div className="space-y-3">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
                  <p className="text-sm font-semibold text-foreground">Zero Notifications</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You're all caught up! No notifications in this category.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {filteredNotifications.map((notif) => (
                    <NotificationCard
                      key={notif.id}
                      item={notif}
                      onMarkRead={() => markRead(notif.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* TAB: ANNOUNCEMENTS */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Official Organization Broadcasts</h3>
                  <p className="text-xs text-muted-foreground">General notices and policy announcements.</p>
                </div>
                {isAdmin && (
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs font-semibold"
                    onClick={() => setAnnouncementOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" /> New Broadcast
                  </Button>
                )}
              </div>

              {visibleAnnouncements.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                  <Megaphone className="h-10 w-10 text-muted-foreground/60 mb-2" />
                  <p className="text-sm font-semibold text-foreground">No Announcements Published</p>
                  <p className="text-xs text-muted-foreground mt-1">Official company notices and broadcasts will appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {visibleAnnouncements.map((ann) => (
                    <AnnouncementCard
                      key={ann.id}
                      announcement={ann}
                      isSuperAdmin={isSuperAdmin}
                      onDelete={() => deleteAnnouncement(ann.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsShell>

        {/* DIALOG: Publish Announcement */}
        <AnnouncementDialog
          open={announcementOpen}
          onOpenChange={setAnnouncementOpen}
          onSubmit={(annData) => {
            addAnnouncement(annData);
            setAnnouncementOpen(false);
            setActiveTab("announcements");
            toast.success("Announcement broadcast published successfully");
          }}
        />
      </div>
    </AppShell>
  );
}

/* =========================================================================================
 * COMPONENT: NotificationCard (Rich custom card layout)
 * ========================================================================================= */
function NotificationCard({
  item,
  onMarkRead,
}: {
  item: NotificationItem;
  onMarkRead: () => void;
}) {
  const isHigh = item.priority === "High";

  const getCategoryStyle = () => {
    switch (item.category) {
      case "Approvals":
        return {
          icon: <ShieldCheck className="h-5 w-5" />,
          color: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
        };
      case "Attendance":
        return {
          icon: <Clock className="h-5 w-5" />,
          color: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
        };
      case "Payroll":
        return {
          icon: <Wallet className="h-5 w-5" />,
          color: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
        };
      case "Documents":
        return {
          icon: <FileText className="h-5 w-5" />,
          color: "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900",
        };
      default:
        return {
          icon: <Info className="h-5 w-5" />,
          color: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800",
        };
    }
  };

  const style = getCategoryStyle();

  return (
    <div
      className={cn(
        "group relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border p-4 transition-all duration-200",
        !item.read
          ? "border-primary/60 bg-primary/[0.07] ring-1 ring-primary/20 shadow-sm hover:shadow-md dark:bg-primary/15"
          : "border-border/70 bg-muted/25 opacity-80 shadow-none hover:opacity-100 dark:bg-card/50"
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2 sm:flex-nowrap sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border font-bold shadow-sm sm:h-11 sm:w-11", style.color)}>
              {style.icon}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {!item.read && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary ring-2 ring-primary/25" title="Unread" />}
                <h4 className={cn("truncate text-[13px] sm:text-[14px]", !item.read ? "font-bold text-foreground" : "font-medium text-muted-foreground")}>
                  {item.title}
                </h4>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground sm:text-xs">
                <span>{item.category}</span>
                <span>•</span>
                <span className="truncate">{item.timestamp}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {!item.read && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                Unread
              </span>
            )}
            {isHigh && (
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                High Priority
              </span>
            )}
          </div>
        </div>

        {/* Description body */}
        <p className={cn("mt-3 break-words pl-1 text-xs leading-relaxed", !item.read ? "text-foreground/90" : "text-muted-foreground")}>
          {item.description}
        </p>
      </div>

      {/* Footer / Actions */}
      <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs dark:border-slate-800">
        {item.link ? (
          <Link
            href={item.link}
            onClick={onMarkRead}
            className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
          >
            Take Action <ArrowUpRight className="h-3 w-3" />
          </Link>
        ) : (
          <span className="text-[11px] text-muted-foreground">System Notice</span>
        )}

        {!item.read ? (
          <button
            onClick={onMarkRead}
            className="flex items-center gap-1 text-[11px] font-semibold text-primary transition-colors hover:text-primary/80"
          >
            <Check className="h-3 w-3" /> Mark as Read
          </button>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <CheckCheck className="h-3 w-3" /> Read
          </span>
        )}
      </div>
    </div>
  );
}

/* =========================================================================================
 * COMPONENT: AnnouncementCard
 * ========================================================================================= */
function AnnouncementCard({
  announcement,
  isSuperAdmin,
  onDelete,
}: {
  announcement: Announcement;
  isSuperAdmin?: boolean;
  onDelete?: () => void;
}) {
  const isHigh = announcement.priority === "High";

  return (
    <div className="group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-border dark:bg-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2 sm:flex-nowrap sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 font-bold text-amber-600 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300 sm:h-11 sm:w-11">
            <Megaphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm font-bold text-foreground">{announcement.title}</h4>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground sm:text-xs">
              <span>Audience: <strong>{announcement.audience}</strong></span>
              {announcement.scope && (
                <>
                  <span>•</span>
                  <span className="font-medium text-foreground">{announcement.scope}</span>
                </>
              )}
              <span>•</span>
              <span>{fmtDate(announcement.publishAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isHigh && (
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              Urgent Notice
            </span>
          )}
          {isSuperAdmin && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600"
              title="Delete Announcement"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="my-3 border-t border-slate-100 dark:border-slate-800" />

      <p className="break-words whitespace-pre-line rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-foreground/90 dark:bg-muted/30">
        {announcement.message}
      </p>

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Active Broadcast</span>
        {announcement.expiresAt && <span>Valid until {fmtDate(announcement.expiresAt)}</span>}
      </div>
    </div>
  );
}

/* =========================================================================================
 * DIALOG: Publish Announcement Dialog
 * ========================================================================================= */
function AnnouncementDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (a: Omit<Announcement, "id">) => void;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<Announcement["audience"]>("All Employees");
  const [scopeDetails, setScopeDetails] = useState("Hyderabad");
  const [priority, setPriority] = useState<Announcement["priority"]>("Normal");
  const defaultExpiry = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }, []);
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);

  const valid = title.trim().length >= 3 && message.trim().length >= 10;

  const handleSubmit = () => {
    onSubmit({
      title: title.trim(),
      message: message.trim(),
      audience,
      scope: audience.includes("Selected") ? scopeDetails : undefined,
      priority,
      publishAt: new Date().toISOString().slice(0, 10),
      expiresAt,
    });
    setTitle("");
    setMessage("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[90dvh] overflow-y-auto overscroll-contain rounded-2xl p-4 sm:w-full sm:max-w-lg sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Publish Company Announcement</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Broadcast corporate notices, executive announcements, and policy revisions.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-3 py-2 text-xs">
          <Field label="Announcement Headline" required>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Annual Town Hall 2026 & Strategy Roadmap"
              className="h-9"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Audience Scope">
              <Sel
                value={audience}
                onChange={(v) => setAudience(v as Announcement["audience"])}
                options={["All Employees", "Selected Branches", "Selected Departments", "Managers Only"]}
              />
            </Field>

            <Field label="Priority Level">
              <Sel
                value={priority}
                onChange={(v) => setPriority(v as Announcement["priority"])}
                options={["Normal", "High"]}
              />
            </Field>
          </div>

          {audience === "Selected Branches" && (
            <Field label="Target Branch">
              <Sel
                value={scopeDetails}
                onChange={setScopeDetails}
                options={["Hyderabad", "Warangal", "Vijayawada", "Visakhapatnam"]}
              />
            </Field>
          )}

          {audience === "Selected Departments" && (
            <Field label="Target Department">
              <Sel
                value={scopeDetails}
                onChange={setScopeDetails}
                options={DEPARTMENTS}
              />
            </Field>
          )}

          <Field label="Valid Until Expiry Date">
            <Input
              type="date"
              value={expiresAt}
              min={TODAY}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="h-9"
            />
          </Field>

          <Field label="Announcement Message & Actionable Instructions" required>
            <Textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter full broadcast details, meeting links, or mandatory instructions for staff..."
            />
          </Field>
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!valid}
            onClick={handleSubmit}
            className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            Publish Broadcast
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
