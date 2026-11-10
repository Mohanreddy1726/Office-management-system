import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBiometricDevice extends Document {
  deviceId: string;
  name: string;
  brand?: string;
  deviceModel?: string;
  location: string;
  connection?: string;
  ipAddress?: string;
  port?: number;
  commKey?: string;
  status: "Online" | "Offline" | "Sync Pending";
  lastSync?: Date;
  branch: string;
  enrolledUsersCount?: number;
  totalLogsCount?: number;
}

const BiometricDeviceSchema = new Schema<IBiometricDevice>(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    brand: { type: String, default: "eSSL" },
    deviceModel: { type: String, default: "eSSL K30 Pro" },
    location: { type: String, required: true },
    connection: { type: String, default: "TCP/IP" },
    ipAddress: { type: String, default: "192.168.29.201" },
    port: { type: Number, default: 4370 },
    commKey: { type: String, default: "0" },
    status: {
      type: String,
      enum: ["Online", "Offline", "Sync Pending"],
      default: "Online",
    },
    lastSync: { type: Date },
    branch: { type: String, default: "Hyderabad" },
    enrolledUsersCount: { type: Number, default: 0 },
    totalLogsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const BiometricDevice: Model<IBiometricDevice> =
  mongoose.models.BiometricDevice ||
  mongoose.model<IBiometricDevice>("BiometricDevice", BiometricDeviceSchema);

export interface IBiometricMapping extends Document {
  deviceId: string;
  biometricId: string;
  employeeId: string;
  employeeName: string;
  status: "Active" | "Inactive";
  createdAt: Date;
}

const BiometricMappingSchema = new Schema<IBiometricMapping>(
  {
    deviceId: { type: String, required: true, index: true },
    biometricId: { type: String, required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: true }
);

BiometricMappingSchema.index(
  { deviceId: 1, biometricId: 1 },
  { unique: true }
);

export const BiometricMapping: Model<IBiometricMapping> =
  mongoose.models.BiometricMapping ||
  mongoose.model<IBiometricMapping>("BiometricMapping", BiometricMappingSchema);

export interface IUnmappedPunch extends Document {
  deviceId: string;
  biometricId: string;
  punchTime: Date;
  punchType: "CheckIn" | "CheckOut" | "Unknown";
  resolved: boolean;
}

const UnmappedPunchSchema = new Schema<IUnmappedPunch>(
  {
    deviceId: { type: String, required: true },
    biometricId: { type: String, required: true, index: true },
    punchTime: { type: Date, required: true },
    punchType: {
      type: String,
      enum: ["CheckIn", "CheckOut", "Unknown"],
      default: "Unknown",
    },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const UnmappedPunch: Model<IUnmappedPunch> =
  mongoose.models.UnmappedPunch ||
  mongoose.model<IUnmappedPunch>("UnmappedPunch", UnmappedPunchSchema);
