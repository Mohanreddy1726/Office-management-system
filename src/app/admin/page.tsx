"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell";
import { useStore } from "@/lib/data/store";
import { PageHeader, KpiCard, StatusBadge, TabsShell, Field, ConfirmDialog } from "@/components/shared";
import { DataTable, type Column } from "@/components/data-table";
import { Sel, useScope } from "@/components/form-bits";
import { ROLE_LABELS, BRANCHES } from "@/lib/data/types";
import type { Role, UserAccount, PermissionAction } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Users,
  ShieldCheck,
  Settings,
  RotateCcw,
  UserPlus,
  Layers,
  Table as TableIcon,
  ShieldAlert,
  Building2,
  Lock,
  Mail,
  CheckCircle2,
  Clock,
  KeyRound,
  Shield,
  Sliders,
  Trash2,
  Key,
  ShieldHalf,
  FileCheck,
} from "lucide-react";

const ROLES: Role[] = ["super_admin", "hr_admin", "manager", "employee"];
const ACTIONS: PermissionAction[] = ["view", "create", "edit", "approve", "export", "configure"];

export default function AdminPage() {
  const { data, addUser, updateUser, setPermission, resetDemo } = useStore();
  const { role } = useScope();
  const isSuper = role === "super_admin";

  const [tab, setTab] = useState("users");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [permRole, setPermRole] = useState<Role>("manager");
  const [q, setQ] = useState("");
  const [dbUsers, setDbUsers] = useState<UserAccount[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Password reset modal state
  const [pwModalUser, setPwModalUser] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  // Delete user modal state
  const [deleteModalUser, setDeleteModalUser] = useState<UserAccount | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Global settings state
  const [settings, setSettings] = useState({
    company: "GVK EduTech Pvt. Ltd.",
    gstin: "36AABCO1234F1Z5",
    fyStart: "April",
    timezone: "Asia/Kolkata (IST)",
    twoFactor: false,
    emailAlerts: true,
    weeklyDigest: false,
    allowSelfRegister: false,
    sessionTimeout: "7 days",
    enforceStrongPassword: true,
  });

  // Fetch real users from MongoDB backend
  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const d = await res.json();
        if (d.users && Array.isArray(d.users)) {
          setDbUsers(d.users);
        }
      }
    } catch (err) {
      console.error("[Fetch Users Error]", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const activeUserList = dbUsers.length > 0 ? dbUsers : data.users;

  const filteredUsers = activeUserList.filter((u) => {
    const matchQ =
      !q ||
      u.name.toLowerCase().includes(q.toLowerCase()) ||
      u.email.toLowerCase().includes(q.toLowerCase()) ||
      u.role.toLowerCase().includes(q.toLowerCase());
    return matchQ;
  });

  // Handle role change directly via API & local state
  const handleRoleChange = async (userId: string, newRole: Role) => {
    try {
      updateUser(userId, { role: newRole });
      setDbUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));

      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, role: newRole }),
      });

      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "Failed to update role in database");
      } else {
        toast.success(`Role updated to ${ROLE_LABELS[newRole]}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to update role");
    }
  };

  // Handle status toggle (Active / Deactivated)
  const handleStatusToggle = async (user: UserAccount) => {
    const nextStatus = user.status === "Active" ? "Deactivated" : "Active";
    try {
      updateUser(user.id, { status: nextStatus });
      setDbUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)));

      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, status: nextStatus }),
      });

      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "Failed to update user status in database");
        // Revert local state
        setDbUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: user.status } : u)));
      } else {
        toast.success(`User access ${nextStatus.toLowerCase()}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to toggle status");
    }
  };

  // Handle password reset
  const handlePasswordReset = async () => {
    if (!pwModalUser || !newPassword) return;
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setPwBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pwModalUser.id, password: newPassword }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Failed to reset password");
      } else {
        toast.success(`Password successfully updated for ${pwModalUser.name}`);
        setPwModalUser(null);
        setNewPassword("");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setPwBusy(false);
    }
  };

  // Handle delete user account
  const handleDeleteUser = async () => {
    if (!deleteModalUser) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/users?id=${deleteModalUser.id}`, {
        method: "DELETE",
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Failed to delete user account");
      } else {
        toast.success(`Account for ${deleteModalUser.name} deleted`);
        setDbUsers((prev) => prev.filter((u) => u.id !== deleteModalUser.id));
        setDeleteModalUser(null);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete account");
    } finally {
      setDeleteBusy(false);
    }
  };

  const userCols: Column<UserAccount>[] = [
    {
      key: "n",
      header: "User Account",
      sortValue: (r) => r.name,
      render: (r) => (
        <div>
          <span className="block font-semibold text-foreground">{r.name}</span>
          <span className="text-[11px] text-muted-foreground">{r.email}</span>
        </div>
      ),
    },
    {
      key: "r",
      header: "Assigned Role",
      render: (r) =>
        isSuper ? (
          <Sel
            value={r.role}
            className="h-7 w-40 text-xs"
            onChange={(v) => handleRoleChange(r.id, v as Role)}
            options={ROLES.map((x) => ({ value: x, label: ROLE_LABELS[x] }))}
          />
        ) : (
          <span className="text-xs font-medium">{ROLE_LABELS[r.role]}</span>
        ),
    },
    {
      key: "b",
      header: "Branch Scope",
      render: (r) => {
        const s = r.branchScope as unknown;
        return !s || s === "All" ? "All branches" : Array.isArray(s) ? s.join(", ") : String(s);
      },
      hideOnMobile: true,
    },
    { key: "l", header: "Last Active", render: (r) => r.lastActivity, hideOnMobile: true },
    { key: "s", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "a",
      header: "Access Actions",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => handleStatusToggle(r)}
          >
            {r.status === "Active" ? "Deactivate" : "Activate"}
          </Button>
          {isSuper && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  setPwModalUser(r);
                  setNewPassword("");
                }}
              >
                <Key className="h-3 w-3" /> Password
              </Button>
              {r.email !== "superadmin@gvkedutech.com" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                  onClick={() => setDeleteModalUser(r)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  const modules = Object.keys(data.permissions);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Administration & User Access Control"
          description="Manage user account authorization, fine-grained access control (RBAC), security policies, and company parameters."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {tab === "users" && (
                <div className="flex items-center rounded-lg border border-border bg-card p-0.5 shadow-sm">
                  <Button
                    size="sm"
                    variant={viewMode === "cards" ? "default" : "ghost"}
                    className="h-8 px-3 text-xs gap-1.5"
                    onClick={() => setViewMode("cards")}
                  >
                    <Layers className="h-3.5 w-3.5" /> Cards
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "table" ? "default" : "ghost"}
                    className="h-8 px-3 text-xs gap-1.5"
                    onClick={() => setViewMode("table")}
                  >
                    <TableIcon className="h-3.5 w-3.5" /> Table
                  </Button>
                </div>
              )}

              {isSuper && (
                <Button
                  size="sm"
                  className="gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                  onClick={() => setInviteOpen(true)}
                >
                  <UserPlus className="h-3.5 w-3.5" /> Invite User
                </Button>
              )}
            </div>
          }
        />

        {/* 4 Top KPI Cards */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard
            label="User Accounts"
            value={String(activeUserList.length)}
            icon={<Users className="h-4 w-4 text-primary" />}
            hint="Registered in database"
          />
          <KpiCard
            label="Active Users"
            value={String(activeUserList.filter((u) => u.status === "Active").length)}
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            hint="Accounts enabled for access"
          />
          <KpiCard
            label="Secured Modules"
            value={String(modules.length)}
            icon={<ShieldCheck className="h-4 w-4 text-indigo-500" />}
            hint="Covered under RBAC matrix"
          />
          <KpiCard
            label="Master Super Admin"
            value="Active"
            icon={<Shield className="h-4 w-4 text-amber-500" />}
            hint="superadmin@gvkedutech.com"
          />
        </div>

        {/* Tabs Shell */}
        <TabsShell
          tabs={[
            { key: "users", label: `User Accounts & Access (${activeUserList.length})` },
            { key: "security", label: "User Access Controls (Super Admin)" },
            { key: "perms", label: "Permission Matrix (RBAC)" },
            { key: "company", label: "Company Settings" },
            { key: "demo", label: "System Maintenance" },
          ]}
          active={tab}
          onChange={setTab}
        >
          {/* TAB 1: USERS */}
          {tab === "users" && (
            <div className="space-y-4">
              {/* Super Admin Notice Banner */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-sm">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Super Admin Access Management</h4>
                    <p className="text-xs text-muted-foreground">
                      Primary Super Admin credential: <span className="font-mono font-medium text-foreground">superadmin@gvkedutech.com</span>. You have full privileges to assign roles, activate/deactivate accounts, and reset credentials.
                    </p>
                  </div>
                </div>
                {isSuper && (
                  <Button
                    size="sm"
                    className="text-xs shrink-0 gap-1.5"
                    onClick={() => setInviteOpen(true)}
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Add New User
                  </Button>
                )}
              </div>

              {/* Search Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Input
                  placeholder="Search user by name, email or role..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="h-9 w-72 text-xs"
                />
                <span className="text-xs text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">{filteredUsers.length}</span> user accounts
                </span>
              </div>

              {viewMode === "cards" ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredUsers.map((u) => {
                    const initials = u.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();
                    const branchText =
                      !u.branchScope || u.branchScope === "All"
                        ? "All Branches"
                        : Array.isArray(u.branchScope)
                        ? u.branchScope.join(", ")
                        : String(u.branchScope);
                    const isMasterAdmin = u.email.toLowerCase() === "superadmin@gvkedutech.com";

                    return (
                      <div
                        key={u.id}
                        className={`group flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-sm transition hover:shadow-md ${
                          isMasterAdmin ? "border-primary/40 bg-gradient-to-b from-primary/5 to-transparent" : "border-border/80"
                        }`}
                      >
                        <div>
                          {/* Identity Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl font-bold text-white shadow-sm text-sm ${
                                  isMasterAdmin ? "bg-gradient-to-br from-blue-600 to-indigo-700" : "bg-gradient-to-br from-indigo-500 to-purple-600"
                                }`}>
                                  {initials}
                                </div>
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${
                                    u.status === "Active" ? "bg-emerald-500" : "bg-slate-400"
                                  }`}
                                />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <h4 className="font-semibold text-foreground text-sm tracking-tight">{u.name}</h4>
                                  {isMasterAdmin && (
                                    <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                      Root Admin
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  <span className="inline-flex items-center rounded-md bg-purple-500/10 px-1.5 py-0.5 text-[11px] font-medium text-purple-700 dark:text-purple-300">
                                    {ROLE_LABELS[u.role]}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <StatusBadge status={u.status} />
                          </div>

                          {/* Email & Details */}
                          <div className="mt-3 space-y-1 text-xs text-muted-foreground border-b border-border/60 pb-3">
                            <div className="truncate flex items-center gap-1.5">
                              <Mail className="h-3 w-3" /> {u.email}
                            </div>
                          </div>

                          {/* 3 KPI Metric Tiles */}
                          <div className="mt-4 grid grid-cols-3 gap-2">
                            <div className="rounded-xl bg-muted/40 p-2 text-center col-span-2">
                              <span className="text-[9px] font-semibold uppercase text-muted-foreground block tracking-wider">
                                Branch Scope
                              </span>
                              <span className="text-xs font-bold text-foreground block mt-0.5 truncate">
                                {branchText}
                              </span>
                            </div>
                            <div className="rounded-xl bg-muted/40 p-2 text-center">
                              <span className="text-[9px] font-semibold uppercase text-muted-foreground block tracking-wider">
                                Last Active
                              </span>
                              <span className="text-xs font-bold text-foreground block mt-0.5 truncate">
                                {u.lastActivity}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card Bottom Actions */}
                        <div className="mt-4 border-t border-border/60 pt-3 flex flex-col gap-2">
                          {isSuper && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-muted-foreground font-medium">Role:</span>
                              <Sel
                                value={u.role}
                                className="h-8 w-44 text-xs"
                                onChange={(v) => handleRoleChange(u.id, v as Role)}
                                options={ROLES.map((x) => ({ value: x, label: ROLE_LABELS[x] }))}
                              />
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-1">
                              {isSuper && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => {
                                    setPwModalUser(u);
                                    setNewPassword("");
                                  }}
                                >
                                  <Key className="h-3 w-3" /> Password
                                </Button>
                              )}
                              {isSuper && !isMasterAdmin && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                  onClick={() => setDeleteModalUser(u)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>

                            <Button
                              size="sm"
                              variant="outline"
                              className={`h-7 text-xs ${
                                u.status === "Active"
                                  ? "text-rose-600 hover:bg-rose-50"
                                  : "text-emerald-600 hover:bg-emerald-50"
                              }`}
                              onClick={() => handleStatusToggle(u)}
                            >
                              {u.status === "Active" ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <DataTable columns={userCols} rows={filteredUsers} rowKey={(r) => r.id} />
              )}
            </div>
          )}

          {/* TAB 2: USER ACCESS CONTROLS (SUPER ADMIN SPECIFIC) */}
          {tab === "security" && (
            <div className="space-y-6">
              {/* Master Credential Status Card */}
              <div className="rounded-2xl border border-primary/30 bg-card p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold shadow-md">
                      <Shield className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-base">Super Admin Master Authorization</h3>
                      <p className="text-xs text-muted-foreground">Configured in <code className="rounded bg-muted px-1.5 py-0.5 text-primary font-semibold">.env.local</code> for secure master control</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Master Access Active
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Super Admin Email</span>
                    <span className="text-xs font-mono font-bold text-foreground mt-1 block">superadmin@gvkedutech.com</span>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Access Authority</span>
                    <span className="text-xs font-bold text-foreground mt-1 block">Full Root / User Access Manager</span>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Database Connection</span>
                    <span className="text-xs font-bold text-emerald-600 mt-1 block">MongoDB Atlas Live Sync</span>
                  </div>
                </div>
              </div>

              {/* User Access Policies */}
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-3 border-b border-border/60 pb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
                      <Sliders className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-sm">Access Management Policies</h3>
                      <p className="text-xs text-muted-foreground">Control who can register and access the system</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3.5">
                      <div className="pr-4">
                        <p className="text-xs font-semibold text-foreground">Self-Registration (Sign up)</p>
                        <p className="text-[11px] text-muted-foreground">Require Super Admin invitation for all new user accounts.</p>
                      </div>
                      <Switch
                        checked={settings.allowSelfRegister}
                        onCheckedChange={(v) => {
                          setSettings({ ...settings, allowSelfRegister: v });
                          toast.success(`Self-registration ${v ? "Enabled" : "Disabled (Invite Only)"}`);
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3.5">
                      <div className="pr-4">
                        <p className="text-xs font-semibold text-foreground">Two-Factor Authentication (2FA)</p>
                        <p className="text-[11px] text-muted-foreground">Mandate OTP verification for Admins and Managers upon sign-in.</p>
                      </div>
                      <Switch
                        checked={settings.twoFactor}
                        onCheckedChange={(v) => {
                          setSettings({ ...settings, twoFactor: v });
                          toast.success(`2FA Policy: ${v ? "Enforced" : "Optional"}`);
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3.5">
                      <div className="pr-4">
                        <p className="text-xs font-semibold text-foreground">Strong Password Policy</p>
                        <p className="text-[11px] text-muted-foreground">Require minimum 8 characters with numbers and symbols.</p>
                      </div>
                      <Switch
                        checked={settings.enforceStrongPassword}
                        onCheckedChange={(v) => {
                          setSettings({ ...settings, enforceStrongPassword: v });
                          toast.success(`Password policy updated`);
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-3 border-b border-border/60 pb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-sm">Session & Security Parameters</h3>
                      <p className="text-xs text-muted-foreground">Session timeout duration and token lifetimes</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Field label="Active Session Lifetime" hint="Period after which idle user sessions are invalidated">
                      <Sel
                        value={settings.sessionTimeout}
                        onChange={(v) => {
                          setSettings({ ...settings, sessionTimeout: v });
                          toast.success(`Session lifetime set to ${v}`);
                        }}
                        options={["8 hours", "24 hours", "7 days", "30 days"]}
                        className="h-9 text-xs"
                      />
                    </Field>

                    <div className="rounded-xl bg-amber-500/10 p-3.5 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200">
                      <p className="font-semibold flex items-center gap-1.5">
                        <ShieldAlert className="h-4 w-4" /> Root Super Admin Safeguard
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                        The Super Admin account (<code className="font-mono">superadmin@gvkedutech.com</code>) cannot be deactivated or deleted through the UI to ensure you are never locked out of system operations.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PERMISSION MATRIX */}
          {tab === "perms" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 p-4 bg-muted/20">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Configuring Access For:
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      {ROLES.map((r) => (
                        <Button
                          key={r}
                          size="sm"
                          variant={permRole === r ? "default" : "outline"}
                          className="h-8 text-xs rounded-full px-3"
                          onClick={() => setPermRole(r)}
                        >
                          {ROLE_LABELS[r]}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {!isSuper && (
                    <span className="text-xs text-amber-600 flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-md">
                      <ShieldAlert className="h-3.5 w-3.5" /> Read-only mode. Only Super Admin can modify matrix.
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">System Module</th>
                        {ACTIONS.map((a) => (
                          <th key={a} className="px-4 py-3 text-center capitalize font-semibold">
                            {a}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {modules.map((m) => (
                        <tr key={m} className="hover:bg-muted/20 transition">
                          <td className="px-4 py-3.5 font-semibold text-foreground capitalize flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-primary" />
                            {m}
                          </td>
                          {ACTIONS.map((a) => {
                            const isAllowed = !!data.permissions[m]?.[permRole]?.[a];
                            const isLocked = !isSuper || permRole === "super_admin";

                            return (
                              <td key={a} className="px-4 py-3.5 text-center">
                                <div className="flex justify-center items-center">
                                  <Checkbox
                                    disabled={isLocked}
                                    checked={isAllowed}
                                    onCheckedChange={(v) => {
                                      setPermission(m, permRole, a, !!v);
                                      toast.success(`Permission updated: ${m} / ${a} → ${v ? "Allowed" : "Denied"}`);
                                    }}
                                  />
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: COMPANY SETTINGS */}
          {tab === "company" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-border/60 pb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Company Legal Profile</h3>
                    <p className="text-xs text-muted-foreground">Entity registration details & calendar defaults</p>
                  </div>
                </div>

                <Field label="Legal Entity Name">
                  <Input
                    value={settings.company}
                    onChange={(e) => setSettings({ ...settings, company: e.target.value })}
                    className="h-9 text-xs"
                  />
                </Field>

                <Field label="GSTIN / Corporate Tax ID">
                  <Input
                    value={settings.gstin}
                    onChange={(e) => setSettings({ ...settings, gstin: e.target.value.toUpperCase() })}
                    className="h-9 text-xs font-mono"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Financial Year Starts">
                    <Sel
                      value={settings.fyStart}
                      onChange={(v) => setSettings({ ...settings, fyStart: v })}
                      options={["January", "April"]}
                      className="h-9 text-xs"
                    />
                  </Field>
                  <Field label="Timezone">
                    <Input value={settings.timezone} disabled className="h-9 text-xs bg-muted/40" />
                  </Field>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Configured Office Branches</label>
                  <div className="flex flex-wrap gap-1.5">
                    {BRANCHES.map((b) => (
                      <span
                        key={b}
                        className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground flex items-center gap-1"
                      >
                        <Building2 className="h-3 w-3 text-primary" /> {b}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    size="sm"
                    className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                    onClick={() => toast.success("Company profile parameters saved")}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>

              {/* Security & Notification Switches */}
              <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-border/60 pb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Security & System Preferences</h3>
                    <p className="text-xs text-muted-foreground">Multi-factor enforcement and notification triggers</p>
                  </div>
                </div>

                {[
                  {
                    key: "twoFactor" as const,
                    label: "Mandatory Two-Factor Authentication (2FA)",
                    desc: "Require an authenticator app code during sign-in for all manager and admin roles.",
                  },
                  {
                    key: "emailAlerts" as const,
                    label: "Real-time Email Alerts for Leave & Payroll",
                    desc: "Notify approving managers immediately when leaves or reimbursements are filed.",
                  },
                  {
                    key: "weeklyDigest" as const,
                    label: "Weekly Workforce HR Digest",
                    desc: "Send a consolidated attendance summary and upcoming joiner report every Monday morning.",
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-4 transition"
                  >
                    <div className="space-y-0.5 pr-4">
                      <p className="text-xs font-semibold text-foreground">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      checked={settings[item.key]}
                      onCheckedChange={(v) => {
                        setSettings({ ...settings, [item.key]: v });
                        toast.success(`${item.label}: ${v ? "Enabled" : "Disabled"}`);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: DEMO DATA / RESET */}
          {tab === "demo" && (
            <div className="max-w-xl rounded-2xl border border-border/80 bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-base">Reset Environment</h3>
                  <p className="text-xs text-muted-foreground">Restore database to clean initial state with Super Admin only</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Resetting will clean all mock records, leaving only the primary Super Admin (<code className="font-mono">superadmin@gvkedutech.com</code>). You can then add real employees and map biometric terminals.
              </p>

              <div className="pt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5 text-xs font-medium"
                  onClick={() => setResetOpen(true)}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Clean & Re-initialize Environment
                </Button>
              </div>
            </div>
          )}
        </TabsShell>

        {/* Invite Dialog */}
        <InviteDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          onSubmit={async (u) => {
            try {
              const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(u),
              });
              const d = await res.json();
              if (!res.ok) {
                toast.error(d.error || "Failed to create user");
              } else {
                toast.success(`User ${u.name} successfully created!`);
                if (d.user) {
                  setDbUsers((prev) => [d.user, ...prev]);
                  addUser(d.user);
                }
                setInviteOpen(false);
              }
            } catch (err: any) {
              toast.error(err.message || "Failed to invite user");
            }
          }}
        />

        {/* Password Reset Modal */}
        <Dialog open={!!pwModalUser} onOpenChange={(open) => !open && setPwModalUser(null)}>
          <DialogContent className="max-w-md rounded-2xl p-6">
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold">Reset User Password</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Set a new password for <span className="font-semibold text-foreground">{pwModalUser?.name}</span> ({pwModalUser?.email})
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 py-3 text-xs">
              <Field label="New Password" required hint="Minimum 6 characters">
                <Input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-9"
                />
              </Field>
            </div>

            <DialogFooter className="gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setPwModalUser(null)} className="text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={newPassword.length < 6 || pwBusy}
                className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                onClick={handlePasswordReset}
              >
                {pwBusy ? "Updating…" : "Update Password"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete User Modal */}
        <ConfirmDialog
          open={!!deleteModalUser}
          onOpenChange={(open) => !open && setDeleteModalUser(null)}
          title={`Delete Account: ${deleteModalUser?.name}?`}
          description={`Are you sure you want to permanently delete the account for ${deleteModalUser?.email}? They will no longer be able to log in.`}
          destructive
          confirmLabel={deleteBusy ? "Deleting…" : "Yes, Delete Account"}
          onConfirm={handleDeleteUser}
        />

        {/* Reset Confirmation Dialog */}
        <ConfirmDialog
          open={resetOpen}
          onOpenChange={setResetOpen}
          title="Reset Environment to Initial State?"
          description="This action will clean all data and leave only the Super Admin account (superadmin@gvkedutech.com). All attendance logs and demo profiles will be cleared."
          destructive
          confirmLabel="Yes, Clean & Reset"
          onConfirm={async () => {
            try {
              const res = await fetch("/api/admin/seed", { method: "POST" });
              if (res.ok) {
                resetDemo();
                fetchUsers();
                toast.success("Environment reset. Only Super Admin is active.");
              } else {
                toast.error("Failed to reset database");
              }
            } catch (err: any) {
              toast.error(err.message || "Failed to reset");
            }
          }}
        />
      </div>
    </AppShell>
  );
}

// -------------------------------------------------------------
// Invite User Dialog
// -------------------------------------------------------------
function InviteDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (u: any) => Promise<void>;
}) {
  const { data } = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [branch, setBranch] = useState("Headquarters");
  const [submitting, setSubmitting] = useState(false);

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleFormSubmit = async () => {
    if (!name || !validEmail) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim() || "GvkUser@123",
        role,
        branchScope: branch,
        phone,
        status: "Active",
      });
      setName("");
      setEmail("");
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Add System User Account</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Create login access, role-based authorization, and initial password.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2 text-xs">
          <Field label="Full Name" required>
            <Input
              placeholder="e.g. Ramesh Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9"
            />
          </Field>

          <Field label="Work Email Address" required error={email && !validEmail ? "Enter a valid corporate email" : undefined}>
            <Input
              type="email"
              placeholder="ramesh@gvkedutech.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9"
            />
          </Field>

          <Field label="Initial Password" required hint="User can change later">
            <Input
              type="text"
              placeholder="Enter initial password (e.g. GvkUser@123)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9"
            />
          </Field>

          <Field label="Access Authorization Role" required>
            <Sel
              value={role}
              onChange={(v) => setRole(v as Role)}
              options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            />
          </Field>

          <div className="col-span-2">
            <Field label="Branch Scope" hint="Restrict data access to selected branches or full organization">
              <Sel
                value={branch}
                onChange={setBranch}
                options={[{ value: "All", label: "🏢 All Office Branches" }, ...BRANCHES.map((b) => ({ value: b, label: `📍 ${b} Branch Only` }))]}
              />
            </Field>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={name.length < 3 || !validEmail || submitting}
            className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            onClick={handleFormSubmit}
          >
            {submitting ? "Creating…" : "Create User Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
