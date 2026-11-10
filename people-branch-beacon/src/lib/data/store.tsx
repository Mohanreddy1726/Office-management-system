// OfficeFlow demo store: single source of truth for mock data, demo session,
// UI prefs and simulated workflows. Persisted to localStorage (frontend only).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { seedState, DEMO_EMPLOYEES } from "./seed";
import type {
  AppState, Session, Prefs, Role, Employee, AttendanceCorrection, LeaveRequest, NotificationItem,
  DocumentRecord, MailEntry, Announcement, Asset, Goal, UserAccount, AuditEntry, PayrollRun,
  BiometricDevice, BiometricMapping, Shift, OnboardingTask, Review, ImportBatch,
} from "./types";

const KEY = "officeflow-demo-v1";

export interface Store {
  data: AppState;
  session: Session | null;
  prefs: Prefs;
  hydrated: boolean;
  // session & prefs
  signIn: (role: Role) => void;
  signOut: () => void;
  switchRole: (role: Role) => void;
  setPref: (patch: Partial<Prefs>) => void;
  resetDemo: () => void;
  // helpers
  me: () => Employee | null;
  emp: (id: string) => Employee | undefined;
  can: (module: string, action: string) => boolean;
  audit: (e: Omit<AuditEntry, "id" | "timestamp">) => void;
  // employees
  addEmployee: (e: Omit<Employee, "id">) => string;
  updateEmployee: (id: string, patch: Partial<Employee>, auditNote?: string) => void;
  // attendance
  addCorrection: (c: Omit<AttendanceCorrection, "id" | "submittedAt" | "status">) => void;
  decideCorrection: (id: string, decision: "Approved" | "Rejected" | "Clarification", note: string) => void;
  confirmAttendance: (recordId: string) => void;
  advanceAttendance: (recordId: string, note?: string) => void;
  disputeAttendance: (recordId: string) => void;
  bulkConfirmAttendance: (recordIds: string[]) => void;
  lockAttendance: (recordIds: string[]) => void;
  addImport: (b: Omit<ImportBatch, "id">) => void;
  addDevice: (d: Omit<BiometricDevice, "id" | "lastSync" | "status">) => void;
  addMapping: (m: Omit<BiometricMapping, "id" | "status">) => "ok" | "duplicate";
  addShift: (s: Omit<Shift, "id">) => void;
  // leave
  applyLeave: (l: Omit<LeaveRequest, "id" | "timeline" | "status">) => void;
  decideLeave: (id: string, decision: "Approved" | "Rejected" | "Clarification", note: string) => void;
  // payroll
  createPayrollRun: (period: string) => void;
  advancePayroll: (id: string, to: PayrollRun["status"], by: string, note?: string) => void;
  reopenPayroll: (id: string, reason: string) => void;
  // documents
  addDocument: (d: Omit<DocumentRecord, "id" | "version">) => void;
  decideDocument: (id: string, status: DocumentRecord["status"]) => void;
  // mail
  addMail: (m: Omit<MailEntry, "id" | "refNo" | "timeline" | "channel"> & { channel?: MailEntry["channel"] }) => void;
  updateMail: (id: string, patch: Partial<MailEntry>, event?: string) => void;
  setGmail: (connected: boolean) => void;
  // notifications
  notify: (n: Omit<NotificationItem, "id" | "timestamp" | "read">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
  addAnnouncement: (a: Omit<Announcement, "id">) => void;
  // assets
  addAsset: (a: Omit<Asset, "id" | "history" | "status">) => void;
  issueAsset: (id: string, employeeId: string, note?: string) => void;
  returnAsset: (id: string, condition: Asset["condition"], note?: string) => void;
  // performance
  addGoal: (g: Omit<Goal, "id">) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  advanceReview: (id: string, patch: Partial<Review>, next: Review["stage"]) => void;
  addOnboardingTaskUpdate: (taskId: string, status: OnboardingTask["status"]) => void;
  // admin
  addUser: (u: Omit<UserAccount, "id" | "lastActivity">) => void;
  updateUser: (id: string, patch: Partial<UserAccount>) => void;
  setPermission: (module: string, role: Role, action: string, value: boolean) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppState>(() => seedState());
  const [session, setSession] = useState<Session | null>(null);
  const [prefs, setPrefs] = useState<Prefs>({ sidebarCollapsed: false, branch: "All Branches" });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.data) setData(parsed.data);
        setSession(parsed?.session ?? null);
        setPrefs(parsed?.prefs ?? prefs);
      }
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ data, session, prefs }));
    } catch {
      // storage full — demo continues in memory
    }
  }, [data, session, prefs, hydrated]);

  const store = useMemo<Store>(() => {
    const stamp = () => new Date().toISOString().slice(0, 16).replace("T", " ");
    const audit: Store["audit"] = (e) =>
      setData((d) => ({ ...d, audit: [{ id: `AU-${Date.now()}`, timestamp: stamp(), ...e }, ...d.audit] }));

    const s: Store = {
      data, session, prefs, hydrated,
      signIn: (role) => setSession({ userId: DEMO_EMPLOYEES[role], role }),
      signOut: () => setSession(null),
      switchRole: (role) => setSession({ userId: DEMO_EMPLOYEES[role], role }),
      setPref: (patch) => setPrefs((p) => ({ ...p, ...patch })),
      resetDemo: () => {
        setData(seedState());
        audit({ user: "Demo", action: "Reset demo data", module: "System", record: "All modules", outcome: "Success" });
      },
      me: () => (session ? data.employees.find((e) => e.id === session.userId) ?? null : null),
      emp: (id) => data.employees.find((e) => e.id === id),
      can: (module, action) => {
        if (!session) return false;
        const m = data.permissions[module];
        return Boolean(m?.[session.role]?.[action as keyof (typeof m)[Role]]);
      },
      audit,
      addEmployee: (e) => {
        const id = `OF-${2000 + data.employees.length}`;
        setData((d) => ({ ...d, employees: [...d.employees, { ...e, id }] }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Created employee", module: "Employees", record: `${id} ${e.name}`, outcome: "Success" });
        return id;
      },
      updateEmployee: (id, patch, auditNote) => {
        setData((d) => ({ ...d, employees: d.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Updated employee", module: "Employees", record: `${id} ${nameOf(data, id)}`, outcome: "Success", details: auditNote });
      },
      addCorrection: (c) => {
        setData((d) => ({
          ...d,
          corrections: [{ ...c, id: `COR-${d.corrections.length + 1}`, submittedAt: stamp(), status: "Awaiting Manager" }, ...d.corrections],
        }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Submitted attendance correction", module: "Attendance", record: `${nameOf(data, c.employeeId)} ${c.date}`, outcome: "Success" });
      },
      decideCorrection: (id, decision, note) => {
        setData((d) => ({ ...d, corrections: d.corrections.map((c) => (c.id === id ? { ...c, status: decision, decisionNote: note } : c)) }));
        const c = data.corrections.find((x) => x.id === id);
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: `Correction ${decision.toLowerCase()}`, module: "Attendance", record: c ? `${nameOf(data, c.employeeId)} ${c.date}` : id, outcome: "Success", reason: note || undefined });
      },
      confirmAttendance: (recordId) => {
        setData((d) => ({ ...d, attendance: d.attendance.map((r) => (r.id === recordId ? { ...r, confirmation: "Awaiting Manager" } : r)) }));
      },
      advanceAttendance: (recordId, note) => {
        setData((d) => ({
          ...d,
          attendance: d.attendance.map((r) => {
            if (r.id !== recordId) return r;
            const next = r.confirmation === "Awaiting Employee" ? "Awaiting Manager" : r.confirmation === "Awaiting Manager" ? "Awaiting HR" : r.confirmation === "Awaiting HR" ? "Confirmed" : r.confirmation;
            return { ...r, confirmation: next, exception: note ?? r.exception };
          }),
        }));
        const r = data.attendance.find((x) => x.id === recordId);
        if (r) audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Advanced attendance confirmation", module: "Attendance", record: `${nameOf(data, r.employeeId)} ${r.date}`, outcome: "Success" });
      },
      disputeAttendance: (recordId) => {
        setData((d) => ({ ...d, attendance: d.attendance.map((r) => (r.id === recordId ? { ...r, confirmation: "Disputed" } : r)) }));
      },
      bulkConfirmAttendance: (ids) => {
        const set = new Set(ids);
        setData((d) => ({ ...d, attendance: d.attendance.map((r) => (set.has(r.id) ? { ...r, confirmation: "Confirmed" } : r)) }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Bulk confirmed attendance", module: "Attendance", record: `${ids.length} records`, outcome: "Success" });
      },
      lockAttendance: (ids) => {
        const set = new Set(ids);
        setData((d) => ({ ...d, attendance: d.attendance.map((r) => (set.has(r.id) ? { ...r, confirmation: "Locked" } : r)) }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Locked attendance period", module: "Attendance", record: `${ids.length} records`, outcome: "Success" });
      },
      addImport: (b) => {
        setData((d) => ({ ...d, imports: [{ ...b, id: `IMP-${d.imports.length + 1}` }, ...d.imports] }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Imported punch file", module: "Biometric", record: b.batch, outcome: "Success", details: `${b.received} received, ${b.processed} processed` });
      },
      addDevice: (dev) => {
        setData((d) => ({ ...d, devices: [...d.devices, { ...dev, id: `DEV-${d.devices.length + 1}`, lastSync: "—", status: "Sync Pending" }] }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Registered biometric device", module: "Biometric", record: dev.name, outcome: "Success" });
      },
      addMapping: (m) => {
        const dup = data.mappings.some((x) => x.deviceId === m.deviceId && x.biometricId === m.biometricId && x.status === "Active");
        if (dup) return "duplicate";
        setData((d) => ({ ...d, mappings: [...d.mappings, { ...m, id: `MAP-${d.mappings.length + 1}`, status: "Active" }], unmappedIds: d.unmappedIds.filter((u) => u.biometricId !== m.biometricId) }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Mapped biometric ID", module: "Biometric", record: `${nameOf(data, m.employeeId)} → ${m.biometricId}`, outcome: "Success" });
        return "ok";
      },
      addShift: (sh) => {
        setData((d) => ({ ...d, shifts: [...d.shifts, { ...sh, id: `SH-${d.shifts.length + 1}` }] }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Created shift", module: "Attendance", record: sh.name, outcome: "Success" });
      },
      applyLeave: (l) => {
        setData((d) => ({
          ...d,
          leaves: [{ ...l, id: `LV-${d.leaves.length + 1}`, status: "Submitted", timeline: [{ stage: "Submitted", actor: l.employeeId, at: l.startDate }] }, ...d.leaves],
        }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Applied for leave", module: "Leave", record: `${nameOf(data, l.employeeId)} ${l.type}`, outcome: "Success" });
      },
      decideLeave: (id, decision, note) => {
        setData((d) => ({
          ...d,
          leaves: d.leaves.map((l) =>
            l.id === id
              ? { ...l, status: decision, timeline: [...l.timeline, { stage: decision, actor: session ? nameOf(d, session.userId) : "Demo", at: stamp(), note }] }
              : l,
          ),
        }));
        const l = data.leaves.find((x) => x.id === id);
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: `Leave ${decision.toLowerCase()}`, module: "Leave", record: l ? `${nameOf(data, l.employeeId)} ${l.type}` : id, outcome: "Success", reason: decision === "Rejected" ? note : undefined });
      },
      createPayrollRun: (period) => {
        const eligible = data.employees.filter((e) => e.status !== "Inactive" && e.status !== "Resigned");
        const gross = eligible.reduce((s, e) => s + e.monthlyGross, 0);
        const ded = Math.round(gross * 0.13);
        setData((d) => ({
          ...d,
          payrollRuns: [
            { id: `PR-${period}`, period, status: "Draft", headcount: eligible.length, gross, employeeDeductions: ded, employerContributions: Math.round(gross * 0.12), net: gross - ded, createdAt: stamp() },
            ...d.payrollRuns,
          ],
        }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Created payroll run", module: "Payroll", record: `PR-${period}`, outcome: "Success" });
      },
      advancePayroll: (id, to, by, note) => {
        setData((d) => ({
          ...d,
          payrollRuns: d.payrollRuns.map((p) =>
            p.id === id ? { ...p, status: to, approvedBy: to === "Approved" ? by : p.approvedBy, lockedBy: to === "Locked" ? by : p.lockedBy, paidAt: to === "Payment Recorded" ? stamp() : p.paidAt } : p,
          ),
        }));
        audit({ user: by, action: `Payroll moved to ${to}`, module: "Payroll", record: id, outcome: "Success", details: note });
      },
      reopenPayroll: (id, reason) => {
        setData((d) => ({ ...d, payrollRuns: d.payrollRuns.map((p) => (p.id === id ? { ...p, status: "Calculated" } : p)) }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Reopened payroll", module: "Payroll", record: id, outcome: "Success", reason });
      },
      addDocument: (doc) => {
        setData((d) => ({ ...d, documents: [{ ...doc, id: `DOC-${d.documents.length + 1}`, version: 1 }, ...d.documents] }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Uploaded document", module: "Documents", record: doc.name, outcome: "Success" });
      },
      decideDocument: (id, status) => {
        setData((d) => ({ ...d, documents: d.documents.map((x) => (x.id === id ? { ...x, status } : x)) }));
        const doc = data.documents.find((x) => x.id === id);
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: `Document ${status === "Verified" ? "verified" : "rejected"}`, module: "Documents", record: doc?.name ?? id, outcome: "Success" });
      },
      addMail: (m) => {
        const n = data.mail.length + 1;
        const refNo = `${m.direction === "Incoming" ? "IN" : "OUT"}-2026-${String(141 + n).padStart(4, "0")}`;
        setData((d) => ({ ...d, mail: [{ ...m, channel: m.channel ?? "Physical", id: `ML-${n}`, refNo, timeline: [{ at: stamp(), event: m.direction === "Incoming" ? "Received and registered" : "Dispatched", by: session ? nameOf(d, session.userId) : "Demo" }] }, ...d.mail] }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: `Registered ${m.direction.toLowerCase()} mail`, module: "Mail Log", record: refNo, outcome: "Success" });
      },
      updateMail: (id, patch, event) => {
        setData((d) => ({
          ...d,
          mail: d.mail.map((m) => (m.id === id ? { ...m, ...patch, timeline: event ? [...m.timeline, { at: stamp(), event, by: session ? nameOf(d, session.userId) : "Demo" }] : m.timeline } : m)),
        }));
      },
      setGmail: (connected) => {
        setData((d) => ({
          ...d,
          gmail: { ...d.gmail, connected, lastSync: connected ? stamp() : d.gmail.lastSync, logs: [{ at: stamp(), event: connected ? "Connected (demo authorization)" : "Disconnected", status: "Success" as const }, ...d.gmail.logs] },
        }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: connected ? "Connected Gmail (demo)" : "Disconnected Gmail", module: "Mail Log", record: "Gmail integration", outcome: "Success" });
      },
      notify: (n) => {
        setData((d) => ({ ...d, notifications: [{ ...n, id: `N-${Date.now()}`, timestamp: stamp(), read: false }, ...d.notifications] }));
      },
      markRead: (id) => setData((d) => ({ ...d, notifications: d.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
      markAllRead: () => setData((d) => ({ ...d, notifications: d.notifications.map((n) => ({ ...n, read: true })) })),
      clearNotifications: () => setData((d) => ({ ...d, notifications: [] })),
      addAnnouncement: (a) => {
        setData((d) => ({ ...d, announcements: [{ ...a, id: `AN-${d.announcements.length + 1}` }, ...d.announcements] }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Published announcement", module: "Notifications", record: a.title, outcome: "Success" });
      },
      addAsset: (a) => {
        setData((d) => ({ ...d, assets: [{ ...a, id: `AST-${String(d.assets.length + 1).padStart(3, "0")}`, status: "Available", history: [] }, ...d.assets] }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Added asset", module: "Assets", record: a.name, outcome: "Success" });
      },
      issueAsset: (id, employeeId, note) => {
        setData((d) => ({
          ...d,
          assets: d.assets.map((a) =>
            a.id === id
              ? { ...a, assignedTo: employeeId, status: "Assigned", history: [...a.history, { date: stamp().slice(0, 10), action: "Issued", employeeId, note }] }
              : a,
          ),
        }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Issued asset", module: "Assets", record: `${id} → ${nameOf(data, employeeId)}`, outcome: "Success" });
      },
      returnAsset: (id, condition, note) => {
        setData((d) => ({
          ...d,
          assets: d.assets.map((a) =>
            a.id === id
              ? { ...a, assignedTo: null, status: "Available", condition, history: [...a.history, { date: stamp().slice(0, 10), action: "Returned", note }] }
              : a,
          ),
        }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Returned asset", module: "Assets", record: id, outcome: "Success" });
      },
      addGoal: (g) => {
        setData((d) => ({ ...d, goals: [{ ...g, id: `G-${d.goals.length + 1}` }, ...d.goals] }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Created goal", module: "Performance", record: g.title, outcome: "Success" });
      },
      updateGoal: (id, patch) => {
        setData((d) => ({ ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
      },
      advanceReview: (id, patch, next) => {
        setData((d) => ({ ...d, reviews: d.reviews.map((r) => (r.id === id ? { ...r, ...patch, stage: next } : r)) }));
        const r = data.reviews.find((x) => x.id === id);
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Updated review", module: "Performance", record: `${nameOf(data, r?.employeeId ?? "")} → ${next}`, outcome: "Success" });
      },
      addOnboardingTaskUpdate: (taskId, status) => {
        setData((d) => ({ ...d, onboardingTasks: d.onboardingTasks.map((t) => (t.id === taskId ? { ...t, status } : t)) }));
      },
      addUser: (u) => {
        setData((d) => ({ ...d, users: [...d.users, { ...u, id: `U-${d.users.length + 1}`, lastActivity: "—" }] }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Invited user", module: "Administration", record: u.email, outcome: "Success" });
      },
      updateUser: (id, patch) => {
        setData((d) => ({ ...d, users: d.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
        const u = data.users.find((x) => x.id === id);
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Updated user", module: "Administration", record: u?.email ?? id, outcome: "Success" });
      },
      setPermission: (module, role, action, value) => {
        setData((d) => {
          const permissions = { ...d.permissions };
          permissions[module] = { ...permissions[module], [role]: { ...permissions[module]?.[role], [action]: value } } as typeof permissions[string];
          return { ...d, permissions };
        });
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Changed permission", module: "Administration", record: `${module} / ${role} / ${action}`, outcome: "Success", newValue: value ? "Allowed" : "Denied" });
      },
    };
    return s;
  }, [data, session, prefs, hydrated]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

function nameOf(d: AppState, id: string) {
  return d.employees.find((e) => e.id === id)?.name ?? id;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
