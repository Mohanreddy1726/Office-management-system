"use client";

import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, UserCog, Briefcase, Users, ArrowRight, Loader2, UserCheck } from "lucide-react";
import { EmployeeAvatar } from "@/components/shared";
import { useStore } from "@/lib/data/store";
import { ROLE_LABELS, type Role } from "@/lib/data/types";

export interface AccountOption {
  userId: string;
  name: string;
  email: string;
  role: Role;
  employeeId: string;
  designation?: string;
  department?: string;
  branch?: string;
}

interface AccountSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetRole: Role | null;
  onSelectAccount: (account: AccountOption) => void;
}

export function AccountSelectorModal({
  open,
  onOpenChange,
  targetRole,
  onSelectAccount,
}: AccountSelectorModalProps) {
  const { data } = useStore();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [dbUsers, setDbUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }

    setLoading(true);
    fetch("/api/admin/users")
      .then((res) => (res.ok ? res.json() : null))
      .then((resData) => {
        if (resData?.success && Array.isArray(resData.users)) {
          setDbUsers(resData.users);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const accounts = useMemo<AccountOption[]>(() => {
    if (!targetRole) return [];

    const map = new Map<string, AccountOption>();

    if (targetRole === "hr_admin") {
      // 1. Users with hr_admin role
      dbUsers
        .filter((u) => u.role === "hr_admin")
        .forEach((u) => {
          const emp = data.employees.find(
            (e) => e.id === u.employeeId || e.workEmail.toLowerCase() === u.email.toLowerCase()
          );
          const key = u.employeeId || u.email;
          map.set(key, {
            userId: u.employeeId || u.id,
            name: u.name,
            email: u.email,
            role: "hr_admin",
            employeeId: u.employeeId || emp?.id || "HR-001",
            designation: emp?.designation || "HR Administrator",
            department: emp?.department || "Human Resources",
            branch: emp?.branch || u.branchScope || "Headquarters",
          });
        });

      // 2. Employees with HR designation if not already present
      data.employees
        .filter((e) => /hr|human resource/i.test(e.designation) || /hr|human resource/i.test(e.department))
        .forEach((e) => {
          const key = e.id || e.workEmail;
          if (!map.has(key)) {
            map.set(key, {
              userId: e.id,
              name: e.name,
              email: e.workEmail,
              role: "hr_admin",
              employeeId: e.id,
              designation: e.designation,
              department: e.department,
              branch: e.branch,
            });
          }
        });
    } else if (targetRole === "manager") {
      // 1. Users with manager role
      dbUsers
        .filter((u) => u.role === "manager")
        .forEach((u) => {
          const emp = data.employees.find(
            (e) => e.id === u.employeeId || e.workEmail.toLowerCase() === u.email.toLowerCase()
          );
          const key = u.employeeId || u.email;
          map.set(key, {
            userId: u.employeeId || u.id,
            name: u.name,
            email: u.email,
            role: "manager",
            employeeId: u.employeeId || emp?.id || "MGR-001",
            designation: emp?.designation || "Manager",
            department: emp?.department || "Operations",
            branch: emp?.branch || u.branchScope || "Headquarters",
          });
        });

      // 2. Employees who are designated as managers or team leads
      data.employees
        .filter((e) => /manager|lead|head|director/i.test(e.designation))
        .forEach((e) => {
          const key = e.id || e.workEmail;
          if (!map.has(key)) {
            map.set(key, {
              userId: e.id,
              name: e.name,
              email: e.workEmail,
              role: "manager",
              employeeId: e.id,
              designation: e.designation,
              department: e.department,
              branch: e.branch,
            });
          }
        });
    } else if (targetRole === "employee") {
      // All employees in the company
      data.employees.forEach((e) => {
        const key = e.id || e.workEmail;
        map.set(key, {
          userId: e.id,
          name: e.name,
          email: e.workEmail,
          role: "employee",
          employeeId: e.id,
          designation: e.designation,
          department: e.department,
          branch: e.branch,
        });
      });

      // Also any users marked as employee
      dbUsers
        .filter((u) => u.role === "employee")
        .forEach((u) => {
          const key = u.employeeId || u.email;
          if (!map.has(key)) {
            map.set(key, {
              userId: u.employeeId || u.id,
              name: u.name,
              email: u.email,
              role: "employee",
              employeeId: u.employeeId || "EMP-001",
              designation: "Staff",
              department: "General",
              branch: u.branchScope || "Headquarters",
            });
          }
        });
    }

    return Array.from(map.values());
  }, [targetRole, dbUsers, data.employees]);

  const filteredAccounts = useMemo(() => {
    if (!search.trim()) return accounts;
    const term = search.toLowerCase().trim();
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(term) ||
        a.employeeId.toLowerCase().includes(term) ||
        a.email.toLowerCase().includes(term) ||
        (a.designation && a.designation.toLowerCase().includes(term)) ||
        (a.department && a.department.toLowerCase().includes(term)) ||
        (a.branch && a.branch.toLowerCase().includes(term))
    );
  }, [accounts, search]);

  const getRoleIcon = () => {
    switch (targetRole) {
      case "hr_admin":
        return <UserCog className="h-5 w-5 text-blue-600" />;
      case "manager":
        return <Briefcase className="h-5 w-5 text-amber-600" />;
      default:
        return <Users className="h-5 w-5 text-emerald-600" />;
    }
  };

  const getRoleColor = () => {
    switch (targetRole) {
      case "hr_admin":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "manager":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      default:
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    }
  };

  const roleTitle = targetRole ? ROLE_LABELS[targetRole] : "Account";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60">
              {getRoleIcon()}
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground">
                Select {roleTitle} Account
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Choose which {roleTitle.toLowerCase()} account you want to switch and sign in as.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="my-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${roleTitle.toLowerCase()}s by name, ID, email, or dept...`}
              className="pl-9 h-9 text-xs"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[400px] scrollbar-thin">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
              <p className="text-xs">Loading available accounts...</p>
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Users className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-foreground">No accounts found</p>
              <p className="text-xs max-w-xs mt-1">
                {search.trim()
                  ? `No ${roleTitle.toLowerCase()}s match "${search}". Try a different keyword.`
                  : `There are currently no active ${roleTitle.toLowerCase()} accounts configured.`}
              </p>
            </div>
          ) : (
            filteredAccounts.map((acc) => (
              <div
                key={acc.userId + acc.email}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/80 bg-card hover:bg-accent/40 hover:border-border transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <EmployeeAvatar id={acc.employeeId} name={acc.name} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">{acc.name}</span>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 font-normal ${getRoleColor()}`}>
                        {acc.employeeId}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {acc.designation || "Staff"} · {acc.department || "Operations"} · {acc.branch || "Headquarters"}
                    </div>
                    <div className="text-[11px] text-muted-foreground/80 truncate">
                      {acc.email}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="shrink-0 h-8 gap-1.5 text-xs"
                  onClick={() => {
                    onSelectAccount(acc);
                    onOpenChange(false);
                  }}
                >
                  <span>Select</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>Found {filteredAccounts.length} {roleTitle.toLowerCase()}{filteredAccounts.length === 1 ? "" : "s"}</span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
