import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import { Users, ShieldCheck, Settings, RotateCcw, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({ meta: [
    { title: "Administration & Settings — OfficeFlow" },
    { name: "description", content: "User accounts, role permissions, company settings and policies." },
    { property: "og:title", content: "Administration & Settings — OfficeFlow" },
    { property: "og:description", content: "User accounts, role permissions, company settings and policies." },
  ] }),
  component: AdminPage,
});

const ROLES: Role[] = ["super_admin", "hr_admin", "manager", "employee"];
const ACTIONS: PermissionAction[] = ["view", "create", "edit", "approve", "export", "configure"];

function AdminPage() {
  const { data, addUser, updateUser, setPermission, resetDemo } = useStore();
  const { role } = useScope();
  const isSuper = role === "super_admin";
  const [tab, setTab] = useState("users");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [permRole, setPermRole] = useState<string>("manager");
  const [settings, setSettings] = useState({ company: "OfficeFlow Technologies Pvt. Ltd.", gstin: "36AABCO1234F1Z5", fyStart: "April", timezone: "Asia/Kolkata (IST)", twoFactor: true, emailAlerts: true, weeklyDigest: false });

  const userCols: Column<UserAccount>[] = [
    { key: "n", header: "User", sortValue: (r) => r.name, render: (r) => <span><span className="block font-medium">{r.name}</span><span className="text-[11px] text-muted-foreground">{r.email}</span></span> },
    { key: "r", header: "Role", render: (r) => isSuper ? <Sel value={r.role} className="h-7 w-40" onChange={(v) => { updateUser(r.id, { role: v as Role }); toast.success(`Role changed to ${ROLE_LABELS[v as Role]}`); }} options={ROLES.map((x) => ({ value: x, label: ROLE_LABELS[x] }))} /> : ROLE_LABELS[r.role] },
    { key: "b", header: "Branch scope", render: (r) => { const s = r.branchScope as unknown; return !s || s === "All" ? "All branches" : Array.isArray(s) ? s.join(", ") : String(s); }, hideOnMobile: true },
    { key: "l", header: "Last activity", render: (r) => r.lastActivity, hideOnMobile: true },
    { key: "s", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "a", header: "", render: (r) => <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { const s = r.status === "Active" ? "Deactivated" : "Active"; updateUser(r.id, { status: s }); toast.success(`User ${s.toLowerCase()}`); }}>{r.status === "Active" ? "Deactivate" : "Activate"}</Button> },
  ];

  const modules = Object.keys(data.permissions);

  return (
    <div>
      <PageHeader title="Administration & Settings" description="Manage who can access OfficeFlow and what they can do." />
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="User accounts" value={String(data.users.length)} icon={<Users className="h-4 w-4" />} />
        <KpiCard label="Active users" value={String(data.users.filter((u) => u.status === "Active").length)} />
        <KpiCard label="Modules secured" value={String(modules.length)} icon={<ShieldCheck className="h-4 w-4" />} />
        <KpiCard label="Roles" value={String(ROLES.length)} icon={<Settings className="h-4 w-4" />} />
      </div>
      <TabsShell tabs={[{ key: "users", label: "Users" }, { key: "perms", label: "Permission matrix" }, { key: "company", label: "Company settings" }, { key: "demo", label: "Demo data" }]} active={tab} onChange={setTab}>
        {tab === "users" && <DataTable columns={userCols} rows={data.users} rowKey={(r) => r.id}
          toolbar={<Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setInviteOpen(true)}><UserPlus className="h-3.5 w-3.5" /> Invite user</Button>} />}
        {tab === "perms" && (
          <div className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
              <Sel value={permRole} onChange={setPermRole} className="h-8 w-48" options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
              {!isSuper && <span className="text-[11px] text-muted-foreground">Only Super Admin can change permissions.</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground"><tr><th className="px-3 py-2 text-left">Module</th>{ACTIONS.map((a) => <th key={a} className="px-3 py-2 text-center capitalize">{a}</th>)}</tr></thead>
                <tbody>
                  {modules.map((m) => (
                    <tr key={m} className="border-t border-border">
                      <td className="px-3 py-2 font-medium capitalize">{m}</td>
                      {ACTIONS.map((a) => (
                        <td key={a} className="px-3 py-2 text-center">
                          <Checkbox disabled={!isSuper || permRole === "super_admin"} checked={!!data.permissions[m]?.[permRole as Role]?.[a]} onCheckedChange={(v) => { setPermission(m, permRole as Role, a, !!v); toast.success("Permission updated"); }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === "company" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold">Company profile</p>
              <Field label="Legal name"><Input value={settings.company} onChange={(e) => setSettings({ ...settings, company: e.target.value })} /></Field>
              <Field label="GSTIN"><Input value={settings.gstin} onChange={(e) => setSettings({ ...settings, gstin: e.target.value.toUpperCase() })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Financial year starts"><Sel value={settings.fyStart} onChange={(v) => setSettings({ ...settings, fyStart: v })} options={["January", "April"]} /></Field>
                <Field label="Timezone"><Input value={settings.timezone} disabled /></Field>
              </div>
              <p className="text-[11px] text-muted-foreground">Branches: {BRANCHES.join(", ")}</p>
              <Button size="sm" className="text-xs" onClick={() => toast.success("Company settings saved")}>Save changes</Button>
            </div>
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold">Security & notifications</p>
              {([["twoFactor", "Require two-factor sign-in"], ["emailAlerts", "Email alerts for approvals"], ["weeklyDigest", "Weekly HR digest to admins"]] as const).map(([k, label]) => (
                <div key={k} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                  <span>{label}</span>
                  <Switch checked={settings[k]} onCheckedChange={(v) => { setSettings({ ...settings, [k]: v }); toast.success(`${label}: ${v ? "on" : "off"}`); }} />
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "demo" && (
          <div className="max-w-lg rounded-lg border border-border bg-card p-4 text-sm">
            <p className="font-semibold">Reset demo data</p>
            <p className="mt-1 text-xs text-muted-foreground">Restores every module to the original sample data. Changes you made in this browser will be lost.</p>
            <Button variant="destructive" size="sm" className="mt-3 gap-1.5 text-xs" onClick={() => setResetOpen(true)}><RotateCcw className="h-3.5 w-3.5" /> Reset demo data</Button>
          </div>
        )}
      </TabsShell>
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} onSubmit={(u) => { addUser(u); setInviteOpen(false); toast.success(`Invitation sent to ${u.email} (demo)`); }} />
      <ConfirmDialog open={resetOpen} onOpenChange={setResetOpen} title="Reset all demo data?" description="This can't be undone." destructive confirmLabel="Reset" onConfirm={() => { resetDemo(); toast.success("Demo data reset"); }} />
    </div>
  );
}

function InviteDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (v: boolean) => void; onSubmit: (u: Omit<UserAccount, "id" | "lastActivity">) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("employee");
  const [branch, setBranch] = useState("All");
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Invite user</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Full name" required><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Work email" required error={email && !validEmail ? "Enter a valid email" : undefined}><Input value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role"><Sel value={role} onChange={setRole} options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} /></Field>
            <Field label="Branch scope"><Sel value={branch} onChange={setBranch} options={[{ value: "All", label: "All branches" }, ...BRANCHES]} /></Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={name.length < 3 || !validEmail} onClick={() => onSubmit({ name, email, role: role as Role, branchScope: branch === "All" ? "All" : [branch as (typeof BRANCHES)[number]], status: "Active" })}>Send invite</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
