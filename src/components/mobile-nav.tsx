"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Fingerprint,
  CalendarDays,
  Wallet,
  Menu,
  FileText,
  Boxes,
  Bell,
  User,
  LogOut,
  Download,
  X,
  Sparkles,
} from "lucide-react";
import { useStore } from "@/lib/data/store";
import { usePwa } from "@/components/pwa-install-prompt";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmployeeAvatar } from "@/components/shared";

export function MobileNavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, data, signOut, me } = useStore();
  const { isInstallable, isStandalone, promptInstall } = usePwa();
  const [moreOpen, setMoreOpen] = useState(false);

  const currentEmp = me();
  const unreadNotifs = data.notifications.filter((n) => !n.read).length;

  // Primary bottom navigation items for employee portal
  const navTabs = [
    {
      id: "dashboard",
      label: "Home",
      href: "/dashboard",
      icon: LayoutDashboard,
      active: pathname === "/dashboard",
    },
    {
      id: "attendance",
      label: "Clock",
      href: "/attendance",
      icon: Fingerprint,
      active: pathname.startsWith("/attendance"),
    },
    {
      id: "leave",
      label: "Leave",
      href: "/leave",
      icon: CalendarDays,
      active: pathname.startsWith("/leave"),
    },
    {
      id: "payroll",
      label: "Payslip",
      href: "/payroll",
      icon: Wallet,
      active: pathname.startsWith("/payroll"),
    },
    {
      id: "more",
      label: "More",
      href: "#",
      icon: Menu,
      active: moreOpen || ["/documents", "/assets", "/notifications"].some((p) => pathname.startsWith(p)),
      badge: unreadNotifs > 0 ? unreadNotifs : null,
      onClick: () => setMoreOpen(true),
    },
  ];

  return (
    <>
      {/* Native Bottom Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 block border-t border-border/80 bg-background/95 backdrop-blur-lg lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex h-16 items-center justify-around px-2">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const content = (
              <div
                className={cn(
                  "relative flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 select-none",
                  tab.active
                    ? "text-primary font-semibold scale-105"
                    : "text-muted-foreground hover:text-foreground active:scale-95"
                )}
              >
                <div className="relative">
                  <Icon className={cn("h-5 w-5 transition-transform", tab.active && "stroke-[2.3]")} />
                  {tab.badge && (
                    <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow">
                      {tab.badge > 9 ? "9+" : tab.badge}
                    </span>
                  )}
                  {tab.active && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                  )}
                </div>
                <span className="mt-1 text-[10px] tracking-tight">{tab.label}</span>
              </div>
            );

            if (tab.onClick) {
              return (
                <button
                  key={tab.id}
                  onClick={tab.onClick}
                  className="focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-2xl"
                  aria-label={tab.label}
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={tab.id}
                href={tab.href}
                className="focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-2xl"
                aria-label={tab.label}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* "More" Native Action Drawer Sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-background p-6 max-h-[85vh] overflow-y-auto">
          <SheetHeader className="text-left pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <EmployeeAvatar id={currentEmp?.id || "USER"} name={currentEmp?.name || session?.name || "User"} size={44} />
                <div>
                  <SheetTitle className="text-base font-bold text-foreground">
                    {currentEmp?.name || session?.name || "Employee"}
                  </SheetTitle>
                  <p className="text-xs text-muted-foreground">
                    {currentEmp?.designation || "Staff"} · {currentEmp?.department || "Operations"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMoreOpen(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </SheetHeader>

          <div className="py-4 space-y-4">
            {/* Quick PWA Install Callout if installable */}
            {isInstallable && !isStandalone && (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 border border-primary/20 p-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow">
                    <Download className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Install Mobile App</p>
                    <p className="text-[11px] text-muted-foreground">Add to phone home screen</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMoreOpen(false);
                    promptInstall();
                  }}
                  className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95"
                >
                  Install
                </button>
              </div>
            )}

            {/* Menu Links Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <Link
                href="/notifications"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 font-medium text-foreground hover:bg-muted/50 active:scale-95 transition-transform"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
                  <Bell className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">Alerts & News</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {unreadNotifs > 0 ? `${unreadNotifs} unread` : "Announcements"}
                  </p>
                </div>
              </Link>

              <Link
                href="/documents"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 font-medium text-foreground hover:bg-muted/50 active:scale-95 transition-transform"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">Documents</p>
                  <p className="text-[10px] text-muted-foreground truncate">PAN, ID & Policy</p>
                </div>
              </Link>

              <Link
                href="/assets"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 font-medium text-foreground hover:bg-muted/50 active:scale-95 transition-transform"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
                  <Boxes className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">My Assets</p>
                  <p className="text-[10px] text-muted-foreground truncate">Laptop, SIM, Hardware</p>
                </div>
              </Link>

              {currentEmp?.id && (
                <Link
                  href={`/employees/${currentEmp.id}`}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 font-medium text-foreground hover:bg-muted/50 active:scale-95 transition-transform"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">My Profile</p>
                    <p className="text-[10px] text-muted-foreground truncate">Bank & Details</p>
                  </div>
                </Link>
              )}
            </div>

            {/* Sign Out Button */}
            <div className="pt-2">
              <button
                onClick={() => {
                  setMoreOpen(false);
                  signOut();
                  router.push("/login");
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 active:scale-95 transition-transform"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
