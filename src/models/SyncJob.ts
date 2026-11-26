import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISyncJob extends Document {
  jobId: string;
  action: "sync_biometric" | "sync_device" | "test_connection";
  deviceId?: string;
  ipAddress?: string;
  port?: number;
  status: "pending" | "running" | "completed" | "failed";
  requestedBy?: string;
  summary?: {
    totalLogs?: number;
    recentLogsChecked?: number;
    skippedOldLogs?: number;
    updatedRecords?: number;
    userCount?: number;
  };
  error?: string;
  completedAt?: Date;
  createdAt: Date;
}

const SyncJobSchema = new Schema<ISyncJob>(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    action: { type: String, default: "sync_biometric" },
    deviceId: { type: String, default: "DEV-01" },
    ipAddress: { type: String },
    port: { type: Number },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed"],
      default: "pending",
      index: true,
    },
    requestedBy: { type: String },
    summary: { type: Schema.Types.Mixed },
    error: { type: String },
    completedAt: { type: Date },
    createdAt: { type: Date, default: Date.now, expires: 86400 },
  },
  { timestamps: false }
);

export const SyncJob: Model<ISyncJob> =
  mongoose.models.SyncJob || mongoose.model<ISyncJob>("SyncJob", SyncJobSchema, "syncjobs");
