"use client";

// RenDesk demo store: single source of truth for mock data, demo session,
// UI prefs and simulated workflows. Persisted to localStorage (frontend only).
import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { seedState, DEMO_EMPLOYEES } from "./seed";
import { classifyLoginTime, GVK_LEAVE_POLICIES } from "@/lib/policies";
import type {
  AppState, Session, Prefs, Role, Employee, AttendanceRecord, AttendanceCorrection, LeaveRequest, NotificationItem,
  DocumentRecord, MailEntry, Announcement, Asset, Goal, UserAccount, AuditEntry, PayrollRun, Reimbursement,
  BiometricDevice, BiometricMapping, Shift, Holiday, OnboardingTask, Review, ImportBatch, Joiner, Resignation, Branch,
} from "./types";

const KEY = "rendesk-v4";

export interface Store {
  data: AppState;
  session: Session | null;
  prefs: Prefs;
  hydrated: boolean;
  // session & prefs
  signIn: (role: Role, details?: Partial<Session>) => void;
  signOut: () => void;
  switchRole: (role: Role, targetUser?: { userId: string; name?: string; email?: string; role?: Role }) => void;
  setPref: (patch: Partial<Prefs>) => void;
  resetDemo: () => void;
  // helpers
  me: () => Employee | null;
  emp: (id: string) => Employee | undefined;
  can: (module: string, action: string) => boolean;
  audit: (e: Omit<AuditEntry, "id" | "timestamp">) => void;
  // employees
  addEmployee: (e: Omit<Employee, "id"> & { id?: string }) => string;
  updateEmployee: (id: string, patch: Partial<Employee>, auditNote?: string) => void;
  deleteEmployee: (id: string, skipApi?: boolean) => void;
  // attendance
  addCorrection: (c: Omit<AttendanceCorrection, "id" | "submittedAt" | "status">) => void;
  decideCorrection: (id: string, decision: "Approved" | "Rejected" | "Clarification", note: string) => void;
  confirmAttendance: (recordId: string) => void;
  advanceAttendance: (recordId: string, note?: string) => void;
  disputeAttendance: (recordId: string) => void;
  bulkConfirmAttendance: (recordIds: string[]) => void;
  lockAttendance: (recordIds: string[]) => void;
  setAttendanceRecords: (records: AttendanceRecord[]) => void;
  addImport: (b: Omit<ImportBatch, "id">) => void;
  addDevice: (d: Omit<BiometricDevice, "id" | "lastSync" | "status">) => void;
  addMapping: (m: Omit<BiometricMapping, "id" | "status">) => "ok" | "duplicate";
  addShift: (s: Omit<Shift, "id">) => void;
  updateShift: (id: string, patch: Partial<Omit<Shift, "id">>) => void;
  deleteShift: (id: string) => void;
  addHoliday: (h: Omit<Holiday, "id">) => void;
  // leave
  applyLeave: (l: Omit<LeaveRequest, "id" | "timeline" | "status">) => void;
  decideLeave: (id: string, decision: "Approved" | "Rejected" | "Clarification", note: string) => void;
  deleteLeave: (id: string) => void;
  refreshLeaves: () => Promise<void>;
  setLeaveRecords: (records: LeaveRequest[]) => void;
  // payroll
  createPayrollRun: (period: string) => void;
  advancePayroll: (id: string, to: PayrollRun["status"], by: string, note?: string) => void;
  reopenPayroll: (id: string, reason: string) => void;
  addReimbursement: (r: Omit<Reimbursement, "id">) => void;
  decideReimbursement: (id: string, status: Reimbursement["status"], note?: string) => void;
  // documents
  pendingDocumentsCount: number;
  refreshDocuments: () => Promise<void>;
  addDocument: (d: Omit<DocumentRecord, "id" | "version">) => Promise<{ ok: boolean; error?: string; status?: DocumentRecord["status"] }>;
  decideDocument: (id: string, status: DocumentRecord["status"]) => Promise<void>;
  // mail
  addMail: (m: Omit<MailEntry, "id" | "refNo" | "timeline" | "channel"> & { channel?: MailEntry["channel"] }) => void;
  updateMail: (id: string, patch: Partial<MailEntry>, event?: string) => void;
  setMailRecords: (records: MailEntry[]) => void;
  setGmail: (connected: boolean) => void;
  // notifications
  notify: (n: Omit<NotificationItem, "id" | "timestamp" | "read">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
  addAnnouncement: (a: Omit<Announcement, "id">) => void;
  deleteAnnouncement: (id: string) => void;
  // assets
  addAsset: (a: Omit<Asset, "id" | "history" | "status">) => void;
  issueAsset: (id: string, employeeId: string, note?: string) => void;
  returnAsset: (id: string, condition: Asset["condition"], note?: string) => void;
  // performance
  addGoal: (g: Omit<Goal, "id">) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  advanceReview: (id: string, patch: Partial<Review>, next: Review["stage"]) => void;
  addOnboardingTaskUpdate: (taskId: string, status: OnboardingTask["status"]) => void;
  addOnboardingTask: (t: Omit<OnboardingTask, "id">) => void;
  addJoiner: (j: Omit<Joiner, "id" | "checklistCompletion"> & { checklistCompletion?: number }) => void;
  addResignation: (r: Omit<Resignation, "id" | "managerApproval" | "hrApproval" | "handoverDone" | "assetReturnDone" | "documentClearance" | "financeClearance" | "settlementDone" | "accountDeactivated" | "status"> & Partial<Resignation>) => void;
  // admin
  addUser: (u: Omit<UserAccount, "id" | "lastActivity">) => void;
  updateUser: (id: string, patch: Partial<UserAccount>) => void;
  setPermission: (module: string, role: Role, action: string, value: boolean) => void;
}

const Ctx = createContext<Store | null>(null);

const parseTimeToMinutes = (str?: string): number | null => {
  if (!str) return null;
  const clean = str.toLowerCase().trim();
  const isPm = clean.includes("pm");
  const isAm = clean.includes("am");
  const bare = clean.replace(/am|pm/g, "").trim();
  const parts = bare.split(":");
  if (parts.length < 2) return null;
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  if (isPm && h < 12) h += 12;
  if (isAm && h === 12) h = 0;
  return h * 60 + m;
};

function mapApiDocument(doc: any): DocumentRecord | null {
  if (!doc?.employeeId || doc.category === "Company Policy" || doc.category === "Policies") {
    return null;
  }
  return {
    id: doc.docId || doc._id || `DOC-${Date.now()}`,
    name: doc.title || "Untitled Document",
    category: doc.category || "Identity",
    ownerId: doc.employeeId,
    uploadedBy: doc.uploadedBy || doc.employeeName || "HR Admin",
    uploadedAt: doc.createdAt
      ? new Date(doc.createdAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    expiresAt: doc.expiryDate || "",
    size: doc.fileSize || "—",
    status: (doc.status === "Pending" ? "Pending Verification" : doc.status) || "Verified",
    version: doc.version || 1,
    fileUrl: doc.fileUrl || undefined,
    fileType: doc.fileType || undefined,
    verifiedBy: doc.verifiedBy || undefined,
    notes: doc.notes || undefined,
    docNumber: doc.docNumber || undefined,
    confidentiality: doc.confidentiality || undefined,
    issueDate: doc.issueDate || undefined,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppState>(() => seedState());
  const [session, setSession] = useState<Session | null>(null);
  const [prefs, setPrefs] = useState<Prefs>({ sidebarCollapsed: false, branch: "All Branches" });
  const [pendingDocumentsCount, setPendingDocumentsCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      // Clear legacy storage if present so stale cached statuses do not linger
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("rendesk-v3");
        window.localStorage.removeItem("rendesk-v2");
        window.localStorage.removeItem("rendesk-demo-v1");
      }
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.data) {
          const generalShift: Shift = {
            id: "SH-GEN",
            name: "General Shift",
            start: "10:00",
            end: "18:30",
            breakMinutes: 60,
            graceMinutes: 10,
            weeklyOffs: ["Sunday"],
            minFullDayHours: 7.5,
            minHalfDayHours: 4,
            overtimeEligible: false,
            branches: ["Hyderabad", "Warangal", "Vijayawada", "Visakhapatnam"],
            overnight: false,
          };
          // Enforce General Shift & official GVK Leave Policies
          parsed.data.shifts = [generalShift];
          parsed.data.leavePolicies = GVK_LEAVE_POLICIES;

          if (Array.isArray(parsed.data.attendance)) {
            parsed.data.attendance = parsed.data.attendance.map((rec: any) => {
              const updatedRec = { ...rec, shiftId: "SH-GEN" };
              if (rec.checkIn && !["Leave", "Absent", "Holiday", "Week Off"].includes(rec.status)) {
                const cls = classifyLoginTime(rec.checkIn);
                return { ...updatedRec, lateMinutes: cls.lateMinutes, status: cls.status };
              }
              return updatedRec;
            });
          }
          // Authoritative leaves always come from MongoDB Atlas
          parsed.data.leaves = [];
          // Filter out stale unverified employees lingering in localStorage
          if (Array.isArray(parsed.data.employees)) {
            parsed.data.employees = parsed.data.employees.filter((e: any) => e.status !== "Pending Verification");
          }
          // Authoritative employee-only documents always come from MongoDB
          if (Array.isArray(parsed.data.documents)) {
            parsed.data.documents = parsed.data.documents.filter(
              (doc: any) => Boolean(doc?.ownerId) && doc?.category !== "Company Policy" && doc?.category !== "Policies"
            );
          }
          setData(parsed.data);
        }
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
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((resData) => {
        if (resData?.authenticated && resData.user) {
          const u = resData.user;
          const origRole = (u.originalRole || u.role) as Role;
          const origUserId = u.originalUserId || u.employeeId || u.userId;
          const origName = u.originalName || u.name;
          const currentUserId = u.employeeId || u.userId;

          setSession((prev) => {
            if (
              prev &&
              prev.userId === currentUserId &&
              prev.role === (u.role as Role) &&
              prev.name === u.name &&
              prev.email === u.email &&
              prev.branch === u.branch &&
              prev.originalRole === origRole
            ) {
              return prev;
            }
            return {
              userId: currentUserId,
              role: u.role as Role,
              name: u.name,
              email: u.email,
              employeeId: u.employeeId,
              branch: u.branch,
              originalRole: origRole,
              originalUserId: origUserId,
              originalName: origName,
            };
          });
        }
      })
      .catch(() => {});
  }, []);

