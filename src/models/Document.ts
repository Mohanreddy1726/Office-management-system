import mongoose, { Schema, Document as MongooseDoc, Model } from "mongoose";

export interface IDocumentRecord extends MongooseDoc {
  docId?: string; // e.g. DOC-101
  documentId?: string;
  title: string;
  category: "Identity Proof" | "Government ID" | "Education" | "Experience" | "Offer Letter" | "Appointment Letter" | "Payslip" | "Company Policy" | string;
  fileUrl: string;
  fileSize?: string | number;
  fileType?: string;
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
