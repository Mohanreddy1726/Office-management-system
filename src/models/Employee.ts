import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEmployee extends Document {
  employeeId: string; // e.g. OF-1001
  name: string;
  email: string;
  workEmail?: string;
  personalEmail?: string;
  phone: string;
  avatarUrl?: string;
  gender?: "Male" | "Female" | "Other" | "Prefer not to say";
  dateOfBirth?: string;
  bloodGroup?: string;
  maritalStatus?: string;
  address?: string;
  panNumber?: string;
  aadhaarNumber?: string; // Complete 12-digit Aadhaar Number

  // Job details
  designation: string;
  department: string;
  branch: string;
  employmentType?: string;
  status: "Active" | "Probation" | "Notice" | "Inactive" | "Pending Verification";
  joiningDate: string;
  probationEndDate?: string;
  probationMonths?: number;
  noticePeriodDays?: number;
  reportingManagerId?: string; // Links to another Employee
  reportingManagerName?: string;

  // Flat convenience fields synced from onboarding form
  qualification?: string;
  institution?: string;
  graduationYear?: number;
  grade?: string;
  experienceYears?: number;
  previousCompany?: string;
  previousDesignation?: string;
  skills?: string;
  salaryStructureId?: string;
  paymentMethod?: string;

  // Emergency contact
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };

  // Education Qualifications
  education?: Array<{
    degree: string;
    institution: string;
    yearOfPassing: string;
    percentageOrCgpa?: string;
  }>;

  // Prior Work Experience
  experience?: Array<{
    companyName: string;
    designation: string;
    fromDate: string;
    toDate: string;
    reasonForLeaving?: string;
  }>;

  // Salary & compensation (INR) - Zero PF & Zero ESI enforced
  salary: {
    annualCtc: number;
    monthlyGross: number;
    basic: number;
    hra: number;
    specialAllowance: number;
    professionalTax: number;
    epfDeduction: number;
    esiDeduction: number;
    tds: number;
  };

  // Statutory & Bank
  bankDetails?: {
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    panNumber: string;
    aadhaarNumber: string;
    bankLast4?: string;
  };

  // Work Shift
  shift?: {
    shiftName: string;
    startTime: string;
    endTime: string;
    gracePeriodMinutes?: number;
    halfDayThresholdHours?: number;
    fullDayHours?: number;
  };

  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    workEmail: { type: String, lowercase: true, trim: true },
    personalEmail: { type: String, lowercase: true, trim: true },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    avatarUrl: { type: String },
    gender: { type: String, enum: ["Male", "Female", "Other", "Prefer not to say"] },
    dateOfBirth: { type: String },
    bloodGroup: { type: String },
    maritalStatus: { type: String },
    address: { type: String },
    panNumber: { type: String, trim: true },
    aadhaarNumber: { type: String, trim: true, index: true },

    designation: { type: String, required: true },
    department: { type: String, required: true },
    branch: { type: String },
    employmentType: { type: String },
    status: {
      type: String,
      enum: ["Active", "Probation", "Notice", "Inactive", "Pending Verification"],
      default: "Pending Verification",
    },
    joiningDate: { type: String, required: true },
    probationEndDate: { type: String },
    probationMonths: { type: Number },
    noticePeriodDays: { type: Number },
    reportingManagerId: { type: String },
    reportingManagerName: { type: String },

    qualification: { type: String },
    institution: { type: String },
    graduationYear: { type: Number },
    grade: { type: String },
    experienceYears: { type: Number },
    previousCompany: { type: String },
    previousDesignation: { type: String },
    skills: { type: String },
    salaryStructureId: { type: String },
    paymentMethod: { type: String },

    emergencyContact: {
      name: { type: String },
      relationship: { type: String },
      phone: { type: String },
    },

    education: [
      {
        degree: { type: String },
        institution: { type: String },
        yearOfPassing: { type: String },
        percentageOrCgpa: { type: String },
      },
    ],

    experience: [
      {
        companyName: { type: String },
        designation: { type: String },
        fromDate: { type: String },
        toDate: { type: String },
        reasonForLeaving: { type: String },
      },
    ],

    salary: {
      annualCtc: { type: Number, default: 0 },
      monthlyGross: { type: Number, default: 0 },
      basic: { type: Number, default: 0 },
      hra: { type: Number, default: 0 },
      specialAllowance: { type: Number, default: 0 },
      professionalTax: { type: Number, default: 200 },
      epfDeduction: { type: Number, default: 0 },
      esiDeduction: { type: Number, default: 0 },
      tds: { type: Number, default: 0 },
    },

    bankDetails: {
      accountNumber: { type: String },
      ifscCode: { type: String },
      bankName: { type: String },
      panNumber: { type: String },
      aadhaarNumber: { type: String },
      bankLast4: { type: String },
    },

    shift: {
      shiftName: { type: String, default: "General Shift" },
      startTime: { type: String, default: "10:00" },
      endTime: { type: String, default: "18:30" },
      gracePeriodMinutes: { type: Number, default: 15 },
      halfDayThresholdHours: { type: Number, default: 4.5 },
      fullDayHours: { type: Number, default: 8.5 },
    },
  },
  { timestamps: true }
);

export const Employee: Model<IEmployee> =
  mongoose.models.Employee ||
  mongoose.model<IEmployee>("Employee", EmployeeSchema);
