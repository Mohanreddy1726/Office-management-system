import mongoose, { Schema, Document, Model } from "mongoose";

export type RoleType = "super_admin" | "hr_admin" | "manager" | "employee";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: RoleType;
  employeeId?: string; // Links to Employee model
  branch: string;
  isActive: boolean;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  initialPassword?: string; // Kept temporarily until verification is completed
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["super_admin", "hr_admin", "manager", "employee"],
      default: "employee",
      required: true,
    },
    employeeId: {
      type: String,
      sparse: true,
      index: true,
    },
    branch: {
      type: String,
      default: "Headquarters",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      sparse: true,
      index: true,
    },
    emailVerificationExpires: {
      type: Date,
    },
    initialPassword: {
      type: String,
    },
    lastLogin: {
      type: Date,
    },
  },
  { timestamps: true }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
