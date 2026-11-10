"use client";

import { useState, useEffect } from "react";
import { Laptop, Plus, CheckCircle2, UserCheck, RotateCcw } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

export function AssetsClient() {
  const [assets, setAssets] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);

  // Add Asset Form
  const [formData, setFormData] = useState({
    name: "",
    category: "Laptop",
    brandModel: "",
    serialNumber: "",
    purchaseValue: "85000",
  });

  // Issue Form
  const [targetEmp, setTargetEmp] = useState("");
  const [condition, setCondition] = useState<"New" | "Good" | "Fair">("Good");

  const fetchData = async () => {
    try {
      const res = await fetch("/api/assets");
      const data = await res.json();
      if (data.success) {
        setAssets(data.assets || []);
        setEmployees(data.employees || []);
        if (data.employees?.length > 0) setTargetEmp(data.employees[0].employeeId);
      }
    } catch {
      toast.error("Failed to load assets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_asset", ...formData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      toast.success(`Asset ${data.asset.name} registered!`);
      setShowAddModal(false);
      setFormData({
        name: "",
        category: "Laptop",
        brandModel: "",
        serialNumber: "",
        purchaseValue: "85000",
      });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to register asset");
    }
  };

  const handleIssueAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "issue_asset",
          assetId: selectedAsset._id,
          employeeId: targetEmp,
          condition,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      toast.success(`Asset issued to employee!`);
      setShowIssueModal(false);
      setSelectedAsset(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to issue asset");
    }
  };

  const handleReturnAsset = async (asset: any) => {
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "return_asset",
          assetId: asset._id,
          condition: "Good",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      toast.success(`Asset returned to office inventory!`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to return asset");
    }
  };

  const totalAssigned = assets.filter((a) => a.status === "Assigned").length;
  const totalAvailable = assets.filter((a) => a.status === "Available").length;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Laptop className="h-5 w-5 text-primary" /> IT & Hardware Assets
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Office equipment inventory, serial number tracking, allocations, and returns.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition"
        >
          <Plus className="h-4 w-4" /> Add Asset
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Assets</span>
          <p className="text-3xl font-extrabold text-foreground mt-2">{assets.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Currently Assigned</span>
          <p className="text-3xl font-extrabold text-blue-600 mt-2">{totalAssigned}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">In Stock / Available</span>
          <p className="text-3xl font-extrabold text-emerald-600 mt-2">{totalAvailable}</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground font-semibold">
              <tr>
                <th className="px-5 py-3.5">Asset Tag</th>
                <th className="px-5 py-3.5">Equipment Name</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Serial No.</th>
                <th className="px-5 py-3.5 text-right">Value (₹)</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Assigned To</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    Loading assets…
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No hardware assets registered yet.
                  </td>
                </tr>
              ) : (
                assets.map((a) => (
                  <tr key={a._id} className="hover:bg-muted/30 transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-primary">{a.assetTag}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-foreground">{a.name}</p>
                      <p className="text-[11px] text-muted-foreground">{a.brandModel}</p>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-foreground">{a.category}</td>
                    <td className="px-5 py-3.5 font-mono text-muted-foreground">{a.serialNumber}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-foreground">
                      {formatCurrency(a.purchaseValue)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          a.status === "Assigned"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {a.assignedTo ? (
                        <div>
                          <p className="font-semibold text-foreground">{a.assignedTo.employeeName}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">{a.assignedTo.employeeId}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {a.status === "Available" ? (
                        <button
                          onClick={() => {
                            setSelectedAsset(a);
                            setShowIssueModal(true);
                          }}
                          className="rounded px-2.5 py-1 text-[11px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition inline-flex items-center gap-1"
                        >
                          <UserCheck className="h-3 w-3" /> Issue
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReturnAsset(a)}
                          className="rounded px-2.5 py-1 text-[11px] font-semibold border border-border text-foreground hover:bg-muted transition inline-flex items-center gap-1"
                        >
                          <RotateCcw className="h-3 w-3" /> Return
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-base font-bold text-foreground">Register New Asset</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground text-sm font-semibold">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddAsset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Asset Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. MacBook Pro 14 M3"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  >
                    <option value="Laptop">Laptop</option>
                    <option value="Desktop">Desktop</option>
                    <option value="Monitor">Monitor</option>
                    <option value="Mobile">Mobile Device</option>
                    <option value="Furniture">Furniture</option>
                    <option value="Access Card">Access Card</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Purchase Value (₹)</label>
                  <input
                    type="number"
                    value={formData.purchaseValue}
                    onChange={(e) => setFormData({ ...formData, purchaseValue: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Brand & Model *</label>
                  <input
                    type="text"
                    required
                    value={formData.brandModel}
                    onChange={(e) => setFormData({ ...formData, brandModel: e.target.value })}
                    placeholder="Apple A2918"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Serial Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    placeholder="SN-98765432"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
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
                  Save Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Issue Modal */}
      {showIssueModal && selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-base font-bold text-foreground">Issue Asset</h3>
              <button onClick={() => setShowIssueModal(false)} className="text-muted-foreground text-sm font-semibold">
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Allocating <strong className="text-foreground">{selectedAsset.name}</strong> ({selectedAsset.assetTag})
            </p>

            <form onSubmit={handleIssueAsset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Assign to Employee *</label>
                <select
                  value={targetEmp}
                  onChange={(e) => setTargetEmp(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                >
                  {employees.map((emp) => (
                    <option key={emp.employeeId} value={emp.employeeId}>
                      {emp.name} ({emp.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Condition at Handover</label>
                <select
                  value={condition}
                  onChange={(e: any) => setCondition(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                >
                  <option value="New">Brand New</option>
                  <option value="Good">Good / Working</option>
                  <option value="Fair">Fair / Minor scratches</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90"
                >
                  Confirm Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
