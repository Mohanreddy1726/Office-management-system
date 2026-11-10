"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/data/store";
import { BRANCHES, DEPARTMENTS } from "@/lib/data/departments";
import { PageHeader, KpiCard, Field } from "@/components/shared";
import { DataTable, exportCsv, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/shared";
import type { Employee, Role } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { fmtDate, inr, tenure, initials } from "@/lib/format";
import { AppShell } from "@/components/shell";
import {
  Download, Plus, Users, LayoutGrid, List, Mail, Phone, Building2,
  ArrowUpRight, Key, Trash2, BarChart3, Activity, Shield, CheckCircle2,
  Lock, AlertTriangle, GraduationCap, Briefcase, CreditCard, User, Landmark,
  ChevronRight, ChevronLeft, Check, Sparkles, FileText, ShieldCheck, Eye, EyeOff, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function EmployeesPage() {
  const { data, session, addEmployee, updateEmployee } = useStore();
  const router = useRouter();
  const role = session?.role;
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [branch, setBranch] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [openAdd, setOpenAdd] = useState(false);
  const [resetEmp, setResetEmp] = useState<Employee | null>(null);
  const [deleteEmp, setDeleteEmp] = useState<Employee | null>(null);

  // Sync employees from MongoDB API to ensure real status and new employees are always up-to-date
  useEffect(() => {
    fetch("/api/employees")
      .then((res) => (res.ok ? res.json() : null))
      .then((resData) => {
        if (resData?.success && Array.isArray(resData.employees)) {
          resData.employees.forEach((dbEmp: any) => {
            const id = dbEmp.employeeId;
            const existing = data.employees.find((e) => e.id === id);
            if (existing) {
              if (existing.status !== dbEmp.status) {
                updateEmployee(id, { status: dbEmp.status });
              }
            } else {
              addEmployee({
                id,
                name: dbEmp.name,
                workEmail: dbEmp.workEmail || dbEmp.email,
                personalEmail: dbEmp.personalEmail || "",
                phone: dbEmp.phone || "+91 90000 00000",
                dob: dbEmp.dateOfBirth || "2000-01-01",
                gender: dbEmp.gender || "Other",
                address: dbEmp.address || "",
                emergencyContact: dbEmp.emergencyContact?.phone || "+91 90000 00000",
                joiningDate: dbEmp.joiningDate || new Date().toISOString().slice(0, 10),
                branch: dbEmp.branch || "Hyderabad",
                department: dbEmp.department || "Operations",
                team: dbEmp.team || "Operations",
                designation: dbEmp.designation,
                employmentType: "Full-time",
                managerId: dbEmp.reportingManagerId || null,
                probationMonths: dbEmp.probationEndDate ? 6 : 0,
                status: dbEmp.status,
                annualCTC: dbEmp.salary?.annualCtc || 600000,
                monthlyGross: dbEmp.salary?.monthlyGross || 50000,
                aadhaarNumber: dbEmp.aadhaarNumber,
                pan: dbEmp.panNumber,
              });
            }
          });
        }
      })
      .catch((err) => console.warn("Failed to sync employees from DB:", err));
  }, []);

  const isManager = role === "manager";
  const rows = useMemo(() => {
    let list = data.employees;
    if (isManager && session) list = list.filter((e) => e.managerId === session.userId);
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(t) ||
          e.id.toLowerCase().includes(t) ||
          e.workEmail.toLowerCase().includes(t) ||
          e.designation.toLowerCase().includes(t)
      );
    }
    if (dept !== "all") list = list.filter((e) => e.department === dept);
    if (branch !== "all") list = list.filter((e) => e.branch === branch);
    if (statusFilter !== "all") list = list.filter((e) => e.status === statusFilter);
    return list;
  }, [data.employees, q, dept, branch, statusFilter, isManager, session]);

  const columns: Column<Employee>[] = [
    {
      key: "name",
      header: "Employee",
      sortValue: (r) => r.name,
      render: (r) => (
        <span className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 font-semibold text-white text-xs shadow-sm"
          >
            {initials(r.name)}
          </span>
          <span>
            <span className="block font-medium text-foreground">{r.name}</span>
            <span className="block text-[11px] text-muted-foreground">{r.id}</span>
          </span>
        </span>
      ),
    },
    { key: "dept", header: "Department", sortValue: (r) => r.department, render: (r) => r.department },
    { key: "desig", header: "Designation", render: (r) => r.designation, hideOnMobile: true },
    { key: "branch", header: "Branch", render: (r) => r.branch, hideOnMobile: true },
    {
      key: "joined",
      header: "Joined",
      sortValue: (r) => r.joiningDate,
      render: (r) => fmtDate(r.joiningDate),
      hideOnMobile: true,
    },
    { key: "tenure", header: "Tenure", render: (r) => tenure(r.joiningDate), hideOnMobile: true },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <AppShell>
      <div>
        <PageHeader
          title="Employees"
          description={
            isManager
              ? "Your direct team members."
              : "Directory of all employees across branches."
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() =>
                  exportCsv(
                    "employees.csv",
                    ["ID", "Name", "Email", "Department", "Designation", "Branch", "Status", "Joined"],
                    rows.map((e) => [
                      e.id,
                      e.name,
                      e.workEmail,
                      e.department,
                      e.designation,
                      e.branch,
                      e.status,
                      e.joiningDate,
                    ])
                  )
                }
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
              {role !== "employee" && (
                <Button size="sm" className="gap-1.5 text-xs" onClick={() => setOpenAdd(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add Employee
                </Button>
              )}
            </div>
          }
        />

        <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard
            label="Employees"
            value={String(rows.length)}
            icon={<Users className="h-4 w-4" />}
          />
          <KpiCard
            label="Active"
            value={String(rows.filter((e) => e.status === "Active").length)}
          />
          <KpiCard
            label="Pending Verification"
            value={String(rows.filter((e) => e.status === "Pending Verification").length)}
          />
          <KpiCard
            label="On Probation"
            value={String(rows.filter((e) => e.status === "Probation").length)}
          />
        </div>

        {/* Toolbar Controls */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search name, ID, email or role…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8 w-60 text-xs"
            />
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                {["all", ...DEPARTMENTS].map((d) => (
                  <SelectItem key={d} value={d}>
                    {d === "all" ? "All departments" : d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                {["all", ...BRANCHES].map((b) => (
                  <SelectItem key={b} value={b}>
                    {b === "all" ? "All branches" : b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Pending Verification">Pending Verification</SelectItem>
                <SelectItem value="Probation">Probation</SelectItem>
                <SelectItem value="On Notice">On Notice</SelectItem>
                <SelectItem value="Resigned">Resigned</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* View Switcher Toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
            <Button
              variant={view === "cards" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("cards")}
              className="h-7 gap-1.5 px-2.5 text-xs font-medium"
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Cards
            </Button>
            <Button
              variant={view === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("table")}
              className="h-7 gap-1.5 px-2.5 text-xs font-medium"
            >
              <List className="h-3.5 w-3.5" /> Table
            </Button>
          </div>
        </div>

        {/* Views */}
        {view === "cards" ? (
          rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium text-foreground">No employees found</p>
              <p className="mt-1 text-xs text-muted-foreground">Try clearing search filters or add a new employee.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {rows.map((emp) => (
                <EmployeeCard
                  key={emp.id}
                  emp={emp}
                  onResetPassword={() => setResetEmp(emp)}
                  onDelete={() => setDeleteEmp(emp)}
                />
              ))}
            </div>
          )
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(`/employees/${r.id}`)}
          />
        )}

        {/* Add Employee Dialog */}
        <AddEmployeeDialog
          open={openAdd}
          onOpenChange={setOpenAdd}
          onSubmit={async (newEmp) => {
            try {
              const res = await fetch("/api/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newEmp),
              });
              const data = await res.json();
              if (!res.ok) {
                toast.error(data.error || "Failed to add employee");
                throw new Error(data.error || "Failed to add employee");
              }

              const newId = data.employee?.employeeId || `OF-${1000 + (data.employees?.length || 0) + 1}`;
              const actualStatus = data.employee?.status || (newEmp.sendVerification ? "Pending Verification" : "Active");
              addEmployee({ ...newEmp, id: newId, status: actualStatus });
              setOpenAdd(false);

              if (data.emailSent) {
                toast.success(`Employee ${newEmp.name} created! Verification link sent to ${newEmp.personalEmail || newEmp.workEmail}`);
              } else {
                toast.success(`Employee ${newEmp.name} (${newId}) added successfully!`);
              }
            } catch (err: any) {
              if (!err.message?.includes("Failed to add employee")) {
                addEmployee(newEmp);
                setOpenAdd(false);
                toast.success("Employee saved to store");
              }
              throw err;
            }
          }}
        />

        {/* Reset Password Dialog */}
        <ResetPasswordDialog
          emp={resetEmp}
          onClose={() => setResetEmp(null)}
          onConfirm={(email) => {
            toast.success(`Password reset email sent to ${email} (simulated)`);
            setResetEmp(null);
          }}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteEmployeeDialog
          emp={deleteEmp}
          onClose={() => setDeleteEmp(null)}
          onConfirm={(emp) => {
            updateEmployee(emp.id, { status: "Inactive" }, "Deactivated by admin");
            toast.success(`Employee ${emp.name} marked as Inactive`);
            setDeleteEmp(null);
          }}
        />
      </div>
    </AppShell>
  );
}

/* ---------- Rich Employee Card Component (Matching Uploaded Design) ---------- */

function EmployeeCard({
  emp,
  onResetPassword,
  onDelete,
}: {
  emp: Employee;
  onResetPassword: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const { data } = useStore();

  // Calculate deterministic metrics for this employee
  const attRecords = data.attendance.filter((a) => a.employeeId === emp.id);
  const presentDays = attRecords.filter((a) => a.status === "Present" || a.status === "Late").length;
  const attPct = Math.min(100, Math.max(78, Math.round(((presentDays || 19) / 22) * 100)));
  const workHours = (presentDays || 19) * 8.5;
  const leaveBalance = Object.values(data.leaveBalances[emp.id] ?? {}).reduce((acc, v) => acc + (v as number), 0) || 12;

  // Custom responsibility focus description
  const responsibility = getResponsibility(emp);

  // Status mapping
  const isOnDuty = emp.status === "Active";
  const statusLabel = isOnDuty ? "On Duty" : emp.status;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
      <div>
        {/* Top Header: Avatar + Identity + Status & Actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {/* Square Avatar with Status Indicator Dot */}
            <div className="relative shrink-0">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl font-bold text-white shadow-sm text-base"
                style={{
                  background: getAvatarGradient(emp.id),
                }}
              >
                {initials(emp.name)}
              </div>
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-card",
                  isOnDuty
                    ? "bg-emerald-500"
                    : emp.status === "Probation"
                    ? "bg-blue-500"
                    : emp.status === "Pending Verification"
                    ? "bg-amber-500 animate-pulse"
                    : emp.status === "On Notice"
                    ? "bg-rose-500"
                    : "bg-slate-400"
                )}
                title={statusLabel}
              />
            </div>

            {/* Name + Badges */}
            <div className="min-w-0">
              <Link
                href={`/employees/${emp.id}`}
                className="group flex items-center gap-1 text-base font-semibold text-foreground hover:text-primary transition-colors"
              >
                <span className="truncate underline decoration-foreground/30 underline-offset-2 group-hover:decoration-primary">
                  {emp.name}
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
              </Link>

              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="inline-flex items-center gap-1 rounded-md border border-purple-200/70 bg-purple-50 px-2 py-0.5 font-medium text-purple-700">
                  <Shield className="h-3 w-3 shrink-0" />
                  <span className="truncate max-w-[130px]">{emp.designation}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Building2 className="h-3 w-3 shrink-0" />
                  <span className="truncate max-w-[130px]">
                    {emp.team && emp.team !== "Unassigned" ? emp.team : emp.department} · {emp.branch}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Top Right: Status Badge & Quick Icons */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                isOnDuty
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : emp.status === "Probation"
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : emp.status === "Pending Verification"
                  ? "border-amber-300 bg-amber-50 text-amber-800 font-semibold"
                  : emp.status === "On Notice"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {statusLabel}
            </span>

            <div className="flex items-center gap-1 text-muted-foreground">
              <button
                type="button"
                onClick={onResetPassword}
                className="rounded-md p-1 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                title="Reset Password"
              >
                <Key className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-md p-1 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                title="Delete Employee"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="my-3 border-t border-border/60" />

        {/* Contact Info */}
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
            <a
              href={`mailto:${emp.workEmail}`}
              className="truncate hover:text-foreground transition-colors"
            >
              {emp.workEmail}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
            <a
              href={`tel:${emp.phone || "+919849000000"}`}
              className="hover:text-foreground transition-colors"
            >
              {emp.phone || "+91 90000 00000"}
            </a>
          </div>
        </div>

        {/* Responsibility / Activity Banner */}
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2 text-xs text-blue-900">
          <Activity className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <span className="truncate font-medium">{responsibility}</span>
        </div>

        {/* 3 Metric KPI Boxes */}
        <div className="mt-3.5 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-border/80 bg-muted/30 p-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              ATTENDANCE
            </p>
            <p className="mt-1 text-lg font-bold text-foreground">{attPct}%</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-muted/30 p-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              WORK HOURS
            </p>
            <p className="mt-1 text-lg font-bold text-purple-600">{Math.round(workHours)}h</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-muted/30 p-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              LEAVE BAL
            </p>
            <p className="mt-1 text-lg font-bold text-emerald-600">{leaveBalance}d</p>
          </div>
        </div>

        {/* Quota / Progress Bar */}
        <div className="mt-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">Monthly Attendance Quota</span>
            <span className="font-semibold text-foreground">
              {presentDays || 19} / 22 ({attPct}%)
            </span>
          </div>
          <Progress value={attPct} className="mt-1.5 h-1.5 bg-slate-100" />
        </div>
      </div>

      {/* Card Footer: Joined Date + Action Buttons */}
      <div>
        <div className="my-3 border-t border-border/60" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            Joined {fmtDate(emp.joiningDate)}
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onResetPassword}
              className="h-8 gap-1 border-amber-300 bg-amber-50/40 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              <Key className="h-3.5 w-3.5 text-amber-600" />
              <span>Reset Password</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="h-8 gap-1 border-rose-200 bg-rose-50/40 text-xs font-medium text-rose-600 hover:bg-rose-100"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              <span>Delete</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => router.push(`/employees/${emp.id}`)}
              className="h-8 gap-1.5 border border-slate-200 bg-slate-100 text-xs font-medium text-slate-800 hover:bg-slate-200"
            >
              <BarChart3 className="h-3.5 w-3.5 text-slate-600" />
              <span>View Analytics</span>
              <ArrowUpRight className="h-3 w-3 text-slate-400" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Helper functions for Card styling */

function getAvatarGradient(id: string) {
  const gradients = [
    "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
    "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
    "linear-gradient(135deg, #10B981 0%, #047857 100%)",
    "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
    "linear-gradient(135deg, #EC4899 0%, #BE185D 100%)",
    "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)",
  ];
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return gradients[h % gradients.length];
}

function getResponsibility(emp: Employee) {
  const desig = emp.designation.toLowerCase();
  const dept = emp.department.toLowerCase();

  if (desig.includes("manager") || desig.includes("lead") || desig.includes("head")) {
    return "Supervising team operations & deliveries";
  }
  if (dept.includes("engineering") || desig.includes("engineer") || desig.includes("developer")) {
    return "Feature development & code reviews";
  }
  if (dept.includes("human resources") || desig.includes("hr") || desig.includes("recruiter")) {
    return "Talent acquisition & people operations";
  }
  if (dept.includes("finance") || desig.includes("account")) {
    return "Financial audits & payroll processing";
  }
  if (dept.includes("sales") || desig.includes("business")) {
    return "Client relationships & growth pipelines";
  }
  if (dept.includes("support")) {
    return "Customer resolution & service desk";
  }
  return "Operations execution & facility workflows";
}

/* ---------- Dialog Modals ---------- */

function AddEmployeeDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (e: any) => Promise<void>;
}) {
  const { data } = useStore();
  type TabKey = "personal" | "job" | "education" | "experience" | "compensation" | "credentials";
  const [activeTab, setActiveTab] = useState<TabKey>("personal");
  const [submitting, setSubmitting] = useState(false);

  // 1. Personal Details
  const [name, setName] = useState("");
  const [dob, setDob] = useState("1996-05-15");
  const [gender, setGender] = useState("Female");
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [maritalStatus, setMaritalStatus] = useState<"Single" | "Married" | "Other">("Single");
  const [phone, setPhone] = useState("+91 98490 12345");
  const [personalEmail, setPersonalEmail] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [address, setAddress] = useState("");
  const [pan, setPan] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");

  // 2. Job & Organization
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState(DEPARTMENTS[0]!);
  const [team, setTeam] = useState("Frontend Platform");
  const [branch, setBranch] = useState(BRANCHES[0]!);
  const [employmentType, setEmploymentType] = useState<"Full-time" | "Part-time" | "Contract" | "Intern">("Full-time");
  const [managerId, setManagerId] = useState<string>("");
  const [joining, setJoining] = useState("2026-11-15");
  const [probationMonths, setProbationMonths] = useState("6");
  const [workEmail, setWorkEmail] = useState("");

  // 3. Education & Qualification
  const [qualification, setQualification] = useState("B.Tech in Computer Science");
  const [institution, setInstitution] = useState("JNTU Hyderabad");
  const [graduationYear, setGraduationYear] = useState("2022");
  const [grade, setGrade] = useState("8.2 CGPA");

  // 4. Prior Experience
  const [experienceYears, setExperienceYears] = useState("2.5");
  const [previousCompany, setPreviousCompany] = useState("");
  const [previousDesignation, setPreviousDesignation] = useState("");
  const [skills, setSkills] = useState("React, TypeScript, Next.js, Node.js");

  // 5. Compensation & Banking (No PF & No ESI)
  const [ctc, setCtc] = useState("900000");
  const [salaryStructureId, setSalaryStructureId] = useState("SS-STANDARD");
  const [bankName, setBankName] = useState("HDFC Bank");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("HDFC0001844");
  const [paymentMethod, setPaymentMethod] = useState("Corporate NEFT");

  // 6. Login Credentials & Access
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("GvkEmp@2026");
  const [userRole, setUserRole] = useState<Role>("employee");
  const [sendVerification, setSendVerification] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Auto-format Aadhaar Card as 12 digits: "XXXX XXXX XXXX"
  const handleAadhaarChange = (val: string) => {
    const raw = val.replace(/\D/g, "").slice(0, 12);
    const parts = [];
    for (let i = 0; i < raw.length; i += 4) {
      parts.push(raw.slice(i, i + 4));
    }
    setAadhaarNumber(parts.join(" "));
  };

  // Update auto-generated work email as name changes
  const handleNameChange = (val: string) => {
    setName(val);
    const sanitized = val.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
    const generated = sanitized ? `${sanitized}@gvkedutech.com` : "";
    if (!workEmail || workEmail.includes("@gvkedutech.com") || workEmail.includes("@rendesk.example") || workEmail.includes("@officeflow.example")) {
      setWorkEmail(generated);
    }
    if (!loginEmail || loginEmail.includes("@gvkedutech.com")) {
      setLoginEmail(generated);
    }
  };

  const calculatedMonthly = Math.round((Number(ctc) || 0) / 12 / 1000) * 1000;
  const cleanAadhaar = aadhaarNumber.replace(/\s+/g, "");
  const valid =
    name.trim().length >= 2 &&
    designation.trim().length >= 2 &&
    phone.trim().length >= 8 &&
    Number(ctc) > 0 &&
    cleanAadhaar.length === 12;

  const tabsConfig = [
    { key: "personal" as const, label: "1. Personal", icon: <User className="h-3.5 w-3.5" /> },
    { key: "job" as const, label: "2. Job & Org", icon: <Building2 className="h-3.5 w-3.5" /> },
    { key: "education" as const, label: "3. Education", icon: <GraduationCap className="h-3.5 w-3.5" /> },
    { key: "experience" as const, label: "4. Experience", icon: <Briefcase className="h-3.5 w-3.5" /> },
    { key: "compensation" as const, label: "5. Salary & Bank", icon: <Landmark className="h-3.5 w-3.5" /> },
    { key: "credentials" as const, label: "6. Login & Access", icon: <Key className="h-3.5 w-3.5" /> },
  ];

  const handleFinalSubmit = async () => {
    if (cleanAadhaar.length !== 12) {
      toast.error("Please enter a complete 12-digit Aadhaar Card number.");
      setActiveTab("personal");
      return;
    }
    if (!valid) {
      toast.error("Please fill in required fields: Full Name, Designation, Phone, 12-digit Aadhaar, and Annual CTC");
      return;
    }

    const emailToUse = workEmail.trim() || `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@gvkedutech.com`;
    const acc = accountNumber.trim() || `501004${Math.floor(10000000 + Math.random() * 90000000)}`;

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        workEmail: emailToUse,
        personalEmail: personalEmail.trim() || `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@gmail.com`,
        phone: phone.trim(),
        dob,
        gender,
        bloodGroup,
        maritalStatus,
        address: address.trim() || "Hyderabad, Telangana, India",
        emergencyContact: emergencyContact.trim() || "Family Contact: +91 98490 00000",
        pan: pan.trim().toUpperCase() || "ABCDE1234F",
        aadhaarNumber: cleanAadhaar,
        aadharLast4: cleanAadhaar.slice(-4),

        // Job Details
        designation: designation.trim(),
        department,
        team: team.trim() || "Frontend Platform",
        branch,
        employmentType,
        managerId: managerId || null,
        joiningDate: joining,
        probationMonths: Number(probationMonths),
        status: sendVerification ? "Pending Verification" : (Number(probationMonths) > 0 ? "Probation" : "Active"),

        // Education
        qualification: qualification.trim(),
        institution: institution.trim(),
        graduationYear: graduationYear ? Number(graduationYear) : 2022,
        grade: grade.trim(),

        // Prior Experience
        experienceYears: experienceYears ? Number(experienceYears) : 0,
        previousCompany: previousCompany.trim() || "Fresher / None",
        previousDesignation: previousDesignation.trim() || "Graduate Trainee",
        skills: skills.trim(),

        // Compensation & Banking (No PF & No ESI)
        annualCTC: Number(ctc),
        monthlyGross: calculatedMonthly,
        salaryStructureId:
          salaryStructureId ||
          (Number(ctc) > 1500000 ? "SS-EXEC" : Number(ctc) > 800000 ? "SS-SENIOR" : "SS-STANDARD"),
        bankName,
        accountNumber: acc,
        bankLast4: acc.slice(-4),
        ifscCode: ifscCode.trim().toUpperCase(),
        paymentMethod,

        // Login & Credentials
        loginEmail: loginEmail.trim() || emailToUse,
        loginPassword: loginPassword.trim() || "GvkEmp@2026",
        role: userRole,
        sendVerification,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-5xl max-h-[92vh] overflow-y-auto overflow-x-hidden p-6 sm:p-8">
        <DialogHeader className="border-b border-border/80 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Add New Employee (Full Onboarding Profile)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Record personal identity, job placement, educational qualifications, prior experience, banking, and login credentials.
              </DialogDescription>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Zero PF/ESI Compliant
            </span>
          </div>

          {/* Stepper Tabs Bar (Grid responsive without horizontal scrollbar) */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1 w-full">
            {tabsConfig.map((t) => (
              <Button
                key={t.key}
                type="button"
                size="sm"
                variant={activeTab === t.key ? "default" : "outline"}
                className={`h-9 text-xs gap-1.5 rounded-lg px-2.5 font-medium transition truncate w-full ${
                  activeTab === t.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60"
                }`}
                onClick={() => setActiveTab(t.key)}
              >
                <span className="shrink-0">{t.icon}</span>
                <span className="truncate">{t.label}</span>
              </Button>
            ))}
          </div>
        </DialogHeader>

        {/* Tab 1: Personal Details */}
        {activeTab === "personal" && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Full Legal Name" required>
                <Input
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Meera Iyer"
                  className="h-9 text-xs"
                />
              </Field>

              <Field label="Date of Birth" required>
                <Input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="h-9 text-xs"
                />
              </Field>

              <Field label="Gender" required>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                    <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Blood Group">
                <Select value={bloodGroup} onValueChange={setBloodGroup}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => (
                      <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Marital Status">
                <Select value={maritalStatus} onValueChange={(v) => setMaritalStatus(v as any)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single">Single</SelectItem>
                    <SelectItem value="Married">Married</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Contact Phone Number" required>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98490 12345"
                  className="h-9 text-xs"
                />
              </Field>

              <Field label="Personal Email Address">
                <Input
                  type="email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  placeholder="meera.iyer@gmail.com"
                  className="h-9 text-xs"
                />
              </Field>

              <Field label="Emergency Contact (Name & Phone)">
                <Input
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="Ramesh Iyer (+91 98490 54321)"
                  className="h-9 text-xs"
                />
              </Field>

              <Field label="PAN Card Number">
                <Input
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className="h-9 text-xs font-mono uppercase"
                  maxLength={10}
                />
              </Field>

              <Field label="Complete Aadhaar Card Number (12 Digits)" required hint="Format: XXXX XXXX XXXX">
                <Input
                  value={aadhaarNumber}
                  onChange={(e) => handleAadhaarChange(e.target.value)}
                  placeholder="1234 5678 9012"
                  className="h-9 text-xs font-mono font-semibold tracking-wider"
                  maxLength={14}
                />
              </Field>

              <div className="col-span-1 sm:col-span-2">
                <Field label="Current Residential Address">
                  <Textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Flat 402, Lotus Towers, Madhapur, Hyderabad - 500081"
                    className="text-xs min-h-[60px]"
                  />
                </Field>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                size="sm"
                className="gap-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                onClick={() => setActiveTab("job")}
              >
                Next: Job & Organization <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Tab 2: Job & Organization */}
        {activeTab === "job" && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Designation / Role Title" required>
                <Input
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Senior Frontend Engineer"
                  className="h-9 text-xs"
                />
              </Field>

              <Field label="Department" required>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Assigned Team" required>
                <Select value={team} onValueChange={setTeam}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      "Frontend Platform",
                      "Backend Services",
                      "Quality Engineering",
                      "Talent Acquisition",
                      "Finance & Accounts",
                      "Growth & Sales",
                      "Support Desk",
                      "Facilities & Admin",
                      "Leadership & Strategy",
                    ].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Branch Office" required>
                <Select value={branch} onValueChange={(v) => setBranch(v as typeof branch)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BRANCHES.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Employment Type">
                <Select value={employmentType} onValueChange={(v) => setEmploymentType(v as any)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full-time">Full-time Permanent</SelectItem>
                    <SelectItem value="Part-time">Part-time</SelectItem>
                    <SelectItem value="Contract">Fixed Term Contract</SelectItem>
                    <SelectItem value="Intern">Intern / Trainee</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Reporting Manager / Team Lead">
                <select
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                >
                  <option value="">Directly to Leadership (No Lead)</option>
                  {data.employees
                    .filter((emp) => emp.designation.includes("Lead") || emp.designation.includes("Manager") || emp.designation.includes("Director"))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.designation} • {m.department})
                      </option>
                    ))}
                </select>
              </Field>

              <Field label="Date of Joining" required>
                <Input
                  type="date"
                  value={joining}
                  onChange={(e) => setJoining(e.target.value)}
                  className="h-9 text-xs"
                />
              </Field>

              <Field label="Probation Duration">
                <Select value={probationMonths} onValueChange={setProbationMonths}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 Months</SelectItem>
                    <SelectItem value="6">6 Months</SelectItem>
                    <SelectItem value="0">Zero / Direct Confirmed</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <div className="col-span-1 sm:col-span-2">
                <Field label="Official Corporate Work Email" hint="Auto-generated based on legal name">
                  <Input
                    type="email"
                    value={workEmail}
                    onChange={(e) => setWorkEmail(e.target.value)}
                    placeholder="meera.iyer@gvkedutech.com"
                    className="h-9 text-xs"
                  />
                </Field>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => setActiveTab("personal")}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Back: Personal Details
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                onClick={() => setActiveTab("education")}
              >
                Next: Education <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Tab 3: Education & Qualifications */}
        {activeTab === "education" && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary shrink-0" />
              <span>Record the employee's highest academic qualification, granting university, and graduation metrics.</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Highest Degree / Qualification" required>
                <Input
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                  placeholder="e.g. B.Tech / B.E, MCA, MBA, M.Tech"
                  className="h-9 text-xs"
                />
              </Field>

              <Field label="University / College / Institute" required>
                <Input
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="e.g. JNTU Hyderabad / Osmania University"
                  className="h-9 text-xs"
                />
              </Field>

              <Field label="Year of Graduation / Passing">
                <Input
                  type="number"
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value)}
                  placeholder="2023"
                  className="h-9 text-xs font-mono"
                />
              </Field>

              <Field label="Final Grade / Percentage / CGPA">
                <Input
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="e.g. 8.4 CGPA or 78%"
                  className="h-9 text-xs"
                />
              </Field>
            </div>

            <div className="flex justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => setActiveTab("job")}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Back: Job & Org
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                onClick={() => setActiveTab("experience")}
              >
                Next: Prior Experience <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Tab 4: Prior Experience */}
        {activeTab === "experience" && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary shrink-0" />
              <span>Prior professional career background, past employers, years of experience, and core skills.</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Total Prior Experience (Years)">
                <Input
                  type="number"
                  step="0.5"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  placeholder="e.g. 3.5 (0 for freshers)"
                  className="h-9 text-xs font-mono"
                />
              </Field>

              <Field label="Previous Employer / Organization">
                <Input
                  value={previousCompany}
                  onChange={(e) => setPreviousCompany(e.target.value)}
                  placeholder="e.g. Infosys / TCS / Tech Mahindra (or None)"
                  className="h-9 text-xs"
                />
              </Field>

              <Field label="Previous Designation / Job Title">
                <Input
                  value={previousDesignation}
                  onChange={(e) => setPreviousDesignation(e.target.value)}
                  placeholder="e.g. Associate Software Engineer"
                  className="h-9 text-xs"
                />
              </Field>

              <div className="col-span-1 sm:col-span-2">
                <Field label="Core Technical & Professional Skills">
                  <Input
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder="e.g. React, Next.js, TypeScript, PostgreSQL, UI Design"
                    className="h-9 text-xs"
                  />
                </Field>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => setActiveTab("education")}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Back: Education
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                onClick={() => setActiveTab("compensation")}
              >
                Next: Salary & Banking <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Tab 5: Compensation & Banking */}
        {activeTab === "compensation" && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Zero PF and Zero ESI deductions applied. Total CTC directly drives gross take-home pay.</span>
              </div>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">Zero Statutory Cut</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Annual Cost to Company (CTC ₹)" required>
                <Input
                  type="number"
                  value={ctc}
                  onChange={(e) => setCtc(e.target.value)}
                  placeholder="900000"
                  className="h-9 text-xs font-mono font-semibold"
                />
              </Field>

              <Field label="Calculated Monthly Gross (₹)" hint="Auto-computed: Annual CTC ÷ 12">
                <Input
                  value={inr(calculatedMonthly)}
                  disabled
                  className="h-9 text-xs bg-muted/40 font-mono font-bold text-foreground"
                />
              </Field>

              <Field label="Salary Structure Template">
                <Select value={salaryStructureId} onValueChange={setSalaryStructureId}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SS-STANDARD">Standard (No PF / No ESI) — Up to ₹8 LPA</SelectItem>
                    <SelectItem value="SS-SENIOR">Senior Staff (No PF / No ESI) — ₹8 to ₹15 LPA</SelectItem>
                    <SelectItem value="SS-EXEC">Executive Grade (No PF / No ESI) — Above ₹15 LPA</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Beneficiary Bank Name" required>
                <Select value={bankName} onValueChange={setBankName}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HDFC Bank">HDFC Bank</SelectItem>
                    <SelectItem value="ICICI Bank">ICICI Bank</SelectItem>
                    <SelectItem value="State Bank of India">State Bank of India</SelectItem>
                    <SelectItem value="Axis Bank">Axis Bank</SelectItem>
                    <SelectItem value="Kotak Mahindra Bank">Kotak Mahindra Bank</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Bank Account Number" required>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="50100412345678"
                  className="h-9 text-xs font-mono"
                />
              </Field>

              <Field label="Bank IFSC Code" required>
                <Input
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="HDFC0001844"
                  className="h-9 text-xs font-mono uppercase"
                />
              </Field>

              <Field label="Payment Disbursement Mode">
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Corporate NEFT">Corporate NEFT</SelectItem>
                    <SelectItem value="RTGS Direct">RTGS Direct</SelectItem>
                    <SelectItem value="Bank Account Transfer">Bank Account Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="flex justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => setActiveTab("experience")}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Back: Prior Experience
              </Button>

              <Button
                type="button"
                size="sm"
                className="gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                onClick={() => setActiveTab("credentials")}
              >
                Next: Login Credentials <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Tab 6: Login Credentials & Access */}
        {activeTab === "credentials" && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shrink-0 mt-0.5">
                <Key className="h-4 w-4" />
              </div>
              <div className="text-xs space-y-1">
                <p className="font-semibold text-foreground">Employee Login Credentials & Verification</p>
                <p className="text-muted-foreground leading-relaxed">
                  The initial credentials configured here will automatically be sent to the employee from <strong className="text-foreground font-mono">gvkdigital01@gmail.com</strong> once they verify their email.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Work Login Email" required hint="Used to sign in to the portal">
                <Input
                  type="email"
                  value={loginEmail || workEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="employee@gvkedutech.com"
                  className="h-9 text-xs font-mono"
                />
              </Field>

              <Field label="Assigned System Role" required hint="Controls permissions & dashboard view">
                <Select value={userRole} onValueChange={(v) => setUserRole(v as Role)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee (Standard Portal Access)</SelectItem>
                    <SelectItem value="manager">Manager (Attendance & Leave Approver)</SelectItem>
                    <SelectItem value="hr_admin">HR Admin (Human Resources Operator)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <div className="col-span-1 sm:col-span-2">
                <Field
                  label="Initial Temporary Password"
                  required
                  hint="Dispatched to employee upon successful email verification"
                >
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Enter password"
                        className="h-9 text-xs font-mono pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs gap-1 shrink-0"
                      onClick={() => {
                        const rand = `Gvk@${Math.floor(100000 + Math.random() * 900000)}`;
                        setLoginPassword(rand);
                        toast.info(`Generated password: ${rand}`);
                      }}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Generate
                    </Button>
                  </div>
                </Field>
              </div>

              <div className="col-span-1 sm:col-span-2 rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-primary" /> Send Email Verification Upon Creation
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      An activation email from <span className="font-mono text-primary font-medium">gvkdigital01@gmail.com</span> will be sent to the employee with an account verification link.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={sendVerification}
                    onChange={(e) => setSendVerification(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                </div>

                <div className="border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                  Verification target: <span className="font-semibold text-foreground">{personalEmail || workEmail || "Employee email"}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => setActiveTab("compensation")}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Back: Salary & Banking
              </Button>

              <Button
                type="button"
                size="sm"
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                disabled={!valid || submitting}
                onClick={handleFinalSubmit}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Adding & Sending Verification…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" /> Save Employee & Dispatch Verification
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="border-t border-border/80 pt-3 flex sm:justify-between items-center">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              disabled={!valid || submitting}
              onClick={handleFinalSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…
                </>
              ) : (
                "Save Employee"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  emp,
  onClose,
  onConfirm,
}: {
  emp: Employee | null;
  onClose: () => void;
  onConfirm: (email: string) => void;
}) {
  if (!emp) return null;
  return (
    <Dialog open={Boolean(emp)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Key className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle>Reset employee password</DialogTitle>
              <DialogDescription>
                Generate a password reset link for {emp.name}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="rounded-lg border border-amber-200/60 bg-amber-50/50 p-3 text-xs text-amber-900">
          A secure one-time password reset link will be dispatched to <strong>{emp.workEmail}</strong>.
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => onConfirm(emp.workEmail)}
          >
            Send reset link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteEmployeeDialog({
  emp,
  onClose,
  onConfirm,
}: {
  emp: Employee | null;
  onClose: () => void;
  onConfirm: (emp: Employee) => void;
}) {
  if (!emp) return null;
  return (
    <Dialog open={Boolean(emp)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle>Deactivate employee</DialogTitle>
              <DialogDescription>
                Are you sure you want to deactivate {emp.name}?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          This will set the status of <strong>{emp.name} ({emp.id})</strong> to <em>Inactive</em> and revoke access. You can reactivate this account later from Administration.
        </p>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(emp)}
          >
            Confirm Deactivation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
