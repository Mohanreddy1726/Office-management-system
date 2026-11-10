import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAttendance extends Document {
  employeeId: string;
  employeeName: string;
  department: string;
  date: string; // YYYY-MM-DD
  checkIn?: string; // HH:MM
  checkOut?: string; // HH:MM
  totalHours?: number;
  status: "Present" | "Late" | "Half-day" | "Absent" | "On Leave";
  confirmation:
    | "Awaiting Employee"
    | "Awaiting Manager"
    | "Awaiting HR"
    | "Confirmed"
    | "Disputed"
    | "Locked";
  correction?: {
    status: "Pending" | "Approved" | "Rejected";
    requestedCheckIn?: string;
    requestedCheckOut?: string;
    reason: string;
    submittedAt: Date;
    reviewedBy?: string;
    reviewNote?: string;
    reviewedAt?: Date;
  };
  deviceUsed?: string;
  branch: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    department: { type: String, required: true },
    date: { type: String, required: true, index: true },
    checkIn: { type: String },
    checkOut: { type: String },
    totalHours: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Present", "Late", "Half-day", "Absent", "On Leave"],
      default: "Present",
    },
    confirmation: {
      type: String,
      enum: [
        "Awaiting Employee",
        "Awaiting Manager",
        "Awaiting HR",
        "Confirmed",
        "Disputed",
        "Locked",
      ],
      default: "Awaiting Employee",
    },
    correction: {
      status: { type: String, enum: ["Pending", "Approved", "Rejected"] },
      requestedCheckIn: { type: String },
      requestedCheckOut: { type: String },
      reason: { type: String },
      submittedAt: { type: Date },
      reviewedBy: { type: String },
      reviewNote: { type: String },
      reviewedAt: { type: Date },
    },
    deviceUsed: { type: String },
    branch: { type: String, default: "Headquarters" },
  },
  { timestamps: true }
);

AttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

export const Attendance: Model<IAttendance> =
  mongoose.models.Attendance ||
  mongoose.model<IAttendance>("Attendance", AttendanceSchema);
