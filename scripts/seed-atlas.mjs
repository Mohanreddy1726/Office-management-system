import dns from "node:dns";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

// Ensure public DNS fallback for MongoDB Atlas SRV lookups on Windows
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Ignore
}

// Read MONGODB_URI from .env.local if present
let mongoUri = "mongodb+srv://mohanreddy:mohanreddy1726@cluster0.5ghmukt.mongodb.net/rendesk?retryWrites=true&w=majority";
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("MONGODB_URI=")) {
        mongoUri = trimmed.replace("MONGODB_URI=", "").trim();
        break;
      }
    }
  }
} catch (err) {
  console.warn("Could not read .env.local, using default URI");
}

console.log("Connecting to MongoDB Atlas at:", mongoUri.split("@").pop());

await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
console.log("Connected successfully to DB:", mongoose.connection.name);

const db = mongoose.connection.db;

const defaultPassword = "password123";
const passwordHash = await bcrypt.hash(defaultPassword, 10);

// --------------------------------------------------------------------------
// 1. SEED USERS (All 4 Core Roles)
// --------------------------------------------------------------------------
const usersColl = db.collection("users");
await usersColl.deleteMany({});

const users = [
  {
    email: "vikram.desai@rendesk.example",
    passwordHash,
    name: "Vikram Desai",
    role: "super_admin",
    employeeId: "OF-1001",
    branch: "Headquarters",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    email: "ananya.sharma@rendesk.example",
    passwordHash,
    name: "Ananya Sharma",
    role: "hr_admin",
    employeeId: "OF-1010",
    branch: "Headquarters",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    email: "rahul.verma@rendesk.example",
    passwordHash,
    name: "Rahul Verma",
    role: "manager",
    employeeId: "OF-1002",
    branch: "Headquarters",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    email: "karthik.reddy@rendesk.example",
    passwordHash,
    name: "Karthik Reddy",
    role: "employee",
    employeeId: "OF-1011",
    branch: "Headquarters",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];
await usersColl.insertMany(users);
console.log(`[1/9] Seeded ${users.length} Users`);

// --------------------------------------------------------------------------
// 2. SEED EMPLOYEES (With Full Profile, Education, Experience, Bank, Zero PF/ESI)
// --------------------------------------------------------------------------
const empColl = db.collection("employees");
await empColl.deleteMany({});

const employeeNames = [
  ["OF-1001", "Vikram Desai", "Managing Director & CEO", "Executive", 300000, "Hyderabad"],
  ["OF-1002", "Rahul Verma", "VP of Engineering", "Engineering", 220000, "Hyderabad"],
  ["OF-1003", "Priya Nair", "Principal Architect", "Engineering", 180000, "Hyderabad"],
  ["OF-1004", "Suresh Babu", "QA Director", "Engineering", 160000, "Warangal"],
  ["OF-1005", "Neha Sharma", "Lead UX Researcher", "Product", 140000, "Hyderabad"],
  ["OF-1006", "Deepak Rao", "VP of Finance", "Finance", 200000, "Hyderabad"],
  ["OF-1007", "Imran Khan", "Enterprise Sales Director", "Sales", 190000, "Vijayawada"],
  ["OF-1008", "Sunita Rao", "Support Operations Lead", "Customer Support", 110000, "Visakhapatnam"],
  ["OF-1009", "Arun Kumar", "Facilities & Operations Head", "Operations", 125000, "Hyderabad"],
  ["OF-1010", "Ananya Sharma", "Head of People & Culture", "Human Resources", 175000, "Hyderabad"],
  ["OF-1011", "Karthik Reddy", "Senior Full-Stack Engineer", "Engineering", 115000, "Hyderabad"],
  ["OF-1012", "Aarav Gupta", "Backend Engineer", "Engineering", 95000, "Hyderabad"],
  ["OF-1013", "Meera Iyer", "Frontend Engineer", "Engineering", 90000, "Hyderabad"],
  ["OF-1014", "Rohan Mehta", "DevOps Engineer", "Engineering", 105000, "Hyderabad"],
  ["OF-1015", "Divya Joshi", "Product Manager", "Product", 130000, "Hyderabad"],
  ["OF-1016", "Siddharth Sen", "UI/UX Designer", "Product", 85000, "Hyderabad"],
  ["OF-1017", "Aditi Deshmukh", "Financial Analyst", "Finance", 75000, "Hyderabad"],
  ["OF-1018", "Rajesh Pillai", "Accounting Specialist", "Finance", 70000, "Hyderabad"],
  ["OF-1019", "Tanvi Bhatia", "Sales Executive", "Sales", 65000, "Vijayawada"],
  ["OF-1020", "Naveen Murthy", "Account Manager", "Sales", 80000, "Vijayawada"],
  ["OF-1021", "Bhavna Jain", "Customer Support Rep", "Customer Support", 45000, "Visakhapatnam"],
  ["OF-1022", "Manoj Kulkarni", "Support Engineer", "Customer Support", 50000, "Visakhapatnam"],
  ["OF-1023", "Swati Patil", "Office Administrator", "Operations", 48000, "Warangal"],
  ["OF-1024", "Varun Chawla", "Logistics Coordinator", "Operations", 52000, "Hyderabad"],
  ["OF-1025", "Pooja Hegde", "Talent Acquisition Specialist", "Human Resources", 68000, "Hyderabad"],
  ["OF-1026", "Harish Nambiar", "HR Generalist", "Human Resources", 60000, "Hyderabad"],
  ["OF-1027", "Preeti Saxena", "Security Analyst", "Engineering", 110000, "Hyderabad"],
  ["OF-1028", "Girish Varma", "Database Administrator", "Engineering", 120000, "Hyderabad"],
  ["OF-1029", "Shreya Das", "Content & Brand Specialist", "Marketing", 65000, "Hyderabad"],
  ["OF-1030", "Akhil Pillai", "Growth Marketer", "Marketing", 85000, "Hyderabad"],
  ["OF-1031", "Ritika Roy", "QA Automation Engineer", "Engineering", 78000, "Warangal"],
  ["OF-1032", "Kiran Yadav", "QA Manual Tester", "Engineering", 55000, "Warangal"],
  ["OF-1033", "Deepika Rathi", "Associate Product Manager", "Product", 72000, "Hyderabad"],
  ["OF-1034", "Gaurav Malhotra", "Inside Sales Rep", "Sales", 58000, "Vijayawada"],
  ["OF-1035", "Pallavi Kulkarni", "Tier-2 Support Specialist", "Customer Support", 52000, "Visakhapatnam"],
  ["OF-1036", "Vishal Shinde", "Procurement Associate", "Operations", 46000, "Hyderabad"],
  ["OF-1037", "Anand Bakshi", "Legal & Compliance Counsel", "Executive", 165000, "Hyderabad"],
  ["OF-1038", "Sangeeta Nair", "Payroll Specialist", "Finance", 62000, "Hyderabad"],
  ["OF-1039", "Nitin Gadhavi", "Mobile App Engineer", "Engineering", 100000, "Hyderabad"],
  ["OF-1040", "Ritu Agrawal", "Scrum Master", "Engineering", 115000, "Hyderabad"],
  ["OF-1041", "Manish Pandey", "Field Support Technician", "Customer Support", 42000, "Visakhapatnam"],
  ["OF-1042", "Kavita Somani", "Sales Operations Lead", "Sales", 92000, "Vijayawada"],
  ["OF-1043", "Vijayalakshmi B", "Senior Network Engineer", "Engineering", 118000, "Hyderabad"],
  ["OF-1044", "Raghavendra S", "Systems Administrator", "Operations", 65000, "Warangal"],
  ["OF-1045", "Archana Murugan", "HR Operations Executive", "Human Resources", 48000, "Hyderabad"],
  ["OF-1046", "Rakesh Goud", "Corporate Treasury Executive", "Finance", 72000, "Hyderabad"],
  ["OF-1047", "Jyothi Prasad", "Senior BI Analyst", "Analytics", 98000, "Hyderabad"],
  ["OF-1048", "Kishore Chandra", "Data Engineer", "Engineering", 108000, "Hyderabad"],
];

const bankNames = ["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank", "Kotak Mahindra Bank"];

const employees = employeeNames.map(([id, name, designation, department, monthlyGross, branch], idx) => {
  const numId = parseInt(id.replace(/\D/g, "")) || 1000;
  const bankName = bankNames[idx % bankNames.length];
  const last4 = String(1000 + (numId % 9000));
  const accNo = `501004${String(numId).padStart(4, "0")}${last4}`;
  const ifsc =
    bankName === "HDFC Bank"
      ? "HDFC0001844"
      : bankName === "ICICI Bank"
      ? "ICIC0000047"
      : bankName === "State Bank of India"
      ? "SBIN0001234"
      : bankName === "Axis Bank"
      ? "UTIB0000123"
      : "KKBK0000456";

  const basic = Math.round(monthlyGross * 0.45);
  const hra = Math.round(basic * 0.5);
  const specialAllowance = monthlyGross - basic - hra;
  const professionalTax = 200;
  const tds = monthlyGross > 100000 ? Math.round(monthlyGross * 0.1) : 0;
  const slug = name.toLowerCase().replace(/[^a-z]/g, ".");

  return {
    employeeId: id,
    name,
    email: `${slug}@rendesk.example`,
    workEmail: `${slug}@rendesk.example`,
    personalEmail: `${slug}@gmail.example`,
    phone: `+91 98490 ${String(10000 + numId).slice(-5)}`,
    avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
    gender: idx % 3 === 0 ? "Female" : "Male",
    dateOfBirth: `199${(idx % 8) + 1}-0${(idx % 9) + 1}-15`,
    bloodGroup: ["O+", "A+", "B+", "AB+"][idx % 4],
    address: `${10 + idx}, Jubilee Hills Road No. ${(idx % 12) + 1}, ${branch}`,
    designation,
    department,
    branch,
    status: "Active",
    joiningDate: `202${(idx % 4) + 2}-0${(idx % 9) + 1}-10`,
    probationEndDate: `202${(idx % 4) + 2}-0${((idx + 6) % 9) + 1}-10`,
    noticePeriodDays: 30,
    reportingManagerId: idx === 0 ? undefined : "OF-1001",
    reportingManagerName: idx === 0 ? undefined : "Vikram Desai",
    emergencyContact: {
      name: `${name.split(" ")[0]} Contact`,
      relationship: idx % 2 === 0 ? "Spouse" : "Parent",
      phone: `+91 99480 ${String(20000 + numId).slice(-5)}`,
    },
    education: [
      {
        degree: "Bachelor of Technology (B.Tech)",
        institution: "JNTU Hyderabad / Osmania University",
        yearOfPassing: `201${(idx % 6) + 4}`,
        percentageOrCgpa: `${7 + (idx % 3)}.${idx % 9} CGPA`,
      },
    ],
    experience: [
      {
        companyName: "Prior Tech Solutions Pvt Ltd",
        designation: "Associate Software Engineer",
        fromDate: `201${(idx % 5) + 5}-06-01`,
        toDate: `202${(idx % 4) + 1}-12-31`,
        reasonForLeaving: "Career progression and growth",
      },
    ],
    salary: {
      annualCtc: monthlyGross * 12,
      monthlyGross,
      basic,
      hra,
      specialAllowance,
      professionalTax,
      epfDeduction: 0, // Zero PF Policy
      esiDeduction: 0, // Zero ESI Policy
      tds,
    },
    bankDetails: {
      accountNumber: accNo,
      ifscCode: ifsc,
      bankName,
      panNumber: `ABCDE${String(1000 + idx)}F`,
      aadhaarNumber: `4589 1234 ${String(5000 + idx)}`,
      bankLast4: last4,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});

await empColl.insertMany(employees);
console.log(`[2/9] Seeded ${employees.length} Complete Employee Profiles`);

// --------------------------------------------------------------------------
// 3. SEED LEAVE BALANCES & SAMPLE REQUESTS (Strictly 3 Types)
// --------------------------------------------------------------------------
const leaveBalColl = db.collection("leavebalances");
await leaveBalColl.deleteMany({});
const leaveReqColl = db.collection("leaverequests");
await leaveReqColl.deleteMany({});

const leaveBalances = employees.map((e) => ({
  employeeId: e.employeeId,
  year: 2026,
  casualLeave: { total: 12, used: 2, remaining: 10 },
  sickLeave: { total: 10, used: 1, remaining: 9 },
  compOff: { total: 2, used: 0, remaining: 2 },
}));
await leaveBalColl.insertMany(leaveBalances);

const sampleLeaves = [
  {
    employeeId: "OF-1011",
    employeeName: "Karthik Reddy",
    department: "Engineering",
    leaveType: "Casual Leave",
    startDate: "2026-10-26",
    endDate: "2026-10-27",
    daysCount: 2,
    isHalfDay: false,
    reason: "Personal family commitment",
    status: "Manager Approved",
    reviewedBy: "Rahul Verma",
    timeline: [
      { stage: "Submitted", actor: "Karthik Reddy", at: new Date("2026-10-22T08:00:00Z"), note: "Applied for 2 days" },
      { stage: "Manager Approved", actor: "Rahul Verma", at: new Date("2026-10-22T10:30:00Z"), note: "Approved" },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    employeeId: "OF-1003",
    employeeName: "Priya Nair",
    department: "Engineering",
    leaveType: "Sick Leave",
    startDate: "2026-10-24",
    endDate: "2026-10-24",
    daysCount: 1,
    isHalfDay: false,
    reason: "Doctor appointment and seasonal flu recovery",
    status: "HR Approved",
    reviewedBy: "Ananya Sharma",
    timeline: [
      { stage: "Submitted", actor: "Priya Nair", at: new Date("2026-10-23T07:30:00Z") },
      { stage: "HR Approved", actor: "Ananya Sharma", at: new Date("2026-10-23T09:15:00Z") },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    employeeId: "OF-1007",
    employeeName: "Imran Khan",
    department: "Sales",
    leaveType: "Comp-Off",
    startDate: "2026-10-28",
    endDate: "2026-10-28",
    daysCount: 1,
    isHalfDay: false,
    reason: "Weekend customer deployment support on Oct 11",
    status: "Submitted",
    timeline: [{ stage: "Submitted", actor: "Imran Khan", at: new Date("2026-10-24T11:00:00Z") }],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];
await leaveReqColl.insertMany(sampleLeaves);
console.log(`[3/9] Seeded ${leaveBalances.length} Leave Balances & Sample Requests (Strictly Casual, Sick, Comp-off)`);

// --------------------------------------------------------------------------
// 4. SEED PAYROLL RUNS & PAYSLIPS (5-Stage Model & Zero PF/ESI)
// --------------------------------------------------------------------------
const payRunColl = db.collection("payrollruns");
await payRunColl.deleteMany({});
const payslipColl = db.collection("payslips");
await payslipColl.deleteMany({});

const totalGrossSum = employees.reduce((s, e) => s + e.salary.monthlyGross, 0);
const totalPtTds = employees.reduce((s, e) => s + e.salary.professionalTax + e.salary.tds, 0);

const payrollRuns = [
  {
    runId: "PR-2026-08",
    period: "2026-08",
    status: "Payment Recorded",
    headcount: 45,
    totalGross: totalGrossSum - 350000,
    totalIncentives: 45000,
    totalMiscDeductions: 8000,
    totalLop: 12000,
    totalDeductions: totalPtTds + 20000,
    employerContributions: 0,
    totalNet: totalGrossSum - 350000 + 45000 - (totalPtTds + 20000),
    verifiedEmployeeIds: employees.slice(0, 45).map((e) => e.employeeId),
    approvedBy: "Vikram Desai",
    lockedBy: "Ananya Sharma",
    paymentDetails: {
      method: "Corporate NEFT Batch",
      reference: "NEFT-2026-08-44912",
      paidAt: new Date("2026-09-01T10:00:00Z"),
      notes: "Full salary disbursed via corporate NEFT. Zero PF/ESI.",
    },
    createdAt: new Date("2026-08-25"),
    updatedAt: new Date("2026-09-01"),
  },
  {
    runId: "PR-2026-09",
    period: "2026-09",
    status: "Payment Recorded",
    headcount: 46,
    totalGross: totalGrossSum - 200000,
    totalIncentives: 60000,
    totalMiscDeductions: 10000,
    totalLop: 15000,
    totalDeductions: totalPtTds + 25000,
    employerContributions: 0,
    totalNet: totalGrossSum - 200000 + 60000 - (totalPtTds + 25000),
    verifiedEmployeeIds: employees.slice(0, 46).map((e) => e.employeeId),
    approvedBy: "Vikram Desai",
    lockedBy: "Ananya Sharma",
    paymentDetails: {
      method: "Corporate NEFT Batch",
      reference: "NEFT-2026-09-88412",
      paidAt: new Date("2026-10-01T10:00:00Z"),
      notes: "Direct bank credit executed.",
    },
    createdAt: new Date("2026-09-25"),
    updatedAt: new Date("2026-10-01"),
  },
  {
    runId: "PR-2026-10",
    period: "2026-10",
    status: "Calculated",
    headcount: employees.length,
    totalGross: totalGrossSum,
    totalIncentives: 80000,
    totalMiscDeductions: 8700,
    totalLop: 14200,
    totalDeductions: totalPtTds + 22900,
    employerContributions: 0,
    totalNet: totalGrossSum + 80000 - (totalPtTds + 22900),
    verifiedEmployeeIds: employees.map((e) => e.employeeId),
    createdAt: new Date("2026-10-21"),
    updatedAt: new Date("2026-10-21"),
  },
];
await payRunColl.insertMany(payrollRuns);

// Sample individual payslips for October 2026
const payslips = employees.slice(0, 10).map((e) => {
  const p = e.salary;
  return {
    payrollRunId: "PR-2026-10",
    employeeId: e.employeeId,
    employeeName: e.name,
    designation: e.designation,
    department: e.department,
    period: "2026-10",
    workDays: 30,
    presentDays: 30,
    paidLeaves: 0,
    lopDays: 0,
    earnings: {
      basic: p.basic,
      hra: p.hra,
      specialAllowance: p.specialAllowance,
      incentives: e.employeeId === "OF-1011" ? 15000 : 0,
      gross: p.monthlyGross + (e.employeeId === "OF-1011" ? 15000 : 0),
    },
    deductions: {
      epf: 0, // Zero PF Policy
      esi: 0, // Zero ESI Policy
      professionalTax: p.professionalTax,
      tds: p.tds,
      lopAmount: 0,
      miscDeductions: 0,
      total: p.professionalTax + p.tds,
    },
    bankDetails: {
      bankName: e.bankDetails.bankName,
      accountNumber: e.bankDetails.accountNumber,
      ifscCode: e.bankDetails.ifscCode,
    },
    netSalary: p.monthlyGross + (e.employeeId === "OF-1011" ? 15000 : 0) - (p.professionalTax + p.tds),
    status: "Pending",
    createdAt: new Date(),
  };
});
await payslipColl.insertMany(payslips);
console.log(`[4/9] Seeded ${payrollRuns.length} Payroll Cycles & ${payslips.length} Sample Payslips (Zero PF & ESI)`);

// --------------------------------------------------------------------------
// 5. SEED ATTENDANCE RECORDS
// --------------------------------------------------------------------------
const attColl = db.collection("attendances");
await attColl.deleteMany({});

const todayStr = "2026-10-22";
const attendanceRecords = employees.map((e, i) => {
  const isLate = i % 7 === 0;
  const isAbsent = i === 14;
  const checkIn = isAbsent ? undefined : isLate ? "09:48" : `09:${String(10 + (i % 20)).padStart(2, "0")}`;
  const checkOut = isAbsent ? undefined : "18:15";

  return {
    employeeId: e.employeeId,
    employeeName: e.name,
    department: e.department,
    date: todayStr,
    checkIn,
    checkOut,
    totalHours: isAbsent ? 0 : 8.5,
    status: isAbsent ? "Absent" : isLate ? "Late" : "Present",
    confirmation: isAbsent ? "Disputed" : "Confirmed",
    deviceUsed: "DEV-01",
    branch: e.branch,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});
await attColl.insertMany(attendanceRecords);
console.log(`[5/9] Seeded ${attendanceRecords.length} Attendance Records for Today`);

// --------------------------------------------------------------------------
// 6. SEED BIOMETRIC DEVICES & HARDWARE MAPPINGS
// --------------------------------------------------------------------------
const devColl = db.collection("biometricdevices");
await devColl.deleteMany({});
const mapColl = db.collection("biometricmappings");
await mapColl.deleteMany({});

const devices = [
  { deviceId: "DEV-1", name: "HQ Main Entrance (Face+Finger)", location: "Hyderabad Reception", ipAddress: "192.168.1.101", status: "Online", lastSync: new Date(), branch: "Hyderabad" },
  { deviceId: "DEV-2", name: "HQ Engineering Bay", location: "Hyderabad Floor 3", ipAddress: "192.168.1.102", status: "Online", lastSync: new Date(), branch: "Hyderabad" },
  { deviceId: "DEV-3", name: "Warangal Tech Center", location: "Warangal Office Main", ipAddress: "192.168.2.101", status: "Online", lastSync: new Date(), branch: "Warangal" },
  { deviceId: "DEV-4", name: "Vijayawada Regional Office", location: "Vijayawada Hub", ipAddress: "192.168.3.101", status: "Online", lastSync: new Date(), branch: "Vijayawada" },
  { deviceId: "DEV-5", name: "Visakhapatnam Support Desk", location: "Vizag Facility", ipAddress: "192.168.4.101", status: "Online", lastSync: new Date(), branch: "Visakhapatnam" },
];
await devColl.insertMany(devices);

const mappings = employees.map((e, idx) => ({
  deviceId: devices[idx % devices.length].deviceId,
  biometricId: `BIO-${1000 + idx}`,
  employeeId: e.employeeId,
  employeeName: e.name,
  status: "Active",
  createdAt: new Date(),
}));
await mapColl.insertMany(mappings);
console.log(`[6/9] Seeded ${devices.length} Biometric Devices & ${mappings.length} Employee Hardware Mappings`);

// --------------------------------------------------------------------------
// 7. SEED ASSETS INVENTORY
// --------------------------------------------------------------------------
const assetColl = db.collection("assets");
await assetColl.deleteMany({});

const assets = [
  { assetId: "AST-001", assetTag: "AST-001", name: "MacBook Pro 14 M3", category: "Laptop", brandModel: "Apple M3 Pro", modelNumber: "Apple M3 Pro / 18GB / 512GB", serialNumber: "C02XK1YZLVDL", branch: "Hyderabad", status: "Assigned", assignedTo: "OF-1011", assignedEmployeeName: "Karthik Reddy", condition: "Excellent", purchaseDate: "2025-06-12", purchaseValue: 214900, purchaseCost: 214900, warrantyExpiry: "2027-06-12", warrantyExpiresAt: "2027-06-12" },
  { assetId: "AST-002", assetTag: "AST-002", name: "Dell Latitude 5440", category: "Laptop", brandModel: "Dell Latitude 5440", modelNumber: "Dell i7 13th Gen / 16GB", serialNumber: "DL5440-88213", branch: "Hyderabad", status: "Assigned", assignedTo: "OF-1002", assignedEmployeeName: "Rahul Verma", condition: "Good", purchaseDate: "2024-11-02", purchaseValue: 128000, purchaseCost: 128000, warrantyExpiry: "2026-11-02", warrantyExpiresAt: "2026-11-02" },
  { assetId: "AST-003", assetTag: "AST-003", name: "ThinkPad T14 Gen 4", category: "Laptop", brandModel: "Lenovo ThinkPad T14", modelNumber: "Lenovo i5 / 16GB", serialNumber: "LNV-T14-55201", branch: "Warangal", status: "Assigned", assignedTo: "OF-1004", assignedEmployeeName: "Suresh Babu", condition: "Good", purchaseDate: "2025-01-20", purchaseValue: 96000, purchaseCost: 96000, warrantyExpiry: "2027-01-20", warrantyExpiresAt: "2027-01-20" },
  { assetId: "AST-004", assetTag: "AST-004", name: "Dell UltraSharp 27 4K", category: "Monitor", brandModel: "Dell U2723QE", modelNumber: "Dell U2723QE", serialNumber: "DLU27-91102", branch: "Hyderabad", status: "Available", condition: "Good", purchaseDate: "2024-08-15", purchaseValue: 45000, purchaseCost: 45000, warrantyExpiry: "2026-08-15", warrantyExpiresAt: "2026-08-15" },
  { assetId: "AST-005", assetTag: "AST-005", name: "iPhone 15 128GB", category: "Phone", brandModel: "Apple iPhone 15", modelNumber: "Apple A16", serialNumber: "IP15-77342", branch: "Vijayawada", status: "Assigned", assignedTo: "OF-1007", assignedEmployeeName: "Imran Khan", condition: "Good", purchaseDate: "2025-03-10", purchaseValue: 79900, purchaseCost: 79900, warrantyExpiry: "2026-03-10", warrantyExpiresAt: "2026-03-10" },
];
await assetColl.insertMany(assets);
console.log(`[7/9] Seeded ${assets.length} Company Assets`);

// --------------------------------------------------------------------------
// 8. SEED DOCUMENTS & MAIL LOGS
// --------------------------------------------------------------------------
const docColl = db.collection("documents");
await docColl.deleteMany({});
const mailColl = db.collection("maillogs");
await mailColl.deleteMany({});

const documents = [
  { docId: "DOC-1", documentId: "DOC-1", title: "Offer Letter — Karthik Reddy", category: "Offer Letter", employeeId: "OF-1011", employeeName: "Karthik Reddy", fileUrl: "/docs/sample-offer.pdf", fileType: "PDF", fileSize: 184000, status: "Verified", verifiedBy: "Ananya Sharma", verifiedAt: new Date("2025-04-10") },
  { docId: "DOC-2", documentId: "DOC-2", title: "Appointment Letter — Karthik Reddy", category: "Appointment Letter", employeeId: "OF-1011", employeeName: "Karthik Reddy", fileUrl: "/docs/sample-appt.pdf", fileType: "PDF", fileSize: 201000, status: "Verified", verifiedBy: "Ananya Sharma", verifiedAt: new Date("2025-04-21") },
  { docId: "DOC-3", documentId: "DOC-3", title: "Aadhaar Card — Karthik Reddy", category: "Government ID", employeeId: "OF-1011", employeeName: "Karthik Reddy", fileUrl: "/docs/sample-aadhaar.pdf", fileType: "PDF", fileSize: 512000, status: "Verified", verifiedBy: "Ananya Sharma", verifiedAt: new Date("2025-04-19") },
];
await docColl.insertMany(documents);

const mailEntries = [
  { refNo: "IN-2026-0141", direction: "Incoming", channel: "Physical Courier", sender: "Income Tax Department", recipient: "Finance", subject: "TDS Return Q2 Acknowledgment", department: "Finance", ownerId: "OF-1006", ownerName: "Deepak Rao", status: "Action Pending", priority: "High", timeline: [{ at: new Date("2026-10-21"), event: "Received and registered", by: "Arun Kumar" }] },
  { refNo: "OUT-2026-0089", direction: "Outgoing", channel: "Email", sender: "HR", recipient: "All Employees", subject: "Diwali Corporate Holiday Schedule", department: "Human Resources", ownerId: "OF-1010", ownerName: "Ananya Sharma", status: "Closed", priority: "Normal", timeline: [{ at: new Date("2026-10-20"), event: "Dispatched via email", by: "Ananya Sharma" }] },
  { refNo: "IN-2026-0140", direction: "Incoming", channel: "Physical Courier", sender: "HDFC Bank Corporate Banking", recipient: "Finance", subject: "Monthly Current Account Physical Audit Certificate", department: "Finance", ownerId: "OF-1006", ownerName: "Deepak Rao", status: "Closed", priority: "Normal", timeline: [{ at: new Date("2026-10-18"), event: "Received and archived", by: "Arun Kumar" }] },
];
await mailColl.insertMany(mailEntries);
console.log(`[8/9] Seeded ${documents.length} Verified Documents & ${mailEntries.length} Mail Logs`);

// --------------------------------------------------------------------------
// 9. SEED AUDIT LOGS & NOTIFICATIONS
// --------------------------------------------------------------------------
const auditColl = db.collection("auditlogs");
await auditColl.deleteMany({});
const notifColl = db.collection("notifications");
await notifColl.deleteMany({});

const auditLogs = [
  { auditId: "AU-1", timestamp: new Date("2026-10-22T08:30:00Z"), user: "Karthik Reddy", userId: "OF-1011", action: "Submitted attendance correction", module: "Attendance", record: "AR Oct 20 — OF-1011", outcome: "Success", details: "Requested 09:30-18:25" },
  { auditId: "AU-2", timestamp: new Date("2026-10-21T18:00:00Z"), user: "Ananya Sharma", userId: "OF-1010", action: "Calculated October payroll", module: "Payroll", record: "PR-2026-10", outcome: "Success", details: "48 employees included with Zero PF/ESI" },
  { auditId: "AU-3", timestamp: new Date("2026-10-20T10:00:00Z"), user: "Ananya Sharma", userId: "OF-1010", action: "Published Diwali circular", module: "Notifications", record: "AN-1 Diwali holidays", outcome: "Success" },
  { auditId: "AU-4", timestamp: new Date("2026-10-18T15:20:00Z"), user: "Rahul Verma", userId: "OF-1002", action: "Approved casual leave", module: "Leave", record: "LV-1 Karthik Reddy", outcome: "Success" },
];
await auditColl.insertMany(auditLogs);

const notifications = [
  { id: "N-1", title: "Leave request awaiting your approval", message: "Karthik Reddy applied for Casual Leave (Oct 26-27).", description: "Karthik Reddy applied for Casual Leave (Oct 26-27).", category: "Approvals", timestamp: "2026-10-22 09:12", read: false, priority: "High", link: "/leave", type: "info" },
  { id: "N-2", title: "Attendance correction submitted", message: "Karthik Reddy requested a correction for Oct 20.", description: "Karthik Reddy requested a correction for Oct 20.", category: "Attendance", timestamp: "2026-10-22 08:30", read: false, priority: "Normal", link: "/attendance?tab=corrections", type: "info" },
  { id: "N-3", title: "October payroll ready for review", message: "Payroll run for Oct 2026 has been calculated.", description: "Payroll run for Oct 2026 has been calculated.", category: "Payroll", timestamp: "2026-10-21 18:00", read: true, priority: "Normal", link: "/payroll", type: "info" },
];
await notifColl.insertMany(notifications);
console.log(`[9/9] Seeded ${auditLogs.length} Immutable Audit Logs & Notifications`);

console.log("\n========================================================");
console.log("🎉 RENDESK MONGODB ATLAS SEED COMPLETED SUCCESSFULLY!");
console.log("Database: rendesk");
console.log("Cluster: cluster0.5ghmukt.mongodb.net");
console.log("========================================================\n");

await mongoose.disconnect();
process.exit(0);
