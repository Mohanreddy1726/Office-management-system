"use client";

import { useState } from "react";
import { Settings, Building, RotateCcw, ShieldAlert, Check } from "lucide-react";
import { toast } from "sonner";

export function AdminClient() {
  const [resetting, setResetting] = useState(false);
  const [saved, setSaved] = useState(false);

  const [companySettings, setCompanySettings] = useState({
    legalName: "Acme Technologies India Pvt Ltd",
    gstin: "36AABCA1234F1Z9",
    fyStart: "April",
    timezone: "Asia/Kolkata (IST +5:30)",
    officeLocation: "Headquarters (Main Office)",
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    toast.success("Company settings updated!");
    setTimeout(() => setSaved(false), 3000);
  };

  const handleResetData = async () => {
    if (!confirm("Are you sure you want to reset the database to the fresh demo dataset? This will overwrite existing records.")) {
      return;
    }

    setResetting(true);
    try {
      const res = await fetch("/api/admin/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");

      toast.success("Database restored to fresh demo baseline!");
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset demo data");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" /> Administration & Settings
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Company legal identity, Indian statutory parameters, and database state management.
        </p>
      </div>

      {/* Company Settings */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
        <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
          <Building className="h-4 w-4 text-primary" /> Corporate & Statutory Profile
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Details utilized across payslips, statutory tax submissions, and inward/outward communications.
        </p>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Company Legal Entity Name</label>
              <input
                type="text"
                value={companySettings.legalName}
                onChange={(e) => setCompanySettings({ ...companySettings, legalName: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">GSTIN Number</label>
              <input
                type="text"
                value={companySettings.gstin}
                onChange={(e) => setCompanySettings({ ...companySettings, gstin: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Financial Year Starts</label>
              <input
                type="text"
                disabled
                value={companySettings.fyStart}
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Office Timezone</label>
              <input
                type="text"
                disabled
                value={companySettings.timezone}
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Active Office Node</label>
              <input
                type="text"
                disabled
                value={companySettings.officeLocation}
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 flex items-center gap-1.5"
            >
              {saved && <Check className="h-4 w-4" />}
              {saved ? "Settings Saved" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      {/* Demo Data Reset Card */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-6 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground">Restore Baseline Demo Dataset</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Reset all MongoDB collections (Users, Employees, Today’s Attendance, Assets, Devices, and Mails) back to the clean initial demo state.
            </p>

            <div className="mt-4">
              <button
                onClick={handleResetData}
                disabled={resetting}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition disabled:opacity-70"
              >
                <RotateCcw className="h-4 w-4" />
                {resetting ? "Resetting Database…" : "Reset Database to Fresh Demo State"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
