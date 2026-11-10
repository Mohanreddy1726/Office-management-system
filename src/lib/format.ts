import type { Employee } from "@/lib/data/types";

export const inr = (n: number, opts?: { compact?: boolean }) =>
  opts?.compact
    ? n >= 10000000
      ? `₹${(n / 10000000).toFixed(2)} Cr`
      : n >= 100000
        ? `₹${(n / 100000).toFixed(2)} L`
        : `₹${n.toLocaleString("en-IN")}`
    : `₹${n.toLocaleString("en-IN")}`;

export const fmtDate = (d?: string) => (d ? new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—");

export const tenure = (from: string, to = "2026-10-22") => {
  const a = new Date(from + "T00:00:00Z");
  const b = new Date(to + "T00:00:00Z");
  const months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (months < 1) return "<1 mo";
  return months >= 12 ? `${Math.floor(months / 12)} yr ${months % 12} mo` : `${months} mo`;
};

export const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

const AVATAR_COLORS = ["#356AE6", "#16845B", "#5B61D6", "#D98E04", "#0E7490", "#B45309", "#7C3AED", "#BE185D", "#4D7C0F", "#183153"];
export const avatarColor = (id: string) => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

export const daysUntil = (d?: string) => (d ? Math.ceil((new Date(d + "T00:00:00Z").getTime() - new Date("2026-10-22T00:00:00Z").getTime()) / 86400000) : undefined);

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";
export function statusTone(status: string): BadgeTone {
  const s = status.toLowerCase();
  if (/(pending|probation|awaiting|in progress|submitted|calculated|review|processing|sync|warning|sync pending|draft|fair|upcoming|open|clarification|not started|at risk)/.test(s)) return "warning";
  if (/(active|present|approved|confirmed|completed|verified|online|available|paid|finalized|locked|success|good|on track|closed)/.test(s)) return "success";
  if (/(absent|rejected|disputed|failure|damaged|inactive|offline|late|resigned|notice|blocked|retired|poor|failed|urgent)/.test(s)) return "danger";
  if (/(leave|holiday|half day|week off|maintenance|deactivated|manual|csv)/.test(s)) return "info";
  return "neutral";
}

export const attColor = (status: string) =>
  ({ Present: "bg-success/15 text-success border-success/30", Late: "bg-warning/15 text-warning border-warning/30", Absent: "bg-danger/15 text-danger border-danger/30", Leave: "bg-info/15 text-info border-info/30", "Half Day": "bg-warning/15 text-warning border-warning/30", Holiday: "bg-primary/10 text-primary border-primary/30", "Week Off": "bg-muted text-muted-foreground border-border", "Pending Review": "bg-muted text-muted-foreground border-border" } as Record<string, string>)[status] ?? "bg-muted text-muted-foreground border-border";

export function empLabel(e: Employee | undefined) {
  return e ? `${e.name}` : "—";
}
