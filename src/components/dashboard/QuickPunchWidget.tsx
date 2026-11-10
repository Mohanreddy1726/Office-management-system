"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";

interface QuickPunchWidgetProps {
  employeeId: string;
  employeeName: string;
  todayAttendance?: {
    checkIn?: string;
    checkOut?: string;
    status?: string;
    totalHours?: number;
  } | null;
}

export function QuickPunchWidget({
  employeeId,
  employeeName,
  todayAttendance,
}: QuickPunchWidgetProps) {
  const router = useRouter();
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const handlePunch = async (punchType: "checkIn" | "checkOut") => {
    setLoading(true);
    try {
      const res = await fetch("/api/attendance/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, employeeName, punchType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Punch failed");

      toast.success(
        punchType === "checkIn"
          ? `Clocked in at ${data.record.checkIn}`
          : `Clocked out at ${data.record.checkOut} (${data.record.totalHours} hrs)`
      );
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to record punch");
    } finally {
      setLoading(false);
    }
  };

  const hasCheckedIn = !!todayAttendance?.checkIn;
  const hasCheckedOut = !!todayAttendance?.checkOut;

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-3 shadow-xs">
      <div className="hidden sm:block text-right pr-2 border-r border-border">
        <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 justify-end">
          <Clock className="h-3 w-3" /> Live Office Time
        </p>
        <p className="text-sm font-bold text-foreground font-mono">{time || "—"}</p>
      </div>

      <div>
        {!hasCheckedIn ? (
          <button
            onClick={() => handlePunch("checkIn")}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition disabled:opacity-70"
          >
            <LogIn className="h-4 w-4" />
            <span>Clock In</span>
          </button>
        ) : !hasCheckedOut ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              In at <strong className="text-foreground">{todayAttendance?.checkIn}</strong>
            </span>
            <button
              onClick={() => handlePunch("checkOut")}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition disabled:opacity-70"
            >
              <LogOut className="h-4 w-4" />
              <span>Clock Out</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
            <CheckCircle className="h-4 w-4" />
            <span>
              Done for today ({todayAttendance.totalHours} hrs)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
