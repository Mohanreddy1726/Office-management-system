import type { AttendanceRecord, Employee, Holiday, LeavePolicy, LeaveRequest } from "@/lib/data/types";

/**
 * Official GVK Edutech Pvt. Ltd. HR, Attendance, Leave & Login Policies
 * Derived from Appointment Letter Annexures A, B & C.
 */
export const GVK_POLICY = {
  companyName: "GVK Edutech Pvt. Ltd.",
  shiftStart: "10:00",
  shiftEnd: "18:30",
  shiftLabel: "10:00 AM – 6:30 PM",
  graceMinutes: 10, // Up to 10:10 AM
  graceMonthlyLimit: 3, // Accepted for 3 logins in a month
  lateNoonCutoffMinutes: 12 * 60, // 12:00 noon
  lateLoginsPerLop: 3, // 3 late logins in a month = Loss of Pay
  publicHolidaysPerYear: 12,
  monthlyHolidaysPerMonth: 1, // 1 day off per month apart from Sundays & public holidays
  firstYearMonthlyLeaveCap: 1,
  confirmedAnnualLeaveEntitlement: 10,
  confirmedMonthlyLeaveCapFirst11Months: 1,
  carryForwardPermitted: false,
  advanceApprovalDays: 1, // At least 1 day in advance unless accident/demise
  abandonmentConsecutiveDays: 5, // 5 consecutive calendar days absent/overstay
  maxMonthlyLopDays: 15, // Cannot exceed 15 days except maternity or personal medical emergency
  salaryDiscussionMonth: "December",
} as const;

export const EXTENUATING_CATEGORIES = [
  "Accident / Medical Emergency",
  "Bereavement / Demise",
  "Emergency",
] as const;

export const GVK_LEAVE_POLICIES: LeavePolicy[] = [
  {
    id: "LP-1",
    type: "Casual Leave",
    annualEntitlement: 10,
    accrual: "1st Year: max 1/month (extra = LOP) · Confirmed: 10 leaves / 12 months (max 1/month for first 11 months; balance in 12th month or encashed)",
    carryForwardCap: 0,
    expiry: "Carry forward is NOT permitted. Balance in 12th month may be availed or encashed.",
    halfDayEligible: true,
    negativeBalance: false,
    eligibility: "All employees; must be approved at least 1 day in advance by Regional Director / Operations Head (except accident/demise).",
  },
  {
    id: "LP-2",
    type: "Sick Leave",
    annualEntitlement: 10,
    accrual: "Included within monthly / annual leave cap; personal medical emergency exempt from 15-day LOP cap at management discretion.",
    carryForwardCap: 0,
    expiry: "No carry-forward permitted.",
    halfDayEligible: true,
    negativeBalance: false,
    eligibility: "Extenuating circumstances (accident/medical emergency/demise) exempt from 1-day advance approval rule.",
  },
  {
    id: "LP-3",
    type: "Comp-Off",
    annualEntitlement: 0,
    accrual: "Earned when required to attend office on a Holiday/Sunday with prior approval from Regional Director / Operations Head.",
    carryForwardCap: 0,
    expiry: "Avail as Comp-Off (approved by RD/Ops Head) or encash at 1 day's Gross Salary in that month's payroll.",
    halfDayEligible: false,
    negativeBalance: false,
    eligibility: "Employees with prior-approved holiday/off-day attendance.",
  },
];

/**
 * Parses "10:15", "10:15 AM", "02:30 pm", etc. into minutes since midnight.
 */
export function parseTimeToMinutes(str?: string): number | null {
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
}

export interface LoginClassification {
  tier: "on_time" | "grace" | "late" | "half_day" | "unknown";
  status: "Present" | "Late" | "Half Day";
  lateMinutes: number;
  label: string;
}

/**
 * Classifies a daily check-in time according to GVK Edutech Login Policy:
 * - Office timings: 10:00 AM – 6:30 PM
 * - Grace time up to 10 mins (10:10 AM) accepted for up to 3 logins/month
 * - Up to 12:00 noon: Considered a late login
 * - After 12:00 noon: Half-day salary cut
 */
