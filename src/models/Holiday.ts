import mongoose, { Schema, Document, Model } from "mongoose";

export interface IHoliday extends Document {
  holidayId: string;
  name: string;
  date: string; // YYYY-MM-DD
  type?: "National" | "Regional" | "Company" | "Restricted" | string;
  branches: string[] | "All";
  description?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const HolidaySchema = new Schema<IHoliday>(
  {
    holidayId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    date: { type: String, required: true, index: true },
    type: { type: String, default: "Public" },
    branches: { type: Schema.Types.Mixed, default: "All" },
    description: { type: String },
    createdBy: { type: String },
  },
  { timestamps: true, strict: false }
);

export const Holiday: Model<IHoliday> =
  mongoose.models.Holiday || mongoose.model<IHoliday>("Holiday", HolidaySchema, "holidays");
