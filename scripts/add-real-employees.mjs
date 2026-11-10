import dns from "node:dns";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {}

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
} catch {}

console.log("Connecting to MongoDB Atlas...");
await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
const db = mongoose.connection.db;

const defaultPassword = "password123";
const passwordHash = await bcrypt.hash(defaultPassword, 10);

export const realStaffList = [
  { pin: "1000", name: "Dr. G. Vinod Kumar", role: "super_admin", designation: "Medical Director & Head", department: "Executive", monthlyGross: 250000, branch: "Headquarters" },
  { pin: "1001", name: "Dr. Ashok Ande", role: "manager", designation: "Chief Medical Consultant", department: "Medical Services", monthlyGross: 220000, branch: "Headquarters" },
  { pin: "1002", name: "Reena", role: "employee", designation: "Clinical Coordinator", department: "Operations", monthlyGross: 45000, branch: "Headquarters" },
  { pin: "1003", name: "Ch. Padma", role: "employee", designation: "Senior Staff Nurse", department: "Clinical Care", monthlyGross: 42000, branch: "Headquarters" },
  { pin: "1005", name: "Ch. Rakesh", role: "hr_admin", designation: "Head of Operations & Administration", department: "Operations", monthlyGross: 120000, branch: "Headquarters" },
  { pin: "1006", name: "Regula Shiva", role: "employee", designation: "Administrative Executive", department: "Administration", monthlyGross: 38000, branch: "Headquarters" },
  { pin: "1007", name: "N Vandana", role: "employee", designation: "Front Office Executive", department: "Customer Relations", monthlyGross: 35000, branch: "Headquarters" },
  { pin: "1016", name: "Gunti HariKrishna", role: "employee", designation: "Operations Associate", department: "Operations", monthlyGross: 36000, branch: "Headquarters" },
  { pin: "1017", name: "Balastu Vasu", role: "employee", designation: "Pharmacy In-charge", department: "Pharmacy", monthlyGross: 40000, branch: "Headquarters" },
  { pin: "1018", name: "Dr. GVK 1", role: "employee", designation: "Consultant Physician", department: "Medical Services", monthlyGross: 180000, branch: "Headquarters" },
  { pin: "1019", name: "Meenakshi", role: "employee", designation: "Support Executive", department: "Customer Support", monthlyGross: 32000, branch: "Headquarters" },
  { pin: "1020", name: "Konna Yellagoud", role: "employee", designation: "Facilities Supervisor", department: "Facilities", monthlyGross: 34000, branch: "Headquarters" },
  { pin: "1021", name: "Subba Reddy", role: "employee", designation: "Accounts Executive", department: "Finance", monthlyGross: 55000, branch: "Headquarters" },
  { pin: "1027", name: "Hanok Srikar", role: "employee", designation: "Technical Assistant", department: "Operations", monthlyGross: 35000, branch: "Headquarters" },
  { pin: "1028", name: "Eruguralla Siddhartha", role: "employee", designation: "Operations Executive", department: "Operations", monthlyGross: 38000, branch: "Headquarters" },
  { pin: "1029", name: "Madunala Lavanya", role: "employee", designation: "Quality & Patient Care Associate", department: "Clinical Care", monthlyGross: 40000, branch: "Headquarters" },
  { pin: "1030", name: "Mohan Reddy", role: "super_admin", designation: "System Administrator & Tech Lead", department: "Executive", monthlyGross: 150000, branch: "Headquarters" },
  { pin: "1031", name: "Saggam Sunitha", role: "employee", designation: "Senior Care Specialist", department: "Clinical Care", monthlyGross: 42000, branch: "Headquarters" },
  { pin: "1032", name: "Sadha Laxmi", role: "employee", designation: "Healthcare Associate", department: "Clinical Care", monthlyGross: 38000, branch: "Headquarters" },
  { pin: "1033", name: "Mahesh Babu", role: "employee", designation: "Logistics Coordinator", department: "Operations", monthlyGross: 35000, branch: "Headquarters" },
  { pin: "1034", name: "Eruguralla Shivam", role: "employee", designation: "Inventory Associate", department: "Pharmacy", monthlyGross: 34000, branch: "Headquarters" },
  { pin: "1035", name: "Gunti Kavitha", role: "employee", designation: "Operations Assistant", department: "Operations", monthlyGross: 33000, branch: "Headquarters" },
  { pin: "1036", name: "M Chandrika", role: "employee", designation: "Patient Care Coordinator", department: "Customer Relations", monthlyGross: 36000, branch: "Headquarters" },
  { pin: "1037", name: "Chandu", role: "employee", designation: "Support Assistant", department: "Customer Support", monthlyGross: 30000, branch: "Headquarters" },
];