  const fetchLeavesAsync = useCallback(async () => {
    try {
      const res = await fetch("/api/leave");
      if (res.ok) {
        const resData = await res.json();
        if (resData?.success && Array.isArray(resData.requests)) {
          const serverLeaves: LeaveRequest[] = resData.requests.map((req: any) => ({
            id: req.id || req._id,
            employeeId: req.employeeId,
            type: req.type || req.leaveType || "Emergency Leave",
            startDate: req.startDate,
            endDate: req.endDate,
            days: req.days || req.daysCount || 1,
            halfDay: req.halfDay,
            reason: req.reason || "Personal Leave",
            reasonCategory: req.reasonCategory,
            handoverEmployeeId: req.handoverEmployeeId,
            emergencyContact: req.emergencyContact,
            documentNote: req.documentNote,
            status: req.status || "Submitted",
            managerDecision: req.managerDecision,
            managerNote: req.managerNote,
            decisionNote:
              req.decisionNote ||
              (Array.isArray(req.timeline)
                ? [...req.timeline].reverse().find((t: any) => (t.stage === "Rejected" || t.stage === "Clarification") && t.note)?.note
                : undefined),
            reviewedBy: req.reviewedBy,
            reviewedAt: req.reviewedAt,
            timeline: Array.isArray(req.timeline) ? req.timeline : [],
          }));

          setData((d) => {
            let updatedBalances = d.leaveBalances;
            if (resData.balance?.employeeId) {
              const b = resData.balance;
              updatedBalances = {
                ...updatedBalances,
                [b.employeeId]: {
                  "Emergency Leave": b.casualLeave?.remaining ?? 10,
                  "Comp-Off": b.compOff?.remaining ?? 0,
                },
              };
            }

            return {
              ...d,
              leaves: serverLeaves.sort((a, b) => b.startDate.localeCompare(a.startDate)),
              leaveBalances: updatedBalances,
            };
          });
        }
      }
    } catch (err) {
      console.warn("[syncLeaves error]", err);
    }
  }, []);

