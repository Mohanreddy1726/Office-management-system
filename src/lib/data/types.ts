// RenDesk shared domain types. Frontend demo only — mirrors a future Node/MongoDB API shape.

export type Role = "super_admin" | "hr_admin" | "manager" | "employee";

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  hr_admin: "HR Admin",
  manager: "Manager / Team Lead",
  employee: "Employee",
};

export type Branch = "Hyderabad" | "Warangal" | "Vijayawada" | "Visakhapatnam";
export const BRANCHES: Branch[] = ["Hyderabad", "Warangal", "Vijayawada", "Visakhapatnam"];

export type EmploymentStatus = "Active" | "Probation" | "Pending Verification" | "On Notice" | "Resigned" | "Inactive";

export interface Employee {
  id: string;
  name: string;
  workEmail: string;
  personalEmail: string;
  phone: string;
  dob: string;
  gender: string;
  address: string;
  emergencyContact: string;
  joiningDate: string;
  branch: Branch;
  department: string;
  team: string;
  designation: string;
  employmentType: "Full-time" | "Part-time" | "Contract" | "Intern";
  managerId: string | null;
  probationMonths: number;
  status: EmploymentStatus;
  annualCTC: number;
  monthlyGross: number;
  bankLast4?: string;
  paymentMethod?: string;
  salaryStructureId?: string;
  leftDate?: string;
  // Personal & Identity
  bloodGroup?: string;
  maritalStatus?: "Single" | "Married" | "Other";
  pan?: string;
  aadharLast4?: string;
  aadhaarNumber?: string;
  // Education & Qualifications
  qualification?: string;
  institution?: string;
  graduationYear?: number;
  grade?: string;
  // Prior Experience
  experienceYears?: number;
  previousCompany?: string;
  previousDesignation?: string;
  skills?: string;
  // Banking
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
}

export type AttendanceStatus = "Present" | "Absent" | "Leave" | "Half Day" | "Holiday" | "Week Off" | "Late" | "Pending Review";
export type ConfirmationStage = "Awaiting Employee" | "Awaiting Manager" | "Awaiting HR" | "Confirmed" | "Disputed" | "Locked";
export type PunchSource = "Biometric" | "Manual" | "CSV Import";

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // yyyy-MM-dd
  shiftId: string;
  checkIn?: string; // HH:mm
  checkOut?: string;
  workedMinutes?: number;
  lateMinutes: number;
  status: AttendanceStatus;
  source: PunchSource;
  confirmation: ConfirmationStage;
  exception?: string;
  deviceUsed?: string;
}

export interface AttendanceCorrection {
  id: string;
  employeeId: string;
  date: string;
  originalIn?: string;
  originalOut?: string;
  requestedIn: string;
  requestedOut: string;
  reason: string;
  correctionType?: string;
  workMode?: "Office" | "WFH" | "Client Site" | "Tour";
  ticketRef?: string;
  submittedBy: string;
  submittedAt: string;
  status: "Awaiting Manager" | "Awaiting HR" | "Approved" | "Rejected" | "Clarification";
  decisionNote?: string;
}

export type LeaveType = "Casual Leave" | "Sick Leave" | "Comp-Off";
export type LeaveStage = "Submitted" | "Manager Review" | "HR Review" | "Approved" | "Rejected" | "Clarification";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  halfDay?: "First Half" | "Second Half";
  reason: string;
  reasonCategory?: string;
  handoverEmployeeId?: string;
  emergencyContact?: string;
  documentNote?: string;
  status: LeaveStage;
  managerDecision?: "Recommended Approval" | "Recommended Rejection";
  managerNote?: string;
  timeline: { stage: string; actor: string; at: string; note?: string }[];
}

export interface LeavePolicy {
  id: string;
  type: LeaveType;
  annualEntitlement: number;
  accrual: string;
  carryForwardCap: number;
  expiry: string;
  halfDayEligible: boolean;
  negativeBalance: boolean;
  eligibility: string;
}

export interface Shift {
  id: string;
  name: string;
  start: string;
  end: string;
  breakMinutes: number;
  graceMinutes: number;
  weeklyOffs: string[];
  minFullDayHours: number;
  minHalfDayHours: number;
  overtimeEligible: boolean;
  branches: Branch[];
  overnight: boolean;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  branches: Branch[] | "All";
}