export function classifyLoginTime(
  checkIn?: string,
  priorGraceCountInMonth = 0
): LoginClassification {
  const mins = parseTimeToMinutes(checkIn);
  if (mins === null) {
    return { tier: "unknown", status: "Present", lateMinutes: 0, label: "No check-in" };
  }

  const shiftStart = 10 * 60; // 10:00 AM (600)
  const graceEnd = shiftStart + GVK_POLICY.graceMinutes; // 10:10 AM (610)
  const noonCutoff = GVK_POLICY.lateNoonCutoffMinutes; // 12:00 PM (720)

  if (mins <= shiftStart) {
    return { tier: "on_time", status: "Present", lateMinutes: 0, label: "On time" };
  }

  if (mins <= graceEnd) {
    const lateMinutes = mins - shiftStart;
    if (priorGraceCountInMonth < GVK_POLICY.graceMonthlyLimit) {
      return {
        tier: "grace",
        status: "Present",
        lateMinutes,
        label: `Grace (${priorGraceCountInMonth + 1}/${GVK_POLICY.graceMonthlyLimit} used)`,
      };
    }
    return {
      tier: "late",
      status: "Late",
      lateMinutes,
      label: "Late login (monthly grace limit exceeded)",
    };
  }

  if (mins <= noonCutoff) {
    return {
      tier: "late",
      status: "Late",
      lateMinutes: mins - shiftStart,
      label: "Late login (10:11 AM – 12:00 noon)",
    };
  }

  return {
    tier: "half_day",
    status: "Half Day",
    lateMinutes: mins - shiftStart,
    label: "After 12:00 noon (Half-day salary cut)",
  };
}

export interface MonthlyAttendanceSummary {
  period: string;
  graceUsed: number;
  lateLogins: number;
  halfDayAfterNoonCount: number;
  absentDays: number;
  lateLopDays: number;
  halfDayLopDays: number;
  absentLopDays: number;
  excessLeaveLopDays: number;
  rawLopDays: number;
  cappedLopDays: number;
  isLopCapped: boolean;
  consecutiveAbsentMax: number;
  abandonmentRisk: boolean; // >= 5 consecutive calendar days absent
  holidayWorkDays: number;
  paidLeavesTakenInMonth: number;
  breakdownText: string;
}

/**
 * Evaluates a single employee's monthly attendance + leave records under GVK Edutech policies.
 */
