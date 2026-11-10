"use client";

// Small form helpers shared by module pages.
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/data/store";
import { EmployeeAvatar } from "@/components/shared";
import { cn } from "@/lib/utils";

export function Sel({ value, onChange, options, placeholder, className }: {
  value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[]; placeholder?: string; className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-9 text-xs", className)}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          const l = typeof o === "string" ? o : o.label;
          return <SelectItem key={v} value={v}>{l}</SelectItem>;
        })}
      </SelectContent>
    </Select>
  );
}

export function useNames() {
  const { data } = useStore();
  return (id: string | null | undefined) => (id ? data.employees.find((e) => e.id === id)?.name ?? id : "—");
}

export function Person({ id }: { id: string | null | undefined }) {
  const nameOf = useNames();
  if (!id) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex items-center gap-2">
      <EmployeeAvatar id={id} name={nameOf(id)} size={24} />
      <span className="text-foreground">{nameOf(id)}</span>
    </span>
  );
}

export function useScope() {
  const { data, session, prefs } = useStore();
  const role = session?.role;
  const isAdmin = role === "super_admin" || role === "hr_admin";
  const isManager = role === "manager";
  const isEmployee = role === "employee";
  const uid = session?.userId ?? "";
  const inScope = (empId: string) => {
    const e = data.employees.find((x) => x.id === empId);
    if (!e) {
      if (isAdmin || !session) return true;
      return false;
    }
    if (prefs.branch !== "All Branches" && e.branch !== prefs.branch) return false;
    if (isEmployee) return empId === uid;
    if (isManager) return e.managerId === uid || empId === uid;
    return true;
  };
  return { role, isAdmin, isManager, isEmployee, uid, inScope };
}

export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-[13px] font-medium text-foreground">{value}</p>
    </div>
  );
}

export type ModuleSearch = { open?: string; tab?: string };
export const moduleSearch = (s: Record<string, unknown>): ModuleSearch => ({
  ...(typeof s["open"] === "string" ? { open: s["open"] } : {}),
  ...(typeof s["tab"] === "string" ? { tab: s["tab"] } : {}),
});
