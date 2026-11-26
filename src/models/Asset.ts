import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAsset extends Document {
  assetId?: string;
  assetTag: string; // e.g. AST-001
  name: string;
  category: "Laptop" | "Desktop" | "Monitor" | "Mobile" | "Phone" | "Furniture" | "Access Card" | "Peripheral" | string;
  brandModel?: string;
  modelNumber?: string;
  serialNumber: string;
  purchaseValue?: number;
  purchaseCost?: number;
  purchaseDate?: string;
  warrantyExpiry?: string;
  warrantyExpiresAt?: string;
  status: "Available" | "Pending Acceptance" | "Assigned" | "Under Maintenance" | "Damaged" | "Retired" | string;
  branch?: string;
  condition?: string;
  assignedTo?: any;
  assignedEmployeeName?: string;
  assignedAt?: string;
  assignedBy?: string;
  acceptanceStatus?: "Pending" | "Accepted" | "Declined" | string;
  termsAccepted?: boolean;
  termsAcceptedAt?: string;
  termsVersion?: string;
  employeeSignature?: string;
  declineReason?: string;
  vendor?: string;
  invoiceNo?: string;
  specs?: string;
  notes?: string;
  history?: Array<{ date: string; action: string; employeeId?: string; note?: string }>;
  returnHistory?: Array<{
    employeeId: string;
    returnedDate: Date;
    condition: "Good" | "Fair" | "Damaged" | string;
    notes?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const AssetSchema = new Schema<IAsset>(
  {
    assetId: { type: String, index: true },
    assetTag: { type: String, index: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    brandModel: { type: String },
    modelNumber: { type: String },
    serialNumber: { type: String, required: true },
    purchaseValue: { type: Number, default: 0 },
    purchaseCost: { type: Number, default: 0 },
    purchaseDate: { type: String },
    warrantyExpiry: { type: String },
    warrantyExpiresAt: { type: String },
    branch: { type: String, default: "Hyderabad" },
    condition: { type: String, default: "Good" },
    status: {
      type: String,
      default: "Available",
    },
    assignedTo: { type: Schema.Types.Mixed },
    assignedEmployeeName: { type: String },
    assignedAt: { type: String },
    assignedBy: { type: String },
    acceptanceStatus: { type: String },
    termsAccepted: { type: Boolean, default: false },
    termsAcceptedAt: { type: String },
    termsVersion: { type: String },
    employeeSignature: { type: String },
    declineReason: { type: String },
    vendor: { type: String },
    invoiceNo: { type: String },
    specs: { type: String },
    notes: { type: String },
    history: [
      {
        date: { type: String },
        action: { type: String },
        employeeId: { type: String },
        note: { type: String },
      },
    ],
    returnHistory: [
      {
        employeeId: { type: String },
        returnedDate: { type: Date },
        condition: { type: String },
        notes: { type: String },
      },
    ],
  },
  { timestamps: true, strict: false }
);

export const Asset: Model<IAsset> =
  mongoose.models.Asset || mongoose.model<IAsset>("Asset", AssetSchema);
