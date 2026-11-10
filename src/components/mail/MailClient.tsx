"use client";

import { useState, useEffect } from "react";
import { Mail, Plus, ArrowDownLeft, ArrowUpRight, Send, Package } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

export function MailClient() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDirection, setFilterDirection] = useState("All");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form
  const [formData, setFormData] = useState({
    direction: "Incoming",
    channel: "Physical Courier",
    sender: "",
    recipient: "",
    subject: "",
    department: "Executive",
    priority: "Normal",
    trackingNumber: "",
  });

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/mail");
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
      }
    } catch {
      toast.error("Failed to load mail logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleAddMail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      toast.success(`Mail registered with Reference: ${data.mail.refNo}`);
      setShowAddModal(false);
      setFormData({
        direction: "Incoming",
        channel: "Physical Courier",
        sender: "",
        recipient: "",
        subject: "",
        department: "Executive",
        priority: "Normal",
        trackingNumber: "",
      });
      fetchLogs();
    } catch (err: any) {
      toast.error(err.message || "Failed to log mail");
    }
  };

  const filteredLogs = logs.filter(
    (l) => filterDirection === "All" || l.direction === filterDirection
  );

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> Mail & Courier Dispatch Log
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Log inward/outward office couriers, statutory letters, parcels, and physical consignments.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition"
        >
          <Plus className="h-4 w-4" /> Register Inward / Outward Mail
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        {["All", "Incoming", "Outgoing"].map((d) => (
          <button
            key={d}
            onClick={() => setFilterDirection(d)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filterDirection === d
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {d} Mail
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground font-semibold">
              <tr>
                <th className="px-5 py-3.5">Ref No.</th>
                <th className="px-5 py-3.5">Direction</th>
                <th className="px-5 py-3.5">Sender → Recipient</th>
                <th className="px-5 py-3.5">Subject / Description</th>
                <th className="px-5 py-3.5">Carrier / Channel</th>
                <th className="px-5 py-3.5">Priority</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    Loading logs…
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No mail records logged yet.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => (
                  <tr key={l._id} className="hover:bg-muted/30 transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-primary">{l.refNo}</td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          l.direction === "Incoming"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {l.direction === "Incoming" ? (
                          <ArrowDownLeft className="h-3 w-3" />
                        ) : (
                          <ArrowUpRight className="h-3 w-3" />
                        )}
                        {l.direction}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-foreground">
                        From: <span className="text-muted-foreground font-normal">{l.sender}</span>
                      </p>
                      <p className="font-semibold text-foreground">
                        To: <span className="text-muted-foreground font-normal">{l.recipient}</span>
                      </p>
                    </td>

                    <td className="px-5 py-3.5 text-foreground font-medium max-w-xs truncate" title={l.subject}>
                      {l.subject}
                    </td>

                    <td className="px-5 py-3.5 text-muted-foreground">
                      <p className="font-medium text-foreground">{l.channel}</p>
                      {l.trackingNumber && (
                        <p className="font-mono text-[10px] text-muted-foreground">#{l.trackingNumber}</p>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold ${
                          l.priority === "Urgent"
                            ? "bg-red-100 text-red-800"
                            : l.priority === "High"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {l.priority}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-800">
                        {l.status}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right text-muted-foreground font-medium">
                      {formatDate(l.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-base font-bold text-foreground">Register Mail / Courier</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground text-sm font-semibold">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMail} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Direction *</label>
                  <select
                    value={formData.direction}
                    onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  >
                    <option value="Incoming">Incoming (Inward)</option>
                    <option value="Outgoing">Outgoing (Outward)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Channel / Courier</label>
                  <select
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  >
                    <option value="Physical Courier">Physical Courier (BlueDart / DTDC)</option>
                    <option value="Speed Post">India Post / Speed Post</option>
                    <option value="Hand Delivery">Hand Delivery</option>
                    <option value="Email">Email / Digital</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Sender *</label>
                  <input
                    type="text"
                    required
                    value={formData.sender}
                    onChange={(e) => setFormData({ ...formData, sender: e.target.value })}
                    placeholder="e.g. HDFC Bank Ltd"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Recipient *</label>
                  <input
                    type="text"
                    required
                    value={formData.recipient}
                    onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                    placeholder="e.g. Vikram Desai"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Subject / Document Description *</label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g. Credit Card statement / MCA Legal Notice"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Tracking Number</label>
                  <input
                    type="text"
                    value={formData.trackingNumber}
                    onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                    placeholder="e.g. BD12345678"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  >
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90"
                >
                  Log Mail
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
