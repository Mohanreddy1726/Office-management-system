"use client";

// Persistent application shell: sidebar, header, global search, branch selector.
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, UserPlus, Building2, CalendarCheck, Fingerprint, CalendarDays, Wallet,
  FileText, Mails, Boxes, Bell, BarChart3, Settings, ScrollText, PanelLeftClose,
  PanelLeftOpen, Menu, Search, Plus, ChevronDown, LogOut, RefreshCcw, UserCog, MapPin,
} from "lucide-react";
import { useStore } from "@/lib/data/store";
import { ROLE_LABELS, BRANCHES, type Role } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { EmployeeAvatar } from "@/components/shared";

interface NavItem { to: string; label: string; icon: typeof Users; roles: Role[] }
interface NavGroup { group: string; items: NavItem[] }

const ALL: Role[] = ["super_admin", "hr_admin", "manager", "employee"];
const A_H: Role[] = ["super_admin", "hr_admin"];

export const NAV: NavGroup[] = [
  { group: "Workspace", items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL }] },
  {
    group: "People",
    items: [
      { to: "/employees", label: "Employees", icon: Users, roles: ["super_admin", "hr_admin", "manager"] },
      { to: "/onboarding", label: "Onboarding & Exit", icon: UserPlus, roles: A_H },
      { to: "/organization", label: "Organization & Team", icon: Building2, roles: ["super_admin", "hr_admin", "manager"] },
    ],
  },
  {
    group: "Time & Attendance",
    items: [
      { to: "/attendance", label: "Attendance", icon: CalendarCheck, roles: ALL },
      { to: "/biometric", label: "Biometric Mapping", icon: Fingerprint, roles: A_H },
      { to: "/leave", label: "Leave Management", icon: CalendarDays, roles: ALL },
    ],
  },
  { group: "Finance", items: [{ to: "/payroll", label: "Payroll", icon: Wallet, roles: ["super_admin", "hr_admin", "employee"] }] },
  {
    group: "Operations",
    items: [
      { to: "/documents", label: "Documents", icon: FileText, roles: ALL },
      { to: "/mail", label: "Mail Log", icon: Mails, roles: A_H },
      { to: "/assets", label: "Assets", icon: Boxes, roles: ALL },
      { to: "/notifications", label: "Notifications", icon: Bell, roles: ALL },
    ],
  },
  { group: "Insights", items: [{ to: "/analytics", label: "Analytics & Reports", icon: BarChart3, roles: ["super_admin", "hr_admin", "manager"] }] },
  {
    group: "Administration",
    items: [
      { to: "/admin", label: "Administration & Settings", icon: Settings, roles: A_H },
      { to: "/audit-logs", label: "Audit Logs", icon: ScrollText, roles: A_H },
    ],
  },
];

export const BREADCRUMBS: Record<string, string[]> = {
  "/dashboard": ["Workspace", "Dashboard"],
  "/employees": ["People", "Employees"],
  "/onboarding": ["People", "Onboarding & Exit"],
  "/organization": ["People", "Organization & Team"],
  "/attendance": ["Time & Attendance", "Attendance"],
  "/biometric": ["Time & Attendance", "Biometric Mapping"],
  "/leave": ["Time & Attendance", "Leave Management"],
  "/payroll": ["Finance", "Payroll"],
  "/documents": ["Operations", "Documents"],
  "/mail": ["Operations", "Mail Log"],
  "/assets": ["Operations", "Assets"],
  "/notifications": ["Operations", "Notifications"],
  "/analytics": ["Insights", "Analytics & Reports"],
  "/admin": ["Administration", "Administration & Settings"],
  "/audit-logs": ["Administration", "Audit Logs"],
};

import { RenDeskLogo } from "@/components/logo";

export { RenDeskLogo as OfficeFlowLogo, RenDeskLogo };

function SidebarContent({ collapsed, onNavigate, mobile }: { collapsed: boolean; onNavigate?: () => void; mobile?: boolean }) {
  const { session } = useStore();
  const role = session?.role;
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className={cn("flex items-center gap-2.5 border-b border-border px-4 py-4", collapsed && !mobile && "justify-center px-2")}>
        <RenDeskLogo size={34} />
        {(!collapsed || mobile) && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-foreground">
              Ren<span className="text-primary font-semibold">Desk</span>
            </p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Workplace OS</p>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin">
        {NAV.map((g) => {
          const items = g.items.filter((i) => i.roles.includes(role as Role));
          if (!items.length) return null;
          return (
            <div key={g.group} className="mb-3">
              {(!collapsed || mobile) && <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.group}</p>}
              {collapsed && !mobile && <div className="mx-2 mb-2 border-t border-border" />}
              {items.map((i) => {
                const active = pathname === i.to || pathname.startsWith(i.to + "/");
                const link = (
                  <Link
                    href={i.to}
                    onClick={onNavigate}
                    className={cn(
                      "mb-0.5 flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] font-medium transition-colors",
                      active ? "bg-sidebar-accent text-primary" : "text-foreground/80 hover:bg-sidebar-accent/60 hover:text-foreground",
                      collapsed && !mobile && "justify-center px-0",
                    )}
                  >
                    <i.icon className="h-4 w-4 shrink-0" />
                    {(!collapsed || mobile) && <span className="truncate">{i.label}</span>}
                  </Link>
                );
                return collapsed && !mobile ? (
                  <Tooltip key={i.to}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{i.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  <div key={i.to}>{link}</div>
                );
              })}
            </div>
          );
        })}
      </nav>
      <ProfileArea collapsed={collapsed && !mobile} />
    </div>
  );
}

