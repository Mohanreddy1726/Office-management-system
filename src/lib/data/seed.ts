// Deterministic demo seed for RenDesk. All dates are relative to a fixed
// "today" so the dataset stays consistent across refreshes and role switches.
import type {
  AppState, AttendanceRecord, AttendanceCorrection, LeaveRequest, LeavePolicy, Shift, Holiday,
  BiometricDevice, BiometricMapping, UnmappedBiometricId, ImportBatch, PayrollRun, SalaryStructure,
  Reimbursement, DocumentRecord, MailEntry, NotificationItem, Announcement, Asset, Goal,
  ReviewCycle, Review, OnboardingTask, Joiner, Resignation, FormerEmployee, UserAccount,
  PermissionMatrix, AuditEntry, Employee, Branch, Role, PermissionAction,
} from "./types";

export const TODAY = "2026-11-09";
export const CURRENT_PERIOD = "2026-11";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261022);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const rint = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

export const DEPARTMENTS = ["Engineering", "Human Resources", "Finance", "Sales", "Operations", "Customer Support"];

export const TEAMS = [
  { name: "Frontend Platform", department: "Engineering", branch: "Hyderabad" as Branch },
  { name: "Backend Services", department: "Engineering", branch: "Hyderabad" as Branch },
  { name: "Quality Engineering", department: "Engineering", branch: "Warangal" as Branch },
  { name: "Talent Acquisition", department: "Human Resources", branch: "Hyderabad" as Branch },
  { name: "Finance & Accounts", department: "Finance", branch: "Hyderabad" as Branch },
  { name: "Growth & Sales", department: "Sales", branch: "Vijayawada" as Branch },
  { name: "Support Desk", department: "Customer Support", branch: "Visakhapatnam" as Branch },
  { name: "Facilities & Admin", department: "Operations", branch: "Hyderabad" as Branch },
];

const DESIGNATIONS: Record<string, string[]> = {
  "Frontend Platform": ["Senior Software Engineer", "Software Engineer", "Software Engineer", "UI Developer", "Software Engineer", "UI Developer", "Senior Software Engineer"],
  "Backend Services": ["Senior Software Engineer", "Software Engineer", "DevOps Engineer", "Software Engineer", "Senior Software Engineer", "Software Engineer"],
  "Quality Engineering": ["QA Lead", "QA Engineer", "QA Engineer", "QA Engineer", "Automation Engineer"],
  "Talent Acquisition": ["HR Executive", "Recruiter", "HR Executive", "Recruiter"],
  "Finance & Accounts": ["Accountant", "Accounts Executive", "Senior Accountant", "Accounts Executive"],
  "Growth & Sales": ["Sales Executive", "Business Development Executive", "Sales Executive", "Key Account Manager", "Sales Executive"],
  "Support Desk": ["Support Executive", "Support Team Member", "Support Executive"],
  "Facilities & Admin": ["Operations Executive", "Admin Executive", "Front Office Executive"],
};

const EXTRA_NAMES = [
  "Aarav Gupta", "Bhavna Joshi", "Chetan Rao", "Divya Iyer", "Eshwar Prasad", "Farhan Ali", "Gauri Nandan",
  "Harish Kumar", "Ishita Bose", "Jagan Mohan", "Kritika Saxena", "Lokesh Naik", "Manish Tiwari", "Nandini Rao",
  "Om Prakash", "Pooja Hegde", "Qadir Khan", "Ramesh Yadav", "Sanjana Pillai", "Tarun Bhatt", "Uma Mahesh",
  "Varun Chandra", "Vidya Sagar", "Yamini Reddy", "Zainab Sheikh", "Akash Dutta", "Bharat Shetty", "Charan Teja",
  "Deepika Nair", "Ganesh Verma", "Hema Latha", "Irfan Mohammed", "Jyothi Kumari", "Kunal Kapoor", "Madhavi Latha",
  "Naveen Kumar", "Sneha Kulkarni",
];

const slug = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, ".");

let nextId = 1001;
const newId = () => `OF-${nextId++}`;

function buildEmployees(): Employee[] {
  return [];
}

const EMPLOYEES = buildEmployees();
export const DEMO_EMPLOYEES = {
  super_admin: "ADM-001",
  hr_admin: "ADM-001",
  manager: "ADM-001",
  employee: "ADM-001",
} as const;

function buildShifts(): Shift[] {
  return [
    { id: "SH-GEN", name: "General Shift", start: "09:30", end: "18:30", breakMinutes: 60, graceMinutes: 10, weeklyOffs: ["Sunday"], minFullDayHours: 7.5, minHalfDayHours: 4, overtimeEligible: false, branches: ["Hyderabad", "Warangal", "Vijayawada", "Visakhapatnam"], overnight: false },
    { id: "SH-MORN", name: "Morning Support", start: "07:00", end: "15:30", breakMinutes: 45, graceMinutes: 10, weeklyOffs: ["Sunday"], minFullDayHours: 7, minHalfDayHours: 4, overtimeEligible: true, branches: ["Hyderabad", "Visakhapatnam"], overnight: false },
    { id: "SH-EVE", name: "Evening Support", start: "14:00", end: "22:30", breakMinutes: 45, graceMinutes: 10, weeklyOffs: ["Sunday"], minFullDayHours: 7, minHalfDayHours: 4, overtimeEligible: true, branches: ["Hyderabad", "Vijayawada"], overnight: false },
    { id: "SH-NIGHT", name: "Night Operations", start: "22:00", end: "06:30", breakMinutes: 45, graceMinutes: 15, weeklyOffs: ["Sunday"], minFullDayHours: 7, minHalfDayHours: 4, overtimeEligible: true, branches: ["Hyderabad"], overnight: true },
  ];
}

const SHIFTS = buildShifts();

