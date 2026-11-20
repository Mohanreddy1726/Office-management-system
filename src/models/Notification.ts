import mongoose, { Schema, Document, Model } from "mongoose";

export interface INotification extends Document {
  id?: string;
  title: string;
  message?: string;
  description?: string;
  category?: string;
  link?: string;
  priority?: "Normal" | "High" | string;
  type?: "info" | "warning" | "success" | "danger" | string;
  targetRole?: string; // all, super_admin, hr_admin, manager, employee
  targetUserId?: string; // specific user
  targetBranch?: string;
  targetDepartment?: string;
  audience?: string;
  scope?: string;
  isAnnouncement?: boolean;
  publishAt?: string;
  expiresAt?: string;
  read?: boolean;
  readBy?: string[]; // User IDs who read this
  timestamp?: string;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    id: { type: String, index: true },
    title: { type: String, required: true },
    message: { type: String },
    description: { type: String },
    category: { type: String, default: "System" },
    link: { type: String },
    priority: { type: String, default: "Normal" },
    type: {
      type: String,
      default: "info",
    },
    targetRole: { type: String, default: "all" },
    targetUserId: { type: String },
    targetBranch: { type: String },
    targetDepartment: { type: String },
    audience: { type: String, default: "All Employees" },
    scope: { type: String },
    isAnnouncement: { type: Boolean, default: false },
    publishAt: { type: String },
    expiresAt: { type: String },
    read: { type: Boolean, default: false },
    readBy: [{ type: String }],
    timestamp: { type: String },
  },
  { timestamps: true, strict: false }
);

export const Notification: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", NotificationSchema);
