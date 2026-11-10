import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPayrollRun extends Document {
  runId: string; // e.g. PR-2026-10
  period: string; // YYYY-MM
  status: "Draft" | "Calculated" | "Approved" | "Locked" | "Payment Recorded";
  headcount: number;
  totalGross: number;
  totalIncentives: number;
  totalMiscDeductions: number;
  totalLop: number;
  totalDeductions: number;
  employerContributions: number;
  totalNet: number;
  verifiedEmployeeIds: string[];
  approvedBy?: string;
  lockedBy?: string;
  paymentDetails?: {
    method: string;
    reference: string;
    paidAt: Date;
    notes?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PayrollRunSchema = new Schema<IPayrollRun>(
  {
    runId: { type: String, required: true, unique: true, index: true },
    period: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["Draft", "Calculated", "Approved", "Locked", "Payment Recorded"],
      default: "Draft",
    },
    headcount: { type: Number, default: 0 },
    totalGross: { type: Number, default: 0 },
    totalIncentives: { type: Number, default: 0 },
    totalMiscDeductions: { type: Number, default: 0 },
    totalLop: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    employerContributions: { type: Number, default: 0 },
    totalNet: { type: Number, default: 0 },
    verifiedEmployeeIds: [{ type: String }],
    approvedBy: { type: String },
    lockedBy: { type: String },
    paymentDetails: {
      method: { type: String },
      reference: { type: String },
      paidAt: { type: Date },
      notes: { type: String },
    },
  },
  { timestamps: true }
);

export const PayrollRun: Model<IPayrollRun> =
  mongoose.models.PayrollRun ||
  mongoose.model<IPayrollRun>("PayrollRun", PayrollRunSchema);

export interface IPayslip extends Document {
  payrollRunId: string;
  employeeId: string;
  employeeName: string;
  designation: string;
  department: string;
  period: string;
  workDays: number;
  presentDays: number;
  paidLeaves: number;
  lopDays: number;
  earnings: {
    basic: number;
    hra: number;
    specialAllowance: number;
    incentives: number;
    gross: number;
  };
  deductions: {
    epf: number;
    esi: number;
    professionalTax: number;
    tds: number;
    lopAmount: number;
    miscDeductions: number;
    total: number;
  };
  bankDetails: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
  };
  netSalary: number;
  status: "Pending" | "Paid";
  createdAt: Date;
}

const PayslipSchema = new Schema<IPayslip>(
  {
    payrollRunId: { type: String, required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    designation: { type: String, required: true },
    department: { type: String, required: true },
    period: { type: String, required: true, index: true },
    workDays: { type: Number, default: 30 },
    presentDays: { type: Number, default: 30 },
    paidLeaves: { type: Number, default: 0 },
    lopDays: { type: Number, default: 0 },
    earnings: {
      basic: { type: Number, default: 0 },
      hra: { type: Number, default: 0 },
      specialAllowance: { type: Number, default: 0 },
      incentives: { type: Number, default: 0 },
      gross: { type: Number, default: 0 },
    },
    deductions: {
      epf: { type: Number, default: 0 },
      esi: { type: Number, default: 0 },
      professionalTax: { type: Number, default: 200 },
      tds: { type: Number, default: 0 },
      lopAmount: { type: Number, default: 0 },
      miscDeductions: { type: Number, default: 0 },
      total: { type: Number, default: 200 },
    },
    bankDetails: {
      bankName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      ifscCode: { type: String, default: "" },
    },
    netSalary: { type: Number, default: 0 },
    status: { type: String, enum: ["Pending", "Paid"], default: "Pending" },
  },
  { timestamps: true }
);

PayslipSchema.index({ payrollRunId: 1, employeeId: 1 }, { unique: true });

export const Payslip: Model<IPayslip> =
  mongoose.models.Payslip || mongoose.model<IPayslip>("Payslip", PayslipSchema);
