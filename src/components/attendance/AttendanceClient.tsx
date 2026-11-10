"use client";

import { useState, useEffect } from "react";
import { Clock, Calendar, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { formatTime } from "@/lib/utils";

interface AttendanceClientProps {
  currentRole: string;
}

export function AttendanceClient({ currentRole }: AttendanceClientProps) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Correction Modal State
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [reqCheckIn, setReqCheckIn] = useState("09:00");
  const [reqCheckOut, setReqCheckOut] = useState("18:00");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance?date=${date}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.records);
      }
    } catch {
      toast.error("Failed to load attendance records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [date]);

  const handleAdvance = async (attendanceId: string) => {
    try {
      const res = await fetch("/api/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId, action: "advance_confirmation" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Attendance moved to: ${data.record.confirmation}`);
        fetchRecords();
      }
    } catch {
      toast.error("Failed to advance confirmation");
    }
  };

  const handleDecisionCorrection = async (attendanceId: string, approve: boolean) => {
    try {
      const res = await fetch("/api/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceId,
          action: approve ? "approve_correction" : "reject_correction",
          decisionNote: approve ? "Approved by manager" : "Rejected by manager",
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(approve ? "Correction approved!" : "Correction rejected");
        fetchRecords();
      }
    } catch {
      toast.error("Failed to process correction");
    }
  };

  const submitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceId: selectedRecord._id,
          action: "request_correction",
          requestedCheckIn: reqCheckIn,
          requestedCheckOut: reqCheckOut,
          reason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Attendance correction request submitted to manager!");
        setSelectedRecord(null);
        setReason("");
        fetchRecords();
      }
    } catch {
      toast.error("Failed to submit correction");
    } finally {
      setSubmitting(false);
    }
  };

  const canApprove = currentRole === "super_admin" || currentRole === "hr_admin" || currentRole === "manager";

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Attendance Management
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daily office register, 4-stage confirmation pipeline, and punch regularizations.
          </p>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 shadow-xs">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-xs font-semibold text-foreground focus:outline-none"
          />
        </div>
      </div>

      {/* Confirmation Pipeline Legend */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-primary" /> 4-Stage Confirmation Workflow
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
            <span className="font-semibold text-slate-700">1. Awaiting Employee</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Punch logged by device</p>
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5">
            <span className="font-semibold text-blue-700">2. Awaiting Manager</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Manager reviews shift</p>
          </div>
          <div className="rounded-lg bg-purple-50 border border-purple-200 p-2.5">
            <span className="font-semibold text-purple-700">3. Awaiting HR</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">HR audit verification</p>
          </div>
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5">
            <span className="font-semibold text-emerald-700">4. Confirmed & Locked</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Ready for payroll cycle</p>
          </div>
        </div>
      </div>

      {/* Daily Register Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground font-semibold">
              <tr>
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-5 py-3.5">Department</th>
                <th className="px-5 py-3.5">Check In</th>
                <th className="px-5 py-3.5">Check Out</th>
                <th className="px-5 py-3.5">Hours</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Confirmation</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    Loading attendance records…
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No attendance records found for {date}.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r._id} className="hover:bg-muted/30 transition">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-foreground">{r.employeeName}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{r.employeeId}</p>
                    </td>

                    <td className="px-5 py-3.5 text-muted-foreground">{r.department}</td>

                    <td className="px-5 py-3.5 font-mono font-medium text-foreground">
                      {formatTime(r.checkIn)}
                    </td>

                    <td className="px-5 py-3.5 font-mono font-medium text-foreground">
                      {formatTime(r.checkOut)}
                    </td>

                    <td className="px-5 py-3.5 font-semibold text-foreground">
                      {r.totalHours ? `${r.totalHours} hrs` : "—"}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          r.status === "Present"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : r.status === "Late"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : r.status === "Half-day"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium w-fit ${
                            r.confirmation === "Confirmed"
                              ? "bg-emerald-100 text-emerald-800"
                              : r.confirmation === "Awaiting HR"
                              ? "bg-purple-100 text-purple-800"
                              : r.confirmation === "Awaiting Manager"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {r.confirmation}
                        </span>

                        {r.correction?.status === "Pending" && (
                          <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Correction requested
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {r.correction?.status === "Pending" && canApprove ? (
                          <>
                            <button
                              onClick={() => handleDecisionCorrection(r._id, true)}
                              className="rounded px-2 py-1 text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleDecisionCorrection(r._id, false)}
                              className="rounded px-2 py-1 text-[11px] font-semibold bg-red-600 text-white hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </>
                        ) : r.confirmation !== "Confirmed" && canApprove ? (
                          <button
                            onClick={() => handleAdvance(r._id)}
                            className="rounded px-2 py-1 text-[11px] font-semibold border border-primary text-primary hover:bg-primary/10 transition inline-flex items-center gap-1"
                          >
                            Advance <ArrowRight className="h-3 w-3" />
                          </button>
                        ) : null}

                        <button
                          onClick={() => {
                            setSelectedRecord(r);
                            setReqCheckIn(r.checkIn || "09:00");
                            setReqCheckOut(r.checkOut || "18:00");
                          }}
                          className="rounded px-2 py-1 text-[11px] font-medium border border-border text-foreground hover:bg-muted"
                        >
                          Regularize
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Regularize Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-base font-bold text-foreground">Attendance Regularization</h3>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Requesting correction for <strong className="text-foreground">{selectedRecord.employeeName}</strong> on {selectedRecord.date}.
            </p>

            <form onSubmit={submitCorrection} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Correct Check-in</label>
                  <input
                    type="time"
                    required
                    value={reqCheckIn}
                    onChange={(e) => setReqCheckIn(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Correct Check-out</label>
                  <input
                    type="time"
                    required
                    value={reqCheckOut}
                    onChange={(e) => setReqCheckOut(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Reason for Regularization *</label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Biometric device failed to register punch / client on-site visit…"
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-xs focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-70"
                >
                  {submitting ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
