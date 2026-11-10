import mongoose, { Schema, Document, Model } from "mongoose";

export type LeaveType = "Casual Leave" | "Sick Leave" | "Comp-Off";

export interface ILeaveRequest extends Document {
  employeeId: string;
  employeeName: string;
  department: string;
  leaveType: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  daysCount: number;
  isHalfDay: boolean;
  reason: string;
  status: "Submitted" | "Manager Approved" | "HR Approved" | "Rejected";
  decisionNote?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  timeline: Array<{
    stage: string;
    actor: string;
    at: Date;
    note?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const LeaveRequestSchema = new Schema<ILeaveRequest>(
  {
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    department: { type: String, required: true },
    leaveType: {
      type: String,
      enum: ["Casual Leave", "Sick Leave", "Comp-Off"],
      required: true,
    },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    daysCount: { type: Number, required: true },
    isHalfDay: { type: Boolean, default: false },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ["Submitted", "Manager Approved", "HR Approved", "Rejected"],
      default: "Submitted",
    },
    decisionNote: { type: String },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
    timeline: [
      {
        stage: { type: String },
        actor: { type: String },
        at: { type: Date, default: Date.now },
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
    total: { type: Number, default: 12 },
    used: { type: Number, default: 0 },
    remaining: { type: Number, default: 12 },
  },
  sickLeave: {
    total: { type: Number, default: 10 },
    used: { type: Number, default: 0 },
    remaining: { type: Number, default: 10 },
  },
  compOff: {
    total: { type: Number, default: 2 },
    used: { type: Number, default: 0 },
    remaining: { type: Number, default: 2 },
  },
});

export const LeaveBalance: Model<ILeaveBalance> =
  mongoose.models.LeaveBalance ||
  mongoose.model<ILeaveBalance>("LeaveBalance", LeaveBalanceSchema);