function ProfileArea({ collapsed }: { collapsed: boolean }) {
  const { session, emp, signOut, switchRole, resetDemo } = useStore();
  const router = useRouter();
  if (!session) return null;

  const foundEmp = emp(session.userId ?? "");
  const me = foundEmp || {
    id: session.userId || "ADM-001",
    name: session.role === "super_admin" ? "Super Admin" : "User",
    workEmail: session.role === "super_admin" ? "superadmin@gvkedutech.com" : "",
    designation: session.role === "super_admin" ? "Super Administrator" : "Staff",
  };

  const handleRoleSwitch = async (r: Role) => {
    switchRole(r);
    try {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demoRole: r }),
      });
    } catch {}
    toast.success(`Switched to ${ROLE_LABELS[r]}`);
    router.push("/dashboard");
    router.refresh();
  };

  const handleSignOut = async () => {
    signOut();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    toast.info("Signed out");
    router.push("/login");
    router.refresh();
  };

  const menu = (
    <DropdownMenuContent side="top" align="start" className="w-56">
      <DropdownMenuLabel>
        <p className="text-xs font-semibold">{me.name}</p>
        <p className="truncate text-[11px] font-normal text-muted-foreground">{me.workEmail}</p>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Switch demo role</DropdownMenuLabel>
      {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
        <DropdownMenuItem key={r} onClick={() => handleRoleSwitch(r)}>
          <UserCog className="mr-2 h-3.5 w-3.5" /> {ROLE_LABELS[r]}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => { resetDemo(); toast.success("Demo data reset"); }}>
        <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Reset demo data
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleSignOut}>
        <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
  return (
    <div className={cn("border-t border-border p-3", collapsed && "px-2")}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn("flex w-full items-center gap-2.5 rounded-md p-1.5 text-left hover:bg-sidebar-accent/60", collapsed && "justify-center")}>
            <EmployeeAvatar id={me.id} name={me.name} size={30} />
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-foreground">{me.name}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{ROLE_LABELS[session.role]}</span>
              </span>
            )}
            {!collapsed && <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
        </DropdownMenuTrigger>
        {menu}
      </DropdownMenu>
    </div>
  );
}

