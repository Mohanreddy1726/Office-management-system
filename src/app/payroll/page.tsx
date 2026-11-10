"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell";
import { useStore } from "@/lib/data/store";
import { CURRENT_PERIOD } from "@/lib/data/seed";
import { PageHeader, KpiCard, StatusBadge, ConfirmDialog } from "@/components/shared";
import { DataTable, exportCsv, type Column } from "@/components/data-table";
import { Person, useScope, useNames, Sel } from "@/components/form-bits";
import type { Employee, PayrollRun, SalaryStructure } from "@/lib/data/types";
import { inr, fmtDate } from "@/lib/format";
import { payslipFor, PayslipBreakdown } from "@/lib/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Download,
  IndianRupee,
  Lock,
  Play,
  Wallet,
  Users,
  CheckCircle2,
  XCircle,
  Plus,
  RotateCcw,
  Receipt,
  Eye,
  Printer,
  Layers,
  Table as TableIcon,
  Calendar,
  Building2,
  Sparkles,
  ShieldCheck,
  CreditCard,
  ArrowUpRight,
  Clock,
  FileText,
  BadgeAlert,
  Percent,
  Check,
  ChevronRight,
  Coins,
  MinusCircle,
  AlertTriangle,
  FileSpreadsheet,
  Landmark,
  ShieldAlert,
  Trash2,
  Edit2,
  Send,
  ArrowLeft,
  BarChart3,
  TrendingUp,
} from "lucide-react";

// Types for the custom payroll steps
interface IncentiveItem {
  id: string;
  employeeId: string;
  category: string;
  amount: number;
  reason: string;
  date: string;
}

interface DeductionItem {
  id: string;
  employeeId: string;
  category: string;
  amount: number;
  reason: string;
  date: string;
}

interface LopOverride {
  employeeId: string;
  unpaidDays: number;
  reason: string;
  status: "Calculated" | "Adjusted" | "Confirmed";
}

// Deterministic bank details generator for realistic statement
function getBankDetails(e: Employee) {
  const bankNames = ["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank", "Kotak Mahindra Bank"];
  const numId = parseInt(e.id.replace(/\D/g, "")) || 1000;
  const bankName = bankNames[numId % bankNames.length];
  const last4 = e.bankLast4 ?? String(1000 + (numId % 9000));
  const accNo = `501004${String(numId).padStart(4, "0")}${last4}`;
  const ifsc =
    bankName === "HDFC Bank"
      ? "HDFC0001844"
      : bankName === "ICICI Bank"
      ? "ICIC0000047"
      : bankName === "State Bank of India"
      ? "SBIN0001234"
      : bankName === "Axis Bank"
      ? "UTIB0000123"
      : "KKBK0000456";

  return { bankName, accNo, ifsc };
}

