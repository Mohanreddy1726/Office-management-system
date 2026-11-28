// Deterministic mock payroll math configured for company rules:
// - No PF & No ESI deductions
// - Support for Incentives / Bonuses
// - Support for Miscellaneous Deductions
// - Support for Loss of Pay (LOP) based on unpaid absence days
// - Bank statement compilation

import type { Employee, SalaryStructure, PayrollRun } from "@/lib/data/types";
import { inr } from "@/lib/format";

export interface PayslipBreakdown {
  basic: number;
  hra: number;
  special: number;
  incentives: number;
  gross: number;
  pf: number; // 0 (exempted)
  esi: number; // 0 (exempted)
  pt: number;
  tds: number;
  lop: number;
  miscDeductions: number;
  totalDeductions: number;
  employerPf: number; // 0 (exempted)
  net: number;
}

export function payslipFor(
  e: Employee,
  _structures: SalaryStructure[],
  unpaidDays = 0,
  incentives = 0,
  miscDeductions = 0,
  options?: { allowOver15DaysLop?: boolean }
): PayslipBreakdown {
  const baseGross = Number(e.monthlyGross) || 0;
  // Complete salary goes to Basic Salary; zero allowances and zero standard deductions
  const basic = baseGross;
  const hra = 0;
  const special = 0;

  // Loss of Pay (LOP) calculation based on Basic Salary (30-day month).
  // Policy: Except for maternity or personal medical emergency, LOP cannot exceed 15 days.
  const effectiveUnpaidDays = options?.allowOver15DaysLop
    ? Math.max(0, unpaidDays)
    : Math.min(15, Math.max(0, unpaidDays));
  const perDay = Math.round(baseGross / 30);
  const lop = Math.round(perDay * effectiveUnpaidDays);

  // Zero standard statutory deductions (No PF, No ESI, No PT, No TDS)
  const pf = 0;
  const esi = 0;
  const pt = 0;
  const tds = 0;

  const totalDeductions = pf + esi + pt + tds + lop + miscDeductions;
  const totalGross = baseGross + incentives;
  const net = Math.max(0, totalGross - totalDeductions);

  return {
    basic,
    hra,
    special,
    incentives,
    gross: totalGross,
    pf: 0,
    esi: 0,
    pt,
    tds,
    lop,
    miscDeductions,
    totalDeductions,
    employerPf: 0,
    net,
  };
}

export function runTotals(
  employees: Employee[],
  structures: SalaryStructure[],
  lopMap: Record<string, number> = {},
  incentiveMap: Record<string, number> = {},
  deductionMap: Record<string, number> = {}
) {
  let gross = 0, ded = 0, employer = 0, net = 0;
  for (const e of employees) {
    const p = payslipFor(
      e,
      structures,
      lopMap[e.id] ?? 0,
      incentiveMap[e.id] ?? 0,
      deductionMap[e.id] ?? 0
    );
    gross += p.gross;
    ded += p.totalDeductions;
    employer += p.employerPf;
    net += p.net;
  }
  return { gross, ded, employer, net };
}

export function runFromState(run: PayrollRun) {
  return run;
}

export function compOffEncashmentAmount(e: Employee, holidayDaysWorked: number): number {
  if (holidayDaysWorked <= 0) return 0;
  return Math.round((e.monthlyGross / 30) * holidayDaysWorked);
}

export const payMoney = inr;
