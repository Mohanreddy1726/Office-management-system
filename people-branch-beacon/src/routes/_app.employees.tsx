import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useStore } from "@/lib/data/store";
import { BRANCHES, DEPARTMENTS } from "@/lib/data/departments";
import { PageHeader, KpiCard, Field, EmployeeAvatar } from "@/components/shared";
import { DataTable, exportCsv, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/shared";
import type { Employee } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { fmtDate, inr, tenure } from "@/lib/format";
import { Download, Plus, Users } from "lucide-react";

export const Route = createFileRoute("/_app/employees")({
  component: EmployeesPage,
});

function EmployeesPage() {
  const { data, session, addEmployee } = useStore();
  const navigate = useNavigate();
  const role = session?.role;
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [branch, setBranch] = useState("all");
  const [open, setOpen] = useState(false);

  const isManager = role === "manager";
  const rows = useMemo(() => {
    let list = data.employees;
    if (isManager && session) list = list.filter((e) => e.managerId === session.userId);
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(t) || e.id.toLowerCase().includes(t) || e.workEmail.includes(t));
    }
    if (dept !== "all") list = list.filter((e) => e.department === dept);
    if (branch !== "all") list = list.filter((e) => e.branch === branch);
    return list;
  }, [data.employees, q, dept, branch, isManager, session]);

  const columns: Column<Employee>[] = [
    {
      key: "name", header: "Employee", sortValue: (r) => r.name,
      render: (r) => (
        <span className="flex items-center gap-2.5">
          <EmployeeAvatar id={r.id} name={r.name} size={30} />
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
    { key: "joined", header: "Joined", sortValue: (r) => r.joiningDate, render: (r) => fmtDate(r.joiningDate), hideOnMobile: true },
    { key: "tenure", header: "Tenure", render: (r) => tenure(r.joiningDate), hideOnMobile: true },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Employees"
        description={isManager ? "Your direct team members." : "Directory of all employees across branches."}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => exportCsv("employees.csv", ["ID", "Name", "Email", "Department", "Branch", "Status"], rows.map((e) => [e.id, e.name, e.workEmail, e.department, e.branch, e.status]))}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            {role !== "employee" && (
              <Button size="sm" className="gap-1.5 text-xs" onClick={() => setOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Add Employee
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Employees" value={String(rows.length)} icon={<Users className="h-4 w-4" />} />
        <KpiCard label="On probation" value={String(rows.filter((e) => e.status === "Probation").length)} />
        <KpiCard label="On notice" value={String(rows.filter((e) => e.status === "On Notice").length)} />
        <KpiCard label="Departments" value={String(new Set(rows.map((e) => e.department)).size)} />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate({ to: `/employees/${r.id}` })}
        toolbar={
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Search name, ID or email…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-56 text-xs" />
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>{["all", ...DEPARTMENTS].map((d) => <SelectItem key={d} value={d}>{d === "all" ? "All departments" : d}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Branch" /></SelectTrigger>
              <SelectContent>{["all", ...BRANCHES].map((b) => <SelectItem key={b} value={b}>{b === "all" ? "All branches" : b}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        }
      />

      <AddEmployeeDialog open={open} onOpenChange={setOpen} onSubmit={(emp) => {
        addEmployee(emp);
        setOpen(false);
        toast.success("Employee added (demo)");
      }} />
    </div>
  );
}

function AddEmployeeDialog({ open, onOpenChange, onSubmit }: {
  open: boolean; onOpenChange: (v: boolean) => void; onSubmit: (e: Omit<Employee, "id">) => void;
}) {
  const { data } = useStore();
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState(DEPARTMENTS[0]!);
  const [branch, setBranch] = useState(BRANCHES[0]!);
  const [joining, setJoining] = useState("2026-11-01");
  const [ctc, setCtc] = useState("900000");
  const valid = name.trim().length > 2 && designation.trim().length > 2 && /^\d{5,}$/.test(ctc);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add employee</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Meera Iyer" /></Field>
          <Field label="Designation" required><Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Software Engineer" /></Field>
          <Field label="Department">
            <Select value={department} onValueChange={(v) => setDepartment(v as typeof department)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
          </Field>
          <Field label="Branch">
            <Select value={branch} onValueChange={(v) => setBranch(v as typeof branch)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select>
          </Field>
          <Field label="Joining date"><Input type="date" value={joining} onChange={(e) => setJoining(e.target.value)} /></Field>
          <Field label="Annual CTC (₹)" required hint="Approximate; editable later"><Input value={ctc} onChange={(e) => setCtc(e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Notes"><Textarea rows={2} placeholder="Anything the onboarding team should know" /></Field></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid} onClick={() => onSubmit({
            name: name.trim(), designation: designation.trim(), department, branch,
            team: "Unassigned", workEmail: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@officeflow.example`,
            personalEmail: "", phone: "", dob: "1995-01-01", gender: "", address: "", emergencyContact: "",
            joiningDate: joining, employmentType: "Full-time", managerId: null, probationMonths: 6,
            status: "Probation", annualCTC: Number(ctc), monthlyGross: Math.round(Number(ctc) / 12 / 1000) * 1000,
            salaryStructureId: Number(ctc) > 1500000 ? "SS-EXEC" : Number(ctc) > 800000 ? "SS-SENIOR" : "SS-STANDARD",
          })}>Save employee</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
