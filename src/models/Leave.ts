import mongoose, { Schema, Document, Model } from "mongoose";

export type LeaveType = "Emergency Leave" | "Comp-Off" | "Casual Leave" | "Sick Leave";
export type LeaveStage =
  | "Submitted"
  | "Manager Review"
  | "HR Review"
  | "Approved"
  | "Manager Approved"
  | "HR Approved"
  | "Rejected"
  | "Clarification";

export interface ILeaveRequest extends Document {
  employeeId: string;
  employeeName: string;
  department: string;
  branch?: string;
  leaveType: LeaveType;
  type?: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  daysCount: number;
  days?: number;
  isHalfDay: boolean;
  halfDay?: "First Half" | "Second Half" | string;
  reason: string;
  reasonCategory?: string;
  handoverEmployeeId?: string;
  emergencyContact?: string;
  documentNote?: string;
  status: LeaveStage;
  managerDecision?: string;
  managerNote?: string;
  decisionNote?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  timeline: Array<{
    stage: string;
    actor: string;
    at: Date | string;
    note?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const LeaveRequestSchema = new Schema<ILeaveRequest>(
  {
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    department: { type: String, default: "Operations" },
    branch: { type: String, default: "Headquarters" },
    leaveType: {
      type: String,
      enum: ["Emergency Leave", "Comp-Off", "Casual Leave", "Sick Leave"],
      required: true,
    },
    type: { type: String },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    daysCount: { type: Number, required: true, default: 1 },
    days: { type: Number, default: 1 },
    isHalfDay: { type: Boolean, default: false },
    halfDay: { type: String },
    reason: { type: String, required: true },
    reasonCategory: { type: String },
    handoverEmployeeId: { type: String },
    emergencyContact: { type: String },
    documentNote: { type: String },
    status: {
      type: String,
      enum: [
        "Submitted",
        "Manager Review",
        "HR Review",
        "Approved",
        "Manager Approved",
        "HR Approved",
        "Rejected",
        "Clarification",
      ],
      default: "Submitted",
      index: true,
    },
    managerDecision: { type: String },
    managerNote: { type: String },
    decisionNote: { type: String },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
    timeline: [
      {
        stage: { type: String },
        actor: { type: String },
        at: { type: Schema.Types.Mixed, default: Date.now },
        note: { type: String },
      },
    ],
  },
  { timestamps: true }
);

export const LeaveRequest: Model<ILeaveRequest> =
  mongoose.models.LeaveRequest ||
  mongoose.model<ILeaveRequest>("LeaveRequest", LeaveRequestSchema);

// Leave balance per employee (strictly Casual Leave, Sick Leave, and Comp-Off)
export interface ILeaveBalance extends Document {
  employeeId: string;
  year: number;
  casualLeave: { total: number; used: number; remaining: number };
  sickLeave: { total: number; used: number; remaining: number };
  compOff: { total: number; used: number; remaining: number };
}

const LeaveBalanceSchema = new Schema<ILeaveBalance>({
  employeeId: { type: String, required: true, unique: true, index: true },
  year: { type: Number, default: new Date().getFullYear() },
  casualLeave: {
    total: { type: Number, default: 10 },
    used: { type: Number, default: 0 },
    remaining: { type: Number, default: 10 },
  },
  sickLeave: {
    total: { type: Number, default: 10 },
    used: { type: Number, default: 0 },
    remaining: { type: Number, default: 10 },
  },
  compOff: {
    total: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    remaining: { type: Number, default: 0 },
  },
});

export const LeaveBalance: Model<ILeaveBalance> =
  mongoose.models.LeaveBalance ||
  mongoose.model<ILeaveBalance>("LeaveBalance", LeaveBalanceSchema);
