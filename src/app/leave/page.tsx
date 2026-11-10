"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/data/store";
import { TODAY } from "@/lib/data/seed";
import { PageHeader, KpiCard, StatusBadge, TabsShell, Field, Timeline, EmployeeAvatar } from "@/components/shared";
import { DataTable, exportCsv, type Column } from "@/components/data-table";
import { Person, Sel, useScope, useNames } from "@/components/form-bits";
import type { LeaveRequest, LeaveType, LeavePolicy, LeaveStage } from "@/lib/data/types";
import { fmtDate, initials, avatarColor } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { AppShell } from "@/components/shell";
import {
  CalendarDays, Download, Hourglass, Plus, CheckCircle2, Clock,
  Calendar, Check, X, Search, LayoutGrid, List, Building2, Shield,
  ArrowUpRight, FileText, AlertCircle, Sparkles, Plane, HeartPulse,
  Coffee, Baby, FileQuestion, UserCheck, AlertTriangle, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

const LEAVE_TYPES: LeaveType[] = [
  "Casual Leave",
  "Sick Leave",
  "Comp-Off",
];

export default function LeavePage() {
  const { data, applyLeave, decideLeave } = useStore();
  const { isAdmin, isManager, isEmployee, uid, inScope } = useScope();
  const nameOf = useNames();

  const [tab, setTab] = useState<string>(isEmployee ? "mine" : "approvals");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals & Slide-out Sheet
  const [applyOpen, setApplyOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<LeaveRequest | null>(null);

  // Scoped requests
  const scopedLeaves = useMemo(() => {
    return data.leaves.filter((l) => inScope(l.employeeId));
  }, [data.leaves, inScope]);

  // Approvals awaiting current user
  const approvals = useMemo(() => {
    return scopedLeaves.filter(
      (l) =>
        l.employeeId !== uid &&
        ((isManager && ["Submitted", "Manager Review"].includes(l.status)) ||
          (isAdmin && ["Submitted", "Manager Review", "HR Review"].includes(l.status)))
    );
  }, [scopedLeaves, uid, isManager, isAdmin]);

  // Employee's own leaves
  const myLeaves = useMemo(() => {
    return data.leaves.filter((l) => l.employeeId === uid);
  }, [data.leaves, uid]);

  // All team requests with search & filter
  const filteredAll = useMemo(() => {
    return scopedLeaves.filter((l) => {
      if (typeFilter !== "all" && l.type !== typeFilter) return false;
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const emp = data.employees.find((e) => e.id === l.employeeId);
        const name = (emp?.name ?? "").toLowerCase();
        const dep = (emp?.department ?? "").toLowerCase();
        const reason = (l.reason ?? "").toLowerCase();
        return name.includes(q) || dep.includes(q) || reason.includes(q) || l.type.toLowerCase().includes(q);
      }
      return true;
    });
  }, [scopedLeaves, typeFilter, statusFilter, searchQuery, data.employees]);

  // Current user's balance
  const myBalances = data.leaveBalances[uid] ?? {
    "Casual Leave": 12,
    "Sick Leave": 10,
    "Comp-Off": 2,
  };

  // Staff currently on approved leave today
  const onLeaveToday = useMemo(() => {
    return scopedLeaves.filter((l) => l.status === "Approved" && l.startDate <= TODAY && l.endDate >= TODAY);
  }, [scopedLeaves]);

  // Table Columns
  const tableColumns: Column<LeaveRequest>[] = [
    {
      key: "emp",
      header: "Employee",
      sortValue: (r) => nameOf(r.employeeId),
      render: (r) => (
        <Link href={`/employees/${r.employeeId}`} className="group flex items-center gap-2 hover:underline">
          <Person id={r.employeeId} />
          <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      ),
    },
    { key: "type", header: "Leave Type", render: (r) => <span className="font-semibold text-foreground">{r.type}</span> },
    {
      key: "dates",
      header: "Period",
      sortValue: (r) => r.startDate,
      render: (r) => `${fmtDate(r.startDate)} → ${fmtDate(r.endDate)}`,
    },
    {
      key: "days",
      header: "Duration",
      render: (r) => (
        <span className="font-semibold text-foreground">
          {r.days} {r.days === 1 ? "day" : "days"}
        </span>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      render: (r) => <span className="block max-w-[200px] truncate text-muted-foreground">{r.reason}</span>,
      hideOnMobile: true,
    },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "act",
      header: "",
      render: (r) => {
        const canApprove =
          r.employeeId !== uid &&
          ((isManager && ["Submitted", "Manager Review"].includes(r.status)) ||
            (isAdmin && ["Submitted", "Manager Review", "HR Review"].includes(r.status)));

        return (
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setDetailItem(r)}
            >
              Details
            </Button>
            {canApprove && (
              <>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    decideLeave(r.id, "Approved", isManager ? "Approved by Reporting Manager" : "Approved by HR Admin");
                    toast.success(`Leave request approved for ${nameOf(r.employeeId)}`);
                  }}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                  onClick={() => {
                    decideLeave(r.id, "Rejected", "Operational constraints");
                    toast.error(`Leave request rejected`);
                  }}
                >
                  Reject
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <AppShell>
      <div>
        <PageHeader
          breadcrumb={["Time & Attendance", "Leave Management"]}
          title="Leave & Time-Off Management"
          description={
            isEmployee
              ? "Submit leave applications, track pending manager approvals, and monitor your personal leave balance."
              : "Review team leave applications, manage approval escalations, verify balances, and manage time-off policies."
          }
          actions={
            <>
              {!isEmployee && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs shadow-sm"
                  onClick={() =>
                    exportCsv(
                      "leave-requests.csv",
                      ["Employee ID", "Employee Name", "Type", "Start Date", "End Date", "Days", "Reason", "Status"],
                      scopedLeaves.map((l) => [
                        l.employeeId,
                        nameOf(l.employeeId),
                        l.type,
                        l.startDate,
                        l.endDate,
                        l.days,
                        l.reason,
                        l.status,
                      ])
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
              )}
              <Button
                size="sm"
                className="gap-1.5 text-xs shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => setApplyOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" /> Apply for Leave
              </Button>
            </>
          }
        />

        {/* Top KPI Cards Row */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Casual Leave Balance"
            value={`${myBalances["Casual Leave"] ?? 0} Days`}
            hint="Available for personal matters"
            icon={<Coffee className="h-4 w-4 text-amber-500" />}
          />
          <KpiCard
            label="Sick Leave Balance"
            value={`${myBalances["Sick Leave"] ?? 0} Days`}
            hint="Medical & illness recovery"
            icon={<HeartPulse className="h-4 w-4 text-rose-500" />}
          />
          <KpiCard
            label="Comp-Off Balance"
            value={`${myBalances["Comp-Off"] ?? 0} Days`}
            hint="Accrued from extra work"
            icon={<ShieldCheck className="h-4 w-4 text-purple-500" />}
          />
          {isEmployee ? (
            <KpiCard
              label="My Pending Requests"
              value={String(myLeaves.filter((l) => !["Approved", "Rejected"].includes(l.status)).length)}
              hint="Awaiting manager sign-off"
              icon={<Hourglass className="h-4 w-4 text-primary" />}
            />
          ) : (
            <KpiCard
              label="Awaiting My Approval"
              value={String(approvals.length)}
              hint={approvals.length > 0 ? "Requires review action" : "All caught up"}
              icon={<Hourglass className="h-4 w-4 text-amber-600" />}
              onClick={() => setTab("approvals")}
            />
          )}
          <KpiCard
            label="On Leave Today"
            value={String(onLeaveToday.length)}
            hint={onLeaveToday.length > 0 ? `${onLeaveToday.length} staff out today` : "Full team present"}
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          />
        </div>

        {/* Tabs Shell */}
        <TabsShell
          tabs={[
            { key: "approvals", label: `Approvals (${approvals.length})`, hidden: isEmployee },
            { key: "mine", label: `My Leaves (${myLeaves.length})` },
            { key: "all", label: isManager ? `Team Requests (${filteredAll.length})` : `All Requests (${filteredAll.length})`, hidden: isEmployee },
            { key: "balances", label: "Leave Balances" },
            { key: "policies", label: `Company Policies (${data.leavePolicies.length})` },
          ]}
          active={tab}
          onChange={(t) => {
            setTab(t);
            setSearchQuery("");
          }}
        >
          {/* TAB 1: PENDING APPROVALS */}
          {tab === "approvals" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Actionable Leave Requests</h3>
                  <p className="text-xs text-muted-foreground">
                    Applications currently pending your approval level.
                  </p>
                </div>

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

              {approvals.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
                  <p className="text-sm font-semibold text-foreground">Zero Pending Approvals</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You have reviewed all leave requests for your team.
                  </p>
                </div>
              ) : view === "cards" ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {approvals.map((req) => (
                    <LeaveRequestCard
                      key={req.id}
                      request={req}
                      isOwn={req.employeeId === uid}
                      canApprove={true}
                      onApprove={() => {
                        decideLeave(req.id, "Approved", isManager ? "Approved by Manager" : "Approved by HR Admin");
                        toast.success(`Leave approved for ${nameOf(req.employeeId)}`);
                      }}
                      onReject={() => {
                        decideLeave(req.id, "Rejected", "Coverage constraints");
                        toast.error("Leave request rejected");
                      }}
                      onViewDetails={() => setDetailItem(req)}
                    />
                  ))}
                </div>
              ) : (
                <DataTable columns={tableColumns} rows={approvals} rowKey={(r) => r.id} onRowClick={setDetailItem} />
              )}
            </div>
          )}

          {/* TAB 2: MY LEAVE REQUESTS */}
          {tab === "mine" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Your Leave History</h3>
                  <p className="text-xs text-muted-foreground">All leaves submitted by your profile.</p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="h-8.5 gap-1.5 text-xs font-medium"
                    onClick={() => setApplyOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" /> Apply New Leave
                  </Button>

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
              </div>

              {myLeaves.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                  <CalendarDays className="h-10 w-10 text-muted-foreground/60 mb-2" />
                  <p className="text-sm font-semibold text-foreground">No Leave Requests</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    You haven't submitted any leave applications yet.
                  </p>
                  <Button size="sm" onClick={() => setApplyOpen(true)} className="gap-1.5 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Apply for Leave
                  </Button>
                </div>
              ) : view === "cards" ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {myLeaves.map((req) => (
                    <LeaveRequestCard
                      key={req.id}
                      request={req}
                      isOwn={true}
                      canApprove={false}
                      onApprove={() => {}}
                      onReject={() => {}}
                      onViewDetails={() => setDetailItem(req)}
                    />
                  ))}
                </div>
              ) : (
                <DataTable
                  columns={tableColumns.filter((c) => c.key !== "act")}
                  rows={myLeaves}
                  rowKey={(r) => r.id}
                  onRowClick={setDetailItem}
                />
              )}
            </div>
          )}

          {/* TAB 3: ALL / TEAM REQUESTS */}
          {tab === "all" && (
            <div className="space-y-4">
              {/* Filter Toolbar */}
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative w-56 sm:w-64">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search employee, team, reason..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8.5 pl-8 text-xs"
                    />
                  </div>
                  <Sel
                    value={typeFilter}
                    onChange={setTypeFilter}
                    className="h-8.5 w-40 text-xs"
                    options={[{ value: "all", label: "All Leave Types" }, ...LEAVE_TYPES]}
                  />
                  <Sel
                    value={statusFilter}
                    onChange={setStatusFilter}
                    className="h-8.5 w-40 text-xs"
                    options={[
                      { value: "all", label: "All Statuses" },
                      "Submitted",
                      "Manager Review",
                      "HR Review",
                      "Approved",
                      "Rejected",
                      "Clarification",
                    ]}
                  />
                  {(searchQuery || typeFilter !== "all" || statusFilter !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        setTypeFilter("all");
                        setStatusFilter("all");
                      }}
                      className="h-8.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Reset
                    </Button>
                  )}
                </div>

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

              {filteredAll.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                  <CalendarDays className="h-10 w-10 text-muted-foreground/60 mb-2" />
                  <p className="text-sm font-semibold text-foreground">No Leave Requests Found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try adjusting your filters or search criteria.
                  </p>
                </div>
              ) : view === "cards" ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredAll.map((req) => {
                    const canApprove =
                      req.employeeId !== uid &&
                      ((isManager && ["Submitted", "Manager Review"].includes(req.status)) ||
                        (isAdmin && ["Submitted", "Manager Review", "HR Review"].includes(req.status)));

                    return (
                      <LeaveRequestCard
                        key={req.id}
                        request={req}
                        isOwn={req.employeeId === uid}
                        canApprove={canApprove}
                        onApprove={() => {
                          decideLeave(req.id, "Approved", isManager ? "Approved by Manager" : "Approved by HR Admin");
                          toast.success(`Leave approved for ${nameOf(req.employeeId)}`);
                        }}
                        onReject={() => {
                          decideLeave(req.id, "Rejected", "Coverage constraints");
                          toast.error("Leave request rejected");
                        }}
                        onViewDetails={() => setDetailItem(req)}
                      />
                    );
                  })}
                </div>
              ) : (
                <DataTable columns={tableColumns} rows={filteredAll} rowKey={(r) => r.id} onRowClick={setDetailItem} />
              )}
            </div>
          )}

          {/* TAB 4: LEAVE BALANCES */}
          {tab === "balances" && (
            <div className="space-y-6">
              {/* User's Personal Balance Overview */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4">
                  <h3 className="font-semibold text-foreground text-sm">Your Personal Leave Balances (2026)</h3>
                  <p className="text-xs text-muted-foreground">Annual quota allocation and current available balance.</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <BalanceMetricCard
                    type="Casual Leave"
                    available={myBalances["Casual Leave"] ?? 0}
                    total={12}
                    color="amber"
                  />
                  <BalanceMetricCard
                    type="Sick Leave"
                    available={myBalances["Sick Leave"] ?? 0}
                    total={10}
                    color="rose"
                  />
                  <BalanceMetricCard
                    type="Comp-Off"
                    available={myBalances["Comp-Off"] ?? 0}
                    total={4}
                    color="purple"
                  />
                </div>
              </div>

              {/* Team Roster Leave Balances (for managers & admins) */}
              {!isEmployee && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground text-sm">Team Quota Matrix</h3>
                      <p className="text-xs text-muted-foreground">Individual employee balance directory.</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 text-[11px] font-semibold uppercase text-muted-foreground border-b border-border">
                        <tr>
                          <th className="px-4 py-3">Employee</th>
                          <th className="px-4 py-3">Department</th>
                          <th className="px-4 py-3 text-center">Casual (CL)</th>
                          <th className="px-4 py-3 text-center">Sick (SL)</th>
                          <th className="px-4 py-3 text-center">Comp-Off (CO)</th>
                          <th className="px-4 py-3 text-right">Total Available</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.employees
                          .filter((e) => inScope(e.id))
                          .slice(0, 30)
                          .map((e) => {
                            const b = data.leaveBalances[e.id] ?? {};
                            const cl = b["Casual Leave"] ?? 0;
                            const sl = b["Sick Leave"] ?? 0;
                            const co = b["Comp-Off"] ?? 0;
                            const total = cl + sl + co;

                            return (
                              <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3 font-medium">
                                  <Link href={`/employees/${e.id}`} className="hover:underline flex items-center gap-2">
                                    <EmployeeAvatar id={e.id} name={e.name} size={28} />
                                    <span>{e.name}</span>
                                  </Link>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">{e.department}</td>
                                <td className="px-4 py-3 text-center font-semibold text-amber-700 dark:text-amber-400">
                                  {cl}
                                </td>
                                <td className="px-4 py-3 text-center font-semibold text-rose-700 dark:text-rose-400">
                                  {sl}
                                </td>
                                <td className="px-4 py-3 text-center font-semibold text-purple-700 dark:text-purple-400">
                                  {co}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-foreground">
                                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] text-primary">
                                    {total} Days
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: LEAVE POLICIES */}
          {tab === "policies" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">Company Leave & Time-Off Policies</h3>
                <p className="text-xs text-muted-foreground">Standard annual quotas, carry-forward caps, and rules.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.leavePolicies.map((p) => (
                  <LeavePolicyCard key={p.id} policy={p} />
                ))}
              </div>
            </div>
          )}
        </TabsShell>

        {/* DIALOG: Apply for Leave */}
        <ApplyLeaveDialog
          open={applyOpen}
          balances={myBalances}
          onOpenChange={setApplyOpen}
          onSubmit={(leaveData) => {
            applyLeave(leaveData);
            setApplyOpen(false);
            setTab("mine");
            toast.success("Leave application submitted successfully for review");
          }}
        />

        {/* SLIDE-OUT SHEET: Leave Details & Audit Timeline */}
        <Sheet open={!!detailItem} onOpenChange={(v) => !v && setDetailItem(null)}>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            {detailItem && (
              <LeaveDetailSheetContent
                request={detailItem}
                isManager={isManager}
                isAdmin={isAdmin}
                uid={uid}
                onApprove={() => {
                  decideLeave(detailItem.id, "Approved", isManager ? "Approved by Manager" : "Approved by HR Admin");
                  toast.success(`Leave request approved`);
                  setDetailItem(null);
                }}
                onReject={() => {
                  decideLeave(detailItem.id, "Rejected", "Coverage constraints");
                  toast.error(`Leave request rejected`);
                  setDetailItem(null);
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
 * COMPONENT: LeaveRequestCard (Rich custom card layout)
 * ========================================================================================= */
function LeaveRequestCard({
  request,
  isOwn,
  canApprove,
  onApprove,
  onReject,
  onViewDetails,
}: {
  request: LeaveRequest;
  isOwn: boolean;
  canApprove: boolean;
  onApprove: () => void;
  onReject: () => void;
  onViewDetails: () => void;
}) {
  const { data } = useStore();
  const emp = data.employees.find((e) => e.id === request.employeeId);

  // Status dot color
  const dotColor = {
    Approved: "bg-emerald-500",
    Submitted: "bg-amber-500",
    "Manager Review": "bg-amber-500",
    "HR Review": "bg-blue-500",
    Rejected: "bg-rose-500",
    Clarification: "bg-purple-500",
  }[request.status] ?? "bg-slate-400";

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all duration-200 dark:bg-card dark:border-border hover:shadow-md">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl font-bold text-white text-base shadow-sm"
                style={{ backgroundColor: avatarColor(request.employeeId) }}
              >
                {initials(emp?.name || request.employeeId)}
              </div>
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white dark:ring-slate-900",
                  dotColor
                )}
                title={request.status}
              />
            </div>

            <div className="min-w-0">
              <Link
                href={`/employees/${request.employeeId}`}
                className="group/link flex items-center gap-1 font-semibold text-foreground hover:text-primary transition-colors text-[14px]"
              >
                <span className="truncate">{emp?.name || request.employeeId}</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover/link:opacity-100 transition-opacity" />
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                  <Shield className="h-2.5 w-2.5" />
                  {emp?.designation || "Staff"}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Building2 className="h-2.5 w-2.5" />
                  {emp?.team || "Office"}
                </span>
              </div>
            </div>
          </div>

          <StatusBadge status={request.status} />
        </div>

        {/* Divider */}
        <div className="my-3.5 border-t border-slate-100 dark:border-slate-800" />

        {/* Leave Dates Highlight Banner */}
        <div className="mb-3.5 flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-foreground dark:bg-muted/30">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">
              {fmtDate(request.startDate)}
              {request.startDate !== request.endDate ? ` → ${fmtDate(request.endDate)}` : ""}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 rounded bg-white px-2.5 py-0.5 text-[11px] font-bold text-primary border border-slate-200 dark:bg-card dark:border-slate-800">
            {request.days} {request.days === 1 ? "Day" : "Days"}
          </span>
        </div>

        {/* 3 Metric Boxes */}
        <div className="grid grid-cols-3 gap-2">
          {/* Box 1: Category */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Category</p>
            <p className="mt-0.5 truncate text-[11px] font-bold text-slate-900 dark:text-white">
              {request.type.replace(" Leave", "")}
            </p>
          </div>

          {/* Box 2: Duration */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Duration</p>
            <p className="mt-0.5 text-sm font-bold text-primary">
              {request.days}d {request.halfDay ? "(Half)" : "(Full)"}
            </p>
          </div>

          {/* Box 3: Stage */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Reviewer</p>
            <p className="mt-0.5 truncate text-[11px] font-bold text-slate-800 dark:text-slate-200">
              {request.status.replace(" Review", "")}
            </p>
          </div>
        </div>

        {/* Reason Box */}
        <div className="mt-3.5 rounded-xl bg-slate-50 p-2.5 text-xs text-foreground dark:bg-muted/30">
          <p className="text-muted-foreground italic">"{request.reason}"</p>
        </div>

        {request.managerDecision && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Manager: {request.managerDecision}</span>
          </div>
        )}
      </div>

      {/* Footer / Actions */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <button
          onClick={onViewDetails}
          className="text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
        >
          <Clock className="h-3 w-3" /> Audit Timeline
        </button>

        <div className="flex items-center gap-1.5">
          {canApprove ? (
            <>
              <Button
                size="sm"
                className="h-7 px-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                onClick={onApprove}
              >
                <Check className="mr-1 h-3 w-3" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900"
                onClick={onReject}
              >
                Reject
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={onViewDetails}
            >
              View Sheet
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================================
 * COMPONENT: BalanceMetricCard
 * ========================================================================================= */
function BalanceMetricCard({
  type,
  available,
  total,
  color,
}: {
  type: string;
  available: number;
  total: number;
  color: "amber" | "rose" | "blue" | "purple";
}) {
  const percent = Math.min(100, Math.round((available / Math.max(1, total)) * 100));

  const colorStyles = {
    amber: "text-amber-700 dark:text-amber-400 bg-amber-500",
    rose: "text-rose-700 dark:text-rose-400 bg-rose-500",
    blue: "text-blue-700 dark:text-blue-400 bg-blue-500",
    purple: "text-purple-700 dark:text-purple-400 bg-purple-500",
  }[color];

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm dark:bg-card dark:border-border">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{type}</p>
          <p className="text-xl font-bold text-foreground mt-0.5">
            {available} <span className="text-xs font-normal text-muted-foreground">/ {total} Days</span>
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
          <div
            className={cn("h-full rounded-full transition-all", colorStyles.split(" ")[2])}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-[10px] text-right font-medium text-muted-foreground">{percent}% balance remaining</p>
      </div>
    </div>
  );
}

/* =========================================================================================
 * COMPONENT: LeavePolicyCard
 * ========================================================================================= */
function LeavePolicyCard({ policy }: { policy: LeavePolicy }) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:bg-card dark:border-border">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold text-foreground text-sm">{policy.type}</h4>
          <span className="mt-1 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {policy.annualEntitlement > 0 ? `${policy.annualEntitlement} Days / Year` : "As per approval"}
          </span>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-muted dark:text-muted-foreground">
          {policy.accrual}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
        <div>
          <span className="text-muted-foreground text-[10px] uppercase">Carry Forward</span>
          <p className="font-semibold text-foreground">
            {policy.carryForwardCap > 0 ? `Max ${policy.carryForwardCap} days` : "No carry forward"}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground text-[10px] uppercase">Half-Day Leave</span>
          <p className="font-semibold text-foreground">{policy.halfDayEligible ? "Allowed" : "Full day only"}</p>
        </div>
        <div className="col-span-2 mt-1">
          <span className="text-muted-foreground text-[10px] uppercase">Expiry Rule</span>
          <p className="font-medium text-foreground">{policy.expiry}</p>
        </div>
        <div className="col-span-2 mt-1">
          <span className="text-muted-foreground text-[10px] uppercase">Eligibility</span>
          <p className="font-medium text-foreground">{policy.eligibility}</p>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================================
 * COMPONENT: LeaveDetailSheetContent
 * ========================================================================================= */
function LeaveDetailSheetContent({
  request,
  isManager,
  isAdmin,
  uid,
  onApprove,
  onReject,
}: {
  request: LeaveRequest;
  isManager: boolean;
  isAdmin: boolean;
  uid: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { data } = useStore();
  const nameOf = useNames();
  const emp = data.employees.find((e) => e.id === request.employeeId);

  const canApprove =
    request.employeeId !== uid &&
    ((isManager && ["Submitted", "Manager Review"].includes(request.status)) ||
      (isAdmin && ["Submitted", "Manager Review", "HR Review"].includes(request.status)));

  return (
    <div className="space-y-6 pt-4">
      <SheetHeader>
        <div className="flex items-center justify-between">
          <SheetTitle className="text-base font-bold">{request.type} Application</SheetTitle>
          <StatusBadge status={request.status} />
        </div>
      </SheetHeader>

      {/* Employee Header */}
      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-muted/30">
        <EmployeeAvatar id={request.employeeId} name={emp?.name || request.employeeId} size={44} />
        <div>
          <p className="font-semibold text-foreground text-sm">{emp?.name || request.employeeId}</p>
          <p className="text-xs text-muted-foreground">
            {emp?.designation} · {emp?.department}
          </p>
        </div>
      </div>

      {/* Leave Specification Details */}
      <div className="space-y-2 rounded-xl border border-border p-3.5 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Duration:</span>
          <span className="font-semibold text-foreground">{request.days} Day(s)</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Period:</span>
          <span className="font-semibold text-foreground">
            {fmtDate(request.startDate)} to {fmtDate(request.endDate)}
          </span>
        </div>
        {request.halfDay && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Half-Day Session:</span>
            <span className="font-semibold text-foreground">{request.halfDay}</span>
          </div>
        )}
        {request.reasonCategory && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Category:</span>
            <span className="font-semibold text-foreground">{request.reasonCategory}</span>
          </div>
        )}
        {request.handoverEmployeeId && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Handover Delegate:</span>
            <span className="font-semibold text-foreground">{nameOf(request.handoverEmployeeId)}</span>
          </div>
        )}
        {request.emergencyContact && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Emergency Contact:</span>
            <span className="font-semibold text-foreground">{request.emergencyContact}</span>
          </div>
        )}
        {request.documentNote && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Medical / Doc Note:</span>
            <span className="font-semibold text-foreground">{request.documentNote}</span>
          </div>
        )}
        <div className="pt-2 border-t border-border">
          <span className="text-muted-foreground block mb-1">Reason for Absence:</span>
          <p className="font-medium text-foreground bg-muted/40 p-2 rounded-md italic">"{request.reason}"</p>
        </div>
      </div>

      {/* Audit Timeline */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Approval & Audit Trail</h4>
        <Timeline
          items={[...request.timeline].reverse().map((t) => ({
            at: t.at,
            title: t.stage,
            by: nameOf(t.actor),
            note: t.note,
          }))}
        />
      </div>

      {/* Action Buttons if can approve */}
      {canApprove && (
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={onReject} className="text-rose-600 border-rose-200">
            Reject
          </Button>
          <Button size="sm" onClick={onApprove} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            Approve Application
          </Button>
        </div>
      )}
    </div>
  );
}

/* =========================================================================================
 * DIALOG: ApplyLeaveDialog
 * ========================================================================================= */
function ApplyLeaveDialog({
  open,
  balances,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  balances: Record<string, number>;
  onOpenChange: (v: boolean) => void;
  onSubmit: (l: Omit<LeaveRequest, "id" | "timeline" | "status">) => void;
}) {
  const { data } = useStore();
  const { uid, isEmployee, inScope } = useScope();
  const [applicant, setApplicant] = useState(uid);
  const [type, setType] = useState<string>("Casual Leave");
  const [start, setStart] = useState("2026-10-28");
  const [end, setEnd] = useState("2026-10-29");
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfSession, setHalfSession] = useState<"First Half" | "Second Half">("First Half");
  const [category, setCategory] = useState("Personal / Family");
  const [reason, setReason] = useState("");
  const [handover, setHandover] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [docNote, setDocNote] = useState("");

  const effectiveBalances = data.leaveBalances[applicant] ?? balances;
  const rawDays = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
  const days = isHalfDay ? 0.5 : rawDays;
  const balance = effectiveBalances[type];
  const isOver = balance !== undefined && days > balance;
  const valid = days > 0 && reason.trim().length >= 4 && !isOver;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Apply for Leave</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Submit time-off request with absence coverage, emergency contact, and handover details.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2 text-xs">
          {!isEmployee && (
            <div className="col-span-2">
              <Field label="Applicant (Applying On-Behalf-Of)" hint="Admins and managers can submit requests for team members">
                <Sel
                  value={applicant}
                  onChange={setApplicant}
                  options={data.employees
                    .filter((e) => inScope(e.id))
                    .map((e) => ({
                      value: e.id,
                      label: `${e.name} (${e.designation}) · ${e.department}`,
                    }))}
                />
              </Field>
            </div>
          )}

          <div className="col-span-2">
            <Field
              label="Leave Type"
              hint={balance !== undefined ? `Remaining quota for applicant: ${balance} Day(s)` : undefined}
            >
              <Sel value={type} onChange={setType} options={LEAVE_TYPES} />
            </Field>
          </div>

          <Field label="Start Date">
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9" />
          </Field>

          <Field
            label="End Date"
            error={
              rawDays <= 0
                ? "End date must be on or after start"
                : isOver
                ? `Exceeds available balance (${days} days)`
                : undefined
            }
          >
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9" />
          </Field>

          <div className="col-span-2 flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-muted/30">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={isHalfDay}
                onCheckedChange={(c) => setIsHalfDay(Boolean(c))}
                id="halfDayToggle"
              />
              <label htmlFor="halfDayToggle" className="cursor-pointer font-medium text-foreground">
                Apply for Half-Day only (0.5 day)
              </label>
            </div>
            {isHalfDay && (
              <Sel
                value={halfSession}
                onChange={(v) => setHalfSession(v as "First Half" | "Second Half")}
                options={["First Half", "Second Half"]}
                className="h-8 w-32"
              />
            )}
          </div>

          <Field label="Absence Category">
            <Sel
              value={category}
              onChange={setCategory}
              options={[
                "Personal / Family",
                "Medical / Sick Leave",
                "Planned Vacation",
                "Examination / Studies",
                "Bereavement",
                "Emergency",
                "Other",
              ]}
            />
          </Field>

          <Field label="Work Handover Delegate" hint="Colleague covering pending tasks">
            <Sel
              value={handover}
              onChange={setHandover}
              options={[
                { value: "", label: "— No specific delegate —" },
                ...data.employees
                  .filter((e) => e.id !== applicant)
                  .map((e) => ({ value: e.id, label: `${e.name} (${e.department})` })),
              ]}
            />
          </Field>

          <Field label="Emergency Contact (Phone/Email)" hint="Reachability during leave">
            <Input
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="h-9"
            />
          </Field>

          <Field label="Medical / Proof Certificate Note (optional)" hint="Reference number or note">
            <Input
              value={docNote}
              onChange={(e) => setDocNote(e.target.value)}
              placeholder="e.g. Doctor prescription on file"
              className="h-9"
            />
          </Field>

          <div className="col-span-2">
            <Field label="Detailed Reason for Leave" required hint="Provide clear context for supervisory approval">
              <Textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain the purpose of your time-off request..."
              />
            </Field>
          </div>
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
                employeeId: applicant,
                type: type as LeaveType,
                startDate: start,
                endDate: isHalfDay ? start : end,
                days,
                halfDay: isHalfDay ? halfSession : undefined,
                reason: `${category}: ${reason}`,
                reasonCategory: category,
                handoverEmployeeId: handover || undefined,
                emergencyContact: emergencyPhone || undefined,
                documentNote: docNote || undefined,
              })
            }
            className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            Submit Application ({days} {days === 1 ? "Day" : "Days"})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
