// Deterministic mock payroll math. Illustrative only — not legally validated.
import type { Employee, SalaryStructure, PayrollRun } from "@/lib/data/types";
import { inr } from "@/lib/format";

export interface PayslipBreakdown {
  basic: number;
  hra: number;
  special: number;
  gross: number;
  pf: number;
  esi: number;
  pt: number;
  tds: number;
  totalDeductions: number;
  employerPf: number;
  net: number;
}

export function payslipFor(e: Employee, structures: SalaryStructure[], unpaidDays = 0): PayslipBreakdown {
  const gross = e.monthlyGross;
  const st = structures.find((s) => s.id === e.salaryStructureId) ?? structures[0]!;
  const basicPct = st.id === "SS-EXEC" ? 0.5 : st.id === "SS-SENIOR" ? 0.45 : 0.4;
  const basic = Math.round(gross * basicPct);
  const hra = Math.round(basic * 0.5);
  const special = gross - basic - hra;
  const perDay = gross / 22;
  const unpaid = Math.round(perDay * unpaidDays);
  const pf = Math.min(1800, Math.round(basic * 0.12));
  const esi = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
  const pt = 200;
  const tds = Math.max(0, Math.round((gross - 70000) * 0.1));
  const totalDeductions = pf + esi + pt + tds + unpaid;
  return {
    basic, hra, special: special - unpaid, gross, pf, esi, pt, tds,
    totalDeductions, employerPf: Math.min(1800, Math.round(basic * 0.12)),
    net: gross - totalDeductions,
  };
}

export function runTotals(employees: Employee[], structures: SalaryStructure[]) {
  let gross = 0, ded = 0, employer = 0, net = 0;
  for (const e of employees) {
    const p = payslipFor(e, structures);
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
