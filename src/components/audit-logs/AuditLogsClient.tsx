"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Search } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

export function AuditLogsClient() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState("All");

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/audit-logs");
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
      }
    } catch {
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(
    (l) => moduleFilter === "All" || l.module === moduleFilter
  );

  const modules = ["All", "Attendance", "Employees", "Leave", "Payroll", "Biometric", "Assets", "Documents", "Mail Log", "Notifications"];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Enterprise Audit Trail
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Immutable chronological compliance ledger tracking all mutations, approvals, and actions.
          </p>
        </div>

        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground focus:outline-none shadow-xs"
        >
          {modules.map((m) => (
            <option key={m} value={m}>
              Module: {m}
            </option>
          ))}
        </select>
      </div>

      {/* Audit Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground font-semibold">
              <tr>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5">Actor / User</th>
                <th className="px-5 py-3.5">Module</th>
                <th className="px-5 py-3.5">Action Executed</th>
                <th className="px-5 py-3.5">Affected Record</th>
                <th className="px-5 py-3.5">Details / Reason</th>
                <th className="px-5 py-3.5 text-right">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground font-sans">
                    Loading audit records…
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground font-sans">
                    No audit records logged yet.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => (
                  <tr key={l._id} className="hover:bg-muted/30 transition">
                    <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                      {new Date(l.timestamp).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>

                    <td className="px-5 py-3.5 font-sans font-semibold text-foreground">
                      {l.user}
                      {l.role && <span className="block text-[10px] text-muted-foreground font-normal">{l.role}</span>}
                    </td>

                    <td className="px-5 py-3.5 font-sans font-medium text-foreground">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-800">
                        {l.module}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 font-sans font-medium text-foreground">{l.action}</td>

                    <td className="px-5 py-3.5 text-foreground max-w-xs truncate" title={l.record}>
                      {l.record}
                    </td>

                    <td className="px-5 py-3.5 text-muted-foreground max-w-xs truncate" title={l.details || l.reason}>
                      {l.details || l.reason || "—"}
                    </td>

                    <td className="px-5 py-3.5 text-right font-sans">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                          l.outcome === "Success"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {l.outcome}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
