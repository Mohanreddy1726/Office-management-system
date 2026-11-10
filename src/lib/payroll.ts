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
  structures: SalaryStructure[],
  unpaidDays = 0,
  incentives = 0,
  miscDeductions = 0
): PayslipBreakdown {
  const baseGross = e.monthlyGross;
  const st = structures.find((s) => s.id === e.salaryStructureId) ?? structures[0]!;
  const basicPct = st.id === "SS-EXEC" ? 0.5 : st.id === "SS-SENIOR" ? 0.45 : 0.4;
  const basic = Math.round(baseGross * basicPct);
  const hra = Math.round(basic * 0.5);
  const special = Math.max(0, baseGross - basic - hra);

  // Loss of Pay (LOP) calculation based on standard 30-day month
  const perDay = Math.round(baseGross / 30);
  const lop = Math.round(perDay * unpaidDays);

  // Statutory: PF and ESI are 0 as per company policy
  const pf = 0;
  const esi = 0;
  const pt = 200; // Standard professional tax
  const tds = Math.max(0, Math.round((baseGross - 75000) * 0.1));

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

export const payMoney = inr;
