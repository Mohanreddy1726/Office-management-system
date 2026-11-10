"use client";

import { useState, useEffect } from "react";
import { Banknote, Play, CheckCircle2, Lock, ArrowRight, FileSpreadsheet, Eye } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface PayrollClientProps {
  currentRole: string;
}

export function PayrollClient({ currentRole }: PayrollClientProps) {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [run, setRun] = useState<any>(null);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [isEmployee, setIsEmployee] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  // Payslip detail modal
  const [activePayslip, setActivePayslip] = useState<any | null>(null);

  const fetchPayroll = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll?period=${period}`);
      const data = await res.json();
      if (data.success) {
        setIsEmployee(data.isEmployee);
        setRun(data.run);
        setPayslips(data.payslips || []);
      }
    } catch {
      toast.error("Failed to load payroll data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayroll();
  }, [period]);

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to calculate payroll");

      toast.success(`Payroll calculated for ${data.run.headcount} employees!`);
      fetchPayroll();
    } catch (err: any) {
      toast.error(err.message || "Calculation failed");
    } finally {
      setCalculating(false);
    }
  };

  const handleTransition = async (action: "approve" | "lock" | "record_payment") => {
    if (!run) return;
    try {
      const res = await fetch("/api/payroll", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: run.runId,
          action,
          reference: action === "record_payment" ? `NEFT-BATCH-${Date.now().toString().slice(-6)}` : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");

      toast.success(`Payroll moved to ${data.run.status}`);
      fetchPayroll();
    } catch (err: any) {
      toast.error(err.message || "Failed to update payroll status");
    }
  };

  const isHR = currentRole === "super_admin" || currentRole === "hr_admin";

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" /> {isEmployee ? "My Payslips & Compensation" : "Payroll Processing"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isEmployee
              ? "View monthly payslips, earnings, and statutory tax deductions."
              : "End-to-end payroll runs, Indian statutory deductions (EPF, PT, TDS), and disbursement registry."}
          </p>
        </div>

        {!isEmployee && (
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground focus:outline-none shadow-xs"
            />

            {isHR && (
              <button
                onClick={handleCalculate}
                disabled={calculating || (run && (run.status === "Approved" || run.status === "Locked"))}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition disabled:opacity-50"
              >
                <Play className="h-4 w-4" /> {calculating ? "Calculating…" : "Run Calculations"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Admin Run Lifecycle & Summary */}
      {!isEmployee && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">
                  Payroll Cycle: {period}
                </h3>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                    run?.status === "Payment Recorded"
                      ? "bg-emerald-100 text-emerald-800"
                      : run?.status === "Locked"
                      ? "bg-purple-100 text-purple-800"
                      : run?.status === "Approved"
                      ? "bg-blue-100 text-blue-800"
                      : run?.status === "Calculated"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {run?.status || "Not Started"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Headquarters Workforce ({run?.headcount || 0} employees)
              </p>
            </div>

            {/* Workflow Action Buttons */}
            {isHR && run && (
              <div className="flex items-center gap-2">
                {run.status === "Calculated" && (
                  <button
                    onClick={() => handleTransition("approve")}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Approve Run
                  </button>
                )}
                {run.status === "Approved" && (
                  <button
                    onClick={() => handleTransition("lock")}
                    className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-purple-700"
                  >
                    <Lock className="h-4 w-4" /> Lock Attendance & Run
                  </button>
                )}
                {run.status === "Locked" && (
                  <button
                    onClick={() => handleTransition("record_payment")}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
                  >
                    <Banknote className="h-4 w-4" /> Record NEFT Payout
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
              <span className="text-xs font-semibold text-muted-foreground">Total Gross Pay</span>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {formatCurrency(run?.totalGross || 0)}
              </p>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-100 p-4">
              <span className="text-xs font-semibold text-red-700">Total Deductions (PF/PT/TDS)</span>
              <p className="mt-1 text-2xl font-bold text-red-800">
                {formatCurrency(run?.totalDeductions || 0)}
              </p>
            </div>
            <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-4">
              <span className="text-xs font-semibold text-indigo-700">Employer EPF (12%)</span>
              <p className="mt-1 text-2xl font-bold text-indigo-800">
                {formatCurrency(run?.employerContributions || 0)}
              </p>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4">
              <span className="text-xs font-semibold text-emerald-700">Total Net Disbursement</span>
              <p className="mt-1 text-2xl font-bold text-emerald-800">
                {formatCurrency(run?.totalNet || 0)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Salary Register / Payslips Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="flex items-center justify-between border-b border-border p-4 bg-muted/30">
          <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            {isEmployee ? "Your Historical Payslips" : "Salary Register & Payslips"}
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground font-semibold">
              <tr>
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-5 py-3.5">Period</th>
                <th className="px-5 py-3.5 text-right">Gross Pay</th>
                <th className="px-5 py-3.5 text-right">EPF Deduction</th>
                <th className="px-5 py-3.5 text-right">Prof. Tax</th>
                <th className="px-5 py-3.5 text-right">TDS Tax</th>
                <th className="px-5 py-3.5 text-right">Net Take-Home</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    Loading payroll records…
                  </td>
                </tr>
              ) : payslips.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    No payslips calculated for this period. Click "Run Calculations" above.
                  </td>
                </tr>
              ) : (
                payslips.map((ps) => (
                  <tr key={ps._id} className="hover:bg-muted/30 transition">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-foreground">{ps.employeeName}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{ps.employeeId}</p>
                    </td>

                    <td className="px-5 py-3.5 font-medium text-foreground">{ps.period}</td>

                    <td className="px-5 py-3.5 text-right font-medium text-foreground">
                      {formatCurrency(ps.earnings.gross)}
                    </td>

                    <td className="px-5 py-3.5 text-right text-muted-foreground">
                      {formatCurrency(ps.deductions.epf)}
                    </td>

                    <td className="px-5 py-3.5 text-right text-muted-foreground">
                      {formatCurrency(ps.deductions.professionalTax)}
                    </td>

                    <td className="px-5 py-3.5 text-right text-muted-foreground">
                      {formatCurrency(ps.deductions.tds)}
                    </td>

                    <td className="px-5 py-3.5 text-right font-bold text-emerald-700">
                      {formatCurrency(ps.netSalary)}
                    </td>

                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                          ps.status === "Paid"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {ps.status}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setActivePayslip(ps)}
                        className="rounded px-2.5 py-1 text-[11px] font-semibold border border-primary text-primary hover:bg-primary/10 transition inline-flex items-center gap-1"
                      >
                        <Eye className="h-3 w-3" /> View Payslip
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payslip View Modal */}
      {activePayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Official Payslip</h3>
                <p className="text-[11px] text-muted-foreground">Period: {activePayslip.period} • Acme Technologies</p>
              </div>
              <button
                onClick={() => setActivePayslip(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 text-xs mb-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Employee Name:</span>{" "}
                  <strong>{activePayslip.employeeName}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Employee ID:</span>{" "}
                  <strong>{activePayslip.employeeId}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Designation:</span>{" "}
                  <strong>{activePayslip.designation}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Department:</span>{" "}
                  <strong>{activePayslip.department}</strong>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              {/* Earnings */}
              <div className="border border-border rounded-lg p-3">
                <h4 className="font-bold text-foreground mb-2 pb-1 border-b border-border">Earnings</h4>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Basic Pay:</span>
                    <span>{formatCurrency(activePayslip.earnings.basic)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">HRA (House Rent):</span>
                    <span>{formatCurrency(activePayslip.earnings.hra)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Special Allowance:</span>
                    <span>{formatCurrency(activePayslip.earnings.specialAllowance)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border font-bold text-foreground">
                    <span>Total Gross:</span>
                    <span>{formatCurrency(activePayslip.earnings.gross)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div className="border border-border rounded-lg p-3">
                <h4 className="font-bold text-foreground mb-2 pb-1 border-b border-border">Deductions</h4>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">EPF (Provident Fund):</span>
                    <span>{formatCurrency(activePayslip.deductions.epf)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Professional Tax (PT):</span>
                    <span>{formatCurrency(activePayslip.deductions.professionalTax)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TDS (Income Tax):</span>
                    <span>{formatCurrency(activePayslip.deductions.tds)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border font-bold text-red-700">
                    <span>Total Deductions:</span>
                    <span>{formatCurrency(activePayslip.deductions.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Pay Callout */}
            <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-center">
              <span className="text-xs font-semibold text-emerald-800">Net Salary Take-Home</span>
              <p className="text-2xl font-extrabold text-emerald-700 mt-0.5">
                {formatCurrency(activePayslip.netSalary)}
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4 mt-4">
              <button
                onClick={() => setActivePayslip(null)}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