function GlobalSearch() {
  const { data } = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    if (q.trim().length < 2) return [];
    const t = q.toLowerCase();
    const out: { label: string; sub: string; category: string; to: string }[] = [];
    for (const e of data.employees.slice(0, 60)) {
      if (e.name.toLowerCase().includes(t) || e.id.toLowerCase().includes(t) || e.workEmail.includes(t))
        out.push({ label: e.name, sub: `${e.id} · ${e.designation}`, category: "Employees", to: `/employees/${e.id}` });
    }
    for (const d of data.documents) {
      if (d.name.toLowerCase().includes(t)) out.push({ label: d.name, sub: d.category, category: "Documents", to: "/documents" });
    }
    for (const a of data.assets) {
      if (a.name.toLowerCase().includes(t) || a.id.toLowerCase().includes(t)) out.push({ label: `${a.id} ${a.name}`, sub: a.category, category: "Assets", to: "/assets" });
    }
    for (const m of data.mail) {
      if (m.subject.toLowerCase().includes(t) || m.refNo.toLowerCase().includes(t)) out.push({ label: m.subject, sub: m.refNo, category: "Mail Log", to: "/mail" });
    }
    return out.slice(0, 12);
  }, [q, data]);

  return (
    <div className="relative hidden w-64 lg:block">
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        placeholder="Search employees, documents, assets…"
        className="h-8 rounded-md bg-background pl-8 text-xs"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 top-9 z-50 w-[380px] overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          {results.map((r, i) => (
            <button
              key={i}
              onMouseDown={() => { router.push(r.to); setQ(""); }}
              className="flex w-full items-center justify-between gap-2 border-b border-border/60 px-3 py-2 text-left last:border-0 hover:bg-blue-soft/60"
            >
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-foreground">{r.label}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{r.sub}</span>
              </span>
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{r.category}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BranchSelector() {
  const { prefs, setPref, session } = useStore();
  const canAll = session?.role === "super_admin" || session?.role === "hr_admin";
  return (
    <div className="flex items-center gap-1.5">
      <MapPin className="hidden h-3.5 w-3.5 text-muted-foreground md:block" />
      <Select value={prefs.branch} onValueChange={(v) => setPref({ branch: v as typeof prefs.branch })}>
        <SelectTrigger className="h-8 w-[150px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="All Branches" disabled={!canAll}>
            All Branches
          </SelectItem>
          {BRANCHES.map((b) => (
            <SelectItem key={b} value={b}>{b}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function QuickCreate() {
  const router = useRouter();
  const items: { label: string; to: string; search?: Record<string, string> }[] = [
    { label: "Add Employee", to: "/employees", search: { open: "add" } },
    { label: "Record Attendance Correction", to: "/attendance", search: { open: "correction" } },
    { label: "Process Payroll", to: "/payroll", search: { open: "run" } },
    { label: "Upload Document", to: "/documents", search: { open: "upload" } },
    { label: "View Approvals", to: "/leave", search: { tab: "approvals" } },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="h-8 gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Quick create</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Create</DropdownMenuLabel>
        {items.map((i) => (
          <DropdownMenuItem
            key={i.label}
            onClick={() => {
              const qs = i.search ? "?" + new URLSearchParams(i.search).toString() : "";
              router.push(i.to + qs);
            }}
          >
            {i.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationsBell() {
  const { data } = useStore();
  const router = useRouter();
  const unread = data.notifications.filter((n) => !n.read).length;
  return (
    <button
      onClick={() => router.push("/notifications")}
      className="relative flex h-8 w-8 items-center justify-center rounded-md text-foreground/80 hover:bg-muted"
      aria-label={`Notifications, ${unread} unread`}
    >
      <Bell className="h-4 w-4" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
          {unread}
        </span>
      )}
    </button>
  );
}

function UserMenu() {
  const { session, emp } = useStore();
  if (!session) return null;
  const foundEmp = emp(session.userId ?? "");
  const me = foundEmp || {
    id: session.userId || "ADM-001",
    name: session.role === "super_admin" ? "Super Admin" : "User",
    designation: session.role === "super_admin" ? "Super Administrator" : "Staff",
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-md p-1 hover:bg-muted" aria-label="Account menu">
          <EmployeeAvatar id={me.id} name={me.name} size={28} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>
          <p className="text-xs font-semibold">{me.name}</p>
          <p className="text-[11px] font-normal text-muted-foreground">{me.designation}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/notifications">Notifications</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/employees/${me.id}`}>My profile</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { prefs, setPref } = useStore();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const crumbs = BREADCRUMBS[pathname] ?? (pathname.startsWith("/employees/") ? ["People", "Employees", "Profile"] : ["RenDesk", "Workspace"]);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 hidden border-r border-border transition-all duration-200 lg:block",
            prefs.sidebarCollapsed ? "w-[72px]" : "w-[250px]",
          )}
        >
          <SidebarContent collapsed={prefs.sidebarCollapsed} />
        </aside>
        <div className={cn("flex min-h-screen w-full flex-col transition-all duration-200", prefs.sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-[250px]")}>
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
            <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-8 w-8 lg:flex"
              onClick={() => setPref({ sidebarCollapsed: !prefs.sidebarCollapsed })}
              aria-label="Toggle sidebar"
            >
              {prefs.sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
            <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
              {crumbs.map((c, i) => (
                <span key={i} className={cn(i === crumbs.length - 1 && "font-medium text-foreground")}>
                  {c}{i < crumbs.length - 1 && <span className="mx-1">/</span>}
                </span>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <GlobalSearch />
              <BranchSelector />
              <NotificationsBell />
              <QuickCreate />
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6"><RoleGate pathname={pathname}>{children}</RoleGate></main>
          <footer className="px-6 pb-4 text-center text-[10px] text-muted-foreground">
            RenDesk Workplace Operations OS · Unified workforce lifecycle platform.
          </footer>
        </div>
      </div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[260px] border-border bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent collapsed={false} mobile onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}

function RoleGate({ pathname, children }: { pathname: string; children: ReactNode }) {
  const { session } = useStore();
  const item = NAV.flatMap((g) => g.items).find((i) => pathname === i.to || pathname.startsWith(i.to + "/"));
  const allowed = !item || !session || item.roles.includes(session.role) || (pathname.startsWith("/employees/") && session.role === "employee");
  if (allowed) return <>{children}</>;
  return (
    <div className="mx-auto mt-16 max-w-md rounded-lg border border-border bg-card p-8 text-center">
      <p className="text-lg font-semibold text-foreground">You don't have access to this page</p>
      <p className="mt-1 text-sm text-muted-foreground">Your role ({ROLE_LABELS[session.role]}) can't open {item.label}. Switch roles from the profile menu to explore it.</p>
      <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Go to dashboard</Link>
    </div>
  );
}