export interface BiometricDevice {
  id: string;
  name: string;
  deviceId: string;
  brand: string;
  model: string;
  branch: Branch;
  location: string;
  connection: "TCP/IP" | "USB" | "CSV Import";
  ipAddress?: string;
  port?: number;
  commKey?: string;
  syncFrequency?: string;
  lastSync: string;
  status: "Online" | "Offline" | "Sync Pending";
}

export interface BiometricMapping {
  id: string;
  employeeId: string;
  deviceId: string;
  biometricId: string;
  effectiveFrom: string;
  effectiveTo?: string;
  notes?: string;
  status: "Active" | "Ended";
}

export interface UnmappedBiometricId {
  id: string;
  biometricId: string;
  deviceId: string;
  firstSeen: string;
  punchCount: number;
}

export interface ImportBatch {
  id: string;
  batch: string;
  sourceFile: string;
  deviceId: string;
  startedAt: string;
  received: number;
  processed: number;
  duplicates: number;
  failures: number;
  status: "Completed" | "Completed with Failures" | "Processing" | "Failed";
}

export type PayrollStatus = "Draft" | "Calculated" | "Awaiting Approval" | "Approved" | "Locked" | "Payment Recorded";

export interface PayrollRun {
  id: string;
  period: string; // yyyy-MM
  status: PayrollStatus;
  headcount: number;
  gross: number;
  employeeDeductions: number;
  employerContributions: number;
  net: number;
  createdAt: string;
  approvedBy?: string;
  lockedBy?: string;
  paidAt?: string;
}

export interface PayslipLine { label: string; type: "earning" | "deduction" | "employer"; amount: number }

export interface SalaryStructure {
  id: string;
  name: string;
  applicableTo: string;
  effectiveFrom: string;
  earnings: { name: string; calc: string }[];
  deductions: { name: string; calc: string }[];
  employerContributions: { name: string; calc: string }[];
}

export interface Reimbursement {
  id: string;
  employeeId: string;
  type: string;
  amount: number;
  date: string;
  status: "Approved" | "Pending" | "Paid" | "Rejected";
  payrollPeriod?: string;
  note?: string;
}

export interface DocumentRecord {
  id: string;
  name: string;
  category: string;
  subType?: string;
  docNumber?: string;
  confidentiality?: "Public" | "Internal" | "Restricted" | "Strictly Confidential";
  ownerId: string | null; // null = company policy
  uploadedBy: string;
  uploadedAt: string;
  version: number;
  status: "Verified" | "Pending Verification" | "Rejected";
  expiresAt?: string;
  size: string;
}

export type MailDirection = "Incoming" | "Outgoing";

export interface MailEntry {
  id: string;
  refNo: string;
  direction: MailDirection;
  date: string;
  sender: string;
  recipient: string;
  subject: string;
  department: string;
  ownerId: string;
  priority: "Low" | "Normal" | "High" | "Urgent";
  status: "Open" | "In Progress" | "Closed";
  followUpAt?: string;
  channel: "Physical" | "Email";
  notes: string;
  courierVendor?: string;
  trackingNo?: string;
  packageType?: string;
  timeline: { at: string; event: string; by: string }[];
}

export interface GmailIntegration {
  connected: boolean;
  mailbox: string;
  lastSync: string;
  scopes: string[];
  frequency: "Hourly" | "Every 6 hours" | "Daily";
  logs: { at: string; event: string; status: "Success" | "Warning" }[];
}

export interface NotificationItem {
  id: string;
  category: "Approvals" | "Attendance" | "Payroll" | "Documents" | "Announcements" | "System";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  priority: "Normal" | "High";
  link: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  audience: "All Employees" | "Selected Branches" | "Selected Departments" | "Managers Only";
  scope?: string;
  priority: "Normal" | "High";
  publishAt: string;
  expiresAt: string;
}

export interface Asset {
  id: string;
  name: string;
  category: string;
  brandModel: string;
  serial: string;
  assetTag?: string;
  vendor?: string;
  invoiceNo?: string;
  branch: Branch;
  assignedTo: string | null;
  purchaseDate: string;
  purchaseValue: number;
  warrantyExpiry: string;
  condition: "Excellent" | "Good" | "Fair" | "Poor";
  status: "Available" | "Assigned" | "Under Maintenance" | "Damaged" | "Retired";
  notes?: string;
  specs?: string;
  history: { date: string; action: string; employeeId?: string; note?: string }[];
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  employeeId: string;
  managerId: string;
  category: string;
  startDate: string;
  dueDate: string;
  priority: "Low" | "Medium" | "High";
  metric: string;
  target: string;
  baseline?: string;
  weightage?: number;
  progress: number;
  status: "On Track" | "At Risk" | "Completed" | "Not Started";
}

