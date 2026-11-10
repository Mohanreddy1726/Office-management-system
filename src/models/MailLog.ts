import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMailLog extends Document {
  refNo: string; // e.g. IN-2026-0001, OUT-2026-0001
  direction: "Incoming" | "Outgoing";
  channel: "Physical Courier" | "Speed Post" | "Hand Delivery" | "Email";
  sender: string;
  recipient: string;
  subject: string;
  department: string;
  ownerId?: string;
  ownerName?: string;
  status: "Received" | "Dispatched" | "Delivered" | "Action Pending" | "Closed";
  priority: "Normal" | "High" | "Urgent";
  trackingNumber?: string;
  followUpDate?: string;
  timeline: Array<{
    at: Date;
    event: string;
    by: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const MailLogSchema = new Schema<IMailLog>(
  {
    refNo: { type: String, required: true, unique: true, index: true },
    direction: { type: String, enum: ["Incoming", "Outgoing"], required: true },
    channel: {
      type: String,
      enum: ["Physical Courier", "Speed Post", "Hand Delivery", "Email"],
      default: "Physical Courier",
    },
    sender: { type: String, required: true },
    recipient: { type: String, required: true },
    subject: { type: String, required: true },
    department: { type: String, required: true },
    ownerId: { type: String },
    ownerName: { type: String },
    status: {
      type: String,
      enum: ["Received", "Dispatched", "Delivered", "Action Pending", "Closed"],
      default: "Received",
    },
    priority: {
      type: String,
      enum: ["Normal", "High", "Urgent"],
      default: "Normal",
    },
    trackingNumber: { type: String },
    followUpDate: { type: String },
    timeline: [
      {
        at: { type: Date, default: Date.now },
        event: { type: String },
        by: { type: String },
      },
    ],
  },
  { timestamps: true }
);

export const MailLog: Model<IMailLog> =
  mongoose.models.MailLog || mongoose.model<IMailLog>("MailLog", MailLogSchema);
