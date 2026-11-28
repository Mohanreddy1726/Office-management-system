import mongoose, { Schema, Document as MongooseDoc, Model } from "mongoose";

export interface IDocumentRecord extends MongooseDoc {
  docId?: string; // e.g. DOC-101
  documentId?: string;
  title: string;
  category: "Identity Proof" | "Government ID" | "Education" | "Experience" | "Offer Letter" | "Appointment Letter" | "Payslip" | "Company Policy" | string;
  fileUrl: string;
  fileSize?: string | number;
  fileType?: string;
  docNumber?: string;
  confidentiality?: string;
  issueDate?: string;
  uploadedBy?: string;
  notes?: string;
  version?: number;
  letterType?: string;
  letterData?: Record<string, any>;
  acceptanceStatus?: string;
  acceptedAt?: Date;
  acceptedBy?: string;
  systemGenerated?: boolean;
  employeeId?: string; // If employee-specific
  employeeName?: string;
  expiryDate?: string;
  status: "Pending" | "Verified" | "Rejected" | string;
  verifiedBy?: string;
  verifiedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentRecordSchema = new Schema<IDocumentRecord>(
  {
    docId: { type: String, index: true },
    documentId: { type: String, index: true },
    title: { type: String, required: true },
    category: {
      type: String,
      required: true,
    },
    fileUrl: { type: String, required: true },
    fileSize: { type: Schema.Types.Mixed },
    fileType: { type: String },
    docNumber: { type: String },
    confidentiality: { type: String },
    issueDate: { type: String },
    uploadedBy: { type: String },
    notes: { type: String },
    version: { type: Number, default: 1 },
    letterType: { type: String },
    letterData: { type: Schema.Types.Mixed },
    acceptanceStatus: { type: String },
    acceptedAt: { type: Date },
    acceptedBy: { type: String },
    systemGenerated: { type: Boolean },
    employeeId: { type: String, index: true },
    employeeName: { type: String },
    expiryDate: { type: String },
    status: {
      type: String,
      default: "Pending",
    },
    verifiedBy: { type: String },
    verifiedAt: { type: Date },
    rejectionReason: { type: String },
  },
  { timestamps: true, strict: false }
);

export const DocumentRecord: Model<IDocumentRecord> =
  mongoose.models.DocumentRecord ||
  mongoose.model<IDocumentRecord>("DocumentRecord", DocumentRecordSchema, "documents");