export default function PayrollPage() {
  const { data, me, advancePayroll, reopenPayroll, createPayrollRun } = useStore();
  const { isEmployee, uid, role, isAdmin } = useScope();
  const nameOf = useNames();

  // 5-Stage Payroll Workflow as requested:
  // 1: Salary Structures Verification -> 2: Incentives -> 3: Misc Deductions -> 4: Loss of Pay (LOP) -> 5: Final Bank Statement
  type StepKey = "structures" | "incentives" | "deductions" | "lop" | "bank-statement" | "runs";
  const [currentStep, setCurrentStep] = useState<StepKey>("structures");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  // Default to showing only Payroll Overview & Statistics until HR initiates the monthly pay run
  const [payrunMode, setPayrunMode] = useState<"dashboard" | "wizard">("dashboard");

  // State for active period
  const activePeriod = CURRENT_PERIOD; // "2026-10"
  const currentRun = data.payrollRuns.find((p) => p.period === activePeriod);

  // 1. Verified Structures Tracking (Set of employee IDs whose structure is verified)
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(() => {
    // Default: mark all active employees as verified from onboarding
    return new Set(data.employees.filter((e) => e.status !== "Inactive").map((e) => e.id));
  });

  // 2. Incentives State
  const [incentives, setIncentives] = useState<IncentiveItem[]>([]);

  // 3. Misc Deductions State
  const [miscDeductions, setMiscDeductions] = useState<DeductionItem[]>([]);

  // 4. LOP State (Loss of Pay based on unpaid leaves or absence)
  const [lopRecords, setLopRecords] = useState<Record<string, LopOverride>>({});

  // Dialog and search state
  const [q, setQ] = useState("");
  const [slip, setSlip] = useState<{ e: Employee; period: string } | null>(null);
  const [addIncentiveOpen, setAddIncentiveOpen] = useState(false);
  const [addDeductionOpen, setAddDeductionOpen] = useState(false);
  const [adjustLopOpen, setAdjustLopOpen] = useState<Employee | null>(null);
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);

  // Eligible employees
  const eligible = useMemo(
    () => data.employees.filter((e) => e.status !== "Inactive" && e.status !== "Resigned"),
    [data.employees]
  );

  const filteredEmployees = useMemo(() => {
    return eligible.filter((e) => {
      const matchQ =
        !q ||
        e.name.toLowerCase().includes(q.toLowerCase()) ||
        e.department.toLowerCase().includes(q.toLowerCase()) ||
        e.id.toLowerCase().includes(q.toLowerCase());
      return matchQ;
    });
  }, [eligible, q]);

  // Calculations per employee
  const payrollItems = useMemo(() => {
    return eligible.map((e) => {
      const empIncentives = incentives.filter((i) => i.employeeId === e.id);
      const totalIncentives = empIncentives.reduce((s, i) => s + i.amount, 0);

      const empDeductions = miscDeductions.filter((d) => d.employeeId === e.id);
      const totalMiscDed = empDeductions.reduce((s, d) => s + d.amount, 0);

      const unpaidDays = lopRecords[e.id]?.unpaidDays ?? 0;
      const breakdown = payslipFor(e, data.salaryStructures, unpaidDays, totalIncentives, totalMiscDed);
      const bank = getBankDetails(e);

      return {
        employee: e,
        bank,
        incentives: empIncentives,
        totalIncentives,
        deductions: empDeductions,
        totalMiscDed,
        unpaidDays,
        breakdown,
        isVerified: verifiedIds.has(e.id),
      };
    });
  }, [eligible, incentives, miscDeductions, lopRecords, verifiedIds, data.salaryStructures]);

  // Aggregate metrics
  const totalBaseGross = payrollItems.reduce((s, p) => s + p.employee.monthlyGross, 0);
  const totalIncentivesSum = payrollItems.reduce((s, p) => s + p.totalIncentives, 0);
  const totalMiscDedSum = payrollItems.reduce((s, p) => s + p.totalMiscDed, 0);
  const totalLopSum = payrollItems.reduce((s, p) => s + p.breakdown.lop, 0);
  const totalPtTdsSum = payrollItems.reduce((s, p) => s + (p.breakdown.pt + p.breakdown.tds), 0);
  const totalNetPayout = payrollItems.reduce((s, p) => s + p.breakdown.net, 0);

  // Workflow steps navigation definition
  const steps: { key: StepKey; num: number; label: string; badge?: string }[] = [
    { key: "structures", num: 1, label: "Salary Structures", badge: `${verifiedIds.size}/${eligible.length}` },
    { key: "incentives", num: 2, label: "Incentives & Bonuses", badge: `+${inr(totalIncentivesSum, { compact: true })}` },
    { key: "deductions", num: 3, label: "Misc Deductions", badge: `-${inr(totalMiscDedSum, { compact: true })}` },
    { key: "lop", num: 4, label: "Loss of Pay (LOP)", badge: `-${inr(totalLopSum, { compact: true })}` },
    { key: "bank-statement", num: 5, label: "Final Bank Statement", badge: inr(totalNetPayout, { compact: true }) },
  ];

  // Department-wise payroll breakdown for statistics dashboard
  const departmentStats = useMemo(() => {
    const map: Record<string, { count: number; totalGross: number; totalNet: number }> = {};
    payrollItems.forEach((p) => {
      const dept = p.employee.department || "Other";
      if (!map[dept]) map[dept] = { count: 0, totalGross: 0, totalNet: 0 };
      map[dept].count += 1;
      map[dept].totalGross += p.employee.monthlyGross;
      map[dept].totalNet += p.breakdown.net;
    });
    return Object.entries(map)
      .map(([name, val]) => ({
        name,
        count: val.count,
        totalGross: val.totalGross,
        totalNet: val.totalNet,
        pct: totalNetPayout > 0 ? Math.round((val.totalNet / totalNetPayout) * 100) : 0,
      }))
      .sort((a, b) => b.totalNet - a.totalNet);
  }, [payrollItems, totalNetPayout]);

  // Salary distribution brackets for statistics dashboard
  const salaryBrackets = useMemo(() => {
    let under50 = 0;
    let between50And100 = 0;
    let between100And200 = 0;
    let above200 = 0;
    eligible.forEach((e) => {
      if (e.monthlyGross < 50000) under50++;
      else if (e.monthlyGross <= 100000) between50And100++;
      else if (e.monthlyGross <= 200000) between100And200++;
      else above200++;
    });
    const total = eligible.length || 1;
    return [
      { label: "< ₹50,000", count: under50, pct: Math.round((under50 / total) * 100), desc: "Junior & Support Roles" },
      { label: "₹50k – ₹1 Lakh", count: between50And100, pct: Math.round((between50And100 / total) * 100), desc: "Mid-level Staff & Analysts" },
      { label: "₹1 Lakh – ₹2 Lakh", count: between100And200, pct: Math.round((between100And200 / total) * 100), desc: "Senior Staff & Tech Leads" },
      { label: "> ₹2 Lakh", count: above200, pct: Math.round((above200 / total) * 100), desc: "Leadership & Executives" },
    ];
  }, [eligible]);

  // Employee Self-Service View (if regular employee)
  if (isEmployee) {
    const self = data.employees.find((e) => e.id === uid);
    const selfItem = payrollItems.find((p) => p.employee.id === uid);

    return (
      <AppShell>
        <div className="space-y-6">
          <PageHeader
            title="My Payslips & Compensation"
            description="View your verified salary structure, performance incentives, absence deductions, and monthly bank transfer details."
          />

          {self && (
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <KpiCard
                label="Base Monthly Gross"
                value={inr(self.monthlyGross)}
                icon={<Wallet className="h-4 w-4 text-primary" />}
                hint="Fixed compensation structure"
              />
              <KpiCard
                label="Current Month Incentives"
                value={inr(selfItem?.totalIncentives ?? 0)}
                icon={<Sparkles className="h-4 w-4 text-emerald-600" />}
                hint="Performance & sales bonuses"
              />
              <KpiCard
                label="Net In-Hand Salary"
                value={inr(selfItem?.breakdown.net ?? self.monthlyGross)}
                icon={<IndianRupee className="h-4 w-4 text-emerald-600" />}
                hint="Zero PF & ESI deducted"
              />
              <KpiCard
                label="Salary Account"
                value={selfItem?.bank.bankName ?? "HDFC Bank"}
                icon={<Landmark className="h-4 w-4 text-blue-500" />}
                hint={`A/c •••• ${selfItem?.bank.accNo.slice(-4) ?? "1234"}`}
              />
            </div>
          )}

          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground text-base">October 2026 Salary Statement</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verified salary calculation with zero PF/ESI deductions
                </p>
              </div>
              {self && (
                <Button
                  size="sm"
                  className="gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                  onClick={() => setSlip({ e: self, period: activePeriod })}
                >
                  <Receipt className="h-3.5 w-3.5" /> View Formal Payslip
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl bg-muted/30 p-4 text-xs">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Base Earnings</span>
                <span className="font-bold text-foreground text-sm">{inr(self?.monthlyGross ?? 0)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Incentives (+)</span>
                <span className="font-bold text-emerald-600 text-sm">{inr(selfItem?.totalIncentives ?? 0)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Total Deductions (-)</span>
                <span className="font-bold text-rose-600 text-sm">
                  {inr((selfItem?.totalMiscDed ?? 0) + (selfItem?.breakdown.lop ?? 0) + (selfItem?.breakdown.pt ?? 0))}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Net Bank Transfer</span>
                <span className="font-bold text-emerald-600 text-base">{inr(selfItem?.breakdown.net ?? 0)}</span>
              </div>
            </div>
          </div>

          <PayslipDialog
            slip={slip}
            onClose={() => setSlip(null)}
            payrollItem={slip ? payrollItems.find((p) => p.employee.id === slip.e.id) : null}
          />
        </div>
      </AppShell>
    );
  }

  // --------------------------------------------------------------------------
  // Admin & HR: State 1 - Payroll Statistics & Overview (Default View)
  // --------------------------------------------------------------------------
  if (payrunMode === "dashboard") {
    return (
      <AppShell>
        <div className="space-y-6">
          <PageHeader
            title="Payroll Overview & Statistics"
            description="Company-wide compensation statistics, departmental expenditures, statutory compliance, and monthly pay run audit records."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
                  onClick={() => {
                    setPayrunMode("wizard");
                    setCurrentStep("structures");
                  }}
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  {currentRun?.status === "Payment Recorded" ? "Revisit October 2026 Pay Run" : "Start October 2026 Pay Run"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs font-medium"
                  onClick={() =>
                    exportCsv(
                      `payroll-history-${new Date().toISOString().slice(0, 10)}.csv`,
                      ["Period", "Headcount", "Gross Amount", "Deductions", "Net Disbursed", "Status", "Created At"],
                      data.payrollRuns.map((r) => [
                        r.period,
                        r.headcount,
                        r.gross,
                        r.employeeDeductions,
                        r.net,
                        r.status,
                        r.createdAt,
                      ])
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" /> Export History
                </Button>
              </div>
            }
          />

          {/* Top KPI Statistics Cards */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            <KpiCard
              label="Total Net Payroll"
              value={inr(totalNetPayout, { compact: true })}
              icon={<Landmark className="h-4 w-4 text-emerald-600" />}
              hint={`${activePeriod} Net Disbursement`}
            />
            <KpiCard
              label="Active Headcount"
              value={`${eligible.length} Staff`}
              icon={<Users className="h-4 w-4 text-primary" />}
              hint="100% Direct Salary Accounts"
            />
            <KpiCard
              label="Average In-Hand Pay"
              value={inr(Math.round(totalNetPayout / (eligible.length || 1)), { compact: true })}
              icon={<Wallet className="h-4 w-4 text-indigo-600" />}
              hint="Zero PF & ESI Direct Benefit"
            />
            <KpiCard
              label="Incentives & Bonuses"
              value={`+${inr(totalIncentivesSum, { compact: true })}`}
              icon={<Sparkles className="h-4 w-4 text-amber-500" />}
              hint={`${incentives.length} Awards Configured`}
            />
            <KpiCard
              label="Deductions & Taxes"
              value={`-${inr(totalMiscDedSum + totalLopSum + totalPtTdsSum, { compact: true })}`}
              icon={<MinusCircle className="h-4 w-4 text-rose-500" />}
              hint="LOP & PT (Zero PF/ESI)"
            />
          </div>

          {/* Active Pay Run Initiation Hero Banner */}
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-emerald-500/10 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Monthly Pay Run Cycle</span>
                <span className="rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{activePeriod}</span>
              </div>
              <h3 className="text-base font-bold text-foreground">
                {currentRun?.status === "Payment Recorded" ? "October 2026 Pay Run Finalized & Recorded" : "Ready to Process October 2026 Pay Run"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                {currentRun?.status === "Payment Recorded"
                  ? `Payroll payment of ${inr(totalNetPayout)} has been authorized across ${eligible.length} employees with corporate NEFT file generated. You can revisit the 5-stage audit ledger anytime.`
                  : "Start the sequential 5-stage payroll wizard: verify employee salary structures (one-time onboarding check, zero PF & ESI), configure employee incentives, apply misc deductions & LOP, and generate the final corporate NEFT bank statement."}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm gap-2"
                onClick={() => {
                  setPayrunMode("wizard");
                  setCurrentStep("structures");
                }}
              >
                <Play className="h-4 w-4 fill-current" />
                {currentRun?.status === "Payment Recorded" ? "Revisit 5-Stage Audit →" : "Start Pay Run Steps →"}
              </Button>
            </div>
          </div>

          {/* Analytics & Statistical Breakdown Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Department-wise Payroll Cost Breakdown */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-sm text-foreground">Department Payroll Allocation</h4>
                </div>
                <span className="text-xs text-muted-foreground">{departmentStats.length} Departments</span>
              </div>

              <div className="space-y-3">
                {departmentStats.map((dept) => (
                  <div key={dept.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        {dept.name}
                        <span className="text-[10px] text-muted-foreground">({dept.count} staff)</span>
                      </span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {inr(dept.totalNet)} <span className="text-[11px] text-muted-foreground font-normal">({dept.pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(dept.pct, 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Salary Brackets & Statutory Compliance */}
            <div className="space-y-4">
              {/* Salary Brackets */}
              <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    <h4 className="font-semibold text-sm text-foreground">Salary Distribution Bands</h4>
                  </div>
                  <span className="text-xs text-muted-foreground">{eligible.length} Total Staff</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {salaryBrackets.map((band) => (
                    <div key={band.label} className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{band.label}</span>
                        <span className="text-xs font-bold text-primary">{band.count}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground block">{band.desc}</span>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-1.5">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.max(band.pct, 5)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Statutory Compliance Policy Card */}
              <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <h4 className="font-semibold text-sm text-foreground">Statutory & Zero-Deduction Policy</h4>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                    Compliant
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                  <div className="rounded-xl bg-muted/30 p-2.5">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Provident Fund (PF)</span>
                    <span className="text-sm font-bold text-emerald-600">₹0 Exempt</span>
                  </div>
                  <div className="rounded-xl bg-muted/30 p-2.5">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">ESI Scheme</span>
                    <span className="text-sm font-bold text-emerald-600">₹0 Exempt</span>
                  </div>
                  <div className="rounded-xl bg-muted/30 p-2.5">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Professional Tax</span>
                    <span className="text-sm font-bold text-foreground">₹200 Flat</span>
                  </div>
                  <div className="rounded-xl bg-muted/30 p-2.5">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Payment Mode</span>
                    <span className="text-sm font-bold text-primary">100% NEFT</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pay Run History & Status Table */}
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div>
                <h4 className="font-semibold text-sm text-foreground">Monthly Pay Run History & Records</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Complete historical record of processed, locked, and disbursed monthly pay cycles.
                </p>
              </div>

              <span className="text-xs text-muted-foreground">
                Showing <strong className="text-foreground">{data.payrollRuns.length}</strong> payroll cycles
              </span>
            </div>

            <DataTable
              columns={[
                {
                  key: "period",
                  header: "Pay Period",
                  render: (r) => {
                    const d = new Date(r.period + "-01");
                    const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
                    return (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <div>
                          <span className="font-semibold text-foreground text-xs block">{label}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{r.id}</span>
                        </div>
                      </div>
                    );
                  },
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => (
                    <StatusBadge
                      status={r.status === "Payment Recorded" ? "Paid / Recorded" : r.status}
                      className={
                        r.status === "Payment Recorded"
                          ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-400"
                          : undefined
                      }
                    />
                  ),
                },
                {
                  key: "headcount",
                  header: "Staff Count",
                  render: (r) => (
                    <span className="text-xs font-medium text-foreground">
                      {r.period === activePeriod ? eligible.length : r.headcount} Employees
                    </span>
                  ),
                },
                {
                  key: "gross",
                  header: "Gross Total",
                  render: (r) => (
                    <span className="text-xs font-medium text-foreground tabular-nums">
                      {inr(r.period === activePeriod ? totalBaseGross + totalIncentivesSum : r.gross)}
                    </span>
                  ),
                },
                {
                  key: "ded",
                  header: "Deductions",
                  render: (r) => (
                    <span className="text-xs font-medium text-rose-600 tabular-nums">
                      -{inr(r.period === activePeriod ? totalMiscDedSum + totalLopSum + totalPtTdsSum : r.employeeDeductions)}
                    </span>
                  ),
                },
                {
                  key: "net",
                  header: "Net Disbursed",
                  render: (r) => (
                    <span className="text-xs font-bold text-emerald-600 tabular-nums">
                      {inr(r.period === activePeriod ? totalNetPayout : r.net)}
                    </span>
                  ),
                },
                {
                  key: "dates",
                  header: "Processed Date",
                  render: (r) => (
                    <span className="text-xs text-muted-foreground">
                      {r.paidAt ? `Paid on ${r.paidAt}` : r.createdAt ? `Created ${r.createdAt}` : "—"}
                    </span>
                  ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (r) => {
                    const isCurrent = r.period === activePeriod;
                    return (
                      <div className="flex items-center gap-1.5">
                        {isCurrent ? (
                          <Button
                            size="sm"
                            className="h-7 text-xs font-semibold gap-1 bg-primary text-primary-foreground"
                            onClick={() => {
                              setPayrunMode("wizard");
                              setCurrentStep("structures");
                            }}
                          >
                            <Play className="h-3 w-3 fill-current" />
                            {r.status === "Payment Recorded" ? "Revisit Steps" : "Start Steps"}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => {
                              exportCsv(
                                `bank-statement-${r.period}.csv`,
                                ["Employee ID", "Beneficiary Name", "Bank Name", "Account Number", "IFSC Code", "Net Amount", "Narration"],
                                payrollItems.map((p) => [
                                  p.employee.id,
                                  p.employee.name,
                                  p.bank.bankName,
                                  p.bank.accNo,
                                  p.bank.ifsc,
                                  p.breakdown.net,
                                  `Salary for ${r.period}`,
                                ])
                              );
                              toast.success(`Bank transfer statement downloaded for ${r.period}`);
                            }}
                          >
                            <Download className="h-3 w-3 text-primary" /> NEFT CSV
                          </Button>
                        )}
                      </div>
                    );
                  },
                },
              ]}
              rows={data.payrollRuns}
              rowKey={(r) => r.id}
              pageSize={10}
            />
          </div>

          <PayslipDialog
            slip={slip}
            onClose={() => setSlip(null)}
            payrollItem={slip ? payrollItems.find((p) => p.employee.id === slip.e.id) : null}
          />
        </div>
      </AppShell>
    );
  }

  // --------------------------------------------------------------------------
  // Admin & HR: State 2 - Sequential 5-Stage Payroll Processing Wizard
  // --------------------------------------------------------------------------
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="October 2026 Pay Run (5-Stage Processing)"
          description="Sequential 5-stage monthly payroll execution: Salary Structure Verification → Incentives → Misc Deductions → Loss of Pay (LOP) → Final Bank Statement."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs gap-1.5 font-medium border-border/80 hover:bg-muted"
                onClick={() => setPayrunMode("dashboard")}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Payroll Statistics
              </Button>

              <div className="flex items-center rounded-lg border border-border bg-card p-0.5 shadow-sm">
                <Button
                  size="sm"
                  variant={viewMode === "cards" ? "default" : "ghost"}
                  className="h-8 px-3 text-xs gap-1.5"
                  onClick={() => setViewMode("cards")}
                >
                  <Layers className="h-3.5 w-3.5" /> Cards
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "table" ? "default" : "ghost"}
                  className="h-8 px-3 text-xs gap-1.5"
                  onClick={() => setViewMode("table")}
                >
                  <TableIcon className="h-3.5 w-3.5" /> Table
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-medium"
                onClick={() =>
                  exportCsv(
                    `payroll-bank-statement-${activePeriod}.csv`,
                    ["Employee ID", "Beneficiary Name", "Bank Name", "Account Number", "IFSC Code", "Net Amount", "Narration"],
                    payrollItems.map((p) => [
                      p.employee.id,
                      p.employee.name,
                      p.bank.bankName,
                      p.bank.accNo,
                      p.bank.ifsc,
                      p.breakdown.net,
                      `Salary for ${activePeriod}`,
                    ])
                  )
                }
              >
                <Download className="h-3.5 w-3.5" /> Bank Transfer File (CSV)
              </Button>
            </div>
          }
        />

        {/* 5-Stage Interactive Workflow Stepper Header */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {steps.find((s) => s.key === currentStep)?.num}
              </span>
              <h3 className="font-semibold text-foreground text-sm">
                Stage {steps.find((s) => s.key === currentStep)?.num} of 5: {steps.find((s) => s.key === currentStep)?.label}
              </h3>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              No PF & ESI Deductions Policy Active
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {steps.map((s, idx) => {
              const isActive = currentStep === s.key;
              const isPast = steps.findIndex((x) => x.key === currentStep) > idx;

              return (
                <button
                  key={s.key}
                  onClick={() => setCurrentStep(s.key)}
                  className={`group relative flex flex-col text-left p-3 rounded-xl border transition-all ${
                    isActive
                      ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20"
                      : isPast
                      ? "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500"
                      : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : isPast
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isPast ? <Check className="h-3 w-3" /> : s.num}
                    </span>
                    {s.badge && (
                      <span className="text-[10px] font-semibold text-muted-foreground">{s.badge}</span>
                    )}
                  </div>
                  <span
                    className={`text-xs font-semibold leading-tight ${
                      isActive ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Top KPI Metric Cards (dynamically reflecting the workflow) */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard
            label="Total Base Gross"
            value={inr(totalBaseGross, { compact: true })}
            icon={<Wallet className="h-4 w-4 text-primary" />}
            hint={`${eligible.length} employees on payroll`}
          />
          <KpiCard
            label="Active Incentives"
            value={`+${inr(totalIncentivesSum, { compact: true })}`}
            icon={<Coins className="h-4 w-4 text-emerald-600" />}
            hint={`${incentives.length} bonuses configured`}
          />
          <KpiCard
            label="Total Deductions (LOP+Misc)"
            value={`-${inr(totalMiscDedSum + totalLopSum + totalPtTdsSum, { compact: true })}`}
            icon={<MinusCircle className="h-4 w-4 text-rose-500" />}
            hint="Zero PF/ESI • LOP & Recoveries"
          />
          <KpiCard
            label="Net Bank Transfer Total"
            value={inr(totalNetPayout, { compact: true })}
            icon={<Landmark className="h-4 w-4 text-emerald-600" />}
            hint="Final authorized payout"
          />
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* STAGE 1: SALARY STRUCTURE VERIFICATION */}
        {/* ------------------------------------------------------------------ */}
        {currentStep === "structures" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 border border-border/60 rounded-xl p-4">
              <div>
                <h4 className="font-semibold text-foreground text-sm">
                  Employee Base Salary Structures (One-Time Onboarding Setup)
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verify that every staff member has their structured base CTC and Monthly Gross configured. As per company policy,{" "}
                  <strong className="text-foreground">Provident Fund (PF) and ESI are completely exempted (₹0)</strong>.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-medium"
                  onClick={() => {
                    const allIds = new Set(eligible.map((e) => e.id));
                    setVerifiedIds(allIds);
                    toast.success("All employee salary structures confirmed");
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Verify All ({eligible.length})
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1"
                  onClick={() => setCurrentStep("incentives")}
                >
                  Next: Incentives & Bonuses <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Filter */}
            <div className="flex items-center justify-between">
              <Input
                placeholder="Search staff by name, department, role..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-9 w-72 text-xs"
              />
              <span className="text-xs text-muted-foreground">
                <strong className="text-foreground">{verifiedIds.size}</strong> of {eligible.length} structures verified
              </span>
            </div>

            {/* Cards View */}
            {viewMode === "cards" ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredEmployees.map((e) => {
                  const item = payrollItems.find((p) => p.employee.id === e.id)!;
                  const b = item.breakdown;
                  const isVerified = verifiedIds.has(e.id);
                  const initials = e.name
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  return (
                    <div
                      key={e.id}
                      className="group flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-border"
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-white shadow-sm text-sm">
                                {initials}
                              </div>
                              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-emerald-500" />
                            </div>
                            <div>
                              <Link
                                href={`/employees/${e.id}`}
                                className="group/link flex items-center gap-1 font-semibold text-foreground text-sm hover:text-primary transition"
                              >
                                {e.name}
                                <ArrowUpRight className="h-3 w-3 opacity-60 group-hover/link:opacity-100" />
                              </Link>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center rounded-md bg-purple-500/10 px-1.5 py-0.5 text-[11px] font-medium text-purple-700 dark:text-purple-300">
                                  {e.designation}
                                </span>
                                <span className="text-[11px] text-muted-foreground">{e.department}</span>
                              </div>
                            </div>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              isVerified
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            }`}
                          >
                            {isVerified ? (
                              <>
                                <Check className="h-3 w-3" /> Verified
                              </>
                            ) : (
                              "Pending"
                            )}
                          </span>
                        </div>

                        {/* 3 Metric Tiles matching user photo */}
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <div className="rounded-xl bg-muted/40 p-2 text-center">
                            <span className="text-[9px] font-semibold uppercase text-muted-foreground block tracking-wider">
                              Monthly Gross
                            </span>
                            <span className="text-xs font-bold text-foreground block mt-0.5">
                              {inr(e.monthlyGross, { compact: true })}
                            </span>
                          </div>
                          <div className="rounded-xl bg-muted/40 p-2 text-center">
                            <span className="text-[9px] font-semibold uppercase text-muted-foreground block tracking-wider">
                              Basic (40-50%)
                            </span>
                            <span className="text-xs font-bold text-foreground block mt-0.5">
                              {inr(b.basic, { compact: true })}
                            </span>
                          </div>
                          <div className="rounded-xl bg-muted/40 p-2 text-center">
                            <span className="text-[9px] font-semibold uppercase text-muted-foreground block tracking-wider">
                              PF / ESI
                            </span>
                            <span className="text-xs font-bold text-emerald-600 block mt-0.5">
                              ₹0 (Exempt)
                            </span>
                          </div>
                        </div>

                        {/* Breakdown pills */}
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-2.5">
                          <span>HRA: <strong className="text-foreground">{inr(b.hra)}</strong></span>
                          <span>Special: <strong className="text-foreground">{inr(b.special)}</strong></span>
                          <span>Structure: <strong className="text-primary">{e.salaryStructureId ?? "Standard"}</strong></span>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="mt-4 border-t border-border/60 pt-3 flex items-center justify-between">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setSlip({ e, period: activePeriod })}
                        >
                          <Eye className="h-3 w-3 mr-1" /> View Structure Slip
                        </Button>

                        <Button
                          size="sm"
                          variant={isVerified ? "outline" : "default"}
                          className={`h-7 text-xs ${
                            isVerified ? "text-emerald-700 border-emerald-500/30" : "bg-primary text-primary-foreground"
                          }`}
                          onClick={() => {
                            const next = new Set(verifiedIds);
                            if (isVerified) next.delete(e.id);
                            else next.add(e.id);
                            setVerifiedIds(next);
                            toast.success(isVerified ? "Structure marked pending" : "Structure verified");
                          }}
                        >
                          {isVerified ? "Verified ✓" : "Verify Structure"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <DataTable
                columns={[
                  { key: "e", header: "Employee", render: (r) => <Person id={r.employee.id} /> },
                  { key: "d", header: "Department", render: (r) => r.employee.department },
                  { key: "g", header: "Base Monthly Gross", render: (r) => inr(r.employee.monthlyGross) },
                  { key: "b", header: "Basic Salary", render: (r) => inr(r.breakdown.basic) },
                  { key: "h", header: "HRA", render: (r) => inr(r.breakdown.hra) },
                  { key: "pf", header: "PF & ESI", render: () => <span className="text-emerald-600 font-semibold">₹0 (Exempt)</span> },
                  {
                    key: "st",
                    header: "Status",
                    render: (r) => (
                      <span className="font-semibold text-emerald-600">
                        {r.isVerified ? "Verified ✓" : "Pending"}
                      </span>
                    ),
                  },
                ]}
                rows={payrollItems}
                rowKey={(r) => r.employee.id}
              />
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STAGE 2: INCENTIVES & BONUSES */}
        {/* ------------------------------------------------------------------ */}
        {currentStep === "incentives" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 border border-border/60 rounded-xl p-4">
              <div>
                <h4 className="font-semibold text-foreground text-sm">
                  Employee Performance Incentives & Variable Bonuses
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  HR and managers can allocate discretionary incentives, milestone bonuses, and sales commissions for October 2026.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1"
                  onClick={() => setAddIncentiveOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Incentive
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-medium gap-1"
                  onClick={() => setCurrentStep("deductions")}
                >
                  Next: Misc Deductions <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Active Incentives Table / Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {incentives.map((inc) => {
                const emp = data.employees.find((e) => e.id === inc.employeeId);
                const initials = (emp?.name ?? inc.employeeId)
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                return (
                  <div
                    key={inc.id}
                    className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 font-bold text-sm">
                            {initials}
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground text-sm">{emp?.name ?? inc.employeeId}</h4>
                            <p className="text-[11px] text-muted-foreground">
                              {emp?.department} • Added {fmtDate(inc.date)}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600">
                          +{inr(inc.amount)}
                        </span>
                      </div>

                      {/* 3 Metric Tiles for Incentive */}
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-muted/40 p-2 text-center col-span-2">
                          <span className="text-[9px] font-semibold uppercase text-muted-foreground block">
                            Incentive Category
                          </span>
                          <span className="text-xs font-bold text-foreground block mt-0.5 truncate">
                            {inc.category}
                          </span>
                        </div>
                        <div className="rounded-xl bg-emerald-500/10 p-2 text-center">
                          <span className="text-[9px] font-semibold uppercase text-emerald-700 block">Payout</span>
                          <span className="text-xs font-bold text-emerald-600 block mt-0.5 truncate">
                            {inr(inc.amount, { compact: true })}
                          </span>
                        </div>
                      </div>

                      {/* Reason */}
                      <div className="mt-3 rounded-lg bg-muted/30 p-2.5 text-xs text-foreground/80 italic border border-border/40">
                        "{inc.reason}"
                      </div>
                    </div>

                    <div className="mt-4 border-t border-border/60 pt-3 flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Ref: {inc.id}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-rose-600 hover:bg-rose-50 gap-1"
                        onClick={() => {
                          setIncentives((prev) => prev.filter((x) => x.id !== inc.id));
                          toast.error("Incentive entry deleted");
                        }}
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STAGE 3: MISC DEDUCTIONS */}
        {/* ------------------------------------------------------------------ */}
        {currentStep === "deductions" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 border border-border/60 rounded-xl p-4">
              <div>
                <h4 className="font-semibold text-foreground text-sm">
                  Employee Miscellaneous Deductions & Recoveries
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Record company recoveries such as salary advance installments, damaged equipment costs, or transport passes.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1"
                  onClick={() => setAddDeductionOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Misc Deduction
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-medium gap-1"
                  onClick={() => setCurrentStep("lop")}
                >
                  Next: Loss of Pay (LOP) <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Deductions Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {miscDeductions.map((ded) => {
                const emp = data.employees.find((e) => e.id === ded.employeeId);
                const initials = (emp?.name ?? ded.employeeId)
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                return (
                  <div
                    key={ded.id}
                    className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 font-bold text-sm">
                            {initials}
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground text-sm">{emp?.name ?? ded.employeeId}</h4>
                            <p className="text-[11px] text-muted-foreground">
                              {emp?.department} • Added {fmtDate(ded.date)}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-bold text-rose-600">
                          -{inr(ded.amount)}
                        </span>
                      </div>

                      {/* 3 Metric Tiles for Deduction */}
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-muted/40 p-2 text-center col-span-2">
                          <span className="text-[9px] font-semibold uppercase text-muted-foreground block">
                            Deduction Type
                          </span>
                          <span className="text-xs font-bold text-foreground block mt-0.5 truncate">
                            {ded.category}
                          </span>
                        </div>
                        <div className="rounded-xl bg-rose-500/10 p-2 text-center">
                          <span className="text-[9px] font-semibold uppercase text-rose-700 block">Withheld</span>
                          <span className="text-xs font-bold text-rose-600 block mt-0.5 truncate">
                            {inr(ded.amount, { compact: true })}
                          </span>
                        </div>
                      </div>

                      {/* Reason */}
                      <div className="mt-3 rounded-lg bg-muted/30 p-2.5 text-xs text-foreground/80 italic border border-border/40">
                        "{ded.reason}"
                      </div>
                    </div>

                    <div className="mt-4 border-t border-border/60 pt-3 flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Ref: {ded.id}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-rose-600 hover:bg-rose-50 gap-1"
                        onClick={() => {
                          setMiscDeductions((prev) => prev.filter((x) => x.id !== ded.id));
                          toast.error("Deduction entry removed");
                        }}
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STAGE 4: LOSS OF PAY (LOP) */}
        {/* ------------------------------------------------------------------ */}
        {currentStep === "lop" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 border border-border/60 rounded-xl p-4">
              <div>
                <h4 className="font-semibold text-foreground text-sm">
                  Loss of Pay (LOP) Review & Unpaid Absence Reconciliation
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Calculated automatically: <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">Daily Rate = Monthly Gross / 30</code>. HR can adjust days or waive LOP before final payout.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1"
                  onClick={() => setCurrentStep("bank-statement")}
                >
                  Generate Final Bank Statement <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* LOP Employee Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {payrollItems.map((p) => {
                const e = p.employee;
                const perDay = Math.round(e.monthlyGross / 30);
                const lopAmount = p.breakdown.lop;
                const unpaidDays = p.unpaidDays;
                const paidDays = 30 - unpaidDays;
                const paidPct = Math.round((paidDays / 30) * 100);

                const initials = e.name
                  .split(" ")
                  .map((x) => x[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                return (
                  <div
                    key={e.id}
                    className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 font-bold text-sm">
                            {initials}
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground text-sm">{e.name}</h4>
                            <p className="text-[11px] text-muted-foreground">
                              {e.designation} • {e.department}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            unpaidDays > 0 ? "bg-amber-500/10 text-amber-700" : "bg-emerald-500/10 text-emerald-700"
                          }`}
                        >
                          {unpaidDays > 0 ? `${unpaidDays} LOP Days` : "Zero LOP (Full)"}
                        </span>
                      </div>

                      {/* 3 Metric Tiles for LOP */}
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-muted/40 p-2 text-center">
                          <span className="text-[9px] font-semibold uppercase text-muted-foreground block">
                            Daily Rate
                          </span>
                          <span className="text-xs font-bold text-foreground block mt-0.5">
                            {inr(perDay)}
                          </span>
                        </div>
                        <div className="rounded-xl bg-muted/40 p-2 text-center">
                          <span className="text-[9px] font-semibold uppercase text-muted-foreground block">
                            Paid Days
                          </span>
                          <span className="text-xs font-bold text-foreground block mt-0.5">
                            {paidDays}/30
                          </span>
                        </div>
                        <div className="rounded-xl bg-rose-500/10 p-2 text-center">
                          <span className="text-[9px] font-semibold uppercase text-rose-700 block">LOP Total</span>
                          <span className="text-xs font-bold text-rose-600 block mt-0.5">
                            {inr(lopAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Paid days ratio bar */}
                      <div className="mt-4 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Payable Attendance Ratio</span>
                          <span className="font-semibold text-foreground">{paidPct}% Paid</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${paidPct}%` }}
                          />
                        </div>
                      </div>

                      {lopRecords[e.id]?.reason && (
                        <p className="mt-3 text-[11px] text-muted-foreground italic bg-muted/20 p-2 rounded">
                          Note: "{lopRecords[e.id].reason}"
                        </p>
                      )}
                    </div>

                    <div className="mt-4 border-t border-border/60 pt-3 flex items-center justify-between">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs font-medium gap-1"
                        onClick={() => setAdjustLopOpen(e)}
                      >
                        <Edit2 className="h-3 w-3" /> Adjust LOP Days
                      </Button>

                      <span className="text-xs text-muted-foreground">
                        {unpaidDays > 0 ? `Deduction: -${inr(lopAmount)}` : "Regular Pay"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STAGE 5: FINAL BANK STATEMENT & PAYOUT FILE */}
        {/* ------------------------------------------------------------------ */}
        {currentStep === "bank-statement" && (
          <div className="space-y-6">
            {/* Header Notification Banner */}
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-card to-emerald-500/5 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white font-bold text-xs">
                    ✓
                  </span>
                  <h3 className="font-bold text-foreground text-base tracking-tight">
                    October 2026 Final Bank Statement Ready
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                  All 4 confirmation stages completed (Salary Structures verified, Incentives calculated, Misc Deductions reconciled, and Loss of Pay confirmed). Ready for corporate bank execution.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs font-medium bg-card"
                  onClick={() => {
                    exportCsv(
                      `bank-neft-transfer-${activePeriod}.csv`,
                      ["Beneficiary Name", "Account Number", "Bank Name", "IFSC Code", "Amount (INR)", "Payment Mode", "Narration"],
                      payrollItems.map((p) => [
                        p.employee.name,
                        p.bank.accNo,
                        p.bank.bankName,
                        p.bank.ifsc,
                        p.breakdown.net,
                        "NEFT",
                        `Salary for ${activePeriod}`,
                      ])
                    );
                    toast.success("Corporate NEFT transfer file downloaded");
                  }}
                >
                  <Download className="h-3.5 w-3.5 text-primary" /> Download Bank NEFT File
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs font-medium bg-card"
                  onClick={() => setPayrunMode("dashboard")}
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Return to Overview
                </Button>

                <Button
                  size="sm"
                  className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  onClick={() => setLockConfirmOpen(true)}
                >
                  <Lock className="h-3.5 w-3.5" /> Lock & Authorize Bank Transfer
                </Button>
              </div>
            </div>

            {/* Bank Statement Data Cards / Table */}
            {viewMode === "cards" ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {payrollItems.map((p) => {
                  const e = p.employee;
                  const b = p.breakdown;
                  const bank = p.bank;
                  const initials = e.name
                    .split(" ")
                    .map((x) => x[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  return (
                    <div
                      key={e.id}
                      className="group flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-border"
                    >
                      <div>
                        {/* Header matching user reference image */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-white shadow-sm text-sm">
                                {initials}
                              </div>
                              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-emerald-500" />
                            </div>
                            <div>
                              <Link
                                href={`/employees/${e.id}`}
                                className="group/link flex items-center gap-1 font-semibold text-foreground text-sm hover:text-primary transition"
                              >
                                {e.name}
                                <ArrowUpRight className="h-3 w-3 opacity-60 group-hover/link:opacity-100" />
                              </Link>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center rounded-md bg-purple-500/10 px-1.5 py-0.5 text-[11px] font-medium text-purple-700 dark:text-purple-300">
                                  {e.designation}
                                </span>
                                <span className="text-[11px] text-muted-foreground">{e.department}</span>
                              </div>
                            </div>
                          </div>

                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                            Authorized
                          </span>
                        </div>

                        {/* Beneficiary Bank Account Pill */}
                        <div className="mt-3 rounded-xl border border-border/60 bg-muted/20 p-2.5 text-xs flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-foreground block">{bank.bankName}</span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              A/c: •••• {bank.accNo.slice(-4)} • IFSC: {bank.ifsc}
                            </span>
                          </div>
                          <Landmark className="h-4 w-4 text-primary" />
                        </div>

                        {/* 3 Metric Tiles */}
                        <div className="mt-3.5 grid grid-cols-3 gap-2">
                          <div className="rounded-xl bg-muted/40 p-2 text-center">
                            <span className="text-[9px] font-semibold uppercase text-muted-foreground block tracking-wider">
                              Base + Bonus
                            </span>
                            <span className="text-xs font-bold text-foreground block mt-0.5">
                              {inr(b.gross, { compact: true })}
                            </span>
                          </div>
                          <div className="rounded-xl bg-rose-500/10 p-2 text-center">
                            <span className="text-[9px] font-semibold uppercase text-rose-700 block tracking-wider">
                              Deductions
                            </span>
                            <span className="text-xs font-bold text-rose-600 block mt-0.5">
                              -{inr(b.totalDeductions, { compact: true })}
                            </span>
                          </div>
                          <div className="rounded-xl bg-emerald-500/10 p-2 text-center">
                            <span className="text-[9px] font-semibold uppercase text-emerald-700 block tracking-wider">
                              Net Payable
                            </span>
                            <span className="text-xs font-bold text-emerald-600 block mt-0.5">
                              {inr(b.net, { compact: true })}
                            </span>
                          </div>
                        </div>

                        {/* Formula summary */}
                        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/60 pt-2">
                          <span>Base: {inr(e.monthlyGross)}</span>
                          {p.totalIncentives > 0 && <span className="text-emerald-600">+{inr(p.totalIncentives)} inc</span>}
                          {b.lop > 0 && <span className="text-rose-600">-{inr(b.lop)} LOP</span>}
                          {p.totalMiscDed > 0 && <span className="text-amber-600">-{inr(p.totalMiscDed)} ded</span>}
                        </div>
                      </div>

                      {/* Card Bottom */}
                      <div className="mt-4 border-t border-border/60 pt-3 flex items-center justify-between">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs font-medium gap-1 text-primary hover:bg-primary/5 border-primary/30"
                          onClick={() => setSlip({ e, period: activePeriod })}
                        >
                          <Receipt className="h-3 w-3" /> View Payslip
                        </Button>

                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground block uppercase">Bank Credit</span>
                          <span className="font-bold text-sm text-emerald-600">{inr(b.net)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <DataTable
                columns={[
                  { key: "e", header: "Beneficiary Employee", render: (r) => <Person id={r.employee.id} /> },
                  { key: "b", header: "Bank Name", render: (r) => r.bank.bankName },
                  { key: "acc", header: "Account Number", render: (r) => <span className="font-mono text-xs">{r.bank.accNo}</span> },
                  { key: "ifsc", header: "IFSC Code", render: (r) => <span className="font-mono text-xs">{r.bank.ifsc}</span> },
                  { key: "bg", header: "Base Gross", render: (r) => inr(r.employee.monthlyGross) },
                  { key: "inc", header: "Incentives (+)", render: (r) => r.totalIncentives > 0 ? <span className="text-emerald-600 font-medium">+{inr(r.totalIncentives)}</span> : "—" },
                  { key: "lop", header: "LOP (-)", render: (r) => r.breakdown.lop > 0 ? <span className="text-rose-600 font-medium">-{inr(r.breakdown.lop)}</span> : "—" },
                  { key: "ded", header: "Misc Ded (-)", render: (r) => r.totalMiscDed > 0 ? <span className="text-amber-600 font-medium">-{inr(r.totalMiscDed)}</span> : "—" },
                  { key: "net", header: "Final Net Payable", render: (r) => <span className="font-bold text-emerald-600">{inr(r.breakdown.net)}</span> },
                  {
                    key: "slip",
                    header: "",
                    render: (r) => (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setSlip({ e: r.employee, period: activePeriod })}
                      >
                        Payslip
                      </Button>
                    ),
                  },
                ]}
                rows={payrollItems}
                rowKey={(r) => r.employee.id}
                pageSize={15}
              />
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* DIALOG 1: Add Incentive Modal */}
        {/* ------------------------------------------------------------------ */}
        <Dialog open={addIncentiveOpen} onOpenChange={setAddIncentiveOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Allocate Employee Incentive / Bonus</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const empId = (form.elements.namedItem("empId") as HTMLSelectElement).value;
                const category = (form.elements.namedItem("category") as HTMLInputElement).value;
                const amount = parseFloat((form.elements.namedItem("amount") as HTMLInputElement).value) || 0;
                const reason = (form.elements.namedItem("reason") as HTMLTextAreaElement).value;

                if (!empId || amount <= 0) {
                  toast.error("Please select an employee and enter a valid incentive amount");
                  return;
                }

                setIncentives((prev) => [
                  {
                    id: `INC-${Date.now()}`,
                    employeeId: empId,
                    category,
                    amount,
                    reason,
                    date: new Date().toISOString().slice(0, 10),
                  },
                  ...prev,
                ]);

                toast.success(`Incentive of ₹${amount} added for employee`);
                setAddIncentiveOpen(false);
              }}
              className="space-y-4 pt-2"
            >
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Select Employee</label>
                <select
                  name="empId"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  required
                >
                  {eligible.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.id} • {e.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Incentive Category</label>
                <select
                  name="category"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  required
                >
                  <option value="Performance Incentive">Performance Incentive</option>
                  <option value="Sales Commission">Sales Revenue Commission</option>
                  <option value="Milestone Bonus">Milestone Project Bonus</option>
                  <option value="CSAT Excellence Award">CSAT Excellence Award</option>
                  <option value="Referral Bonus">Employee Referral Bonus</option>
                  <option value="Festival Bonus">Festival / Annual Bonus</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Incentive Amount (₹)</label>
                <Input name="amount" type="number" placeholder="10000" className="h-9 text-xs" required />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Justification / Reason</label>
                <Textarea
                  name="reason"
                  placeholder="e.g. Successfully finalized Q3 enterprise deployment..."
                  className="text-xs min-h-[70px]"
                  required
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setAddIncentiveOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-primary text-primary-foreground">
                  Confirm Incentive
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ------------------------------------------------------------------ */}
        {/* DIALOG 2: Add Misc Deduction Modal */}
        {/* ------------------------------------------------------------------ */}
        <Dialog open={addDeductionOpen} onOpenChange={setAddDeductionOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Apply Miscellaneous Deduction</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const empId = (form.elements.namedItem("empId") as HTMLSelectElement).value;
                const category = (form.elements.namedItem("category") as HTMLInputElement).value;
                const amount = parseFloat((form.elements.namedItem("amount") as HTMLInputElement).value) || 0;
                const reason = (form.elements.namedItem("reason") as HTMLTextAreaElement).value;

                if (!empId || amount <= 0) {
                  toast.error("Please enter a valid deduction amount");
                  return;
                }

                setMiscDeductions((prev) => [
                  {
                    id: `DED-${Date.now()}`,
                    employeeId: empId,
                    category,
                    amount,
                    reason,
                    date: new Date().toISOString().slice(0, 10),
                  },
                  ...prev,
                ]);

                toast.success(`Deduction of ₹${amount} recorded for employee`);
                setAddDeductionOpen(false);
              }}
              className="space-y-4 pt-2"
            >
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Select Employee</label>
                <select
                  name="empId"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  required
                >
                  {eligible.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.id} • {e.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Deduction Type</label>
                <select
                  name="category"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  required
                >
                  <option value="Salary Advance Recovery">Salary Advance Recovery</option>
                  <option value="Equipment / Monitor Damage">Equipment / Hardware Damage</option>
                  <option value="Transport Shuttle Charges">Transport Shuttle Charges</option>
                  <option value="Canteen / Food Charges">Canteen / Food Charges</option>
                  <option value="Disciplinary Penalty">Disciplinary Penalty</option>
                  <option value="Tax / TDS Recovery">Tax / TDS Recovery</option>
                  <option value="Other Recovery">Other Miscellaneous Recovery</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Deduction Amount (₹)</label>
                <Input name="amount" type="number" placeholder="2500" className="h-9 text-xs" required />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Reason / Details</label>
                <Textarea
                  name="reason"
                  placeholder="e.g. Monthly installment deduction for personal advance..."
                  className="text-xs min-h-[70px]"
                  required
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setAddDeductionOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-rose-600 text-white hover:bg-rose-700">
                  Apply Deduction
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ------------------------------------------------------------------ */}
        {/* DIALOG 3: Adjust LOP Modal */}
        {/* ------------------------------------------------------------------ */}
        <Dialog open={!!adjustLopOpen} onOpenChange={(v) => !v && setAdjustLopOpen(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">
                Adjust Loss of Pay (LOP) — {adjustLopOpen?.name}
              </DialogTitle>
            </DialogHeader>
            {adjustLopOpen && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const days = parseFloat((form.elements.namedItem("days") as HTMLInputElement).value) || 0;
                  const reason = (form.elements.namedItem("reason") as HTMLTextAreaElement).value;

                  setLopRecords((prev) => ({
                    ...prev,
                    [adjustLopOpen.id]: {
                      employeeId: adjustLopOpen.id,
                      unpaidDays: days,
                      reason,
                      status: "Adjusted",
                    },
                  }));

                  toast.success(`LOP days updated to ${days} days for ${adjustLopOpen.name}`);
                  setAdjustLopOpen(null);
                }}
                className="space-y-4 pt-2"
              >
                <div className="rounded-xl bg-muted/30 p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly Gross:</span>
                    <span className="font-semibold text-foreground">{inr(adjustLopOpen.monthlyGross)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Per Day Rate (Gross / 30):</span>
                    <span className="font-semibold text-foreground">{inr(Math.round(adjustLopOpen.monthlyGross / 30))}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">Unpaid / LOP Days</label>
                  <Input
                    name="days"
                    type="number"
                    step="0.5"
                    min="0"
                    max="30"
                    defaultValue={lopRecords[adjustLopOpen.id]?.unpaidDays ?? 0}
                    className="h-9 text-xs"
                    required
                  />
                  <span className="text-[11px] text-muted-foreground mt-1 block">
                    Enter 0 to completely waive LOP for this employee.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">HR Adjustment Justification</label>
                  <Textarea
                    name="reason"
                    defaultValue={lopRecords[adjustLopOpen.id]?.reason ?? "Attendance regularization adjustment"}
                    className="text-xs min-h-[60px]"
                    required
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setAdjustLopOpen(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-primary text-primary-foreground">
                    Save LOP Adjustment
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* ------------------------------------------------------------------ */}
        {/* DIALOG 4: Lock & Authorize Confirmation */}
        {/* ------------------------------------------------------------------ */}
        <ConfirmDialog
          open={lockConfirmOpen}
          onOpenChange={setLockConfirmOpen}
          title="Authorize & Lock October 2026 Bank Transfer?"
          description={`This will finalize the net payout of ${inr(totalNetPayout)} across ${eligible.length} employees and record the transaction in the company audit log.`}
          confirmLabel="Authorize & Record Transfer"
          onConfirm={() => {
            if (currentRun) {
              advancePayroll(currentRun.id, "Payment Recorded", me()?.name ?? "Administrator", "Disbursed via corporate bank transfer");
            } else {
              createPayrollRun(activePeriod);
            }
            toast.success("Payroll locked and payment recorded successfully!");
            setPayrunMode("dashboard");
          }}
        />

        {/* ------------------------------------------------------------------ */}
        {/* DIALOG 5: Formal Payslip Modal (Zero PF & Zero ESI Guaranteed) */}
        {/* ------------------------------------------------------------------ */}
        <PayslipDialog
          slip={slip}
          onClose={() => setSlip(null)}
          payrollItem={slip ? payrollItems.find((p) => p.employee.id === slip.e.id) : null}
        />
      </div>
    </AppShell>
  );
}

// ----------------------------------------------------------------------------
// Formal Confidential Payslip Dialog Component
// Explicitly enforces: Zero PF & Zero ESI, shows Incentives, Misc Ded, LOP
// ----------------------------------------------------------------------------
function PayslipDialog({
  slip,
  onClose,
  payrollItem,
}: {
  slip: { e: Employee; period: string } | null;
  onClose: () => void;
  payrollItem?: {
    employee: Employee;
    bank: { bankName: string; accNo: string; ifsc: string };
    totalIncentives: number;
    totalMiscDed: number;
    unpaidDays: number;
    breakdown: PayslipBreakdown;
  } | null;
}) {
  const { data } = useStore();
  if (!slip) return null;

  const emp = slip.e;
  const p = payrollItem?.breakdown ?? payslipFor(emp, data.salaryStructures);
  const bank = payrollItem?.bank ?? getBankDetails(emp);
  const periodDate = new Date(slip.period + "-01");
  const periodMonthYear = periodDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const earningsLines = [
    { label: "Basic Salary", val: p.basic },
    { label: "House Rent Allowance (HRA)", val: p.hra },
    { label: "Special Allowance", val: p.special },
    ...(p.incentives > 0 ? [{ label: "Performance Incentives & Bonuses", val: p.incentives }] : []),
  ];

  const deductionLines = [
    { label: "Provident Fund (EPF)", val: 0, tag: "Exempted" },
    { label: "Employee State Insurance (ESI)", val: 0, tag: "Exempted" },
    { label: "Professional Tax (PT)", val: p.pt },
    { label: "Tax Deducted at Source (TDS)", val: p.tds },
    ...(p.lop > 0 ? [{ label: `Loss of Pay (${payrollItem?.unpaidDays ?? 0} days)`, val: p.lop }] : []),
    ...(p.miscDeductions > 0 ? [{ label: "Miscellaneous Deductions / Recovery", val: p.miscDeductions }] : []),
  ];

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-border pb-3">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Salary Statement — {periodMonthYear}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                RenDesk Technologies India Pvt Ltd • Hyderabad Corporate Office
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              No PF / No ESI Exempt
            </span>
          </div>
        </DialogHeader>

        {/* Employee Summary Card */}
        <div className="mt-2 rounded-xl border border-border bg-muted/30 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-semibold block">Employee Name</span>
              <span className="font-semibold text-foreground text-sm">{emp.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-semibold block">Employee ID</span>
              <span className="font-medium text-foreground">{emp.id}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-semibold block">Designation</span>
              <span className="font-medium text-foreground">{emp.designation}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-semibold block">Department</span>
              <span className="font-medium text-foreground">{emp.department}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-semibold block">Bank Name</span>
              <span className="font-medium text-foreground">{bank.bankName}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-semibold block">Bank Account</span>
              <span className="font-mono text-foreground font-medium">{bank.accNo}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-semibold block">IFSC Code</span>
              <span className="font-mono text-foreground font-medium">{bank.ifsc}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-semibold block">Payable Days</span>
              <span className="font-medium text-foreground">{30 - (payrollItem?.unpaidDays ?? 0)} / 30 Days</span>
            </div>
          </div>
        </div>

        {/* Dual Column: Earnings vs Deductions */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Earnings */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground border-b border-border pb-2 mb-3 flex items-center justify-between">
              <span>Earnings</span>
              <span>Amount (₹)</span>
            </h4>
            <div className="space-y-2 text-xs">
              {earningsLines.map((row) => (
                <div key={row.label} className="flex justify-between py-0.5">
                  <span className="text-foreground">{row.label}</span>
                  <span className="font-medium text-foreground tabular-nums">{inr(row.val)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-border pt-2 flex justify-between font-bold text-xs">
              <span>Total Earnings</span>
              <span className="tabular-nums text-foreground">{inr(p.gross)}</span>
            </div>
          </div>

          {/* Deductions */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground border-b border-border pb-2 mb-3 flex items-center justify-between">
              <span>Deductions</span>
              <span>Amount (₹)</span>
            </h4>
            <div className="space-y-2 text-xs">
              {deductionLines.map((row) => (
                <div key={row.label} className="flex justify-between py-0.5">
                  <span className="text-foreground flex items-center gap-1.5">
                    {row.label}
                    {row.tag && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.2 rounded font-normal">
                        {row.tag}
                      </span>
                    )}
                  </span>
                  <span
                    className={`font-medium tabular-nums ${row.val === 0 ? "text-muted-foreground" : "text-rose-600"}`}
                  >
                    {inr(row.val)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-border pt-2 flex justify-between font-bold text-xs">
              <span>Total Deductions</span>
              <span className="tabular-nums text-rose-600">{inr(p.totalDeductions)}</span>
            </div>
          </div>
        </div>

        {/* Net Take-Home Highlight Banner */}
        <div className="mt-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-primary/10 to-emerald-500/10 border border-emerald-500/20 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase font-semibold text-muted-foreground block tracking-wider">
              Net Bank Transfer Amount
            </span>
            <span className="text-2xl font-black text-emerald-600 tracking-tight">{inr(p.net)}</span>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <span>Direct Credit via Corporate NEFT</span>
            <span className="block font-medium text-foreground">Status: Authorized for Payout</span>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="mt-4 flex sm:justify-between items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            System generated confidential payslip • No signature required.
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                window.print();
              }}
            >
              <Printer className="h-3.5 w-3.5" /> Print / Save as PDF
            </Button>
            <Button size="sm" className="text-xs" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
