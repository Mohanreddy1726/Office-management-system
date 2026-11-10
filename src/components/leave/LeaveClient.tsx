"use client";

import { useState, useEffect } from "react";
import { CalendarDays, Plus, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface LeaveClientProps {
  currentRole: string;
}

export function LeaveClient({ currentRole }: LeaveClientProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    leaveType: "Casual Leave",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    isHalfDay: false,
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchLeaveData = async () => {
    try {
      const res = await fetch("/api/leave");
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests);
        setBalance(data.balance);
      }
    } catch {
      toast.error("Failed to load leave data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveData();
  }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply");

      toast.success("Leave application submitted successfully!");
      setShowApplyModal(false);
      setFormData({
        leaveType: "Casual Leave",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        isHalfDay: false,
        reason: "",
      });
      fetchLeaveData();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecision = async (leaveId: string, approve: boolean) => {
    try {
      const res = await fetch("/api/leave", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveId,
          action: approve ? "approve" : "reject",
          note: approve ? "Approved as per leave policy" : "Rejected due to project deadlines",
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(approve ? "Leave request approved!" : "Leave request rejected");
        fetchLeaveData();
      }
    } catch {
      toast.error("Failed to update leave request");
    }
  };

  const canApprove = currentRole === "super_admin" || currentRole === "hr_admin" || currentRole === "manager";

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" /> Leave Management
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track annual leave quotas, apply for time off, and manage approval queues.
          </p>
        </div>

        <button
          onClick={() => setShowApplyModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition"
        >
          <Plus className="h-4 w-4" /> Apply for Leave
        </button>
      </div>

      {/* Leave Balances Cards */}
      {balance && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Casual Leave (CL)
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-foreground">{balance.casualLeave.remaining}</span>
              <span className="text-xs text-muted-foreground">/ {balance.casualLeave.total} days left</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{balance.casualLeave.used} days taken</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Sick Leave (SL)
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-foreground">{balance.sickLeave.remaining}</span>
              <span className="text-xs text-muted-foreground">/ {balance.sickLeave.total} days left</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{balance.sickLeave.used} days taken</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Comp-Off (CO)
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-foreground">{balance.earnedLeave?.remaining ?? 2}</span>
              <span className="text-xs text-muted-foreground">days balance</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Per approved extra work</p>
          </div>
        </div>
      )}

      {/* Requests Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground font-semibold">
              <tr>
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-5 py-3.5">Leave Type</th>
                <th className="px-5 py-3.5">Dates</th>
                <th className="px-5 py-3.5">Duration</th>
                <th className="px-5 py-3.5">Reason</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    Loading requests…
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No leave applications found.
                  </td>
                </tr>
              ) : (
                requests.map((l) => (
                  <tr key={l._id} className="hover:bg-muted/30 transition">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-foreground">{l.employeeName}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{l.employeeId}</p>
                    </td>

                    <td className="px-5 py-3.5 font-medium text-foreground">{l.leaveType}</td>

                    <td className="px-5 py-3.5 text-muted-foreground font-medium">
                      {formatDate(l.startDate)} {l.startDate !== l.endDate && `→ ${formatDate(l.endDate)}`}
                    </td>

                    <td className="px-5 py-3.5 font-semibold text-foreground">
                      {l.daysCount} {l.daysCount === 1 ? "day" : "days"} {l.isHalfDay && "(Half Day)"}
                    </td>

                    <td className="px-5 py-3.5 text-muted-foreground max-w-xs truncate" title={l.reason}>
                      {l.reason}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          l.status === "HR Approved"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : l.status === "Manager Approved"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : l.status === "Rejected"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {l.status}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      {canApprove && (l.status === "Submitted" || (l.status === "Manager Approved" && currentRole !== "manager")) ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleDecision(l._id, true)}
                            className="rounded px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleDecision(l._id, false)}
                            className="rounded px-2.5 py-1 text-[11px] font-semibold bg-red-600 text-white hover:bg-red-700 transition"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          {l.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-base font-bold text-foreground">Apply for Leave</h3>
              <button
                onClick={() => setShowApplyModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApply} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Leave Category *</label>
                <select
                  value={formData.leaveType}
                  onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                >
                  <option value="Casual Leave">Casual Leave (CL)</option>
                  <option value="Sick Leave">Sick Leave (SL)</option>
                  <option value="Comp-Off">Comp-Off (CO)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="halfDay"
                  checked={formData.isHalfDay}
                  onChange={(e) => setFormData({ ...formData, isHalfDay: e.target.checked })}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="halfDay" className="text-xs font-medium text-foreground cursor-pointer">
                  This is a Half-Day leave
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Reason for Leave *</label>
                <textarea
                  required
                  rows={3}
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Explain the purpose of your time off…"
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-xs focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-70"
                >
                  {submitting ? "Submitting…" : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
