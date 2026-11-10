"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/data/store";
import { TODAY } from "@/lib/data/seed";
import { PageHeader, KpiCard, StatusBadge, TabsShell, Field, EmployeeAvatar } from "@/components/shared";
import { Sel } from "@/components/form-bits";
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
  const { data, markRead, markAllRead, clearNotifications, addAnnouncement, me } = useStore();

  const [activeTab, setActiveTab] = useState<string>("all");
  const [announcementOpen, setAnnouncementOpen] = useState(false);

  const unreadCount = data.notifications.filter((n) => !n.read).length;
  const highPriorityCount = data.notifications.filter((n) => n.priority === "High").length;

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return data.notifications.filter((n) => {
      if (activeTab === "unread") return !n.read;
      if (activeTab === "approvals") return n.category === "Approvals";
      if (activeTab === "attendance") return n.category === "Attendance";
      if (activeTab === "payroll") return n.category === "Payroll" || n.category === "Documents";
      return true;
    });
  }, [data.notifications, activeTab]);

  return (
    <AppShell>
      <div>
        <PageHeader
          breadcrumb={["Operations", "Notifications & Announcements"]}
          title="Notifications & Company Announcements"
          description="System notices, workflow approvals, biometric alerts, payroll publications, and official company broadcasts."
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
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
                className="gap-1.5 text-xs shadow-sm text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900"
                onClick={() => {
                  clearNotifications();
                  toast.info("Cleared all notifications");
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear Feed
              </Button>
              <Button
                size="sm"
                className="gap-1.5 text-xs shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => setAnnouncementOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" /> Publish Announcement
              </Button>
            </>
          }
        />

        {/* Top Metric KPI Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            value={String(data.announcements.length)}
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
            { key: "announcements", label: `Announcements (${data.announcements.length})` },
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
                <Button
                  size="sm"
                  className="gap-1.5 text-xs font-semibold"
                  onClick={() => setAnnouncementOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> New Broadcast
                </Button>
              </div>

              {data.announcements.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                  <Megaphone className="h-10 w-10 text-muted-foreground/60 mb-2" />
                  <p className="text-sm font-semibold text-foreground">No Announcements Published</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {data.announcements.map((ann) => (
                    <AnnouncementCard key={ann.id} announcement={ann} />
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
        "group relative flex flex-col justify-between rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:shadow-md",
        !item.read
          ? "border-primary/40 bg-primary/5 dark:bg-primary/10"
          : "border-slate-200/90 bg-white dark:bg-card dark:border-border"
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl border font-bold shadow-sm", style.color)}>
              {style.icon}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {!item.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" title="Unread" />}
                <h4 className={cn("text-[14px] truncate", !item.read ? "font-bold text-foreground" : "font-semibold text-foreground")}>
                  {item.title}
                </h4>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{item.category}</span>
                <span>•</span>
                <span>{item.timestamp}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isHigh && (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300">
                High Priority
              </span>
            )}
          </div>
        </div>

        {/* Description body */}
        <p className="mt-3 text-xs text-muted-foreground leading-relaxed pl-1">
          {item.description}
        </p>
      </div>

      {/* Footer / Actions */}
      <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        {item.link ? (
          <Link
            href={item.link}
            onClick={onMarkRead}
            className="font-semibold text-primary hover:underline flex items-center gap-1 text-[11px]"
          >
            Take Action <ArrowUpRight className="h-3 w-3" />
          </Link>
        ) : (
          <span className="text-[11px] text-muted-foreground">System Notice</span>
        )}

        {!item.read && (
          <button
            onClick={onMarkRead}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Check className="h-3 w-3" /> Mark as Read
          </button>
        )}
      </div>
    </div>
  );
}

/* =========================================================================================
 * COMPONENT: AnnouncementCard
 * ========================================================================================= */
function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const isHigh = announcement.priority === "High";

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:bg-card dark:border-border hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 font-bold border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold text-foreground text-sm">{announcement.title}</h4>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Audience: <strong>{announcement.audience}</strong></span>
              <span>•</span>
              <span>{fmtDate(announcement.publishAt)}</span>
            </div>
          </div>
        </div>

        {isHigh && (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300">
            Urgent Notice
          </span>
        )}
      </div>

      <div className="my-3 border-t border-slate-100 dark:border-slate-800" />

      <p className="text-xs text-foreground/90 leading-relaxed bg-slate-50 dark:bg-muted/30 p-3 rounded-xl">
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
  const [expiresAt, setExpiresAt] = useState("2026-11-15");

  const valid = title.trim().length >= 3 && message.trim().length >= 10;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl p-6">
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

          <div className="grid grid-cols-2 gap-3">
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
                options={["Engineering", "Human Resources", "Finance & Accounts", "Operations", "Sales & BD"]}
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
            onClick={() =>
              onSubmit({
                title,
                message,
                audience,
                scope: audience.includes("Selected") ? scopeDetails : undefined,
                priority,
                publishAt: TODAY,
                expiresAt,
              })
            }
            className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            Publish Broadcast
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