export function evaluateMonthlyAttendancePolicy(
  employeeId: string,
  period: string,
  attendanceRecords: AttendanceRecord[],
  leaveRequests: LeaveRequest[] = [],
  employee?: Employee,
  holidays: Holiday[] = []
): MonthlyAttendanceSummary {
  const empMonthAtt = attendanceRecords
    .filter((r) => r.employeeId === employeeId && r.date.startsWith(period))
    .sort((a, b) => a.date.localeCompare(b.date));

  const holidayDates = new Set(
    holidays.filter((h) => h.date.startsWith(period)).map((h) => h.date)
  );

  // Approved leaves covering dates in this month
  const approvedLeavesInMonth = leaveRequests.filter(
    (l) =>
      l.employeeId === employeeId &&
      l.status === "Approved" &&
      (l.startDate.startsWith(period) || l.endDate.startsWith(period))
  );

  let graceUsed = 0;
  let lateLogins = 0;
  let halfDayAfterNoonCount = 0;
  let absentDays = 0;
  let holidayWorkDays = 0;

  let consecutiveAbsent = 0;
  let consecutiveAbsentMax = 0;
  let prevAbsentDate: string | null = null;

  for (const rec of empMonthAtt) {
    // Check if employee worked on a Sunday or official holiday -> Comp-Off / Encashment eligible
    const dayOfWeek = new Date(rec.date + "T00:00:00Z").getUTCDay();
    const isOffDay = dayOfWeek === 0 || holidayDates.has(rec.date);
    if (isOffDay && rec.checkIn && !["Week Off", "Holiday", "Absent", "Leave"].includes(rec.status)) {
      holidayWorkDays += 1;
    }

    if (rec.status === "Absent") {
      absentDays += 1;
      if (prevAbsentDate) {
        const diffDays = Math.round(
          (new Date(rec.date + "T00:00:00Z").getTime() -
            new Date(prevAbsentDate + "T00:00:00Z").getTime()) /
            86400000
        );
        consecutiveAbsent = diffDays === 1 ? consecutiveAbsent + 1 : 1;
      } else {
        consecutiveAbsent = 1;
      }
      prevAbsentDate = rec.date;
      if (consecutiveAbsent > consecutiveAbsentMax) {
        consecutiveAbsentMax = consecutiveAbsent;
      }
      continue;
    } else {
      prevAbsentDate = null;
      consecutiveAbsent = 0;
    }

    if (["Week Off", "Holiday", "Leave"].includes(rec.status)) {
      continue;
    }

    if (rec.checkIn) {
      const cls = classifyLoginTime(rec.checkIn, graceUsed);
      if (cls.tier === "grace") {
        graceUsed += 1;
      } else if (cls.tier === "late") {
        lateLogins += 1;
      } else if (cls.tier === "half_day") {
        halfDayAfterNoonCount += 1;
      } else if (rec.status === "Half Day") {
        halfDayAfterNoonCount += 1;
      } else if (rec.status === "Late") {
        lateLogins += 1;
      }
    } else if (rec.status === "Late") {
      lateLogins += 1;
    } else if (rec.status === "Half Day") {
      halfDayAfterNoonCount += 1;
    }
  }

  // 3 late logins in a month = Loss of Pay (1 day per 3 late logins)
  const lateLopDays = Math.floor(lateLogins / GVK_POLICY.lateLoginsPerLop);
  const halfDayLopDays = halfDayAfterNoonCount * 0.5;
  const absentLopDays = absentDays;

  // Monthly paid leave cap check (1 leave/month in 1st year or months 1-11 post confirmation; Comp-Off excluded)
  const paidLeavesTakenInMonth = approvedLeavesInMonth
    .filter((l) => l.type !== "Comp-Off")
    .reduce((sum, l) => sum + (l.days || 1), 0);

  const isTwelfthMonthAfterConfirmation = checkIsTwelfthMonth(employee?.joiningDate, period);
  const monthlyPaidAllowance = isTwelfthMonthAfterConfirmation ? 10 : 1;
  const excessLeaveLopDays = Math.max(0, paidLeavesTakenInMonth - monthlyPaidAllowance);

  const rawLopDays = Number(
    (lateLopDays + halfDayLopDays + absentLopDays + excessLeaveLopDays).toFixed(1)
  );
  const cappedLopDays = Math.min(GVK_POLICY.maxMonthlyLopDays, rawLopDays);
  const isLopCapped = rawLopDays > GVK_POLICY.maxMonthlyLopDays;

  const parts: string[] = [];
  if (absentLopDays > 0) parts.push(`${absentLopDays} Absent`);
  if (halfDayAfterNoonCount > 0) parts.push(`${halfDayAfterNoonCount} Half-day (>12 PM)`);
  if (lateLopDays > 0) parts.push(`${lateLopDays}d from ${lateLogins} late logins`);
  if (excessLeaveLopDays > 0) parts.push(`${excessLeaveLopDays}d excess leave (>1/mo)`);

  return {
    period,
    graceUsed,
    lateLogins,
    halfDayAfterNoonCount,
    absentDays,
    lateLopDays,
    halfDayLopDays,
    absentLopDays,
    excessLeaveLopDays,
    rawLopDays,
    cappedLopDays,
    isLopCapped,
    consecutiveAbsentMax,
    abandonmentRisk: consecutiveAbsentMax >= GVK_POLICY.abandonmentConsecutiveDays,
    holidayWorkDays,
    paidLeavesTakenInMonth,
    breakdownText: parts.length > 0 ? parts.join(" · ") : "No LOP deductions",
  };
}

