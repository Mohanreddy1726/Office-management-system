"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useStore } from "@/lib/data/store";
import { TODAY } from "@/lib/data/seed";
import { PageHeader, KpiCard, StatusBadge, TabsShell, Field, ConfirmDialog, EmployeeAvatar } from "@/components/shared";
import { DataTable, exportCsv, type Column } from "@/components/data-table";
import { Sel, Person, useScope, useNames } from "@/components/form-bits";
import { BRANCHES, type Branch, type AttendanceRecord, type AttendanceCorrection, type Shift, type Holiday } from "@/lib/data/types";
import { fmtDate, attColor, initials, avatarColor } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { AppShell } from "@/components/shell";
import {
  CalendarCheck2, Clock, Download, Lock, Plus, UserX, Plane,
  LayoutGrid, List, Search, Building2, Shield, ArrowUpRight,
  Fingerprint, CheckCircle2, AlertCircle, XCircle, AlertTriangle,
  Calendar, Check, X, Sparkles, Filter, ChevronRight, HelpCircle, Pencil, Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";

const getTodayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function AttendancePage() {
  const {
    data,
    advanceAttendance,
    disputeAttendance,
    bulkConfirmAttendance,
    lockAttendance,
    setAttendanceRecords,
    addCorrection,
    decideCorrection,
    addShift,
    updateShift,
    deleteShift,
    addHoliday,
  } = useStore();
  const { isAdmin, isManager, isEmployee, uid, inScope } = useScope();
  const nameOf = useNames();

  const todayIso = useMemo(() => getTodayIso(), []);
  const [tab, setTab] = useState<string>("daily");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [date, setDate] = useState<string>(todayIso);
  const [status, setStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [syncingBiometric, setSyncingBiometric] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Sync attendance records from MongoDB Atlas
  const loadAttendance = useCallback(async () => {
    try {
      setLoadingAttendance(true);
      const res = await fetch("/api/attendance?all=true");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.records)) {
          setAttendanceRecords(json.records);
        }
      }
    } catch (err) {
      console.warn("Failed to load attendance records:", err);
    } finally {
      setLoadingAttendance(false);
    }
  }, [setAttendanceRecords]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const handleSyncBiometric = async () => {
    try {
      setSyncingBiometric(true);
      toast.loading("Connecting to eSSL K30 Pro at 192.168.29.201...", { id: "bio-sync" });
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_biometric" }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(
          `Biometric Sync Complete: ${json.summary?.processed || 0} punches scanned, ${json.summary?.updatedRecords || 0} attendance records updated!`,
          { id: "bio-sync" }
        );
        await loadAttendance();
      } else {
        toast.error(json.error || "Biometric sync failed", { id: "bio-sync" });
      }
    } catch (err: any) {
      toast.error(`Biometric sync failed: ${err.message}`, { id: "bio-sync" });
    } finally {
      setSyncingBiometric(false);
    }
  };

  // Correction, Lock, Shift & Holiday Dialogs
  const [corrOpen, setCorrOpen] = useState(false);
  const [corrPrefill, setCorrPrefill] = useState<{ empId?: string; date?: string; checkIn?: string; checkOut?: string } | null>(null);
  const [lockOpen, setLockOpen] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftToEdit, setShiftToEdit] = useState<Shift | null>(null);
  const [deleteConfirmShift, setDeleteConfirmShift] = useState<Shift | null>(null);
  const [holidayOpen, setHolidayOpen] = useState(false);

  // Filter Sub-States
  const [confirmFilter, setConfirmFilter] = useState<string>("all");
  const [corrFilter, setCorrFilter] = useState<string>("all");

  // Daily records scoped & filtered
  const daily = useMemo(() => {
    return data.attendance.filter((a) => {
      if (a.date !== date) return false;
      if (!inScope(a.employeeId)) return false;
      if (status !== "all" && a.status !== status) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const emp = data.employees.find((e) => e.id === a.employeeId);
        const name = (emp?.name ?? "").toLowerCase();
        const dep = (emp?.department ?? "").toLowerCase();
        const team = (emp?.team ?? "").toLowerCase();
        const id = a.employeeId.toLowerCase();
        if (!name.includes(q) && !dep.includes(q) && !team.includes(q) && !id.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [data.attendance, data.employees, date, inScope, status, searchQuery]);

  // Pending Confirmations
  const pendingConfirm = useMemo(() => {
    return data.attendance.filter((a) => {
      if (!inScope(a.employeeId)) return false;
      if (!a.confirmation.startsWith("Awaiting") && a.confirmation !== "Disputed") return false;
      if (confirmFilter !== "all" && a.confirmation !== confirmFilter) return false;
      if (isEmployee) return a.confirmation === "Awaiting Employee";
      if (isManager) return a.confirmation === "Awaiting Manager" || a.confirmation === "Disputed";
      if (isAdmin) return a.confirmation !== "Awaiting Employee";
      return true;
    });
  }, [data.attendance, inScope, confirmFilter, isEmployee, isManager, isAdmin]);

  // Corrections
  const corrections = useMemo(() => {
    return data.corrections.filter((c) => {
      if (!inScope(c.employeeId)) return false;
      if (corrFilter !== "all" && c.status !== corrFilter) return false;
      return true;
    });
  }, [data.corrections, inScope, corrFilter]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const toggleAll = () => {
    if (selected.size === daily.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(daily.map((r) => r.id)));
    }
  };

  // Quick KPI figures for TODAY
  const todayRecords = useMemo(
    () => data.attendance.filter((a) => (a.date === todayIso || a.date === date) && inScope(a.employeeId)),
    [data.attendance, inScope, todayIso, date]
  );
  const presentToday = todayRecords.filter((a) => ["Present", "Late"].includes(a.status)).length;
  const lateToday = todayRecords.filter((a) => a.status === "Late").length;
  const leaveToday = todayRecords.filter((a) => a.status === "Leave").length;
  const absentToday = todayRecords.filter((a) => a.status === "Absent").length;

  const openCorrectionFor = (empId: string, recDate: string, inT?: string, outT?: string) => {
    setCorrPrefill({ empId, date: recDate, checkIn: inT, checkOut: outT });
    setCorrOpen(true);
  };

  // Table Columns for Daily Register
  const columns: Column<AttendanceRecord>[] = [
    ...(!isEmployee
      ? [
          {
            key: "sel",
            header: "",
            render: (r: AttendanceRecord) => (
              <Checkbox
                checked={selected.has(r.id)}
                onCheckedChange={() => toggle(r.id)}
                onClick={(e) => e.stopPropagation()}
              />
            ),
          },
        ]
      : []),
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
    {
      key: "shift",
      header: "Shift",
      render: (r) => {
        const s =
          data.shifts.find((s) => s.id === r.shiftId) ||
          data.shifts.find((s) => s.id === "SH-GEN") ||
          data.shifts.find((s) => s.name.toLowerCase().includes("general")) ||
          data.shifts[0];
        return (
          <span className="font-medium text-foreground">
            {s ? `${s.name} (${s.start} - ${s.end})` : r.shiftId}
          </span>
        );
      },
      hideOnMobile: true,
    },
    { key: "in", header: "Check In", render: (r) => r.checkIn ?? "—" },
    { key: "out", header: "Check Out", render: (r) => r.checkOut ?? "—" },
    {
      key: "hrs",
      header: "Worked",
      render: (r) => (r.workedMinutes ? `${Math.floor(r.workedMinutes / 60)}h ${r.workedMinutes % 60}m` : "—"),
      hideOnMobile: true,
    },
    {
      key: "late",
      header: "Late",
      render: (r) => {
        const s =
          data.shifts.find((sh) => sh.id === r.shiftId) ||
          data.shifts.find((sh) => sh.id === "SH-GEN") ||
          data.shifts[0];
        let lateM = r.lateMinutes;
        if (r.checkIn && s?.start && !["Leave", "Absent", "Holiday", "Week Off"].includes(r.status)) {
          const [inH, inM] = r.checkIn.split(":").map(Number);
          const [shH, shM] = s.start.split(":").map(Number);
          if (!isNaN(inH) && !isNaN(inM) && !isNaN(shH) && !isNaN(shM)) {
            const inMins = inH * 60 + inM;
            const startMins = shH * 60 + shM;
            const grace = s.graceMinutes ?? 10;
            lateM = inMins > startMins + grace ? inMins - startMins : 0;
          }
        }
        return lateM ? (
          <span className="font-semibold text-amber-600 dark:text-amber-400">+{lateM}m</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (r) => {
        const s =
          data.shifts.find((sh) => sh.id === r.shiftId) ||
          data.shifts.find((sh) => sh.id === "SH-GEN") ||
          data.shifts[0];
        let st = r.status;
        if (r.checkIn && s?.start && !["Leave", "Absent", "Holiday", "Week Off"].includes(r.status)) {
          const [inH, inM] = r.checkIn.split(":").map(Number);
          const [shH, shM] = s.start.split(":").map(Number);
          if (!isNaN(inH) && !isNaN(inM) && !isNaN(shH) && !isNaN(shM)) {
            const inMins = inH * 60 + inM;
            const startMins = shH * 60 + shM;
            const grace = s.graceMinutes ?? 10;
            if (inMins > startMins + grace) st = "Late";
            else if (st === "Late") st = "Present";
          }
        }
        return <StatusBadge status={st} />;
      },
    },
    { key: "confirm", header: "Confirmation", render: (r) => <StatusBadge status={r.confirmation} /> },
    { key: "src", header: "Source", render: (r) => r.source, hideOnMobile: true },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex items-center gap-1.5 justify-end">
          {r.confirmation.startsWith("Awaiting") && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => {
                advanceAttendance(r.id);
                toast.success("Attendance advanced");
              }}
            >
              Advance
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => openCorrectionFor(r.employeeId, r.date, r.checkIn, r.checkOut)}
          >
            Correct
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <div>
        <PageHeader
          breadcrumb={["Time & Attendance", "Attendance Register"]}
          title="Attendance & Time Tracking"
          description={
            isEmployee
              ? "Your attendance logs, biometric punches, confirmation stage and correction requests."
              : "Biometric-fed punch register, multi-stage verification workflow, dispute resolution & corrections."
          }
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={syncingBiometric}
                className="gap-1.5 text-xs shadow-sm text-primary hover:text-primary border-primary/20 bg-primary/5 hover:bg-primary/10"
                onClick={handleSyncBiometric}
              >
                <Fingerprint className={cn("h-3.5 w-3.5", syncingBiometric && "animate-spin text-primary")} />
                {syncingBiometric ? "Syncing Biometric..." : "Sync Biometric"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs shadow-sm"
                onClick={() =>
                  exportCsv(
                    `attendance-${date}.csv`,
                    ["Employee ID", "Employee Name", "Date", "Shift", "In", "Out", "Worked Mins", "Late Mins", "Status", "Confirmation", "Source"],
                    daily.map((r) => [
                      r.employeeId,
                      nameOf(r.employeeId),
                      r.date,
                      (() => {
                        const s =
                          data.shifts.find((sh) => sh.id === r.shiftId) ||
                          data.shifts.find((sh) => sh.id === "SH-GEN") ||
                          data.shifts[0];
                        return s ? `${s.name} (${s.start}-${s.end})` : r.shiftId;
                      })(),
                      r.checkIn ?? "",
                      r.checkOut ?? "",
                      r.workedMinutes ?? "",
                      r.lateMinutes ?? "",
                      r.status,
                      r.confirmation,
                      r.source,
                    ])
                  )
                }
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
              <Button
                size="sm"
                className="gap-1.5 text-xs shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => {
                  setCorrPrefill(null);
                  setCorrOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Request Correction
              </Button>
            </>
          }
        />

        {/* Top KPI Cards Row */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Present Today"
            value={String(presentToday)}
            hint={`${Math.round((presentToday / Math.max(1, todayRecords.length)) * 100)}% attendance rate`}
            icon={<CalendarCheck2 className="h-4 w-4" />}
          />
          <KpiCard
            label="Late Arrivals"
            value={String(lateToday)}
            hint={lateToday > 0 ? "Requires manager review" : "No late arrivals"}
            icon={<Clock className="h-4 w-4 text-amber-500" />}
          />
          <KpiCard
            label="On Leave Today"
            value={String(leaveToday)}
            hint="Approved leave passes"
            icon={<Plane className="h-4 w-4 text-blue-500" />}
          />
          <KpiCard
            label="Absent / Unmarked"
            value={String(absentToday)}
            hint={absentToday > 0 ? "Action required" : "100% accounted for"}
            icon={<UserX className="h-4 w-4 text-rose-500" />}
          />
        </div>

        {/* Primary Tabs */}
        <TabsShell
          tabs={[
            { key: "daily", label: "Daily Register" },
            { key: "month", label: "Monthly Calendar" },
            { key: "confirm", label: `Confirmations (${pendingConfirm.length})` },
            { key: "corrections", label: `Corrections (${corrections.length})` },
            { key: "shifts", label: "Shifts & Holidays" },
          ]}
          active={tab}
          onChange={setTab}
        >
          {/* TAB 1: DAILY REGISTER */}
          {tab === "daily" && (
            <div className="space-y-4">
              {/* Filter Toolbar */}
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Date:</span>
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-8.5 w-38 text-xs font-medium"
                    />
                  </div>
                  <Sel
                    value={status}
                    onChange={setStatus}
                    className="h-8.5 w-40 text-xs"
                    options={[
                      { value: "all", label: "All Statuses" },
                      "Present",
                      "Late",
                      "Absent",
                      "Leave",
                      "Half Day",
                      "Week Off",
                      "Holiday",
                    ]}
                  />
                  <div className="relative w-52 sm:w-64">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search name, team, id..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8.5 pl-8 text-xs"
                    />
                  </div>
                  {(status !== "all" || searchQuery || date !== todayIso) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStatus("all");
                        setSearchQuery("");
                        setDate(todayIso);
                      }}
                      className="h-8.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Reset
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {!isEmployee && daily.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleAll}
                      className="h-8.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {selected.size === daily.length ? "Deselect All" : "Select All"}
                    </Button>
                  )}
                  {/* View Mode Toggle Switch */}
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

              {/* Multi-Selection Sticky Bar */}
              {!isEmployee && selected.size > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-xs animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-foreground">
                      {selected.size} record{selected.size > 1 ? "s" : ""} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-8 text-xs font-medium shadow-sm"
                      onClick={() => {
                        bulkConfirmAttendance([...selected]);
                        toast.success(`${selected.size} attendance records confirmed`);
                        setSelected(new Set());
                      }}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" /> Confirm Selected
                    </Button>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-200"
                        onClick={() => setLockOpen(true)}
                      >
                        <Lock className="h-3.5 w-3.5" /> Lock for Payroll
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground"
                      onClick={() => setSelected(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}

              {/* CARDS VIEW */}
              {view === "cards" && (
                <div>
                  {daily.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                      <CalendarCheck2 className="h-10 w-10 text-muted-foreground/60 mb-2" />
                      <p className="text-sm font-semibold text-foreground">No Attendance Records Found</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                        No logs match the selected date ({fmtDate(date)}) and filters.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {daily.map((record) => (
                        <AttendanceRecordCard
                          key={record.id}
                          record={record}
                          isSelected={selected.has(record.id)}
                          onToggle={() => toggle(record.id)}
                          isEmployee={isEmployee}
                          onAdvance={() => {
                            advanceAttendance(record.id);
                            toast.success("Attendance advanced to next stage");
                          }}
                          onDispute={() => {
                            disputeAttendance(record.id);
                            toast.warning("Attendance marked as disputed");
                          }}
                          onRequestCorrection={() =>
                            openCorrectionFor(record.employeeId, record.date, record.checkIn, record.checkOut)
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TABLE VIEW FALLBACK */}
              {view === "table" && (
                <DataTable
                  columns={columns}
                  rows={daily}
                  rowKey={(r) => r.id}
                  pageSize={15}
                  emptyTitle="No attendance for this date"
                />
              )}
            </div>
          )}

          {/* TAB 2: MONTHLY CALENDAR */}
          {tab === "month" && (
            <MonthCalendarSection
              records={isEmployee ? data.attendance.filter((a) => a.employeeId === uid) : data.attendance.filter((a) => inScope(a.employeeId))}
              isEmployee={isEmployee}
              onSelectDate={(d) => {
                setDate(d);
                setTab("daily");
              }}
            />
          )}

          {/* TAB 3: CONFIRMATIONS */}
          {tab === "confirm" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Stage Filter:</span>
                  <Sel
                    value={confirmFilter}
                    onChange={setConfirmFilter}
                    className="h-8.5 w-48 text-xs"
                    options={[
                      { value: "all", label: "All Pending Stages" },
                      { value: "Awaiting Employee", label: "Awaiting Employee" },
                      { value: "Awaiting Manager", label: "Awaiting Manager" },
                      { value: "Awaiting HR", label: "Awaiting HR" },
                      { value: "Disputed", label: "Disputed Punches" },
                    ]}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">{pendingConfirm.length}</span> punches needing review
                </div>
              </div>

              {pendingConfirm.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
                  <p className="text-sm font-semibold text-foreground">All Clear!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No attendance records are awaiting your stage confirmation.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {pendingConfirm.map((r) => (
                    <ConfirmationCard
                      key={r.id}
                      record={r}
                      onConfirm={() => {
                        advanceAttendance(r.id);
                        toast.success("Attendance confirmed and forwarded");
                      }}
                      onDispute={() => {
                        disputeAttendance(r.id);
                        toast.warning("Attendance marked as disputed");
                      }}
                      onRequestCorrection={() => openCorrectionFor(r.employeeId, r.date, r.checkIn, r.checkOut)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CORRECTIONS */}
          {tab === "corrections" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Status Filter:</span>
                  <Sel
                    value={corrFilter}
                    onChange={setCorrFilter}
                    className="h-8.5 w-48 text-xs"
                    options={[
                      { value: "all", label: "All Correction Requests" },
                      { value: "Awaiting Manager", label: "Awaiting Manager" },
                      { value: "Awaiting HR", label: "Awaiting HR" },
                      { value: "Approved", label: "Approved" },
                      { value: "Rejected", label: "Rejected" },
                    ]}
                  />
                </div>
                <Button
                  size="sm"
                  className="h-8.5 gap-1.5 text-xs font-medium"
                  onClick={() => {
                    setCorrPrefill(null);
                    setCorrOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> New Correction Request
                </Button>
              </div>

              {corrections.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                  <Clock className="h-10 w-10 text-muted-foreground/60 mb-2" />
                  <p className="text-sm font-semibold text-foreground">No Correction Requests</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    There are no punch adjustment requests matching the filter.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {corrections.map((corr) => (
                    <CorrectionCard
                      key={corr.id}
                      correction={corr}
                      isAdmin={isAdmin}
                      isManager={isManager}
                      onApprove={(note) => {
                        decideCorrection(corr.id, "Approved", note || "Approved after punch verification");
                        toast.success("Correction approved and punch updated");
                      }}
                      onReject={(note) => {
                        decideCorrection(corr.id, "Rejected", note || "Punch record mismatch");
                        toast.error("Correction rejected");
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SHIFTS & HOLIDAYS */}
          {tab === "shifts" && (
            <ShiftsAndHolidaysView
              shifts={data.shifts}
              holidays={data.holidays}
              canManage={isAdmin}
              onCreateShift={() => {
                setShiftToEdit(null);
                setShiftOpen(true);
              }}
              onEditShift={(s) => {
                setShiftToEdit(s);
                setShiftOpen(true);
              }}
              onDeleteShift={(s) => {
                setDeleteConfirmShift(s);
              }}
              onAddHoliday={() => setHolidayOpen(true)}
            />
          )}
        </TabsShell>

        {/* MODAL: Request Correction */}
        <CorrectionDialog
          open={corrOpen}
          prefill={corrPrefill}
          onOpenChange={setCorrOpen}
          onSubmit={(c) => {
            addCorrection(c);
            setCorrOpen(false);
            toast.success("Correction request submitted for review");
          }}
        />

        {/* MODAL: Create / Edit Shift */}
        <CreateShiftDialog
          open={shiftOpen}
          initialData={shiftToEdit}
          onOpenChange={(v) => {
            setShiftOpen(v);
            if (!v) setShiftToEdit(null);
          }}
          onSubmit={(s, id) => {
            if (id) {
              updateShift(id, s);
              toast.success(`Work shift "${s.name}" updated successfully`);
            } else {
              addShift(s);
              toast.success(`Work shift "${s.name}" created successfully`);
            }
            setShiftOpen(false);
            setShiftToEdit(null);
          }}
        />

        {/* MODAL: Delete Shift Confirmation */}
        <ConfirmDialog
          open={Boolean(deleteConfirmShift)}
          onOpenChange={(v) => !v && setDeleteConfirmShift(null)}
          title={`Delete Shift "${deleteConfirmShift?.name}"?`}
          description="Are you sure you want to remove this work shift schedule? Employees assigned to this shift may need to be updated. This action cannot be undone."
          confirmLabel="Delete Shift"
          onConfirm={() => {
            if (deleteConfirmShift) {
              deleteShift(deleteConfirmShift.id);
              toast.success(`Work shift "${deleteConfirmShift.name}" removed`);
              setDeleteConfirmShift(null);
            }
          }}
        />

        {/* MODAL: Add Holiday */}
        <AddHolidayDialog
          open={holidayOpen}
          onOpenChange={setHolidayOpen}
          onSubmit={(h) => {
            addHoliday(h);
            setHolidayOpen(false);
            toast.success(`Holiday "${h.name}" added to calendar`);
          }}
        />

        {/* MODAL: Lock Attendance */}
        <ConfirmDialog
          open={lockOpen}
          onOpenChange={setLockOpen}
          title="Lock Selected Attendance Records?"
          description="Locked records are frozen to generate payroll inputs. They cannot be edited or modified without Super Admin unlock."
          confirmLabel="Lock Records for Payroll"
          reasonField
          onConfirm={() => {
            lockAttendance([...selected]);
            setSelected(new Set());
            toast.success("Attendance locked successfully for payroll processing");
          }}
        />
      </div>
    </AppShell>
  );
}

/* =========================================================================================
 * COMPONENT: AttendanceRecordCard (matches user's photo aesthetic!)
 * ========================================================================================= */
function AttendanceRecordCard({
  record,
  isSelected,
  onToggle,
  isEmployee,
  onAdvance,
  onDispute,
  onRequestCorrection,
}: {
  record: AttendanceRecord;
  isSelected: boolean;
  onToggle: () => void;
  isEmployee: boolean;
  onAdvance: () => void;
  onDispute: () => void;
  onRequestCorrection: () => void;
}) {
  const { data } = useStore();
  const emp = data.employees.find((e) => e.id === record.employeeId);
  const shift =
    data.shifts.find((s) => s.id === record.shiftId) ||
    data.shifts.find((s) => s.id === "SH-GEN") ||
    data.shifts.find((s) => s.name.toLowerCase().includes("general")) ||
    data.shifts[0];

  const workedHours = record.workedMinutes ? (record.workedMinutes / 60).toFixed(1) : "0.0";
  const targetHours = shift?.minFullDayHours || 8.0;
  const quotaPercent = Math.min(100, Math.round((Number(workedHours) / targetHours) * 100));

  // Dynamically evaluate effective late minutes and status against assigned shift
  let effectiveLateMinutes = record.lateMinutes || 0;
  let effectiveStatus = record.status;
  if (record.checkIn && shift?.start && !["Leave", "Absent", "Holiday", "Week Off"].includes(record.status)) {
    const [inH, inM] = record.checkIn.split(":").map(Number);
    const [shH, shM] = shift.start.split(":").map(Number);
    if (!isNaN(inH) && !isNaN(inM) && !isNaN(shH) && !isNaN(shM)) {
      const inMins = inH * 60 + inM;
      const startMins = shH * 60 + shM;
      const grace = shift.graceMinutes ?? 10;
      if (inMins > startMins + grace) {
        effectiveLateMinutes = inMins - startMins;
        effectiveStatus = "Late";
      } else {
        effectiveLateMinutes = 0;
        if (effectiveStatus === "Late") effectiveStatus = "Present";
      }
    }
  }

  // Presence dot color
  const dotColor = {
    Present: "bg-emerald-500",
    Late: "bg-amber-500",
    Absent: "bg-rose-500",
    Leave: "bg-blue-500",
    "Half Day": "bg-amber-500",
    Holiday: "bg-purple-500",
    "Week Off": "bg-slate-400",
    "Pending Review": "bg-slate-400",
  }[effectiveStatus] ?? "bg-slate-400";

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 dark:bg-card dark:border-border hover:shadow-md",
        isSelected ? "border-primary ring-2 ring-primary/20" : "border-slate-200/90"
      )}
    >
      <div>
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Square Avatar with Status Dot */}
            <div className="relative">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl font-bold text-white text-base shadow-sm"
                style={{ backgroundColor: avatarColor(record.employeeId) }}
              >
                {initials(emp?.name || record.employeeId)}
              </div>
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white dark:ring-slate-900",
                  dotColor
                )}
                title={record.status}
              />
            </div>

            {/* Name & Role Details */}
            <div className="min-w-0">
              <Link
                href={`/employees/${record.employeeId}`}
                className="group/link flex items-center gap-1 font-semibold text-foreground hover:text-primary transition-colors text-[14px]"
              >
                <span className="truncate">{emp?.name || record.employeeId}</span>
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

          {/* Right: Status Pill & Multi-select Checkbox */}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
                attColor(effectiveStatus)
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", dotColor)} />
              {effectiveStatus}
            </span>

            {!isEmployee && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggle}
                className="rounded-md"
                aria-label="Select attendance record"
              />
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="my-3.5 border-t border-slate-100 dark:border-slate-800" />

        {/* Punch Timing Highlight Banner with Dynamic Shift Info */}
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-foreground dark:bg-muted/30">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              <Clock className="h-3 w-3" />
              Shift: {shift?.start || "09:30"} - {shift?.end || "18:30"}
            </span>
            <span className="font-medium text-xs text-muted-foreground">
              In: <strong className="text-foreground">{record.checkIn || "—"}</strong>
              {"  "}•{"  "}
              Out: <strong className="text-foreground">{record.checkOut || "—"}</strong>
            </span>
          </div>
          <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-slate-200 dark:bg-card dark:border-slate-800" title={record.deviceUsed || record.source}>
            <Fingerprint className="h-2.5 w-2.5 text-primary" />
            {record.deviceUsed ? (record.deviceUsed.length > 18 ? record.deviceUsed.slice(0, 18) + "…" : record.deviceUsed) : record.source}
          </span>
        </div>

        {/* 3 Metric Boxes (photo style) */}
        <div className="grid grid-cols-3 gap-2">
          {/* Box 1: Worked Hours */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Worked</p>
            <p className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
              {record.workedMinutes ? `${Math.floor(record.workedMinutes / 60)}h ${record.workedMinutes % 60}m` : "0h"}
            </p>
          </div>

          {/* Box 2: Late / Deficit */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Late / Punctual</p>
            <p
              className={cn(
                "mt-0.5 text-base font-bold",
                effectiveLateMinutes > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {effectiveLateMinutes > 0 ? `+${effectiveLateMinutes}m` : "On Time"}
            </p>
          </div>

          {/* Box 3: Confirmation Stage */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Stage</p>
            <p className="mt-0.5 truncate text-[12px] font-bold text-slate-800 dark:text-slate-200">
              {record.confirmation.replace("Awaiting ", "Awaiting ")}
            </p>
          </div>
        </div>

        {/* Quota Progress Bar */}
        <div className="mt-3.5 space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Daily Shift Quota ({targetHours.toFixed(1)}h)</span>
            <span className="font-semibold text-foreground">
              {workedHours} / {targetHours.toFixed(1)}h ({quotaPercent}%)
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                quotaPercent >= 100
                  ? "bg-emerald-500"
                  : quotaPercent >= 75
                  ? "bg-primary"
                  : quotaPercent > 0
                  ? "bg-amber-500"
                  : "bg-slate-300"
              )}
              style={{ width: `${Math.min(100, quotaPercent)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer / Actions Row */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">{fmtDate(record.date)}</span>
          {" · "}
          <span className="font-medium text-foreground">{shift?.name || "General Shift"}</span>{" "}
          <span className="font-normal text-muted-foreground">({shift?.start || "09:30"} - {shift?.end || "18:30"})</span>
        </div>

        <div className="flex items-center gap-1.5">
          {record.confirmation.startsWith("Awaiting") ? (
            <>
              <Button
                size="sm"
                className="h-7 px-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                onClick={onAdvance}
              >
                <Check className="mr-1 h-3 w-3" /> Confirm
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400"
                onClick={onDispute}
              >
                Dispute
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={onRequestCorrection}
            >
              <Sparkles className="mr-1 h-3 w-3 text-amber-500" /> Correct
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================================
 * COMPONENT: MonthCalendarSection
 * ========================================================================================= */
function MonthCalendarSection({
  records,
  isEmployee,
  onSelectDate,
}: {
  records: AttendanceRecord[];
  isEmployee: boolean;
  onSelectDate: (d: string) => void;
}) {
  const days = Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
  const offset = new Date("2026-10-01T00:00:00Z").getUTCDay();

  // Summary counts for this month
  const totalLogs = records.length;
  const presentDays = records.filter((r) => ["Present", "Late"].includes(r.status)).length;
  const lateDays = records.filter((r) => r.status === "Late").length;
  const leaveDays = records.filter((r) => r.status === "Leave").length;

  return (
    <div className="space-y-4">
      {/* Monthly Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm text-center">
          <p className="text-[11px] font-medium text-muted-foreground">Month Days</p>
          <p className="text-xl font-bold text-foreground mt-0.5">31 Days</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm text-center">
          <p className="text-[11px] font-medium text-muted-foreground">Working Days</p>
          <p className="text-xl font-bold text-foreground mt-0.5">22 Days</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm text-center">
          <p className="text-[11px] font-medium text-muted-foreground">Attendance Rate</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {Math.round((presentDays / Math.max(1, totalLogs)) * 100)}%
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm text-center">
          <p className="text-[11px] font-medium text-muted-foreground">Late Arrivals</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{lateDays}</p>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground text-sm">October 2026</h3>
            <p className="text-xs text-muted-foreground">
              {isEmployee
                ? "Your individual punch timeline for the month."
                : "Department heatmap (Present / Total in scope). Click any day to inspect register."}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Present
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Late
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Absent
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Leave
            </span>
          </div>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-2 text-center text-xs">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="py-1.5 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
              {day}
            </div>
          ))}

          {/* Empty cells before month start */}
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`empty-${i}`} className="h-20 rounded-xl bg-muted/20 border border-transparent" />
          ))}

          {/* Month Days */}
          {days.map((d, index) => {
            const dayNum = index + 1;
            const recs = records.filter((r) => r.date === d);
            const isToday = d === TODAY;

            if (isEmployee) {
              const r = recs[0];
              return (
                <button
                  key={d}
                  onClick={() => onSelectDate(d)}
                  className={cn(
                    "group flex h-20 flex-col items-center justify-between rounded-xl border p-2 text-xs transition-all hover:border-primary hover:shadow-sm",
                    isToday ? "ring-2 ring-primary ring-offset-1" : "",
                    r ? attColor(r.status) : "border-border bg-card text-muted-foreground"
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="font-bold text-[13px]">{dayNum}</span>
                    {r && (
                      <span className="text-[10px] font-semibold">
                        {r.workedMinutes ? `${(r.workedMinutes / 60).toFixed(1)}h` : ""}
                      </span>
                    )}
                  </div>
                  <div className="w-full text-center">
                    <p className="truncate text-[11px] font-medium">
                      {r?.status ?? (d > TODAY ? "Upcoming" : "—")}
                    </p>
                    {r?.checkIn && (
                      <p className="text-[10px] opacity-75 truncate">
                        {r.checkIn} - {r.checkOut || "?"}
                      </p>
                    )}
                  </div>
                </button>
              );
            }

            // Manager / Admin view
            const present = recs.filter((r) => ["Present", "Late", "Half Day"].includes(r.status)).length;
            const late = recs.filter((r) => r.status === "Late").length;
            const total = recs.length;

            return (
              <button
                key={d}
                onClick={() => onSelectDate(d)}
                className={cn(
                  "group flex h-20 flex-col items-center justify-between rounded-xl border border-border bg-card p-2 text-xs transition-all hover:border-primary hover:shadow-sm text-left",
                  isToday ? "ring-2 ring-primary ring-offset-1 bg-primary/5" : ""
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className={cn("font-bold text-[13px]", isToday ? "text-primary" : "text-foreground")}>
                    {dayNum}
                  </span>
                  {total > 0 && (
                    <span className="rounded bg-emerald-50 px-1 py-0.2 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                      {present}/{total}
                    </span>
                  )}
                </div>

                <div className="w-full">
                  {total > 0 ? (
                    <div className="space-y-0.5">
                      <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${(present / total) * 100}%` }}
                        />
                      </div>
                      {late > 0 && (
                        <p className="text-[10px] text-amber-600 font-medium">{late} late</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">{d > TODAY ? "" : "No logs"}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================================
 * COMPONENT: ConfirmationCard (Rich visual verification)
 * ========================================================================================= */
function ConfirmationCard({
  record,
  onConfirm,
  onDispute,
  onRequestCorrection,
}: {
  record: AttendanceRecord;
  onConfirm: () => void;
  onDispute: () => void;
  onRequestCorrection: () => void;
}) {
  const { data } = useStore();
  const emp = data.employees.find((e) => e.id === record.employeeId);
  const shift =
    data.shifts.find((s) => s.id === record.shiftId) ||
    data.shifts.find((s) => s.id === "SH-GEN") ||
    data.shifts.find((s) => s.name.toLowerCase().includes("general")) ||
    data.shifts[0];

  let effectiveLateMinutes = record.lateMinutes || 0;
  if (record.checkIn && shift?.start && !["Leave", "Absent", "Holiday", "Week Off"].includes(record.status)) {
    const [inH, inM] = record.checkIn.split(":").map(Number);
    const [shH, shM] = shift.start.split(":").map(Number);
    if (!isNaN(inH) && !isNaN(inM) && !isNaN(shH) && !isNaN(shM)) {
      const inMins = inH * 60 + inM;
      const startMins = shH * 60 + shM;
      const grace = shift.graceMinutes ?? 10;
      effectiveLateMinutes = inMins > startMins + grace ? inMins - startMins : 0;
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:bg-card dark:border-border hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <EmployeeAvatar id={record.employeeId} name={emp?.name || record.employeeId} size={42} />
          <div>
            <Link
              href={`/employees/${record.employeeId}`}
              className="font-semibold text-foreground text-sm hover:underline"
            >
              {emp?.name || record.employeeId}
            </Link>
            <p className="text-xs text-muted-foreground">{emp?.designation} · {emp?.department}</p>
          </div>
        </div>
        <StatusBadge status={record.confirmation} />
      </div>

      <div className="my-3.5 border-t border-slate-100 dark:border-slate-800" />

      {/* Date & Punch Info */}
      <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs dark:bg-muted/30">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Log Date:</span>
          <span className="font-semibold text-foreground">{fmtDate(record.date)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Assigned Shift:</span>
          <span className="font-semibold text-foreground">
            {shift?.name || "General Shift"} ({shift?.start || "09:30"} - {shift?.end || "18:30"})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Recorded Punches:</span>
          <span className="font-semibold text-foreground">
            {record.checkIn || "—"} → {record.checkOut || "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Duration:</span>
          <span className="font-semibold text-foreground">
            {record.workedMinutes ? `${Math.floor(record.workedMinutes / 60)}h ${record.workedMinutes % 60}m` : "—"}
          </span>
        </div>
        {effectiveLateMinutes > 0 && (
          <div className="flex justify-between text-amber-600 font-medium">
            <span>Late Arrival:</span>
            <span>+{effectiveLateMinutes} mins</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900"
          onClick={onDispute}
        >
          Dispute Punch
        </Button>
        <Button
          size="sm"
          className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={onConfirm}
        >
          <Check className="mr-1.5 h-3.5 w-3.5" /> Confirm Punch
        </Button>
      </div>
    </div>
  );
}

/* =========================================================================================
 * COMPONENT: CorrectionCard (Before/After punch comparison)
 * ========================================================================================= */
function CorrectionCard({
  correction,
  isAdmin,
  isManager,
  onApprove,
  onReject,
}: {
  correction: AttendanceCorrection;
  isAdmin: boolean;
  isManager: boolean;
  onApprove: (note?: string) => void;
  onReject: (note?: string) => void;
}) {
  const { data } = useStore();
  const emp = data.employees.find((e) => e.id === correction.employeeId);
  const canAct =
    (isManager && correction.status === "Awaiting Manager") ||
    (isAdmin && (correction.status === "Awaiting HR" || correction.status === "Awaiting Manager"));

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:bg-card dark:border-border hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <EmployeeAvatar id={correction.employeeId} name={emp?.name || correction.employeeId} size={42} />
          <div>
            <p className="font-semibold text-foreground text-sm">{emp?.name || correction.employeeId}</p>
            <p className="text-xs text-muted-foreground">
              {fmtDate(correction.date)} · Submitted {correction.submittedAt}
            </p>
          </div>
        </div>
        <StatusBadge status={correction.status} />
      </div>

      <div className="my-3.5 border-t border-slate-100 dark:border-slate-800" />

      {/* Side-by-side Punches */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs dark:bg-muted/20 dark:border-slate-800">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase">Original Punch</p>
          <p className="mt-1 font-semibold text-foreground">
            {correction.originalIn || "—"} → {correction.originalOut || "—"}
          </p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-2.5 text-xs">
          <p className="text-[10px] font-semibold text-primary uppercase">Requested Correction</p>
          <p className="mt-1 font-semibold text-primary">
            {correction.requestedIn} → {correction.requestedOut}
          </p>
        </div>
      </div>

      {/* Reason Box */}
      <div className="rounded-xl bg-slate-50 p-3 text-xs text-foreground dark:bg-muted/30">
        <span className="font-semibold text-muted-foreground">Stated Reason: </span>
        <span>"{correction.reason}"</span>
      </div>

      {correction.decisionNote && (
        <p className="mt-2 text-[11px] text-muted-foreground italic">
          Decision Note: {correction.decisionNote}
        </p>
      )}

      {/* Decision Buttons for Managers / Admins */}
      {canAct && (
        <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900"
            onClick={() => onReject()}
          >
            <X className="mr-1 h-3.5 w-3.5" /> Reject Request
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => onApprove()}
          >
            <Check className="mr-1 h-3.5 w-3.5" /> Approve & Update
          </Button>
        </div>
      )}
    </div>
  );
}

/* =========================================================================================
 * COMPONENT: ShiftsAndHolidaysView
 * ========================================================================================= */
function ShiftsAndHolidaysView({
  shifts,
  holidays,
  canManage = true,
  onCreateShift,
  onEditShift,
  onDeleteShift,
  onAddHoliday,
}: {
  shifts: Shift[];
  holidays: Holiday[];
  canManage?: boolean;
  onCreateShift?: () => void;
  onEditShift?: (shift: Shift) => void;
  onDeleteShift?: (shift: Shift) => void;
  onAddHoliday?: () => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Shifts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Standard Work Shifts</h3>
            <p className="text-xs text-muted-foreground">Rosters, working hours and weekly off schedules.</p>
          </div>
          {canManage && onCreateShift && (
            <Button size="sm" onClick={onCreateShift} className="h-8 gap-1.5 text-xs font-semibold">
              <Plus className="h-3.5 w-3.5" /> Create Shift
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {shifts.map((shift) => (
            <div
              key={shift.id}
              className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:bg-card dark:border-border hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-foreground text-sm truncate">{shift.name}</h4>
                    {shift.overnight && (
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                        Overnight
                      </span>
                    )}
                    {shift.overtimeEligible && (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        OT Eligible
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-primary">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {shift.start} — {shift.end}
                    </span>
                    <span className="text-muted-foreground font-normal">
                      · Full: {shift.minFullDayHours}h · Half: {shift.minHalfDayHours}h
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-muted dark:text-muted-foreground">
                    {shift.branches.join(", ")}
                  </span>
                  {canManage && onEditShift && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEditShift(shift)}
                      className="h-7 gap-1 px-2.5 text-xs text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                  )}
                  {canManage && onDeleteShift && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDeleteShift(shift)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      title="Delete Shift"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase">Grace Period</span>
                  <p className="font-semibold text-foreground">{shift.graceMinutes} mins</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase">Meal Break</span>
                  <p className="font-semibold text-foreground">{shift.breakMinutes} mins</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase">Weekly Offs</span>
                  <p className="font-semibold text-foreground">{shift.weeklyOffs.join(", ")}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Holidays */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Official Holidays (2026)</h3>
            <p className="text-xs text-muted-foreground">Government & mandatory branch holidays.</p>
          </div>
          {onAddHoliday && (
            <Button size="sm" onClick={onAddHoliday} className="h-8 gap-1.5 text-xs font-semibold">
              <Plus className="h-3.5 w-3.5" /> Add Holiday
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {holidays.map((h) => {
            const isPast = h.date < TODAY;
            return (
              <div
                key={h.id}
                className={cn(
                  "flex items-center justify-between rounded-2xl border p-4 shadow-sm transition-all",
                  isPast
                    ? "border-slate-200/60 bg-slate-50/50 opacity-70 dark:bg-card/50 dark:border-border"
                    : "border-slate-200/90 bg-white dark:bg-card dark:border-border"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{h.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(h.date)} • {h.branches === "All" ? "All Locations" : h.branches.join(", ")}
                    </p>
                  </div>
                </div>

                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-medium border",
                    isPast
                      ? "bg-slate-100 text-slate-500 border-slate-200 dark:bg-muted"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                  )}
                >
                  {isPast ? "Passed" : "Upcoming"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================================
 * COMPONENT: CorrectionDialog (Dialog for request correction)
 * ========================================================================================= */
function CorrectionDialog({
  open,
  prefill,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  prefill?: { empId?: string; date?: string; checkIn?: string; checkOut?: string } | null;
  onOpenChange: (v: boolean) => void;
  onSubmit: (c: Omit<AttendanceCorrection, "id" | "submittedAt" | "status">) => void;
}) {
  const { data } = useStore();
  const { isEmployee, uid, inScope } = useScope();

  const genShift =
    data.shifts.find((s) => s.id === "SH-GEN") ||
    data.shifts.find((s) => s.name.toLowerCase().includes("general")) ||
    data.shifts[0];
  const defaultIn = genShift?.start || "09:30";
  const defaultOut = genShift?.end || "18:30";

  const [emp, setEmp] = useState(prefill?.empId || uid);
  const [date, setDate] = useState(prefill?.date || TODAY);
  const [inT, setIn] = useState(prefill?.checkIn || defaultIn);
  const [outT, setOut] = useState(prefill?.checkOut || defaultOut);
  const [workMode, setWorkMode] = useState<"Office" | "WFH" | "Client Site" | "Tour">("Office");
  const [corrType, setCorrType] = useState("Missed In / Out Punch");
  const [ticketRef, setTicketRef] = useState("");
  const [reason, setReason] = useState("");

  // Sync when prefill or shift changes or dialog opens
  useEffect(() => {
    if (prefill) {
      if (prefill.empId) setEmp(prefill.empId);
      if (prefill.date) setDate(prefill.date);
      setIn(prefill.checkIn || defaultIn);
      setOut(prefill.checkOut || defaultOut);
    } else {
      setIn(defaultIn);
      setOut(defaultOut);
    }
  }, [prefill, defaultIn, defaultOut, open]);

  const rec = data.attendance.find((a) => a.employeeId === emp && a.date === date);
  const valid = reason.trim().length >= 4 && inT < outT;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Request Attendance Correction</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Adjust punch timings with work mode, exception justification, and audit verification.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2 text-xs">
          {!isEmployee && (
            <div className="col-span-2">
              <Field label="Employee" hint="Submitting correction for staff member">
                <Sel
                  value={emp}
                  onChange={setEmp}
                  options={data.employees.filter((e) => inScope(e.id)).map((e) => ({ value: e.id, label: `${e.name} (${e.id}) · ${e.department}` }))}
                />
              </Field>
            </div>
          )}

          <div className="col-span-2">
            <Field
              label="Date"
              hint={
                rec
                  ? `Existing punch: ${rec.checkIn ?? "—"} to ${rec.checkOut ?? "—"} (${rec.status})`
                  : "No existing punch on this day"
              }
            >
              <Input type="date" value={date} max={TODAY} onChange={(e) => setDate(e.target.value)} className="h-9" />
            </Field>
          </div>

          <Field label="Correct Check-in Time">
            <Input type="time" value={inT} onChange={(e) => setIn(e.target.value)} className="h-9" />
          </Field>

          <Field label="Correct Check-out Time" error={inT >= outT ? "Must be after check-in" : undefined}>
            <Input type="time" value={outT} onChange={(e) => setOut(e.target.value)} className="h-9" />
          </Field>

          <Field label="Work Location Mode">
            <Sel
              value={workMode}
              onChange={(v) => setWorkMode(v as "Office" | "WFH" | "Client Site" | "Tour")}
              options={["Office", "WFH", "Client Site", "Tour"]}
            />
          </Field>

          <Field label="Adjustment Classification">
            <Sel
              value={corrType}
              onChange={setCorrType}
              options={[
                "Missed In / Out Punch",
                "Biometric Scanner Error",
                "Client Site Visit",
                "Official Outstation Tour",
                "Late Arrival (Traffic / Emergency)",
                "Early Departure Approval",
              ]}
            />
          </Field>

          <div className="col-span-2">
            <Field label="Reference Ticket / Pre-approval Code (optional)" hint="e.g. IT Helpdesk ID or client meeting invitation">
              <Input
                value={ticketRef}
                onChange={(e) => setTicketRef(e.target.value)}
                placeholder="e.g. TICKET-9821 or Manager Slack Approval"
                className="h-9"
              />
            </Field>
          </div>

          <div className="col-span-2">
            <Field label="Reason for Correction" required hint="Provide detailed explanation for supervisor review">
              <Textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe why punch adjustment is necessary..."
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
                employeeId: emp,
                date,
                originalIn: rec?.checkIn,
                originalOut: rec?.checkOut,
                requestedIn: inT,
                requestedOut: outT,
                reason: `${corrType} (${workMode}): ${reason}${ticketRef ? ` [Ref: ${ticketRef}]` : ""}`,
                correctionType: corrType,
                workMode,
                ticketRef: ticketRef || undefined,
                submittedBy: uid,
              })
            }
            className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            Submit for Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================================================
 * COMPONENT: CreateShiftDialog
 * ========================================================================================= */
function CreateShiftDialog({
  open,
  initialData,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  initialData?: Shift | null;
  onOpenChange: (v: boolean) => void;
  onSubmit: (s: Omit<Shift, "id">, id?: string) => void;
}) {
  const [name, setName] = useState("");
  const [start, setStart] = useState("09:30");
  const [end, setEnd] = useState("18:30");
  const [graceMinutes, setGraceMinutes] = useState("15");
  const [breakMinutes, setBreakMinutes] = useState("60");
  const [minFullHours, setMinFullHours] = useState("8.5");
  const [minHalfHours, setMinHalfHours] = useState("4.5");
  const [overnight, setOvernight] = useState(false);
  const [overtimeEligible, setOvertimeEligible] = useState(false);
  const [selectedBranches, setSelectedBranches] = useState<Branch[]>(["Hyderabad", "Warangal"]);
  const [weeklyOffs, setWeeklyOffs] = useState<string[]>(["Saturday", "Sunday"]);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setStart(initialData.start || "09:30");
      setEnd(initialData.end || "18:30");
      setGraceMinutes(String(initialData.graceMinutes ?? 15));
      setBreakMinutes(String(initialData.breakMinutes ?? 60));
      setMinFullHours(String(initialData.minFullDayHours ?? 8.5));
      setMinHalfHours(String(initialData.minHalfDayHours ?? 4.5));
      setOvernight(Boolean(initialData.overnight));
      setOvertimeEligible(Boolean(initialData.overtimeEligible));
      setSelectedBranches(Array.isArray(initialData.branches) && initialData.branches.length > 0 ? initialData.branches : ["Hyderabad"]);
      setWeeklyOffs(Array.isArray(initialData.weeklyOffs) ? initialData.weeklyOffs : ["Saturday", "Sunday"]);
    } else {
      setName("");
      setStart("09:30");
      setEnd("18:30");
      setGraceMinutes("15");
      setBreakMinutes("60");
      setMinFullHours("8.5");
      setMinHalfHours("4.5");
      setOvernight(false);
      setOvertimeEligible(false);
      setSelectedBranches(["Hyderabad", "Warangal"]);
      setWeeklyOffs(["Saturday", "Sunday"]);
    }
  }, [initialData, open]);

  const valid = name.trim().length >= 3 && selectedBranches.length > 0;

  const toggleBranch = (b: Branch) => {
    setSelectedBranches((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]
    );
  };

  const toggleOff = (day: string) => {
    setWeeklyOffs((prev) =>
      prev.includes(day) ? prev.filter((x) => x !== day) : [...prev, day]
    );
  };

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                {initialData ? `Edit Shift: ${initialData.name}` : "Create Work Shift"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {initialData
                  ? "Update duty hours, grace leniency, break times, and weekly off policies."
                  : "Define duty timings, grace intervals, break policies, and roster weekly offs."}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2 text-xs">
          <div className="col-span-2">
            <Field label="Shift Name / Title" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Night Operations Shift / General Day"
                className="h-9"
              />
            </Field>
          </div>

          <Field label="Duty Start Time" required>
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="h-9" />
          </Field>

          <Field label="Duty End Time" required>
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9" />
          </Field>

          <Field label="Grace Period (Minutes)" hint="Leniency before marked Late">
            <Input
              value={graceMinutes}
              onChange={(e) => setGraceMinutes(e.target.value.replace(/\D/g, ""))}
              placeholder="15"
              className="h-9"
            />
          </Field>

          <Field label="Meal / Break Duration (Minutes)">
            <Input
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(e.target.value.replace(/\D/g, ""))}
              placeholder="60"
              className="h-9"
            />
          </Field>

          <Field label="Min Hours for Full Day">
            <Input
              value={minFullHours}
              onChange={(e) => setMinFullHours(e.target.value)}
              placeholder="8.5"
              className="h-9"
            />
          </Field>

          <Field label="Min Hours for Half Day">
            <Input
              value={minHalfHours}
              onChange={(e) => setMinHalfHours(e.target.value)}
              placeholder="4.5"
              className="h-9"
            />
          </Field>

          {/* Toggles */}
          <div className="col-span-2 flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-muted/30">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={overnight} onCheckedChange={(c) => setOvernight(Boolean(c))} />
              <span>Overnight Shift (Crosses midnight 00:00)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={overtimeEligible} onCheckedChange={(c) => setOvertimeEligible(Boolean(c))} />
              <span>Overtime (OT) Eligible</span>
            </label>
          </div>

          {/* Weekly Offs */}
          <div className="col-span-2 space-y-1.5">
            <span className="font-semibold text-foreground text-xs uppercase tracking-wider block">
              Scheduled Weekly Offs
            </span>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleOff(d)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                    weeklyOffs.includes(d)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Branches */}
          <div className="col-span-2 space-y-1.5">
            <span className="font-semibold text-foreground text-xs uppercase tracking-wider block">
              Applicable Office Branches
            </span>
            <div className="flex flex-wrap gap-2">
              {BRANCHES.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => toggleBranch(b)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                    selectedBranches.includes(b)
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
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
              onSubmit(
                {
                  name,
                  start,
                  end,
                  graceMinutes: Number(graceMinutes) || 15,
                  breakMinutes: Number(breakMinutes) || 60,
                  minFullDayHours: Number(minFullHours) || 8.5,
                  minHalfDayHours: Number(minHalfHours) || 4.5,
                  overnight,
                  overtimeEligible,
                  weeklyOffs,
                  branches: selectedBranches,
                },
                initialData?.id
              )
            }
            className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {initialData ? "Save Changes" : "Create Shift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================================================
 * COMPONENT: AddHolidayDialog
 * ========================================================================================= */
function AddHolidayDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (h: Omit<Holiday, "id">) => void;
}) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("2026-11-01");
  const [scope, setScope] = useState<"All" | "Custom">("All");
  const [branches, setBranches] = useState<Branch[]>(["Hyderabad"]);

  const valid = name.trim().length >= 3 && date;

  const toggleBranch = (b: Branch) => {
    setBranches((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Add Official Holiday</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Register a public, gazetted, or regional company holiday.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <Field label="Holiday Name / Occasion" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Diwali / Independence Day"
              className="h-9"
            />
          </Field>

          <Field label="Holiday Date" required>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9"
            />
          </Field>

          <Field label="Branch Scope">
            <Sel
              value={scope}
              onChange={(v) => setScope(v as "All" | "Custom")}
              options={["All", "Custom"]}
            />
          </Field>

          {scope === "Custom" && (
            <div className="space-y-1.5">
              <span className="font-semibold text-foreground text-xs uppercase tracking-wider block">
                Applicable Office Locations
              </span>
              <div className="flex flex-wrap gap-2">
                {BRANCHES.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleBranch(b)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                      branches.includes(b)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}
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
                name,
                date,
                branches: scope === "All" ? "All" : branches,
              })
            }
            className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            Add Holiday
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
