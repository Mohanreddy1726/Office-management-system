"use client";

import { useState, useEffect } from "react";
import { Users, Plus, Search, Mail, Phone } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

export function EmployeesClient() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [status, setStatus] = useState("All");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    designation: "",
    department: "Engineering",
    joiningDate: new Date().toISOString().slice(0, 10),
    annualCtc: "1200000",
    status: "Active",
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchEmployees = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (department !== "All") params.set("department", department);
      if (status !== "All") params.set("status", status);

      const res = await fetch(`/api/employees?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setEmployees(data.employees);
      }
    } catch {
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [search, department, status]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create employee");

      toast.success(`Employee ${data.employee.name} (${data.employee.employeeId}) created successfully!`);
      setShowAddModal(false);
      setFormData({
        name: "",
        email: "",
        phone: "",
        designation: "",
        department: "Engineering",
        joiningDate: new Date().toISOString().slice(0, 10),
        annualCtc: "1200000",
        status: "Active",
      });
      fetchEmployees();
    } catch (err: any) {
      toast.error(err.message || "Failed to add employee");
    } finally {
      setSubmitting(false);
    }
  };

  const departments = ["All", "Engineering", "Human Resources", "Executive", "Design", "Finance", "Operations"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Employees Directory
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage employee records, roles, designations, and compensation for the Headquarters.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition"
        >
          <Plus className="h-4 w-4" /> Add Employee
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, ID (e.g. OF-1001), or designation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
          >
            {departments.map((d) => (
              <option key={d} value={d}>
                Dept: {d}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Probation">Probation</option>
            <option value="Notice">Notice</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Employees Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground font-semibold">
              <tr>
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-5 py-3.5">Designation & Dept</th>
                <th className="px-5 py-3.5">Contact</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Joining Date</th>
                <th className="px-5 py-3.5 text-right">Annual CTC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Loading directory…
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No employees matching the criteria found.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-muted/30 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                          {emp.name.split(" ").map((n: string) => n[0]).join("")}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{emp.name}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">{emp.employeeId}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground">{emp.designation}</p>
                      <p className="text-[11px] text-muted-foreground">{emp.department}</p>
                    </td>

                    <td className="px-5 py-3.5 text-muted-foreground">
                      <p className="flex items-center gap-1.5 text-foreground">
                        <Mail className="h-3 w-3 text-muted-foreground" /> {emp.email}
                      </p>
                      <p className="flex items-center gap-1.5 mt-0.5 text-[11px]">
                        <Phone className="h-3 w-3 text-muted-foreground" /> {emp.phone}
                      </p>
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          emp.status === "Active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : emp.status === "Probation"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : emp.status === "Notice"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {emp.status}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-muted-foreground font-medium">
                      {formatDate(emp.joiningDate)}
                    </td>

                    <td className="px-5 py-3.5 text-right font-semibold text-foreground">
                      {formatCurrency(emp.salary?.annualCtc || 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-base font-bold text-foreground">Add New Employee</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Suresh Kumar"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Work Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="suresh@rendesk.example"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Designation *</label>
                  <input
                    type="text"
                    required
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Backend Developer"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Department *</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="Design">Design</option>
                    <option value="Finance">Finance</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Annual CTC (₹) *</label>
                  <input
                    type="number"
                    required
                    value={formData.annualCtc}
                    onChange={(e) => setFormData({ ...formData, annualCtc: e.target.value })}
                    placeholder="1200000"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Joining Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.joiningDate}
                    onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Probation">Probation</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-70"
                >
                  {submitting ? "Creating…" : "Save Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
