import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAuditLog extends Document {
  auditId: string;
  timestamp: Date;
  user: string;
  userId?: string;
  role?: string;
  action: string;
  module: string;
  record: string;
  outcome: "Success" | "Failure";
  details?: string;
  reason?: string;
  ipAddress?: string;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    auditId: { type: String, required: true, unique: true, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    user: { type: String, required: true },
    userId: { type: String },
    role: { type: String },
    action: { type: String, required: true },
    module: { type: String, required: true, index: true },
    record: { type: String, required: true },
    outcome: { type: String, enum: ["Success", "Failure"], default: "Success" },
    details: { type: String },
    reason: { type: String },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