export interface ReviewCycle {
  id: string;
  name: string;
  period: string;
  startDate: string;
  endDate: string;
  status: "Active" | "Upcoming" | "Closed";
}

export interface Review {
  id: string;
  employeeId: string;
  cycleId: string;
  stage: "Self-Assessment" | "Manager Review" | "HR Review" | "Finalized";
  dueDate: string;
  selfRating?: number;
  managerRating?: number;
  finalRating?: number;
  strengths?: string;
  improvements?: string;
  comments?: string;
  developmentPlan?: string;
}

export interface OnboardingTask {
  id: string;
  employeeId: string;
  task: string;
  owner: string;
  dueDate: string;
  status: "Pending" | "In Progress" | "Completed" | "Blocked";
  category: string;
}

export interface Joiner {
  id: string;
  name: string;
  designation: string;
  department: string;
  branch: Branch;
  joiningDate: string;
  workEmail: string;
  personalEmail?: string;
  phone?: string;
  buddy?: string;
  ctc?: number;
  equipmentAllocation?: string[];
  checklistCompletion: number;
}

export interface Resignation {
  id: string;
  employeeId: string;
  resignationDate: string;
  lastWorkingDay: string;
  noticeDays: number;
  reason: string;
  reasonCategory?: string;
  handoverColleagueId?: string;
  personalPhone?: string;
  personalEmail?: string;
  comments?: string;
  managerApproval: "Pending" | "Approved" | "Rejected";
  hrApproval: "Pending" | "Approved" | "Rejected";
  handoverDone: boolean;
  assetReturnDone: boolean;
  documentClearance: boolean;
  financeClearance: boolean;
  settlementDone: boolean;
  accountDeactivated: boolean;
  status: "In Notice" | "Cleared" | "Settled" | "Withdrawn";
}

export interface FormerEmployee {
  id: string;
  name: string;
  designation: string;
  department: string;
  branch: Branch;
  exitDate: string;
  reason: string;
  clearanceDone: boolean;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  employeeId?: string;
  role: Role;
  branchScope: Branch[] | "All";
  status: "Active" | "Deactivated";
  lastActivity: string;
}

export type PermissionAction = "view" | "create" | "edit" | "approve" | "export" | "configure";
export type PermissionMatrix = Record<string, Record<Role, Record<PermissionAction, boolean>>>;

export interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  module: string;
  record: string;
  outcome: "Success" | "Failure";
  reason?: string;
  details?: string;
  oldValue?: string;
  newValue?: string;
}

export interface AppState {
  employees: Employee[];
  attendance: AttendanceRecord[];
  corrections: AttendanceCorrection[];
  leaves: LeaveRequest[];
  leavePolicies: LeavePolicy[];
  leaveBalances: Record<string, Record<string, number>>; // employeeId -> type -> balance
  shifts: Shift[];
  holidays: Holiday[];
  devices: BiometricDevice[];
  mappings: BiometricMapping[];
  unmappedIds: UnmappedBiometricId[];
  imports: ImportBatch[];
  payrollRuns: PayrollRun[];
  salaryStructures: SalaryStructure[];
  reimbursements: Reimbursement[];
  documents: DocumentRecord[];
  mail: MailEntry[];
  gmail: GmailIntegration;
  notifications: NotificationItem[];
  announcements: Announcement[];
  assets: Asset[];
  goals: Goal[];
  reviewCycles: ReviewCycle[];
  reviews: Review[];
  onboardingTasks: OnboardingTask[];
  joiners: Joiner[];
  resignations: Resignation[];
  formerEmployees: FormerEmployee[];
  users: UserAccount[];
  permissions: PermissionMatrix;
  audit: AuditEntry[];
}

export interface Session {
  userId: string;
  role: Role;
  name?: string;
  email?: string;
  employeeId?: string;
  originalRole?: Role;
  originalUserId?: string;
  originalName?: string;
}

export interface Prefs { sidebarCollapsed: boolean; branch: Branch | "All Branches" }

export interface DemoState { data: AppState; session: Session | null; prefs: Prefs }
