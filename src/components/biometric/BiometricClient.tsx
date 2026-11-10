"use client";

import { useState, useEffect } from "react";
import { Fingerprint, Plus, Laptop, Wifi, CheckCircle2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

export function BiometricClient() {
  const [devices, setDevices] = useState<any[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);

  // Device Form
  const [devName, setDevName] = useState("");
  const [devLoc, setDevLoc] = useState("");
  const [devIp, setDevIp] = useState("192.168.1.105");

  // Mapping Form
  const [selectedDev, setSelectedDev] = useState("DEV-01");
  const [bioId, setBioId] = useState("");
  const [selectedEmp, setSelectedEmp] = useState("");

  const fetchData = async () => {
    try {
      const res = await fetch("/api/biometric");
      const data = await res.json();
      if (data.success) {
        setDevices(data.devices || []);
        setMappings(data.mappings || []);
        setEmployees(data.employees || []);
        if (data.employees?.length > 0) setSelectedEmp(data.employees[0].employeeId);
      }
    } catch {
      toast.error("Failed to load biometric data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/biometric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_device",
          deviceName: devName,
          location: devLoc,
          ipAddress: devIp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      toast.success("Biometric terminal registered successfully!");
      setShowDeviceModal(false);
      setDevName("");
      setDevLoc("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to add device");
    }
  };

  const handleAddMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/biometric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "map_employee",
          deviceId: selectedDev,
          biometricId: bioId,
          employeeId: selectedEmp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      toast.success("Employee biometric ID mapped successfully!");
      setShowMapModal(false);
      setBioId("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to map ID");
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-primary" /> Biometric Hardware & ID Mapping
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage physical office biometric punch terminals and map hardware IDs to employee profiles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDeviceModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted shadow-xs transition"
          >
            <Plus className="h-4 w-4" /> Register Terminal
          </button>
          <button
            onClick={() => setShowMapModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs transition"
          >
            <Link2 className="h-4 w-4" /> Map Employee ID
          </button>
        </div>
      </div>

      {/* Terminal Cards */}
      <div>
        <h3 className="text-xs font-bold text-foreground mb-3 uppercase tracking-wider">
          Office Terminals ({devices.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {devices.map((dev) => (
            <div key={dev.deviceId} className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-primary">{dev.deviceId}</span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {dev.status}
                </span>
              </div>
              <p className="text-sm font-bold text-foreground mt-2">{dev.name}</p>
              <p className="text-xs text-muted-foreground">{dev.location}</p>

              <div className="mt-4 pt-3 border-t border-border flex justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Wifi className="h-3 w-3" /> {dev.ipAddress}
                </span>
                <span>Headquarters</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mappings Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="flex items-center justify-between border-b border-border p-4 bg-muted/30">
          <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" /> Active Biometric Enrollments
          </h3>
          <span className="text-xs text-muted-foreground">{mappings.length} mapped profiles</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground font-semibold">
              <tr>
                <th className="px-5 py-3.5">Terminal</th>
                <th className="px-5 py-3.5">Biometric Punch ID</th>
                <th className="px-5 py-3.5">Assigned Employee</th>
                <th className="px-5 py-3.5">Employee ID</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    Loading mappings…
                  </td>
                </tr>
              ) : mappings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No biometric mappings created yet.
                  </td>
                </tr>
              ) : (
                mappings.map((m) => (
                  <tr key={m._id} className="hover:bg-muted/30 transition">
                    <td className="px-5 py-3.5 font-mono font-medium text-foreground">{m.deviceId}</td>
                    <td className="px-5 py-3.5 font-mono font-bold text-primary">{m.biometricId}</td>
                    <td className="px-5 py-3.5 font-semibold text-foreground">{m.employeeName}</td>
                    <td className="px-5 py-3.5 font-mono text-muted-foreground">{m.employeeId}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Device Modal */}
      {showDeviceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-base font-bold text-foreground">Register Biometric Terminal</h3>
              <button onClick={() => setShowDeviceModal(false)} className="text-muted-foreground text-sm font-semibold">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddDevice} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Terminal Name *</label>
                <input
                  type="text"
                  required
                  value={devName}
                  onChange={(e) => setDevName(e.target.value)}
                  placeholder="e.g. Floor 2 East Gate Terminal"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Physical Location *</label>
                <input
                  type="text"
                  required
                  value={devLoc}
                  onChange={(e) => setDevLoc(e.target.value)}
                  placeholder="e.g. 2nd Floor Main Corridor"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">IP Address / Host</label>
                <input
                  type="text"
                  value={devIp}
                  onChange={(e) => setDevIp(e.target.value)}
                  placeholder="192.168.1.105"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowDeviceModal(false)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90"
                >
                  Register Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Map Employee Modal */}
      {showMapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-base font-bold text-foreground">Map Biometric ID to Employee</h3>
              <button onClick={() => setShowMapModal(false)} className="text-muted-foreground text-sm font-semibold">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMapping} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Select Employee *</label>
                <select
                  value={selectedEmp}
                  onChange={(e) => setSelectedEmp(e.target.value)}
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
                <label className="block text-xs font-semibold mb-1">Device Punch ID (Enrolled Number) *</label>
                <input
                  type="text"
                  required
                  value={bioId}
                  onChange={(e) => setBioId(e.target.value)}
                  placeholder="e.g. BIO-106 or 1006"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowMapModal(false)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90"
                >
                  Save Mapping
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
