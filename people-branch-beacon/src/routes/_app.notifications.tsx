import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/data/store";
import { PageHeader, KpiCard } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/notifications")({
  component: NotificationsPage,
});

const CATEGORIES = ["All", "Unread", "Approvals", "Attendance", "Payroll", "Documents", "Announcements"] as const;

function NotificationsPage() {
  const { data, markRead, markAllRead } = useStore();
  const [cat, setCat] = useState<string>("All");
  const unread = data.notifications.filter((n) => !n.read).length;
  const rows = data.notifications.filter((n) =>
    cat === "All" ? true : cat === "Unread" ? !n.read : n.category === cat,
  );

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Approval requests, attendance and payroll alerts, documents and announcements."
        actions={<Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={markAllRead}><CheckCheck className="h-3.5 w-3.5" /> Mark all read</Button>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Unread" value={String(unread)} icon={<Bell className="h-4 w-4" />} />
        <KpiCard label="Total" value={String(data.notifications.length)} />
        <KpiCard label="Announcements" value={String(data.announcements.length)} />
        <KpiCard label="High priority" value={String(data.notifications.filter((n) => n.priority === "High").length)} />
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={cn("rounded-full border px-3 py-1 text-xs font-medium", cat === c ? "border-primary bg-blue-soft text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
            {c}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-xs text-muted-foreground">Nothing here — you're all caught up.</p>
        ) : rows.map((n) => (
          <button
            key={n.id}
            onClick={() => markRead(n.id)}
            className={cn("flex w-full items-start justify-between gap-3 border-b border-border/60 px-4 py-3 text-left last:border-0 hover:bg-blue-soft/40", !n.read && "bg-blue-soft/30")}
          >
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                <span className={cn("truncate text-[13px]", n.read ? "font-medium text-foreground" : "font-semibold text-foreground")}>{n.title}</span>
                {n.priority === "High" && <Badge className="shrink-0 bg-danger-soft text-danger" variant="outline">High</Badge>}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{n.description}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[10px] text-muted-foreground">{n.timestamp}</span>
              <span className="mt-1 block"><Badge variant="outline" className="text-[10px]">{n.category}</Badge></span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