  const syncNotificationsAsync = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", {
        headers: {
          "x-user-role": session?.role || "employee",
          "x-user-id": session?.userId || session?.employeeId || "",
          "x-user-branch": session?.branch || "",
        },
      });
      if (res.ok) {
        const resData = await res.json();
        if (resData?.success) {
          setData((d) => {
            const annsList = Array.isArray(resData.announcementsList) ? resData.announcementsList : [];
            const notifsList = Array.isArray(resData.notificationsList) ? resData.notificationsList : [];

            const authoritativeAnnouncements: Announcement[] = annsList.map((ann: any) => ({
              id: ann.id || ann._id,
              title: ann.title,
              message: ann.message || ann.description || "",
              audience: ann.audience || "All Employees",
              scope: ann.scope || ann.targetBranch || ann.targetDepartment,
              priority: (ann.priority === "High" ? "High" : "Normal") as "Normal" | "High",
              publishAt: ann.publishAt || (ann.createdAt ? new Date(ann.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)),
              expiresAt: ann.expiresAt || "",
            }));

            const authoritativeNotifications: NotificationItem[] = notifsList.map((n: any) => ({
              id: n.id || n._id,
              category: n.category || "System",
              title: n.title,
              description: n.description || n.message || "",
              timestamp: n.timestamp || (n.createdAt ? new Date(n.createdAt).toISOString().slice(0, 16).replace("T", " ") : "Just now"),
              read: Array.isArray(n.readBy) && session?.userId ? n.readBy.includes(session.userId) : Boolean(n.read),
              priority: (n.priority === "High" ? "High" : "Normal") as "Normal" | "High",
              link: n.link || "/notifications",
            }));

            for (const ann of authoritativeAnnouncements) {
              const annNotifId = `NT-ANN-${ann.id}`;
              if (!authoritativeNotifications.some((x) => x.id === annNotifId)) {
                authoritativeNotifications.unshift({
                  id: annNotifId,
                  category: "Announcements",
                  title: ann.title,
                  description: ann.message,
                  timestamp: ann.publishAt,
                  read: false,
                  priority: ann.priority,
                  link: "/notifications",
                });
              }
            }

            const combinedAnnouncements = [...authoritativeAnnouncements];
            for (const localAnn of d.announcements) {
              if (!combinedAnnouncements.some((x) => x.id === localAnn.id || x.title === localAnn.title)) {
                combinedAnnouncements.push(localAnn);
              }
            }

            return {
              ...d,
              announcements: combinedAnnouncements,
              notifications: authoritativeNotifications.length > 0 ? authoritativeNotifications : d.notifications,
            };
          });
        }
      }
    } catch {}
  }, [session]);

  const syncDocumentsAsync = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch("/api/documents");
      if (!res.ok) return;
      const resData = await res.json();
      if (resData?.success && Array.isArray(resData.documents)) {
        const dbDocs = resData.documents
          .map(mapApiDocument)
          .filter((x: DocumentRecord | null): x is DocumentRecord => x !== null);
        setPendingDocumentsCount(typeof resData.pendingCount === "number" ? resData.pendingCount : 0);
        setData((d) => ({ ...d, documents: dbDocs }));
      }
    } catch {}
  }, [session]);

  useEffect(() => {
    const syncEmployees = () => {
      fetch("/api/employees")
        .then((res) => (res.ok ? res.json() : null))
        .then((resData) => {
          if (resData?.success && Array.isArray(resData.employees)) {
            setData((d) => {
              const existingMap = new Map(d.employees.map((e) => [e.id, e]));
              const authoritativeEmployees = resData.employees.map((dbEmp: any) => {
                const id = dbEmp.employeeId;
                const prev = existingMap.get(id);
                const b = dbEmp.bankDetails;
                return {
                  ...prev, // Base / mock defaults
                  id,
                  name: dbEmp.name || prev?.name || "Employee",
                  workEmail: dbEmp.workEmail || dbEmp.email || prev?.workEmail || "",
                  personalEmail: dbEmp.personalEmail !== undefined ? dbEmp.personalEmail : (prev?.personalEmail || ""),
                  phone: dbEmp.phone || prev?.phone || "+91 90000 00000",
                  dob: dbEmp.dateOfBirth || prev?.dob || "2000-01-01",
                  gender: dbEmp.gender || prev?.gender || "Other",
                  address: dbEmp.address || prev?.address || "",
                  emergencyContact: dbEmp.emergencyContact?.phone || prev?.emergencyContact || "+91 90000 00000",
                  joiningDate: dbEmp.joiningDate || prev?.joiningDate || new Date().toISOString().slice(0, 10),
                  branch: dbEmp.branch || prev?.branch || "Hyderabad",
                  department: dbEmp.department || prev?.department || "Operations",
                  team: dbEmp.department || dbEmp.team || prev?.department || "Operations",
                  designation: dbEmp.designation || prev?.designation || "Staff",
                  employmentType: "Full-time",
                  managerId: dbEmp.reportingManagerId || prev?.managerId || null,
                  probationMonths: dbEmp.probationEndDate ? 6 : (prev?.probationMonths || 3),
                  status: dbEmp.status || "Active", // Authoritative status from database
                  annualCTC: dbEmp.salary?.annualCtc || dbEmp.salary?.ctc || prev?.annualCTC || 600000,
                  monthlyGross: dbEmp.salary?.monthlyGross || (dbEmp.salary?.basic ? dbEmp.salary.basic * 2 : 50000),
                  aadhaarNumber: dbEmp.aadhaarNumber || prev?.aadhaarNumber,
                  pan: dbEmp.panNumber || b?.panNumber || prev?.pan,
                  bloodGroup: dbEmp.bloodGroup || prev?.bloodGroup,
                  bankName: b?.bankName || dbEmp.bankName || prev?.bankName,
                  accountNumber: b?.accountNumber || dbEmp.accountNumber || prev?.accountNumber,
                  ifscCode: b?.ifscCode || dbEmp.ifscCode || prev?.ifscCode,
                  bankLast4: b?.bankLast4 || (b?.accountNumber ? b.accountNumber.slice(-4) : undefined) || dbEmp.bankLast4 || prev?.bankLast4,
                  paymentMethod: dbEmp.paymentMethod || prev?.paymentMethod || "Corporate NEFT",
                };
              });
              return { ...d, employees: authoritativeEmployees };
            });
          }
        })
        .catch(() => {});
    };

    const syncAttendance = () => {
      fetch("/api/attendance?all=true")
        .then((res) => (res.ok ? res.json() : null))
        .then((resData) => {
          if (resData?.success && Array.isArray(resData.records)) {
            setData((d) => {
              const map = new Map<string, AttendanceRecord>();
              for (const r of d.attendance) {
                map.set(`${r.employeeId}_${r.date}`, r);
              }
              for (const r of resData.records) {
                const key = `${r.employeeId}_${r.date}`;
                map.set(key, { ...(map.get(key) || {}), ...r });
              }
              return { ...d, attendance: Array.from(map.values()) };
            });
          }
        })
        .catch(() => {});
    };


    const syncMail = () => {
      fetch("/api/mail")
        .then((res) => (res.ok ? res.json() : null))
        .then((resData) => {
          if (resData?.success && Array.isArray(resData.logs)) {
            const formatted: MailEntry[] = resData.logs.map((m: any) => {
              const createdDate = m.createdAt ? new Date(m.createdAt).toISOString().slice(0, 10) : (m.date || new Date().toISOString().slice(0, 10));
              const channel = m.channel === "Email" ? "Email" : "Physical";
              return {
                id: m._id ? m._id.toString() : (m.id || `ML-${m.refNo}`),
                refNo: m.refNo || `OUT-${Date.now()}`,
                direction: m.direction || "Outgoing",
                date: createdDate,
                sender: m.sender || "System",
                recipient: m.recipient || "Employee",
                subject: m.subject || "Correspondence",
                department: m.department || "Operations",
                ownerId: m.ownerId || "OF-1001",
                priority: m.priority || "Normal",
                status: m.status || (m.direction === "Incoming" ? "Received" : "Dispatched"),
                followUpAt: m.followUpDate || m.followUpAt,
                channel,
                notes: m.notes || "",
                trackingNo: m.trackingNumber || m.trackingNo,
                courierVendor: m.courierVendor || (channel === "Physical" ? (m.channel || "Courier") : "SMTP / Gmail"),
                timeline: Array.isArray(m.timeline)
                  ? m.timeline.map((t: any) => ({
                      at: t.at ? (typeof t.at === "string" ? t.at : new Date(t.at).toISOString().slice(0, 16).replace("T", " ")) : new Date().toISOString().slice(0, 16).replace("T", " "),
                      event: t.event || "Logged",
                      by: t.by || "System",
                    }))
                  : [],
              };
            });
            setData((d) => ({ ...d, mail: formatted }));
          }
        })
        .catch(() => {});
    };

    const syncNotifications = () => {
      syncNotificationsAsync();
    };

    const syncAssets = () => {
      fetch("/api/assets")
        .then((res) => (res.ok ? res.json() : null))
        .then((resData) => {
          if (resData?.success && Array.isArray(resData.assets) && resData.assets.length > 0) {
            setData((d) => {
              const dbAssets: Asset[] = resData.assets.map((a: any) => {
                const assignedToId = typeof a.assignedTo === "object" ? a.assignedTo?.employeeId : a.assignedTo;
                return {
                  id: a.assetTag || a._id || `AST-${Date.now()}`,
                  name: a.name,
                  category: a.category || "Laptop",
                  brandModel: a.brandModel || "",
                  serial: a.serialNumber || a.serial || "",
                  branch: (a.branch as Branch) || "Hyderabad",
                  assignedTo: assignedToId || null,
                  purchaseDate: a.purchaseDate || new Date().toISOString().slice(0, 10),
                  purchaseValue: a.purchaseValue || 0,
                  warrantyExpiry: a.warrantyExpiry || "",
                  condition: a.condition || (a.assignedTo?.conditionAtIssue as any) || "Good",
                  status: a.status || "Available",
                  notes: a.notes,
                  history: Array.isArray(a.history) ? a.history : [],
                };
              });
              return { ...d, assets: dbAssets };
            });
          }
        })
        .catch(() => {});
    };

    const syncAuditLogs = () => {
      fetch("/api/audit-logs")
        .then((res) => (res.ok ? res.json() : null))
        .then((resData) => {
          if (resData?.success && Array.isArray(resData.logs) && resData.logs.length > 0) {
            setData((d) => {
              const dbLogs: AuditEntry[] = resData.logs.map((l: any) => ({
                id: l._id ? l._id.toString() : (l.id || `AU-${Date.now()}`),
                timestamp: l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 16).replace("T", " ") : (l.timestamp || "Just now"),
                user: l.user || "System",
                action: l.action || "System Event",
                module: l.module || "System",
                record: l.details || l.record || "",
                outcome: l.status === "Failure" ? "Failure" : "Success",
                details: l.details,
              }));
              return { ...d, audit: dbLogs };
            });
          }
        })
        .catch(() => {});
    };

    let lastSyncAt = 0;
    const runAllSync = (force = false) => {
      if (!session) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const now = Date.now();
      if (!force && now - lastSyncAt < 15_000) return;
      lastSyncAt = now;

      const isSuperAdmin = session.role === "super_admin";
      const isAdminOrHr = isSuperAdmin || session.role === "hr_admin";

      syncEmployees();
      syncAttendance();
      fetchLeavesAsync();
      syncNotifications();
      syncAssets();
      syncDocumentsAsync();
      if (isAdminOrHr) syncMail();
      if (isSuperAdmin) syncAuditLogs();
    };

    runAllSync(true);
    const interval = setInterval(() => runAllSync(false), 60_000);
    const handleFocus = () => runAllSync(false);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") runAllSync(false);
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [session, fetchLeavesAsync, syncNotificationsAsync, syncDocumentsAsync]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      try {
        // Omit large inline data URLs from localStorage cache; MongoDB holds full document previews
        const cacheableData: AppState = {
          ...data,
          documents: data.documents.map((doc) =>
            doc.fileUrl && doc.fileUrl.length > 50_000 ? { ...doc, fileUrl: undefined } : doc
          ),
        };
        window.localStorage.setItem(KEY, JSON.stringify({ data: cacheableData, session, prefs }));
      } catch {
        // storage full — demo continues in memory
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [data, session, prefs, hydrated]);

  const store = useMemo<Store>(() => {
    const stamp = () => new Date().toISOString().slice(0, 16).replace("T", " ");
    const audit: Store["audit"] = (e) =>
      setData((d) => ({ ...d, audit: [{ id: `AU-${Date.now()}`, timestamp: stamp(), ...e }, ...d.audit] }));

    const s: Store = {
      data, session, prefs, hydrated, pendingDocumentsCount,
      refreshDocuments: syncDocumentsAsync,
      signIn: (role, details) => {
        const origRole = (details?.originalRole || role) as Role;
        const origUserId = details?.originalUserId || details?.userId || details?.employeeId || DEMO_EMPLOYEES[role];
        const origName = details?.originalName || details?.name;
        setSession({
          userId: details?.userId || details?.employeeId || DEMO_EMPLOYEES[role],
          role,
          name: details?.name,
          email: details?.email,
          employeeId: details?.employeeId,
          originalRole: origRole,
          originalUserId: origUserId,
          originalName: origName,
        });
      },
      signOut: () => setSession(null),
      switchRole: (role, targetUser) => {
        setSession((prev) => {
          const origRole = prev?.originalRole || prev?.role || "super_admin";
          const origUserId = prev?.originalUserId || prev?.userId || "ADM-001";
          const origName = prev?.originalName || prev?.name;
          const origEmail = prev?.email;

          if (targetUser) {
            return {
              userId: targetUser.userId,
              role: targetUser.role || role,
              name: targetUser.name,
              email: targetUser.email,
              employeeId: targetUser.userId,
              originalRole: origRole,
              originalUserId: origUserId,
              originalName: origName,
            };
          }

          // If switching back to original role
          if (role === origRole) {
            return {
              userId: origUserId,
              role: origRole,
              name: origName,
              email: origEmail,
              employeeId: origUserId,
              originalRole: origRole,
              originalUserId: origUserId,
              originalName: origName,
            };
          }

          // If HR Admin or Manager switching to their own employee account
          if (role === "employee" && (origRole === "hr_admin" || origRole === "manager")) {
            return {
              userId: origUserId,
              role: "employee",
              name: origName,
              email: origEmail,
              employeeId: origUserId,
              originalRole: origRole,
              originalUserId: origUserId,
              originalName: origName,
            };
          }

          return {
            userId: prev?.userId || DEMO_EMPLOYEES[role],
            role,
            originalRole: origRole,
            originalUserId: origUserId,
            originalName: origName,
          };
        });
      },
      setPref: (patch) => setPrefs((p) => ({ ...p, ...patch })),
      resetDemo: () => {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(KEY);
          window.localStorage.removeItem("rendesk-demo-v1");
        }
        setData(seedState());
        audit({ user: "Admin", action: "Reset data", module: "System", record: "All modules", outcome: "Success" });
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
        const id = e.id || `OF-${2000 + data.employees.length}`;
        setData((d) => ({ ...d, employees: [...d.employees, { ...e, id }] }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Created employee", module: "Employees", record: `${id} ${e.name}`, outcome: "Success" });
        return id;
      },
      updateEmployee: (id, patch, auditNote) => {
        setData((d) => ({ ...d, employees: d.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Updated employee", module: "Employees", record: `${id} ${nameOf(data, id)}`, outcome: "Success", details: auditNote });
      },
      deleteEmployee: (id, skipApi = false) => {
        setData((d) => ({
          ...d,
          employees: d.employees.filter((e) => e.id !== id),
          leaves: d.leaves.filter((l) => l.employeeId !== id),
          attendance: d.attendance.filter((a) => a.employeeId !== id),
          assets: d.assets.map((ast) =>
            ast.assignedTo === id ? { ...ast, assignedTo: null, status: "Available" } : ast
          ),
        }));
        if (!skipApi) {
          fetch(`/api/employees?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch((err) => {
            console.error("Failed to delete employee on server:", err);
          });
        }
        const empRecord = data.employees.find((x) => x.id === id);
        audit({
          user: session ? nameOf(data, session.userId) : "Admin",
          action: "Deleted employee record",
          module: "Employees",
          record: empRecord ? `${empRecord.name} (${empRecord.id})` : id,
          outcome: "Success",
        });
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
      setAttendanceRecords: (records) => {
        setData((d) => {
          const map = new Map<string, AttendanceRecord>();
          for (const r of d.attendance) {
            map.set(`${r.employeeId}_${r.date}`, r);
          }
          for (const r of records) {
            const key = `${r.employeeId}_${r.date}`;
            map.set(key, { ...(map.get(key) || {}), ...r });
          }
          return { ...d, attendance: Array.from(map.values()) };
        });
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
      updateShift: (id, patch) => {
        setData((d) => {
          const updatedShifts = d.shifts.map((s) => (s.id === id ? { ...s, ...patch } : s));
          const targetShift = updatedShifts.find((s) => s.id === id);

          // Recalculate attendance records belonging to this shift when timing parameters change
          let updatedAttendance = d.attendance;
          if (targetShift && (patch.start !== undefined || patch.end !== undefined || patch.graceMinutes !== undefined)) {
            const shiftStartMins = parseTimeToMinutes(targetShift.start);
            const grace = targetShift.graceMinutes ?? 10;

            if (shiftStartMins !== null) {
              updatedAttendance = d.attendance.map((rec) => {
                const recShiftId = rec.shiftId || "SH-GEN";
                if (recShiftId !== id && !(id === "SH-GEN" && (recShiftId === "SH-GEN" || recShiftId.includes("GEN")))) {
                  return rec;
                }
                if (!rec.checkIn || ["Leave", "Absent", "Holiday", "Week Off"].includes(rec.status)) {
                  return rec;
                }

                const checkInMins = parseTimeToMinutes(rec.checkIn);
                if (checkInMins === null) return rec;
                const isHalfDay = checkInMins > 12 * 60;
                const isLate = !isHalfDay && checkInMins > shiftStartMins + grace;
                const lateMinutes = checkInMins > shiftStartMins ? checkInMins - shiftStartMins : 0;
                const status = isHalfDay ? "Half Day" : isLate ? "Late" : "Present";

                return {
                  ...rec,
                  lateMinutes,
                  status,
                };
              });
            }
          }

          return {
            ...d,
            shifts: updatedShifts,
            attendance: updatedAttendance,
          };
        });
        const s = data.shifts.find((x) => x.id === id);
        audit({
          user: session ? nameOf(data, session.userId) : "Demo",
          action: "Updated shift",
          module: "Attendance",
          record: patch.name || s?.name || id,
          outcome: "Success",
        });
      },
      deleteShift: (id) => {
        if (id === "SH-GEN") return;
        const s = data.shifts.find((x) => x.id === id);
        setData((d) => ({
          ...d,
          shifts: d.shifts.filter((x) => x.id !== id),
        }));
        audit({
          user: session ? nameOf(data, session.userId) : "Demo",
          action: "Deleted shift",
          module: "Attendance",
          record: s?.name || id,
          outcome: "Success",
        });
      },
      addHoliday: (h) => {
        setData((d) => ({ ...d, holidays: [...d.holidays, { ...h, id: `HOL-${d.holidays.length + 1}` }] }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Added company holiday", module: "Attendance", record: h.name, outcome: "Success" });
      },
      applyLeave: (l) => {
        const tempId = `LV-${Date.now()}`;
        const newLeave: LeaveRequest = {
          ...l,
          id: tempId,
          status: "Submitted",
          timeline: [{ stage: "Submitted", actor: l.employeeId, at: l.startDate }],
        };
        setData((d) => ({
          ...d,
          leaves: [newLeave, ...d.leaves],
        }));
        audit({
          user: session ? nameOf(data, session.userId) : "Demo",
          action: "Applied for leave",
          module: "Leave",
          record: `${nameOf(data, l.employeeId)} ${l.type}`,
          outcome: "Success",
        });

        // Immediately persist to backend MongoDB Atlas
        fetch("/api/leave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(l),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((resData) => {
            if (resData?.success && resData.leave?.id) {
              setData((d) => ({
                ...d,
                leaves: d.leaves.map((item) =>
                  item.id === tempId ? { ...item, id: resData.leave.id } : item
                ),
              }));
            }
            fetchLeavesAsync();
          })
          .catch((err) => {
            console.error("Failed to persist leave request:", err);
          });
      },
      decideLeave: (id, decision, note) => {
        const stampTime = stamp();
        setData((d) => ({
          ...d,
          leaves: d.leaves.map((l) =>
            l.id === id
              ? {
                  ...l,
                  status: decision,
                  decisionNote: note,
                  reviewedBy: session ? nameOf(d, session.userId) : "Admin",
                  reviewedAt: stampTime,
                  timeline: [
                    ...l.timeline,
                    {
                      stage: decision,
                      actor: session ? nameOf(d, session.userId) : "Admin",
                      at: stampTime,
                      note,
                    },
                  ],
                }
              : l,
          ),
        }));
        const l = data.leaves.find((x) => x.id === id);
        audit({
          user: session ? nameOf(data, session.userId) : "Demo",
          action: `Leave ${decision.toLowerCase()}`,
          module: "Leave",
          record: l ? `${nameOf(data, l.employeeId)} ${l.type}` : id,
          outcome: "Success",
          reason: decision === "Rejected" ? note : undefined,
        });

        // Immediately persist decision to backend MongoDB Atlas
        fetch("/api/leave", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leaveId: id, decision, note }),
        })
          .then(() => fetchLeavesAsync())
          .catch((err) => {
            console.error("Failed to persist leave decision:", err);
          });
      },
      deleteLeave: (id) => {
        setData((d) => ({
          ...d,
          leaves: d.leaves.filter((l) => l.id !== id && (l as any)._id !== id),
        }));
        fetch(`/api/leave?id=${encodeURIComponent(id)}`, { method: "DELETE" })
          .then(() => fetchLeavesAsync())
          .catch((err) => {
            console.error("Failed to delete leave on server:", err);
          });
        const l = data.leaves.find((x) => x.id === id);
        audit({
          user: session ? nameOf(data, session.userId) : "Admin",
          action: "Deleted leave request",
          module: "Leave",
          record: l ? `${nameOf(data, l.employeeId)} ${l.type}` : id,
          outcome: "Success",
        });
      },
      refreshLeaves: fetchLeavesAsync,
      setLeaveRecords: (records) => {
        setData((d) => ({ ...d, leaves: records }));
      },
      createPayrollRun: (period) => {
        const eligible = data.employees.filter((e) => e.status !== "Inactive" && e.status !== "Resigned");
        const gross = eligible.reduce((s, e) => s + e.monthlyGross, 0);
        const ded = Math.round(gross * 0.13);
        setData((d) => ({
          ...d,
          payrollRuns: [
            { id: `PR-${period}`, period, status: "Draft", headcount: eligible.length, gross, employeeDeductions: ded, employerContributions: 0, net: gross - ded, createdAt: stamp() },
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
      addReimbursement: (r) => {
        setData((d) => ({ ...d, reimbursements: [{ ...r, id: `RMB-${d.reimbursements.length + 1}` }, ...d.reimbursements] }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Submitted reimbursement claim", module: "Payroll", record: `${nameOf(data, r.employeeId)} ₹${r.amount}`, outcome: "Success" });
      },
      decideReimbursement: (id, status, note) => {
        setData((d) => ({
          ...d,
          reimbursements: d.reimbursements.map((r) => (r.id === id ? { ...r, status, note: note ?? r.note } : r)),
        }));
        const r = data.reimbursements.find((x) => x.id === id);
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: `Reimbursement ${status.toLowerCase()}`, module: "Payroll", record: r ? `${nameOf(data, r.employeeId)} ₹${r.amount}` : id, outcome: "Success", details: note });
      },
      addDocument: async (doc) => {
        const isApprover = session?.role === "super_admin" || session?.role === "hr_admin";
        const targetOwnerId = isApprover ? doc.ownerId : session?.employeeId || session?.userId || doc.ownerId;
        if (!targetOwnerId) {
          return { ok: false, error: "Document must be attached to an employee." };
        }
        try {
          const res = await fetch("/api/documents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: doc.name,
              category: doc.category,
              employeeId: targetOwnerId,
              fileUrl: doc.fileUrl,
              fileSize: doc.size,
              fileType: doc.fileType,
              docNumber: doc.docNumber,
              confidentiality: doc.confidentiality,
              issueDate: doc.issueDate,
              expiryDate: doc.expiresAt,
              notes: doc.notes,
            }),
          });
          const resData = await res.json().catch(() => null);
          if (!res.ok || !resData?.success) {
            return { ok: false, error: resData?.error || "Failed to upload document." };
          }

          const mapped = mapApiDocument(resData.document);
          if (mapped && (isApprover || mapped.status === "Verified")) {
            setData((d) => ({ ...d, documents: [mapped, ...d.documents.filter((x) => x.id !== mapped.id)] }));
          } else {
            // Employee upload stays Pending until HR / Super Admin approves it
            setPendingDocumentsCount((c) => c + 1);
          }

          audit({
            user: session ? nameOf(data, session.userId) : "Demo",
            action: isApprover ? "Uploaded employee document" : "Submitted document for HR approval",
            module: "Documents",
            record: `${doc.name} (${nameOf(data, targetOwnerId)})`,
            outcome: "Success",
          });
          return { ok: true, status: mapped?.status || (isApprover ? "Verified" : "Pending Verification") };
        } catch {
          return { ok: false, error: "Network error while uploading document." };
        }
      },
      decideDocument: async (id, status) => {
        if (session?.role !== "super_admin" && session?.role !== "hr_admin") return;
        const reviewer = session ? nameOf(data, session.userId) : "HR Admin";
        setData((d) => ({
          ...d,
          documents: d.documents.map((x) => (x.id === id ? { ...x, status, verifiedBy: reviewer } : x)),
        }));
        try {
          await fetch("/api/documents", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              docId: id,
              action: status === "Verified" ? "approve" : "reject",
            }),
          });
          await syncDocumentsAsync();
        } catch {}
        const doc = data.documents.find((x) => x.id === id);
        audit({
          user: reviewer,
          action: `Document ${status === "Verified" ? "verified" : "rejected"}`,
          module: "Documents",
          record: doc?.name ?? id,
          outcome: "Success",
        });
      },
      addMail: (m) => {
        const n = data.mail.length + 1;
        const refNo = `${m.direction === "Incoming" ? "IN" : "OUT"}-2026-${String(141 + n).padStart(4, "0")}`;
        const newMailEntry: MailEntry = {
          ...m,
          channel: m.channel ?? "Physical",
          id: `ML-${n}`,
          refNo,
          timeline: [{ at: stamp(), event: m.direction === "Incoming" ? "Received and registered" : "Dispatched", by: session ? nameOf(data, session.userId) : "Admin" }],
        };
        setData((d) => ({ ...d, mail: [newMailEntry, ...d.mail] }));
        fetch("/api/mail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            direction: m.direction,
            channel: m.channel === "Email" ? "Email" : "Physical Courier",
            sender: m.sender,
            recipient: m.recipient,
            subject: m.subject,
            department: m.department,
            priority: m.priority,
            trackingNumber: m.trackingNo,
            notes: m.notes,
            ownerId: m.ownerId,
            followUpAt: m.followUpAt,
          }),
        }).catch(() => {});
        audit({ user: session ? nameOf(data, session.userId) : "Admin", action: `Registered ${m.direction.toLowerCase()} mail`, module: "Mail Log", record: refNo, outcome: "Success" });
      },
      updateMail: (id, patch, event) => {
        setData((d) => ({
          ...d,
          mail: d.mail.map((m) => (m.id === id ? { ...m, ...patch, timeline: event ? [...m.timeline, { at: stamp(), event, by: session ? nameOf(d, session.userId) : "Admin" }] : m.timeline } : m)),
        }));
        fetch("/api/mail", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, patch, event }),
        }).catch(() => {});
      },
      setMailRecords: (records) => {
        setData((d) => ({ ...d, mail: records }));
      },
      setGmail: (connected) => {
        setData((d) => ({
          ...d,
          gmail: { ...d.gmail, connected, lastSync: connected ? stamp() : d.gmail.lastSync, logs: [{ at: stamp(), event: connected ? "Connected (demo authorization)" : "Disconnected", status: "Success" as const }, ...d.gmail.logs] },
        }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: connected ? "Connected Gmail (demo)" : "Disconnected Gmail", module: "Mail Log", record: "Gmail integration", outcome: "Success" });
      },
      notify: (n) => {
        const notifId = `N-${Date.now()}`;
        setData((d) => ({ ...d, notifications: [{ ...n, id: notifId, timestamp: stamp(), read: false }, ...d.notifications] }));
        fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: n.title,
            message: n.description,
            description: n.description,
            category: n.category,
            priority: n.priority,
            link: n.link,
            isAnnouncement: false,
          }),
        }).catch(() => {});
      },
      markRead: (id) => {
        setData((d) => ({ ...d, notifications: d.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
        fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        }).catch(() => {});
      },
      markAllRead: () => {
        setData((d) => ({ ...d, notifications: d.notifications.map((n) => ({ ...n, read: true })) }));
        fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markAllRead: true }),
        }).catch(() => {});
      },
      clearNotifications: () => setData((d) => ({ ...d, notifications: [] })),
      addAnnouncement: (a) => {
        const id = `AN-${Date.now()}`;
        const newAnn: Announcement = { ...a, id };
        setData((d) => ({
          ...d,
          announcements: [newAnn, ...d.announcements],
          notifications: [
            {
              id: `NT-ANN-${id}`,
              category: "Announcements",
              title: a.title,
              description: a.message,
              timestamp: a.publishAt,
              read: false,
              priority: a.priority,
              link: "/notifications",
            },
            ...d.notifications,
          ],
        }));

        fetch("/api/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-role": session?.role || "super_admin",
            "x-user-id": session?.userId || "ADM-001",
          },
          body: JSON.stringify({
            id,
            title: a.title,
            message: a.message,
            description: a.message,
            category: "Announcements",
            audience: a.audience,
            scope: a.scope,
            priority: a.priority,
            publishAt: a.publishAt,
            expiresAt: a.expiresAt,
            isAnnouncement: true,
          }),
        })
          .then(() => syncNotificationsAsync())
          .catch((err) => console.error("Failed to save announcement to server:", err));

        audit({ user: session ? nameOf(data, session.userId) : "Admin", action: "Published announcement", module: "Notifications", record: a.title, outcome: "Success" });
      },
      deleteAnnouncement: (id) => {
        setData((d) => ({
          ...d,
          announcements: d.announcements.filter((a) => a.id !== id),
          notifications: d.notifications.filter((n) => n.id !== `NT-ANN-${id}` && n.id !== id),
        }));

        fetch(`/api/notifications?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: {
            "x-user-role": session?.role || "super_admin",
            "x-user-id": session?.userId || "ADM-001",
          },
        })
          .then(() => syncNotificationsAsync())
          .catch((err) => console.error("Failed to delete announcement on server:", err));

        audit({ user: session ? nameOf(data, session.userId) : "Admin", action: "Deleted announcement", module: "Notifications", record: id, outcome: "Success" });
      },
      addAsset: (a) => {
        const id = `AST-${String(data.assets.length + 1).padStart(3, "0")}`;
        setData((d) => ({ ...d, assets: [{ ...a, id, status: "Available", history: [] }, ...d.assets] }));
        fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_asset",
            name: a.name,
            category: a.category,
            brandModel: a.brandModel,
            serialNumber: a.serial,
            purchaseValue: a.purchaseValue,
          }),
        }).catch(() => {});
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
        fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "issue_asset",
            assetId: id,
            employeeId,
          }),
        }).catch(() => {});
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
        fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "return_asset",
            assetId: id,
            condition,
          }),
        }).catch(() => {});
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
      addOnboardingTask: (t) => {
        setData((d) => ({
          ...d,
          onboardingTasks: [
            { ...t, id: `TSK-${d.onboardingTasks.length + 1}` },
            ...d.onboardingTasks,
          ],
        }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Created onboarding task", module: "Onboarding", record: t.task, outcome: "Success" });
      },
      addJoiner: (j) => {
        setData((d) => ({
          ...d,
          joiners: [
            {
              ...j,
              id: `JNR-${d.joiners.length + 1}`,
              checklistCompletion: j.checklistCompletion ?? 15,
            },
            ...d.joiners,
          ],
        }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Scheduled upcoming joiner", module: "Onboarding", record: j.name, outcome: "Success" });
      },
      addResignation: (r) => {
        setData((d) => ({
          ...d,
          resignations: [
            {
              id: `RES-${d.resignations.length + 1}`,
              managerApproval: "Pending",
              hrApproval: "Pending",
              handoverDone: false,
              assetReturnDone: false,
              documentClearance: false,
              financeClearance: false,
              settlementDone: false,
              accountDeactivated: false,
              status: "In Notice",
              ...r,
            },
            ...d.resignations,
          ],
        }));
        audit({ user: session ? nameOf(data, session.userId) : "Demo", action: "Submitted resignation request", module: "Onboarding", record: nameOf(data, r.employeeId), outcome: "Success" });
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
  }, [data, session, prefs, hydrated, pendingDocumentsCount, syncDocumentsAsync]);

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