const empColl = db.collection("employees");
await empColl.deleteMany({});

const leaveBalColl = db.collection("leavebalances");
await leaveBalColl.deleteMany({});

const usersColl = db.collection("users");
await usersColl.deleteMany({});

const employeesToInsert = [];
const leaveBalancesToInsert = [];
const usersToInsert = [];

for (const s of realStaffList) {
  const empId = `OF-${s.pin}`;
  const slug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, ".");
  const email = `${slug}@rendesk.example`;
  const basic = Math.round(s.monthlyGross * 0.45);
  const hra = Math.round(basic * 0.5);
  const specialAllowance = s.monthlyGross - basic - hra;

  employeesToInsert.push({
    employeeId: empId,
    name: s.name,
    email,
    workEmail: email,
    personalEmail: `${slug}@gmail.example`,
    phone: `+91 98490 ${String(10000 + parseInt(s.pin)).slice(-5)}`,
    avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(s.name)}`,
    designation: s.designation,
    department: s.department,
    branch: s.branch,
    status: "Active",
    joiningDate: "2024-01-01",
    salary: {
      annualCtc: s.monthlyGross * 12,
      monthlyGross: s.monthlyGross,
      basic,
      hra,
      specialAllowance,
      professionalTax: 200,
      epfDeduction: 0, // Zero PF Policy
      esiDeduction: 0, // Zero ESI Policy
      tds: s.monthlyGross > 100000 ? Math.round(s.monthlyGross * 0.1) : 0,
    },
    bankDetails: {
      accountNumber: `501004${s.pin}${s.pin}`,
      ifscCode: "HDFC0001844",
      bankName: "HDFC Bank",
      bankLast4: s.pin.slice(-4),
    },
    biometricPin: s.pin,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  leaveBalancesToInsert.push({
    employeeId: empId,
    year: 2026,
    casualLeave: { total: 12, used: 0, remaining: 12 },
    sickLeave: { total: 10, used: 0, remaining: 10 },
    compOff: { total: 2, used: 0, remaining: 2 },
  });

  // Create User Accounts for Admin/Super Admin/HR
  if (s.role === "super_admin" || s.role === "hr_admin" || s.pin === "1030" || s.pin === "1000" || s.pin === "1005" || s.pin === "1001") {
    usersToInsert.push({
      email,
      passwordHash,
      name: s.name,
      role: s.role,
      employeeId: empId,
      branch: s.branch,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

await empColl.insertMany(employeesToInsert);
console.log(`✅ [1/3] Seeded ${employeesToInsert.length} Real Employees into MongoDB Atlas!`);

await leaveBalColl.insertMany(leaveBalancesToInsert);
console.log(`✅ [2/3] Seeded ${leaveBalancesToInsert.length} Leave Balances (Zero PF/ESI)!`);

await usersColl.insertMany(usersToInsert);
console.log(`✅ [3/3] Created ${usersToInsert.length} Login Accounts in Atlas (including Mohan Reddy & Dr. Vinod Kumar)!`);

await mongoose.disconnect();
console.log("\nFinished successfully!");