export function getMonthsSinceJoining(joiningDate?: string, referenceDate?: string): number {
  if (!joiningDate) return 12;
  const start = new Date(joiningDate + "T00:00:00Z");
  const ref = referenceDate ? new Date(referenceDate + "T00:00:00Z") : new Date();
  if (isNaN(start.getTime()) || isNaN(ref.getTime())) return 12;
  return Math.max(
    0,
    (ref.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      (ref.getUTCMonth() - start.getUTCMonth())
  );
}

export function checkIsTwelfthMonth(joiningDate?: string, period?: string): boolean {
  if (!joiningDate || !period) return false;
  const months = getMonthsSinceJoining(joiningDate, `${period}-01`);
  // After 1 year (confirmation at month 12), the 12th month post-confirmation is month 23 or 11 modulo 12
  return months >= 23 && (months - 12) % 12 === 11;
}

export interface LeavePolicyValidation {
  todayIso: string;
  isFirstYear: boolean;
  isAdvanceNoticeMet: boolean;
  isExtenuating: boolean;
  usedInTargetMonth: number;
  excessDaysAsLop: number;
  warnings: string[];
  blockingError?: string;
}

/**
 * Validates a leave request against GVK Edutech Leave Policy & Leave Procedure:
 * 1. Must be applied/approved at least 1 day in advance unless extenuating circumstance (accident, demise)
 * 2. Max 1 leave/month in Year 1 (extra = LOP) or 10/year post-confirmation (max 1/mo for first 11 mos)
 * 3. Carry forward is not permitted
 */
export function validateLeavePolicyRequest(params: {
  startDate: string;
  days: number;
  type: string;
  reasonCategory?: string;
  joiningDate?: string;
  existingLeaves: LeaveRequest[];
  employeeId: string;
  todayIso?: string;
}): LeavePolicyValidation {
  let todayIso = params.todayIso;
  if (!todayIso) {
    try {
      todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    } catch {
      todayIso = new Date().toISOString().slice(0, 10);
    }
  }

  const targetMonth = params.startDate.slice(0, 7);
  const monthsWorked = getMonthsSinceJoining(params.joiningDate, params.startDate);
  const isFirstYear = monthsWorked < 12;

  const isExtenuating = EXTENUATING_CATEGORIES.some(
    (c) =>
      (params.reasonCategory || "").toLowerCase().includes(c.toLowerCase()) ||
      (params.reasonCategory || "").toLowerCase().includes("accident") ||
      (params.reasonCategory || "").toLowerCase().includes("demise") ||
      (params.reasonCategory || "").toLowerCase().includes("bereavement") ||
      (params.reasonCategory || "").toLowerCase().includes("emergency")
  );

  // At least 1 day in advance means startDate > todayIso
  const isAdvanceNoticeMet = params.startDate > todayIso;

  const usedInTargetMonth = params.existingLeaves
    .filter(
      (l) =>
        l.employeeId === params.employeeId &&
        l.status !== "Rejected" &&
        l.type !== "Comp-Off" &&
        l.startDate.startsWith(targetMonth)
    )
    .reduce((sum, l) => sum + (l.days || 1), 0);

  const isTwelfthPostConfirm = checkIsTwelfthMonth(params.joiningDate, targetMonth);
  const monthlyAllowance = params.type === "Comp-Off" || isTwelfthPostConfirm ? 99 : 1;
  const totalWithRequest = params.type === "Comp-Off" ? 0 : usedInTargetMonth + params.days;
  const excessDaysAsLop = Math.max(0, totalWithRequest - monthlyAllowance);

  const warnings: string[] = [];
  let blockingError: string | undefined;

  if (!isAdvanceNoticeMet && !isExtenuating) {
    blockingError =
      "Policy requires leave approval at least 1 day in advance. For same-day/past dates, select an extenuating category (Accident / Medical Emergency or Bereavement / Demise).";
    warnings.push(
      "Requires at least 1 day advance notice unless extenuating circumstance (accident, demise)."
    );
  } else if (!isAdvanceNoticeMet && isExtenuating) {
    warnings.push(
      "Extenuating circumstance exception applied (subject to Regional Director / Operations Head approval)."
    );
  }

  if (excessDaysAsLop > 0) {
    warnings.push(
      isFirstYear
        ? `First-year policy allows max 1 leave/month (${usedInTargetMonth} already used in ${targetMonth}). ${excessDaysAsLop} day(s) will result in Loss of Pay (LOP).`
        : `Monthly cap is 1 leave/month for months 1–11 (${usedInTargetMonth} already used in ${targetMonth}). ${excessDaysAsLop} day(s) will be Loss of Pay (LOP) unless in 12th confirmation month.`
    );
  }

  return {
    todayIso,
    isFirstYear,
    isAdvanceNoticeMet,
    isExtenuating,
    usedInTargetMonth,
    excessDaysAsLop,
    warnings,
    blockingError,
  };
}