function dateRange(): string[] {
  const out: string[] = [];
  const start = new Date("2026-09-23T00:00:00Z");
  for (let i = 0; i < 30; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
const DATES = dateRange();

function buildAttendance(): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const sunday = (d: string) => new Date(d + "T00:00:00Z").getUTCDay() === 0;
  let n = 0;
  for (const emp of EMPLOYEES) {
    const shift = emp.department === "Customer Support" ? (emp.id.charCodeAt(6) % 2 ? "SH-EVE" : "SH-NIGHT") : "SH-GEN";
    for (const date of DATES) {
      const id = `AR-${++n}`;
      if (sunday(date)) {
        records.push({ id, employeeId: emp.id, date, shiftId: shift, lateMinutes: 0, status: "Week Off", source: "Biometric", confirmation: "Locked" });
        continue;
      }
      if (date === "2026-10-02") {
        records.push({ id, employeeId: emp.id, date, shiftId: shift, lateMinutes: 0, status: "Holiday", source: "Biometric", confirmation: "Locked" });
        continue;
      }
      const r = rand();
      let status: AttendanceRecord["status"] = "Present";
      let lateMinutes = 0;
      let checkIn: string | undefined;
      let checkOut: string | undefined;
      if (r < 0.05) status = "Absent";
      else if (r < 0.11) status = "Leave";
      else if (r < 0.125) status = "Half Day";
      else if (r < 0.27) { status = "Late"; lateMinutes = rint(6, 45); }
      const sh = SHIFTS.find((s) => s.id === shift)!;
      const [h = 9, m = 30] = sh.start.split(":").map(Number);
      const startMin = h * 60 + m + lateMinutes;
      if (status !== "Absent" && status !== "Leave") {
        checkIn = `${String(Math.floor(startMin / 60) % 24).padStart(2, "0")}:${String(startMin % 60).padStart(2, "0")}`;
        const endMin = startMin + 480 + rint(-30, 60);
        checkOut = `${String(Math.floor(endMin / 60) % 24).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
      }
      // Confirmation stage by recency
      const idx = DATES.indexOf(date);
      const daysAgo = 29 - idx;
      let confirmation: AttendanceRecord["confirmation"] = "Confirmed";
      if (daysAgo <= 1) confirmation = "Awaiting Employee";
      else if (daysAgo <= 3) confirmation = rand() < 0.6 ? "Awaiting Employee" : "Awaiting Manager";
      else if (daysAgo <= 6) confirmation = rand() < 0.5 ? "Awaiting Manager" : "Awaiting HR";
      else if (date.startsWith("2026-09")) confirmation = "Locked";
      else confirmation = rand() < 0.7 ? "Confirmed" : "Awaiting HR";
      if (rand() < 0.008) confirmation = "Disputed";
      const exception = rand() < 0.05 ? "Missing punch" : undefined;
      if (exception && checkOut) checkOut = undefined;
      records.push({
        id, employeeId: emp.id, date, shiftId: shift, checkIn, checkOut,
        workedMinutes: checkIn && checkOut ? 480 : undefined,
        lateMinutes, status, source: rand() < 0.93 ? "Biometric" : rand() < 0.5 ? "Manual" : "CSV Import",
        confirmation, exception,
      });
    }
  }
  return records;
}

const ATTENDANCE = buildAttendance();

function buildCorrections(): AttendanceCorrection[] {
  const mk = (i: number, empId: string, date: string, oi: string, oo: string | undefined, ri: string, ro: string, reason: string, status: AttendanceCorrection["status"]): AttendanceCorrection =>
    ({ id: `COR-${i}`, employeeId: empId, date, originalIn: oi, originalOut: oo, requestedIn: ri, requestedOut: ro, reason, submittedBy: empId, submittedAt: date, status });
  return [
    mk(1, "OF-1011", "2026-10-20", "09:52", undefined, "09:30", "18:25", "Device failed to register evening punch", "Awaiting Manager"),
    mk(2, "OF-1014", "2026-10-18", "10:10", "19:00", "09:30", "18:30", "Forgot to punch in after client meeting", "Awaiting HR"),
    mk(3, "OF-1021", "2026-10-15", "09:41", "18:35", "09:30", "18:30", "Biometric reader was offline", "Approved"),
    mk(4, "OF-1006", "2026-10-12", "09:58", "18:20", "09:30", "18:30", "Traffic delay, punched late by 28 min", "Rejected"),
  ];
}

function buildLeaves(): LeaveRequest[] {
  const lv = (id: string, empId: string, type: LeaveRequest["type"], s: string, e: string, days: number, reason: string, status: LeaveRequest["status"], managerDecision?: LeaveRequest["managerDecision"]): LeaveRequest => ({
    id, employeeId: empId, type, startDate: s, endDate: e, days, reason, status, managerDecision,
    timeline: [
      { stage: "Submitted", actor: empId, at: s },
      ...(managerDecision ? [{ stage: "Manager Review", actor: "OF-1002", at: s, note: managerDecision }] : []),
      ...(status === "Approved" ? [{ stage: "HR Review", actor: "OF-1010", at: e, note: "Approved" }] : []),
    ],
  });
  return [
    lv("LV-1", "OF-1011", "Casual Leave", "2026-10-26", "2026-10-27", 2, "Family function", "Manager Review", "Recommended Approval"),
    lv("LV-2", "OF-1012", "Sick Leave", "2026-10-20", "2026-10-21", 2, "Fever and cold", "HR Review"),
    lv("LV-3", "OF-1015", "Casual Leave", "2026-11-02", "2026-11-06", 5, "Vacation", "Manager Review", "Recommended Approval"),
    lv("LV-4", "OF-1004", "Casual Leave", "2026-10-23", "2026-10-23", 1, "Personal work", "Submitted"),
    lv("LV-5", "OF-1022", "Comp-Off", "2026-10-24", "2026-10-24", 1, "Worked on Oct 4 holiday", "HR Review", "Recommended Approval"),
    lv("LV-6", "OF-1030", "Sick Leave", "2026-10-27", "2026-10-30", 4, "Medical procedure recovery", "Rejected", "Recommended Rejection"),
    lv("LV-7", "OF-1018", "Casual Leave", "2026-10-01", "2026-10-01", 1, "Medical appointment", "Approved", "Recommended Approval"),
    lv("LV-8", "OF-1024", "Sick Leave", "2026-09-28", "2026-09-29", 2, "Viral infection", "Approved", "Recommended Approval"),
    lv("LV-9", "OF-1033", "Casual Leave", "2026-10-19", "2026-10-20", 2, "Sister's wedding", "Approved", "Recommended Approval"),
    lv("LV-10", "OF-1040", "Casual Leave", "2026-10-26", "2026-10-26", 1, "House shifting", "Clarification"),
    lv("LV-11", "OF-1044", "Casual Leave", "2026-11-13", "2026-11-14", 2, "Temple visit", "Submitted"),
    lv("LV-12", "OF-1046", "Sick Leave", "2026-10-14", "2026-10-14", 1, "Dentist", "Approved", "Recommended Approval"),
    lv("LV-13", "OF-1035", "Comp-Off", "2026-10-25", "2026-10-25", 1, "Weekend release work", "Manager Review"),
    lv("LV-14", "OF-1009", "Casual Leave", "2026-12-01", "2026-12-05", 5, "Year-end travel", "Submitted"),
  ];
}

const LEAVE_POLICIES: LeavePolicy[] = [
  { id: "LP-1", type: "Casual Leave", annualEntitlement: 12, accrual: "Monthly credit (1 day/month)", carryForwardCap: 5, expiry: "Carry-forward lapses Mar 31", halfDayEligible: true, negativeBalance: false, eligibility: "All full-time employees" },
  { id: "LP-2", type: "Sick Leave", annualEntitlement: 10, accrual: "Annual grant (credited Jan 1)", carryForwardCap: 0, expiry: "No carry-forward", halfDayEligible: true, negativeBalance: false, eligibility: "All full-time employees" },
  { id: "LP-3", type: "Comp-Off", annualEntitlement: 0, accrual: "Per approved weekend/holiday work", carryForwardCap: 6, expiry: "90 days from accrual", halfDayEligible: false, negativeBalance: false, eligibility: "Employees with approved holiday work" },
];

function buildLeaveBalances(): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const e of EMPLOYEES) {
    out[e.id] = {
      "Casual Leave": rint(3, 12),
      "Sick Leave": rint(4, 10),
      "Comp-Off": rint(0, 3),
    };
  }
  return out;
}

const HOLIDAYS: Holiday[] = [
  { id: "H-1", name: "Gandhi Jayanti", date: "2026-10-02", branches: "All" },
  { id: "H-2", name: "Diwali", date: "2026-11-08", branches: "All" },
  { id: "H-3", name: "Christmas", date: "2026-12-25", branches: "All" },
  { id: "H-4", name: "Sankranti", date: "2027-01-14", branches: ["Hyderabad", "Warangal", "Vijayawada", "Visakhapatnam"] },
];

const DEVICES: BiometricDevice[] = [
  { id: "DEV-1", name: "HQ Main Entrance", deviceId: "ZKT-LX50-001", brand: "ZKTeco", model: "LX50", branch: "Hyderabad", location: "Reception, 3rd Floor", connection: "TCP/IP", lastSync: "2026-10-22 08:45", status: "Online" },
  { id: "DEV-2", name: "HQ Dev Wing", deviceId: "ZKT-LX50-002", brand: "ZKTeco", model: "LX50", branch: "Hyderabad", location: "5th Floor Lobby", connection: "TCP/IP", lastSync: "2026-10-22 08:45", status: "Online" },
  { id: "DEV-3", name: "Warangal Office", deviceId: "ESSL-E9C-011", brand: "eSSL", model: "E9C", branch: "Warangal", location: "Ground Floor", connection: "TCP/IP", lastSync: "2026-10-22 07:10", status: "Online" },
  { id: "DEV-4", name: "Vijayawada Office", deviceId: "ESSL-E9C-021", brand: "eSSL", model: "E9C", branch: "Vijayawada", location: "Reception", connection: "USB", lastSync: "2026-10-21 18:30", status: "Sync Pending" },
  { id: "DEV-5", name: "Visakhapatnam Office", deviceId: "CSV-FALLBACK-05", brand: "—", model: "CSV Import", branch: "Visakhapatnam", location: "Manual CSV upload", connection: "CSV Import", lastSync: "2026-10-20 09:00", status: "Offline" },
];

const MAPPINGS: BiometricMapping[] = EMPLOYEES.slice(0, 40).map((e, i) => ({
  id: `MAP-${i + 1}`,
  employeeId: e.id,
  deviceId: e.branch === "Hyderabad" ? (i % 2 ? "DEV-2" : "DEV-1") : e.branch === "Warangal" ? "DEV-3" : e.branch === "Vijayawada" ? "DEV-4" : "DEV-5",
  biometricId: `BIO-${1000 + i}`,
  effectiveFrom: e.joiningDate,
  status: "Active" as const,
  notes: i % 5 === 0 ? "Re-enrolled after device migration" : undefined,
}));

const UNMAPPED: UnmappedBiometricId[] = [
  { id: "UNM-1", biometricId: "BIO-2041", deviceId: "DEV-1", firstSeen: "2026-10-18", punchCount: 6 },
  { id: "UNM-2", biometricId: "BIO-2042", deviceId: "DEV-2", firstSeen: "2026-10-19", punchCount: 3 },
  { id: "UNM-3", biometricId: "BIO-2043", deviceId: "DEV-3", firstSeen: "2026-10-15", punchCount: 11 },
  { id: "UNM-4", biometricId: "BIO-2044", deviceId: "DEV-4", firstSeen: "2026-10-20", punchCount: 2 },
  { id: "UNM-5", biometricId: "BIO-2045", deviceId: "DEV-1", firstSeen: "2026-10-21", punchCount: 1 },
  { id: "UNM-6", biometricId: "BIO-2046", deviceId: "DEV-2", firstSeen: "2026-10-22", punchCount: 2 },
];

const IMPORTS: ImportBatch[] = [
  { id: "IMP-1", batch: "BATCH-1041", sourceFile: "punches_oct_w1.csv", deviceId: "DEV-5", startedAt: "2026-10-20 09:00", received: 62, processed: 58, duplicates: 2, failures: 2, status: "Completed with Failures" },
  { id: "IMP-2", batch: "BATCH-1040", sourceFile: "vijayawada_weekly.csv", deviceId: "DEV-4", startedAt: "2026-10-13 08:30", received: 48, processed: 48, duplicates: 0, failures: 0, status: "Completed" },
  { id: "IMP-3", batch: "BATCH-1039", sourceFile: "hq_daily_2026-10-08.csv", deviceId: "DEV-1", startedAt: "2026-10-08 09:15", received: 41, processed: 39, duplicates: 2, failures: 0, status: "Completed" },
  { id: "IMP-4", batch: "BATCH-1038", sourceFile: "warangal_oct_w1.csv", deviceId: "DEV-3", startedAt: "2026-10-06 10:00", received: 30, processed: 30, duplicates: 0, failures: 0, status: "Completed" },
];

function buildPayroll(): PayrollRun[] {
  const mk = (period: string, status: PayrollRun["status"], hc: number, approvedBy?: string, lockedBy?: string, paidAt?: string): PayrollRun => {
    const gross = EMPLOYEES.slice(0, hc).reduce((s, e) => s + e.monthlyGross, 0);
    const ded = Math.round(gross * 0.13);
    return {
      id: `PR-${period}`, period, status, headcount: hc, gross, employeeDeductions: ded,
      employerContributions: Math.round(gross * 0.12), net: gross - ded, createdAt: `${period}-25`,
      approvedBy, lockedBy, paidAt,
    };
  };
  return [
    { ...mk("2026-08", "Payment Recorded", 45, "Vikram Desai", "Ananya Sharma", "2026-09-01"), id: "PR-2026-08" },
    { ...mk("2026-09", "Payment Recorded", 46, "Vikram Desai", "Ananya Sharma", "2026-10-01"), id: "PR-2026-09" },
    { ...mk("2026-10", "Calculated", 48), id: "PR-2026-10" },
  ];
}

const SALARY_STRUCTURES: SalaryStructure[] = [
  {
    id: "SS-STANDARD", name: "Standard Structure (No PF / No ESI)", applicableTo: "All full-time staff up to ₹8 LPA", effectiveFrom: "2025-04-01",
    earnings: [{ name: "Basic", calc: "40% of gross" }, { name: "HRA", calc: "50% of Basic" }, { name: "Special Allowance", calc: "Balance of gross" }],
    deductions: [{ name: "Professional Tax", calc: "₹200 flat" }, { name: "TDS", calc: "As per income declaration" }, { name: "PF & ESI", calc: "₹0 (Exempted as per policy)" }],
    employerContributions: [{ name: "PF & ESI", calc: "₹0 (Exempted)" }],
  },
  {
    id: "SS-SENIOR", name: "Senior Staff Structure (No PF / No ESI)", applicableTo: "Senior staff above ₹8 LPA", effectiveFrom: "2025-04-01",
    earnings: [{ name: "Basic", calc: "45% of gross" }, { name: "HRA", calc: "50% of Basic" }, { name: "Special Allowance", calc: "Balance of gross" }, { name: "Incentives", calc: "Variable bonus" }],
    deductions: [{ name: "Professional Tax", calc: "₹200 flat" }, { name: "TDS", calc: "As per income declaration" }, { name: "PF & ESI", calc: "₹0 (Exempted as per policy)" }],
    employerContributions: [{ name: "PF & ESI", calc: "₹0 (Exempted)" }],
  },
  {
    id: "SS-EXEC", name: "Executive Structure (No PF / No ESI)", applicableTo: "Leadership and team leads", effectiveFrom: "2025-04-01",
    earnings: [{ name: "Basic", calc: "50% of gross" }, { name: "HRA", calc: "50% of Basic" }, { name: "Performance Bonus", calc: "Target linked" }],
    deductions: [{ name: "Professional Tax", calc: "₹200 flat" }, { name: "TDS", calc: "As per income declaration" }, { name: "PF & ESI", calc: "₹0 (Exempted as per policy)" }],
    employerContributions: [{ name: "Gratuity Provision", calc: "4.81% of Basic" }, { name: "PF & ESI", calc: "₹0 (Exempted)" }],
  },
];

const REIMBURSEMENTS: Reimbursement[] = [
  { id: "RB-1", employeeId: "OF-1011", type: "Travel", amount: 4200, date: "2026-10-14", status: "Approved", payrollPeriod: "2026-10", note: "Client visit, Bengaluru" },
  { id: "RB-2", employeeId: "OF-1014", type: "Internet", amount: 1200, date: "2026-10-10", status: "Pending", note: "October broadband" },
  { id: "RB-3", employeeId: "OF-1002", type: "Travel", amount: 8600, date: "2026-10-08", status: "Approved", payrollPeriod: "2026-10" },
  { id: "RB-4", employeeId: "OF-1022", type: "Fuel", amount: 2400, date: "2026-10-05", status: "Paid", payrollPeriod: "2026-09" },
  { id: "RB-5", employeeId: "OF-1030", type: "Training", amount: 15000, date: "2026-09-28", status: "Paid", payrollPeriod: "2026-09", note: "AWS certification" },
  { id: "RB-6", employeeId: "OF-1033", type: "Relocation", amount: 22000, date: "2026-09-20", status: "Approved", payrollPeriod: "2026-10" },
  { id: "RB-7", employeeId: "OF-1018", type: "Medical", amount: 5400, date: "2026-10-16", status: "Pending" },
  { id: "RB-8", employeeId: "OF-1044", type: "Telephone", amount: 900, date: "2026-10-12", status: "Approved", payrollPeriod: "2026-10" },
];

const DOCUMENTS: DocumentRecord[] = [
  { id: "DOC-1", name: "Offer Letter — Karthik Reddy", category: "Offer Letters", ownerId: "OF-1011", uploadedBy: "OF-1010", uploadedAt: "2025-04-10", version: 1, status: "Verified", size: "184 KB" },
  { id: "DOC-2", name: "Appointment Letter — Karthik Reddy", category: "Employment", ownerId: "OF-1011", uploadedBy: "OF-1010", uploadedAt: "2025-04-21", version: 1, status: "Verified", size: "201 KB" },
  { id: "DOC-3", name: "Aadhaar — Karthik Reddy", category: "Identity", ownerId: "OF-1011", uploadedBy: "OF-1011", uploadedAt: "2025-04-19", version: 2, status: "Verified", expiresAt: "2027-04-19", size: "512 KB" },
  { id: "DOC-4", name: "PAN — Karthik Reddy", category: "Identity", ownerId: "OF-1011", uploadedBy: "OF-1011", uploadedAt: "2025-04-19", version: 1, status: "Pending Verification", size: "289 KB" },
  { id: "DOC-5", name: "B.E. Certificate — Karthik Reddy", category: "Education", ownerId: "OF-1011", uploadedBy: "OF-1011", uploadedAt: "2025-04-22", version: 1, status: "Verified", size: "1.2 MB" },
  { id: "DOC-6", name: "Employee Handbook 2026", category: "Policies", ownerId: null, uploadedBy: "OF-1010", uploadedAt: "2026-01-05", version: 4, status: "Verified", size: "3.4 MB" },
  { id: "DOC-7", name: "Leave Policy 2026", category: "Policies", ownerId: null, uploadedBy: "OF-1010", uploadedAt: "2026-01-05", version: 2, status: "Verified", size: "410 KB" },
  { id: "DOC-8", name: "Anti-Harassment Policy", category: "Policies", ownerId: null, uploadedBy: "OF-1010", uploadedAt: "2026-02-11", version: 1, status: "Verified", size: "295 KB" },
  { id: "DOC-9", name: "Degree Certificate — Aarav Gupta", category: "Education", ownerId: "OF-1012", uploadedBy: "OF-1012", uploadedAt: "2026-09-28", version: 1, status: "Pending Verification", size: "890 KB" },
  { id: "DOC-10", name: "Relieving Letter — Ravi Teja", category: "Exit", ownerId: "OF-1047", uploadedBy: "OF-1010", uploadedAt: "2026-08-30", version: 1, status: "Verified", size: "156 KB" },
  { id: "DOC-11", name: "Rent Agreement — Pooja Hegde", category: "Others", ownerId: "OF-1016", uploadedBy: "OF-1016", uploadedAt: "2026-05-14", version: 1, status: "Verified", expiresAt: "2026-11-13", size: "760 KB" },
  { id: "DOC-12", name: "Passport — Divya Iyer", category: "Identity", ownerId: "OF-1015", uploadedBy: "OF-1015", uploadedAt: "2026-03-02", version: 1, status: "Verified", expiresAt: "2026-12-20", size: "640 KB" },
  { id: "DOC-13", name: "Offer Letter — Sneha Kulkarni", category: "Offer Letters", ownerId: "OF-1048", uploadedBy: "OF-1010", uploadedAt: "2026-10-12", version: 1, status: "Verified", size: "178 KB" },
  { id: "DOC-14", name: "Medical Certificate — Om Prakash", category: "Others", ownerId: "OF-1015", uploadedBy: "OF-1015", uploadedAt: "2026-09-29", version: 1, status: "Rejected", size: "120 KB" },
];

const MAIL: MailEntry[] = [
  { id: "ML-1", refNo: "IN-2026-0141", direction: "Incoming", date: "2026-10-21", sender: "Income Tax Dept", recipient: "Finance", subject: "TDS return acknowledgment for Q2", department: "Finance", ownerId: "OF-1006", priority: "High", status: "In Progress", channel: "Physical", notes: "Filed acknowledgment copy in records.", timeline: [{ at: "2026-10-21", event: "Received and registered", by: "OF-1009" }] },
  { id: "ML-2", refNo: "OUT-2026-0089", direction: "Outgoing", date: "2026-10-20", sender: "HR", recipient: "All Employees", subject: "Diwali holiday announcement", department: "Human Resources", ownerId: "OF-1010", priority: "Normal", status: "Closed", channel: "Email", notes: "", timeline: [{ at: "2026-10-20", event: "Dispatched via email", by: "OF-1010" }, { at: "2026-10-20", event: "Closed", by: "OF-1010" }] },
  { id: "ML-3", refNo: "IN-2026-0140", direction: "Incoming", date: "2026-10-18", sender: "HDFC Bank", recipient: "Finance", subject: "Current account statement — Sep 2026", department: "Finance", ownerId: "OF-1006", priority: "Normal", status: "Closed", channel: "Physical", notes: "", timeline: [{ at: "2026-10-18", event: "Received", by: "OF-1009" }] },
  { id: "ML-4", refNo: "IN-2026-0139", direction: "Incoming", date: "2026-10-17", sender: "Telangana Commercial Tax", recipient: "Finance", subject: "GST notice — clarification requested", department: "Finance", ownerId: "OF-1006", priority: "Urgent", status: "Open", followUpAt: "2026-10-24", channel: "Physical", notes: "CA is preparing the response.", timeline: [{ at: "2026-10-17", event: "Received", by: "OF-1009" }, { at: "2026-10-18", event: "Assigned to Deepak Rao", by: "OF-1010" }] },
  { id: "ML-5", refNo: "OUT-2026-0088", direction: "Outgoing", date: "2026-10-15", sender: "Operations", recipient: "Acme Facilities Pvt Ltd", subject: "AMC renewal for biometric devices", department: "Operations", ownerId: "OF-1009", priority: "Normal", status: "In Progress", channel: "Email", notes: "Awaiting vendor quote.", timeline: [{ at: "2026-10-15", event: "Sent via email", by: "OF-1009" }] },
  { id: "ML-6", refNo: "IN-2026-0138", direction: "Incoming", date: "2026-10-14", sender: "M/s Rapid Couriers", recipient: "Admin", subject: "Documents from registrar of companies", department: "Operations", ownerId: "OF-1009", priority: "Normal", status: "Closed", channel: "Physical", notes: "", timeline: [{ at: "2026-10-14", event: "Received", by: "OF-1009" }] },
  { id: "ML-7", refNo: "IN-2026-0137", direction: "Incoming", date: "2026-10-12", sender: "Microsoft India", recipient: "Engineering", subject: "Enterprise agreement renewal", department: "Engineering", ownerId: "OF-1002", priority: "High", status: "Open", followUpAt: "2026-10-23", channel: "Email", notes: "", timeline: [{ at: "2026-10-12", event: "Received", by: "OF-1009" }] },
  { id: "ML-8", refNo: "OUT-2026-0087", direction: "Outgoing", date: "2026-10-10", sender: "Sales", recipient: "Sunrise Traders", subject: "Quotation for annual supply contract", department: "Sales", ownerId: "OF-1007", priority: "High", status: "In Progress", channel: "Email", notes: "", timeline: [{ at: "2026-10-10", event: "Sent", by: "OF-1007" }] },
  { id: "ML-9", refNo: "IN-2026-0136", direction: "Incoming", date: "2026-10-08", sender: "Insurance Provider", recipient: "HR", subject: "Group mediclaim renewal notice", department: "Human Resources", ownerId: "OF-1010", priority: "High", status: "In Progress", followUpAt: "2026-10-26", channel: "Physical", notes: "Compare with last year's premium.", timeline: [{ at: "2026-10-08", event: "Received", by: "OF-1009" }] },
  { id: "ML-10", refNo: "OUT-2026-0086", direction: "Outgoing", date: "2026-10-05", sender: "HR", recipient: "Karthik Reddy", subject: "Confirmation letter after probation", department: "Human Resources", ownerId: "OF-1010", priority: "Normal", status: "Closed", channel: "Email", notes: "", timeline: [{ at: "2026-10-05", event: "Sent", by: "OF-1010" }] },
];

const GMAIL = {
  connected: true,
  mailbox: "hr@rendesk.example",
  lastSync: "2026-10-22 08:40",
  scopes: ["Read mail metadata", "Read labels", "Send on behalf (draft only)"],
  frequency: "Every 6 hours" as const,
  logs: [
    { at: "2026-10-22 08:40", event: "Synced 12 new emails to Mail Log (email channel)", status: "Success" as const },
    { at: "2026-10-22 02:40", event: "Synced 4 new emails", status: "Success" as const },
    { at: "2026-10-21 20:40", event: "Sync completed, no new mail", status: "Success" as const },
    { at: "2026-10-21 14:40", event: "Rate limited, retried after 10 min", status: "Warning" as const },
    { at: "2026-10-21 08:40", event: "Synced 9 new emails", status: "Success" as const },
  ],
};

const NOTIFICATIONS: NotificationItem[] = [
  { id: "N-1", category: "Approvals", title: "Leave request awaiting your approval", description: "Karthik Reddy applied for Casual Leave (Oct 26–27).", timestamp: "2026-10-22 09:12", read: false, priority: "High", link: "/leave" },
  { id: "N-2", category: "Attendance", title: "Attendance correction submitted", description: "Karthik Reddy requested a correction for Oct 20.", timestamp: "2026-10-22 08:30", read: false, priority: "Normal", link: "/attendance?tab=corrections" },
  { id: "N-3", category: "Attendance", title: "Confirm your attendance for Oct 21", description: "Your attendance for Oct 21 is awaiting your confirmation.", timestamp: "2026-10-22 07:00", read: false, priority: "Normal", link: "/attendance?tab=confirmation" },
  { id: "N-4", category: "Payroll", title: "October payroll calculated", description: "Payroll run for Oct 2026 is ready for review.", timestamp: "2026-10-21 18:00", read: true, priority: "Normal", link: "/payroll" },
  { id: "N-5", category: "Documents", title: "Document pending verification", description: "PAN — Karthik Reddy needs verification.", timestamp: "2026-10-20 11:20", read: false, priority: "Normal", link: "/documents?tab=pending" },
  { id: "N-6", category: "Announcements", title: "Diwali holidays announced", description: "Office closed Nov 6–9. Read the circular for details.", timestamp: "2026-10-20 10:00", read: true, priority: "Normal", link: "/notifications" },
  { id: "N-7", category: "Approvals", title: "Comp-Off request from Akash Dutta", description: "Comp-Off for Oct 24, worked on Oct 4 release.", timestamp: "2026-10-19 16:45", read: true, priority: "Normal", link: "/leave" },
  { id: "N-8", category: "Attendance", title: "Disputed attendance record", description: "Bhavna Joshi disputed her Oct 16 attendance.", timestamp: "2026-10-19 09:30", read: true, priority: "High", link: "/attendance?tab=confirmation" },
  { id: "N-9", category: "Payroll", title: "Reimbursement approved", description: "Your travel reimbursement of ₹4,200 was approved.", timestamp: "2026-10-18 14:00", read: true, priority: "Normal", link: "/payroll?tab=reimbursements" },
  { id: "N-10", category: "Documents", title: "Rent agreement expiring soon", description: "Pooja Hegde's document expires Nov 13.", timestamp: "2026-10-17 08:00", read: true, priority: "Normal", link: "/documents?tab=expiring" },
  { id: "N-11", category: "System", title: "Biometric device back online", description: "Vijayawada Office device synced successfully.", timestamp: "2026-10-16 19:00", read: true, priority: "Normal", link: "/biometric" },
  { id: "N-12", category: "Approvals", title: "Quarterly review notification", description: "Q3 reviews updated in audit log.", timestamp: "2026-10-15 09:00", read: true, priority: "Normal", link: "/dashboard" },
];

const ANNOUNCEMENTS: Announcement[] = [
  { id: "AN-1", title: "Diwali holidays: Nov 6–9", message: "The office will remain closed from Nov 6 to Nov 9 for Diwali. Emergency support roster will be shared by team leads.", audience: "All Employees", priority: "High", publishAt: "2026-10-20", expiresAt: "2026-11-09" },
  { id: "AN-2", title: "New leave policy effective November", message: "Casual leave carry-forward cap increases to 5 days from November 1. Review the updated policy in Documents.", audience: "All Employees", priority: "Normal", publishAt: "2026-10-18", expiresAt: "2026-11-30" },
  { id: "AN-3", title: "Q3 performance reviews open", message: "Self-assessment window is open until Oct 31. Managers to complete reviews by Nov 10.", audience: "All Employees", priority: "Normal", publishAt: "2026-10-15", expiresAt: "2026-11-10" },
  { id: "AN-4", title: "Hyderabad office: parking levels 2–3", message: "From Oct 25, two-wheeler parking moves to levels 2–3 of the basement.", audience: "Selected Branches", scope: "Hyderabad", priority: "Normal", publishAt: "2026-10-14", expiresAt: "2026-10-31" },
];

const ASSETS: Asset[] = [
  { id: "AST-001", name: "MacBook Pro 14", category: "Laptop", brandModel: "Apple M3 Pro", serial: "C02XK1YZLVDL", branch: "Hyderabad", assignedTo: "OF-1011", purchaseDate: "2025-06-12", purchaseValue: 214900, warrantyExpiry: "2027-06-12", condition: "Excellent", status: "Assigned", history: [{ date: "2025-06-15", action: "Issued", employeeId: "OF-1011" }] },
  { id: "AST-002", name: "Dell Latitude 5440", category: "Laptop", brandModel: "Dell i7/16GB", serial: "DL5440-88213", branch: "Hyderabad", assignedTo: "OF-1002", purchaseDate: "2024-11-02", purchaseValue: 128000, warrantyExpiry: "2026-11-02", condition: "Good", status: "Assigned", history: [{ date: "2024-11-05", action: "Issued", employeeId: "OF-1002" }] },
  { id: "AST-003", name: "ThinkPad T14", category: "Laptop", brandModel: "Lenovo i5/16GB", serial: "LNV-T14-55201", branch: "Warangal", assignedTo: "OF-1004", purchaseDate: "2025-01-20", purchaseValue: 96000, warrantyExpiry: "2027-01-20", condition: "Good", status: "Assigned", history: [{ date: "2025-01-22", action: "Issued", employeeId: "OF-1004" }] },
  { id: "AST-004", name: "iPhone 15", category: "Phone", brandModel: "Apple 128GB", serial: "IP15-77342", branch: "Vijayawada", assignedTo: "OF-1007", purchaseDate: "2025-03-10", purchaseValue: 79900, warrantyExpiry: "2026-03-10", condition: "Good", status: "Assigned", history: [{ date: "2025-03-12", action: "Issued", employeeId: "OF-1007" }] },
  { id: "AST-005", name: "Dell Monitor 24\"", category: "Monitor", brandModel: "Dell P2422H", serial: "DLP24-91102", branch: "Hyderabad", assignedTo: null, purchaseDate: "2024-08-15", purchaseValue: 18500, warrantyExpiry: "2026-08-15", condition: "Good", status: "Available", history: [] },
  { id: "AST-006", name: "HP LaserJet M141", category: "Printer", brandModel: "HP M141w", serial: "HPLJ-22018", branch: "Hyderabad", assignedTo: null, purchaseDate: "2023-05-04", purchaseValue: 24500, warrantyExpiry: "2025-05-04", condition: "Fair", status: "Under Maintenance", notes: "Paper jam sensor replacement", history: [{ date: "2026-10-10", action: "Sent for maintenance", note: "Feeder issue" }] },
  { id: "AST-007", name: "MacBook Air M2", category: "Laptop", brandModel: "Apple M2/8GB", serial: "C02A1B3CDPLC", branch: "Visakhapatnam", assignedTo: "OF-1008", purchaseDate: "2024-06-18", purchaseValue: 114900, warrantyExpiry: "2026-06-18", condition: "Good", status: "Assigned", history: [{ date: "2024-06-20", action: "Issued", employeeId: "OF-1008" }] },
  { id: "AST-008", name: "Logitech MX Keys", category: "Accessory", brandModel: "Logitech MX Keys S", serial: "LGK-31120", branch: "Hyderabad", assignedTo: "OF-1011", purchaseDate: "2025-06-12", purchaseValue: 10995, warrantyExpiry: "2026-06-12", condition: "Excellent", status: "Assigned", history: [{ date: "2025-06-15", action: "Issued", employeeId: "OF-1011" }] },
  { id: "AST-009", name: "Dell Latitude 3420", category: "Laptop", brandModel: "Dell i5/8GB", serial: "DL3420-12098", branch: "Vijayawada", assignedTo: null, purchaseDate: "2022-09-30", purchaseValue: 68000, warrantyExpiry: "2024-09-30", condition: "Poor", status: "Damaged", notes: "Motherboard failure — repair quote pending", history: [{ date: "2026-09-12", action: "Marked damaged", note: "Will not boot" }] },
  { id: "AST-010", name: "Samsung 27\" Monitor", category: "Monitor", brandModel: "Samsung LS27B", serial: "SM27B-71223", branch: "Warangal", assignedTo: "OF-1004", purchaseDate: "2025-01-20", purchaseValue: 22000, warrantyExpiry: "2027-01-20", condition: "Excellent", status: "Assigned", history: [{ date: "2025-01-22", action: "Issued", employeeId: "OF-1004" }] },
  { id: "AST-011", name: "Canon DrScanner DR-C225", category: "Office Equipment", brandModel: "Canon DR-C225", serial: "CANDR-40012", branch: "Hyderabad", assignedTo: null, purchaseDate: "2021-04-14", purchaseValue: 32000, warrantyExpiry: "2023-04-14", condition: "Fair", status: "Retired", history: [{ date: "2026-01-10", action: "Retired", note: "Beyond economic repair" }] },
  { id: "AST-012", name: "Jabra Speak 510", category: "Accessory", brandModel: "Jabra 510 MS", serial: "JB-510-99213", branch: "Hyderabad", assignedTo: null, purchaseDate: "2024-02-08", purchaseValue: 13500, warrantyExpiry: "2026-02-08", condition: "Good", status: "Available", history: [] },
];

const GOALS: Goal[] = [
  { id: "G-1", title: "Ship customer portal v2", description: "Deliver the redesigned customer portal with SSO.", employeeId: "OF-1011", managerId: "OF-1002", category: "Delivery", startDate: "2026-08-01", dueDate: "2026-11-15", priority: "High", metric: "Release milestone", target: "v2 GA", progress: 65, status: "On Track" },
  { id: "G-2", title: "Reduce UI regression defects", description: "Cut UI regression defects by 30% via automated tests.", employeeId: "OF-1011", managerId: "OF-1002", category: "Quality", startDate: "2026-09-01", dueDate: "2026-12-31", priority: "Medium", metric: "Defect count", target: "-30%", progress: 40, status: "On Track" },
  { id: "G-3", title: "Complete AWS certification", description: "Finish AWS Solutions Architect Associate.", employeeId: "OF-1013", managerId: "OF-1003", category: "Learning", startDate: "2026-07-01", dueDate: "2026-10-31", priority: "Medium", metric: "Certification", target: "Pass", progress: 80, status: "On Track" },
  { id: "G-4", title: "Q3 hiring plan closure", description: "Close 6 open engineering positions.", employeeId: "OF-1010", managerId: "OF-1001", category: "Delivery", startDate: "2026-07-01", dueDate: "2026-09-30", priority: "High", metric: "Offers closed", target: "6", progress: 100, status: "Completed" },
  { id: "G-5", title: "Reduce QA escape rate", description: "Bring escaped defects below 5%.", employeeId: "OF-1004", managerId: "OF-1001", category: "Quality", startDate: "2026-08-01", dueDate: "2026-11-30", priority: "High", metric: "Escape rate", target: "<5%", progress: 55, status: "At Risk" },
  { id: "G-6", title: "Q4 enterprise pipeline ₹2 Cr", description: "Build enterprise pipeline worth ₹2 Cr.", employeeId: "OF-1007", managerId: "OF-1001", category: "Revenue", startDate: "2026-10-01", dueDate: "2026-12-31", priority: "High", metric: "Pipeline value", target: "₹2 Cr", progress: 25, status: "On Track" },
  { id: "G-7", title: "GST filing accuracy 100%", description: "Zero late filings across FY26-27.", employeeId: "OF-1006", managerId: "OF-1001", category: "Compliance", startDate: "2026-04-01", dueDate: "2027-03-31", priority: "Medium", metric: "On-time filings", target: "100%", progress: 70, status: "On Track" },
  { id: "G-8", title: "Support CSAT above 4.5", description: "Maintain quarterly CSAT above 4.5.", employeeId: "OF-1008", managerId: "OF-1001", category: "Service", startDate: "2026-10-01", dueDate: "2026-12-31", priority: "Medium", metric: "CSAT", target: "4.5+", progress: 45, status: "On Track" },
  { id: "G-9", title: "API latency p95 under 300ms", description: "Optimize core APIs to p95 < 300ms.", employeeId: "OF-1003", managerId: "OF-1001", category: "Performance", startDate: "2026-09-01", dueDate: "2026-11-30", priority: "High", metric: "p95 latency", target: "300ms", progress: 60, status: "At Risk" },
  { id: "G-10", title: "Office ops cost -8%", description: "Reduce office operations cost by 8%.", employeeId: "OF-1009", managerId: "OF-1001", category: "Cost", startDate: "2026-07-01", dueDate: "2026-12-31", priority: "Low", metric: "Monthly opex", target: "-8%", progress: 30, status: "On Track" },
];

const REVIEW_CYCLES: ReviewCycle[] = [
  { id: "RC-1", name: "Q3 2026 Performance Review", period: "Jul–Sep 2026", startDate: "2026-10-15", endDate: "2026-11-10", status: "Active" },
  { id: "RC-2", name: "Q2 2026 Performance Review", period: "Apr–Jun 2026", startDate: "2026-07-05", endDate: "2026-07-30", status: "Closed" },
  { id: "RC-3", name: "Q4 2026 Performance Review", period: "Oct–Dec 2026", startDate: "2027-01-05", endDate: "2027-01-30", status: "Upcoming" },
];

const REVIEWS: Review[] = [
  { id: "RV-1", employeeId: "OF-1011", cycleId: "RC-1", stage: "Self-Assessment", dueDate: "2026-10-31" },
  { id: "RV-2", employeeId: "OF-1012", cycleId: "RC-1", stage: "Manager Review", dueDate: "2026-11-05", selfRating: 4 },
  { id: "RV-3", employeeId: "OF-1013", cycleId: "RC-1", stage: "Manager Review", dueDate: "2026-11-05", selfRating: 3.5 },
  { id: "RV-4", employeeId: "OF-1014", cycleId: "RC-1", stage: "Self-Assessment", dueDate: "2026-10-31" },
  { id: "RV-5", employeeId: "OF-1004", cycleId: "RC-1", stage: "HR Review", dueDate: "2026-11-08", selfRating: 4.2, managerRating: 4, strengths: "Process discipline, defect triage", improvements: "Automation coverage", comments: "Strong quarter; improved release quality." },
  { id: "RV-6", employeeId: "OF-1003", cycleId: "RC-1", stage: "Finalized", dueDate: "2026-11-10", selfRating: 4.5, managerRating: 4.3, finalRating: 4.3, strengths: "Ownership, API design", improvements: "Delegation", comments: "Reliable technical leadership.", developmentPlan: "Mentor two engineers next quarter." },
  { id: "RV-7", employeeId: "OF-1015", cycleId: "RC-1", stage: "Self-Assessment", dueDate: "2026-10-31" },
  { id: "RV-8", employeeId: "OF-1007", cycleId: "RC-1", stage: "Manager Review", dueDate: "2026-11-05", selfRating: 3.8 },
  // Q2 closed cycle samples
  { id: "RV-9", employeeId: "OF-1011", cycleId: "RC-2", stage: "Finalized", dueDate: "2026-07-30", selfRating: 3.8, managerRating: 4, finalRating: 4, strengths: "Learning speed, ownership", improvements: "Estimation accuracy", comments: "Good first full quarter.", developmentPlan: "Lead the portal v2 migration." },
  { id: "RV-10", employeeId: "OF-1004", cycleId: "RC-2", stage: "Finalized", dueDate: "2026-07-30", selfRating: 4.1, managerRating: 4, finalRating: 4, strengths: "Quality gates", improvements: "Stakeholder comms", comments: "" },
  { id: "RV-11", employeeId: "OF-1006", cycleId: "RC-2", stage: "Finalized", dueDate: "2026-07-30", selfRating: 4.4, managerRating: 4.2, finalRating: 4.2, strengths: "Compliance rigor", improvements: "Team mentoring", comments: "" },
  { id: "RV-12", employeeId: "OF-1008", cycleId: "RC-2", stage: "Finalized", dueDate: "2026-07-30", selfRating: 4, managerRating: 4.1, finalRating: 4.1, strengths: "Customer empathy", improvements: "Escalation handling", comments: "" },
];

function buildOnboarding(): { tasks: OnboardingTask[]; joiners: Joiner[] } {
  const joiners: Joiner[] = [
    { id: "JN-1", name: "Sneha Kulkarni", designation: "Software Engineer", department: "Engineering", branch: "Hyderabad", joiningDate: "2026-10-26", workEmail: "sneha.kulkarni@rendesk.example", checklistCompletion: 60 },
    { id: "JN-2", name: "Rohit Chandra", designation: "QA Engineer", department: "Engineering", branch: "Warangal", joiningDate: "2026-10-28", workEmail: "rohit.chandra@rendesk.example", checklistCompletion: 25 },
    { id: "JN-3", name: "Priyanka Mallya", designation: "Sales Executive", department: "Sales", branch: "Vijayawada", joiningDate: "2026-11-02", workEmail: "priyanka.mallya@rendesk.example", checklistCompletion: 10 },
  ];
  const tasks: OnboardingTask[] = [];
  const taskDefs: [string, string][] = [
    ["Document collection", "HR Executive"], ["Document verification", "HR Manager"], ["Offer acceptance", "HR Manager"],
    ["Appointment letter", "HR Manager"], ["Policy acknowledgment", "HR Executive"], ["System access", "IT Admin"],
    ["Asset assignment", "IT Admin"], ["Induction session", "HR Manager"], ["Manager handover", "Team Lead"],
  ];
  let n = 0;
  for (const j of joiners) {
    for (const [task, owner] of taskDefs) {
      const done = Math.floor((j.checklistCompletion / 100) * taskDefs.length);
      const idx = tasks.filter((t) => t.employeeId === j.id).length;
      const status: OnboardingTask["status"] = idx < done ? "Completed" : idx === done ? "In Progress" : idx === done + 1 && rand() < 0.3 ? "Blocked" : "Pending";
      const due = new Date(new Date(j.joiningDate + "T00:00:00Z").getTime() - (taskDefs.length - idx) * 86400000).toISOString().slice(0, 10);
      tasks.push({ id: `OT-${++n}`, employeeId: j.id, task, owner, dueDate: due, status, category: task });
    }
  }
  return { tasks, joiners };
}
const ONBOARDING_TASKS: OnboardingTask[] = [];
const JOINERS: Joiner[] = [];
const RESIGNATIONS: Resignation[] = [];

const FORMER: FormerEmployee[] = [];

const USERS: UserAccount[] = [
  {
    id: "U-1",
    name: "Super Admin",
    email: "superadmin@gvkedutech.com",
    employeeId: "ADM-001",
    role: "super_admin",
    branchScope: "All",
    status: "Active",
    lastActivity: "Just now",
  },
];

const MODULES = ["employees", "onboarding", "organization", "attendance", "biometric", "leave", "payroll", "documents", "mail", "notifications", "assets", "analytics", "administration", "audit"];
const ACTIONS: PermissionAction[] = ["view", "create", "edit", "approve", "export", "configure"];

function buildPermissions(): PermissionMatrix {
  const matrix: PermissionMatrix = {};
  const grant = (role: Role, module: string, acts: PermissionAction[]) =>
    acts.forEach((a) => {
      matrix[module]![role]![a] = true;
    });
  for (const m of MODULES) {
    matrix[m] = {
      super_admin: { view: false, create: false, edit: false, approve: false, export: false, configure: false },
      hr_admin: { view: false, create: false, edit: false, approve: false, export: false, configure: false },
      manager: { view: false, create: false, edit: false, approve: false, export: false, configure: false },
      employee: { view: false, create: false, edit: false, approve: false, export: false, configure: false },
    };
    // Super Admin: everything except approving own-sensitive flows is still enabled in demo
    grant("super_admin", m, ACTIONS);
    // HR Admin
    if (["employees", "onboarding", "organization", "attendance", "biometric", "leave", "payroll", "documents", "mail", "notifications", "assets", "analytics"].includes(m))
      grant("hr_admin", m, ["view", "create", "edit", "approve", "export"]);
    if (["administration", "audit"].includes(m)) grant("hr_admin", m, ["view", "export"]);
    // Manager
    if (["employees", "organization", "attendance", "leave", "analytics", "onboarding"].includes(m))
      grant("manager", m, ["view"]);
    if (["attendance", "leave"].includes(m)) grant("manager", m, ["approve", "edit"]);
    if (["attendance", "leave"].includes(m)) grant("manager", m, ["create"]);
    if (["employees", "organization", "analytics"].includes(m)) grant("manager", m, ["export"]);
    // Employee
    if (["attendance", "leave", "documents", "notifications", "assets"].includes(m))
      grant("employee", m, ["view", "create"]);
  }
  return matrix;
}

export function seedState(): AppState {
  return {
    employees: [],
    attendance: [],
    corrections: [],
    leaves: [],
    leavePolicies: LEAVE_POLICIES,
    leaveBalances: {},
    shifts: SHIFTS,
    holidays: HOLIDAYS,
    devices: [
      {
        id: "DEV-01",
        deviceId: "DEV-01",
        name: "eSSL K30 Pro - Main Office",
        brand: "eSSL",
        model: "eSSL K30 Pro",
        branch: "Hyderabad",
        location: "Main Office Entrance / Reception",
        connection: "TCP/IP",
        ipAddress: "192.168.29.201",
        port: 4370,
        commKey: "0",
        syncFrequency: "Every 15 Minutes",
        lastSync: "2026-11-09 13:20",
        status: "Online",
      },
    ],
    mappings: [
      {
        id: "MAP-1",
        deviceId: "DEV-01",
        biometricId: "1030",
        employeeId: "OF-1001",
        effectiveFrom: "2026-04-09",
        status: "Active",
      },
    ],
    unmappedIds: [
      { id: "UNM-1000", biometricId: "1000", deviceId: "DEV-01", firstSeen: "2026-10-01", punchCount: 154 },
      { id: "UNM-1001", biometricId: "1001", deviceId: "DEV-01", firstSeen: "2026-10-01", punchCount: 142 },
      { id: "UNM-1002", biometricId: "1002", deviceId: "DEV-01", firstSeen: "2026-10-01", punchCount: 120 },
      { id: "UNM-1003", biometricId: "1003", deviceId: "DEV-01", firstSeen: "2026-10-01", punchCount: 110 },
      { id: "UNM-1005", biometricId: "1005", deviceId: "DEV-01", firstSeen: "2026-10-01", punchCount: 98 },
      { id: "UNM-1006", biometricId: "1006", deviceId: "DEV-01", firstSeen: "2026-10-01", punchCount: 88 },
      { id: "UNM-1007", biometricId: "1007", deviceId: "DEV-01", firstSeen: "2026-10-01", punchCount: 95 },
      { id: "UNM-1028", biometricId: "1028", deviceId: "DEV-01", firstSeen: "2026-10-01", punchCount: 76 },
      { id: "UNM-1029", biometricId: "1029", deviceId: "DEV-01", firstSeen: "2026-10-01", punchCount: 84 },
      { id: "UNM-1031", biometricId: "1031", deviceId: "DEV-01", firstSeen: "2026-10-01", punchCount: 92 },
      { id: "UNM-1032", biometricId: "1032", deviceId: "DEV-01", firstSeen: "2026-10-01", punchCount: 65 },
      { id: "UNM-1033", biometricId: "1033", deviceId: "DEV-01", firstSeen: "2026-10-01", punchCount: 70 },
      { id: "UNM-1034", biometricId: "1034", deviceId: "DEV-01", firstSeen: "2026-10-01", punchCount: 58 },
      { id: "UNM-1035", biometricId: "1035", deviceId: "DEV-01", firstSeen: "2026-10-01", punchCount: 62 },
    ],
    imports: [],
    payrollRuns: [],
    salaryStructures: SALARY_STRUCTURES,
    reimbursements: [],
    documents: [],
    mail: [],
    gmail: { connected: false, mailbox: "", lastSync: "—", scopes: [], frequency: "Hourly", logs: [] },
    notifications: [],
    announcements: [],
    assets: [],
    goals: [],
    reviewCycles: [],
    reviews: [],
    onboardingTasks: [],
    joiners: [],
    resignations: [],
    formerEmployees: [],
    users: USERS,
    permissions: buildPermissions(),
    audit: [],
  };
}
