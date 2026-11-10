// Shared reusable primitives for every OfficeFlow module page.
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { statusTone, initials, avatarColor, type BadgeTone } from "@/lib/format";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone: Record<BadgeTone, string> = {
    success: "bg-success-soft text-success border-success/25",
    warning: "bg-warning-soft text-warning border-warning/30",
    danger: "bg-danger-soft text-danger border-danger/25",
    info: "bg-info-soft text-info border-info/25",
    primary: "bg-blue-soft text-primary border-primary/25",
    neutral: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", tone[statusTone(status)], className)}>
      {status}
    </span>
  );
}

export function EmployeeAvatar({ id, name, size = 32 }: { id: string; name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, backgroundColor: avatarColor(id), fontSize: size * 0.38 }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function KpiCard({ label, value, hint, icon, trend, onClick }: {
  label: string; value: string; hint?: string; icon?: ReactNode; trend?: { dir: "up" | "down"; text: string }; onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={cn("border-border shadow-sm transition-shadow", onClick && "cursor-pointer hover:shadow-md")}
    >
      <CardContent className="flex items-start justify-between p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          {hint && <p className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</p>}
          {trend && (
            <p className={cn("mt-1 text-[11px] font-medium", trend.dir === "up" ? "text-success" : "text-danger")}>
              {trend.dir === "up" ? "▲" : "▼"} {trend.text}
            </p>
          )}
        </div>
        {icon && <span className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-soft text-primary">{icon}</span>}
      </CardContent>
    </Card>
  );
}

export function PageHeader({ title, description, actions, breadcrumb }: {
  title: string; description?: string; actions?: ReactNode; breadcrumb?: string[];
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        {breadcrumb && (
          <p className="mb-0.5 text-[11px] text-muted-foreground">
            {breadcrumb.map((b, i) => (
              <span key={i}>{b}{i < breadcrumb.length - 1 ? " / " : ""}</span>
            ))}
          </p>
        )}
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ChartCard({ title, subtitle, children, className, actions }: {
  title: string; subtitle?: string; children: ReactNode; className?: string; actions?: ReactNode;
}) {
  return (
    <Card className={cn("border-border shadow-sm", className)}>
      <CardHeader className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <div>
          <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

export function Field({ label, required, children, hint, error }: {
  label: string; required?: boolean; children: ReactNode; hint?: string; error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="text-[11px] font-medium text-danger">{error}</p>}
    </div>
  );
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Confirm", destructive, onConfirm, reasonField }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string; description?: string;
  confirmLabel?: string; destructive?: boolean; onConfirm: (reason?: string) => void; reasonField?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {reasonField && <ConfirmReason />}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            onClick={() => {
              const el = document.getElementById("confirm-reason") as HTMLTextAreaElement | null;
              onConfirm(el?.value || undefined);
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConfirmReason() {
  return (
    <textarea
      id="confirm-reason"
      rows={2}
      placeholder="Reason (required for audit history)"
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

export function Timeline({ items }: { items: { at: string; title: string; by?: string; note?: string }[] }) {
  if (!items.length) return <p className="text-xs text-muted-foreground">No activity yet.</p>;
  return (
    <ol className="relative ml-2 space-y-4 border-l border-border pl-4">
      {items.map((it, i) => (
        <li key={i} className="relative">
          <span className={cn("absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-card", i === 0 ? "bg-primary" : "bg-border")} />
          <p className="text-xs font-medium text-foreground">{it.title}</p>
          <p className="text-[11px] text-muted-foreground">
            {it.at}{it.by ? ` · by ${it.by}` : ""}{it.note ? ` · ${it.note}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function Toolbar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">{left}</div>
      <div className="flex flex-wrap items-center gap-2">{right}</div>
    </div>
  );
}

export function TabsShell({ tabs, active, onChange, children }: {
  tabs: { key: string; label: string; hidden?: boolean }[]; active: string; onChange: (k: string) => void; children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border scrollbar-thin">
        {tabs.filter((t) => !t.hidden).map((t) => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
              active === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
