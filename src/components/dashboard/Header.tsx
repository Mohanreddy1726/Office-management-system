"use client";

import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon, Bell } from "lucide-react";
import { toast } from "sonner";
import { UserRole, ROLE_LABELS } from "@/types/auth";

interface HeaderProps {
  user: {
    name: string;
    email: string;
    role: UserRole;
    branch?: string;
  };
}

const ROLES: UserRole[] = ["super_admin", "hr_admin", "manager", "employee"];

export function Header({ user }: HeaderProps) {
  const router = useRouter();

  const handleRoleSwitch = async (role: UserRole) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demoRole: role }),
      });
      if (res.ok) {
        toast.success(`Switched role to ${ROLE_LABELS[role]}`);
        router.refresh();
      }
    } catch {
      toast.error("Failed to switch role");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.info("Signed out successfully");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Failed to sign out");
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-card/80 px-8 backdrop-blur">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-sm font-bold text-foreground">RenDesk</h1>
          <p className="text-[11px] text-muted-foreground">Office Management Portal • Headquarters</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Role Switcher Pill for rapid testing */}
        <div className="hidden sm:flex items-center gap-1 rounded-lg border border-border bg-muted/60 p-1 text-[11px]">
          <span className="px-2 font-medium text-muted-foreground">Role:</span>
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => handleRoleSwitch(r)}
              className={`rounded px-2.5 py-1 font-semibold transition ${
                user.role === r
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ROLE_LABELS[r].split(" ")[0]}
            </button>
          ))}
        </div>

        {/* User Card */}
        <div className="flex items-center gap-3 pl-3 border-l border-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserIcon className="h-4 w-4" />
          </div>
          <div className="hidden md:block text-left text-xs">
            <p className="font-semibold text-foreground leading-tight">{user.name}</p>
            <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[user.role]}</p>
          </div>

          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
