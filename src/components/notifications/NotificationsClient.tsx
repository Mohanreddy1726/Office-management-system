"use client";

import { useState, useEffect } from "react";
import { Bell, Plus, Megaphone, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface NotificationsClientProps {
  currentRole: string;
}

export function NotificationsClient({ currentRole }: NotificationsClientProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"info" | "success" | "warning" | "danger">("info");

  const fetchNotifs = async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
      }
    } catch {
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      toast.success("Company announcement published!");
      setShowModal(false);
      setTitle("");
      setMessage("");
      fetchNotifs();
    } catch (err: any) {
      toast.error(err.message || "Failed to publish announcement");
    }
  };

  const isHR = currentRole === "super_admin" || currentRole === "hr_admin";

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> Notifications & Announcements
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Company-wide updates, holiday notices, and system alerts.
          </p>
        </div>

        {isHR && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition"
          >
            <Plus className="h-4 w-4" /> Publish Announcement
          </button>
        )}
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">Loading announcements…</div>
        ) : notifications.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-xs text-muted-foreground">
            No announcements published yet.
          </div>
        ) : (
          notifications.map((n) => (
            <div key={n._id} className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      n.type === "success"
                        ? "bg-emerald-50 text-emerald-600"
                        : n.type === "warning"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-blue-50 text-blue-600"
                    }`}
                  >
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{n.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{n.message}</p>
                    <span className="block text-[11px] text-slate-400 mt-3 font-medium">
                      Published on {formatDate(n.createdAt)}
                    </span>
                  </div>
                </div>

                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    n.type === "success"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : n.type === "warning"
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-blue-50 text-blue-700 border border-blue-200"
                  }`}
                >
                  {n.type}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Publish Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-base font-bold text-foreground">Publish Company Announcement</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground text-sm font-semibold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Headline *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Diwali Holidays Announcement"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Notice Type</label>
                <select
                  value={type}
                  onChange={(e: any) => setType(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                >
                  <option value="info">Information (Blue)</option>
                  <option value="success">Celebration / Holiday (Green)</option>
                  <option value="warning">Deadline / Action Required (Yellow)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Details & Message *</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type the full announcement message here…"
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-xs focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90"
                >
                  Publish Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
