"use client";

import { useEffect, useState } from "react";
import { Fingerprint, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { useStore } from "@/lib/data/store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TODAY } from "@/lib/data/seed";

export function MobilePunchCard({ employeeId }: { employeeId: string }) {
  const { data, punchAttendance, session } = useStore();
  const [currentTime, setCurrentTime] = useState("");
  const [isPunching, setIsPunching] = useState(false);

  // Live ticking clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Today's attendance record
  const todayRec = data.attendance.find(
    (a) => a.employeeId === employeeId && a.date === TODAY
  );

  const isCheckedIn = Boolean(todayRec?.checkIn);
  const isCheckedOut = Boolean(todayRec?.checkOut);

  // User shift
  const userShift =
    data.shifts.find((s) => s.id === todayRec?.shiftId) ||
    data.shifts.find((s) => s.id === "SH-GEN") ||
    data.shifts[0];

  const handlePunch = async (punchType: "checkIn" | "checkOut") => {
    setIsPunching(true);
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const timeStr = `${hours}:${minutes}`;

    try {
      // 1. Optimistic Store Update
      punchAttendance(employeeId, punchType, timeStr);

      // 2. Persist to Backend API
      const res = await fetch("/api/attendance/punch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": session?.role || "employee",
          "x-user-id": employeeId,
        },
        body: JSON.stringify({
          punchType,
          employeeId,
        }),
      });

      if (res.ok) {
        toast.success(
          punchType === "checkIn"
            ? `Punched in successfully at ${timeStr}`
            : `Punched out successfully at ${timeStr}`
        );
      } else {
        toast.info(`Offline punch recorded at ${timeStr}`);
      }
    } catch {
      toast.info(`Offline punch saved locally at ${timeStr}`);
    } finally {
      setIsPunching(false);
    }
  };

  return (
    <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Clock className="h-3.5 w-3.5 text-primary" /> Live Time & Shift
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Mobile PWA Punch
        </span>
      </div>

      <div className="my-3 text-center">
        <p className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
          {currentTime || "10:00:00 AM"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {userShift?.name || "General Shift"} ({userShift?.start || "10:00"} – {userShift?.end || "18:30"})
        </p>
      </div>

      {/* Check-In / Check-Out Status Overview */}
      <div className="grid grid-cols-2 gap-2 my-3 text-xs">
        <div className="rounded-2xl border border-border/80 bg-background/80 p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground font-medium uppercase">Check-In</p>
          <p className="text-sm font-bold text-foreground mt-0.5">
            {todayRec?.checkIn ? todayRec.checkIn : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-border/80 bg-background/80 p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground font-medium uppercase">Check-Out</p>
          <p className="text-sm font-bold text-foreground mt-0.5">
            {todayRec?.checkOut ? todayRec.checkOut : "—"}
          </p>
        </div>
      </div>

      {/* 1-Tap Action Button */}
      {!isCheckedIn ? (
        <Button
          size="lg"
          disabled={isPunching}
          onClick={() => handlePunch("checkIn")}
          className="w-full h-12 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-sm shadow-md active:scale-95 transition-transform gap-2"
        >
          <Fingerprint className="h-5 w-5 animate-pulse" />
          {isPunching ? "Recording Punch..." : "Tap to Punch In"}
        </Button>
      ) : !isCheckedOut ? (
        <Button
          size="lg"
          variant="outline"
          disabled={isPunching}
          onClick={() => handlePunch("checkOut")}
          className="w-full h-12 rounded-2xl border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 text-rose-600 font-bold text-sm active:scale-95 transition-transform gap-2"
        >
          <Clock className="h-5 w-5" />
          {isPunching ? "Recording Clock-out..." : "Tap to Punch Out"}
        </Button>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-xs font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Shift Attendance Completed
        </div>
      )}
    </div>
  );
}
