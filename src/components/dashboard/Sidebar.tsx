"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Clock,
  Fingerprint,
  CalendarDays,
  Banknote,
  FileText,
  Laptop,
  Mail,
  Bell,
  ShieldCheck,
  Settings,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types/auth";

interface SidebarProps {
  role?: UserRole;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: any;
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Employees", href: "/employees", icon: Users },
  { label: "Attendance", href: "/attendance", icon: Clock },
  { label: "Biometric", href: "/biometric", icon: Fingerprint, roles: ["super_admin", "hr_admin"] },
  { label: "Leave", href: "/leave", icon: CalendarDays },
  { label: "Payroll", href: "/payroll", icon: Banknote },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Assets", href: "/assets", icon: Laptop },
  { label: "Mail Log", href: "/mail", icon: Mail },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Audit Logs", href: "/audit-logs", icon: ShieldCheck, roles: ["super_admin", "hr_admin"] },
  { label: "Settings", href: "/admin", icon: Settings, roles: ["super_admin", "hr_admin"] },
];

export function Sidebar({ role = "employee" }: SidebarProps) {
  const pathname = usePathname();

  const filteredItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(role)
  );

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shadow">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <span className="text-base font-bold tracking-tight text-white">Ren<span className="text-blue-400">Desk</span></span>
          <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
            Headquarters
          </span>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white font-semibold shadow-sm"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-slate-400 group-hover:text-white")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Single Branch Badge Footer */}
      <div className="border-t border-sidebar-border p-4">
        <div className="rounded-lg bg-slate-800/80 p-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-white">Main Office Active</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Single Office Deployment</p>
        </div>
      </div>
    </aside>
  );
}
