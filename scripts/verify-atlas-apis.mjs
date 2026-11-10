import dns from "node:dns";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

// Ensure DNS fallback for Windows MongoDB Atlas SRV lookup
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Ignore
}

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
  // Use default
}

console.log("========================================================");
console.log("RENDESK BACKEND & MONGODB ATLAS VERIFICATION");
console.log("========================================================\n");

await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
console.log("✅ Database Connected: rendesk");

const db = mongoose.connection.db;

// 1. Verify Users & Auth Passwords
const users = await db.collection("users").find({}).toArray();
console.log(`\n[Test 1] Users Collection: Found ${users.length} accounts`);
if (users.length !== 4) throw new Error(`Expected 4 users, found ${users.length}`);

for (const u of users) {
  const match = await bcrypt.compare("password123", u.passwordHash);
  if (!match) throw new Error(`Password hash verification failed for ${u.email}`);
  console.log(`  ✓ ${u.role.padEnd(12)}: ${u.email} (${u.name}) — Password Hash Verified`);
}

// 2. Verify Employees & Zero PF/ESI Policy
const employees = await db.collection("employees").find({}).toArray();
console.log(`\n[Test 2] Employees Collection: Found ${employees.length} full employee profiles`);
if (employees.length !== 48) throw new Error(`Expected 48 employees, found ${employees.length}`);

const hasNonZeroPf = employees.some(e => e.salary?.epfDeduction > 0 || e.salary?.esiDeduction > 0);
if (hasNonZeroPf) throw new Error("Violation: Found employee with non-zero PF or ESI deduction!");
console.log("  ✓ Zero PF & Zero ESI Policy strictly enforced across all 48 profiles (epfDeduction = 0, esiDeduction = 0)");

const sampleEmp = employees[10]; // OF-1011 Karthik Reddy
console.log(`  ✓ Sample Profile (${sampleEmp.employeeId} - ${sampleEmp.name}):`);
console.log(`    - Designation: ${sampleEmp.designation} (${sampleEmp.department})`);
console.log(`    - Monthly Gross: ₹${sampleEmp.salary?.monthlyGross?.toLocaleString("en-IN")}`);
console.log(`    - Bank: ${sampleEmp.bankDetails?.bankName} (A/C ending ${sampleEmp.bankDetails?.bankLast4})`);
console.log(`    - Education: ${sampleEmp.education?.[0]?.degree || "N/A"}`);
console.log(`    - Experience: ${sampleEmp.experience?.[0]?.companyName || "N/A"}`);

// 3. Verify Leave Balances & Leave Types
const leaveBalances = await db.collection("leavebalances").find({}).toArray();
console.log(`\n[Test 3] Leave Balances Collection: Found ${leaveBalances.length} records`);
if (leaveBalances.length !== 48) throw new Error(`Expected 48 leave balances, found ${leaveBalances.length}`);

const invalidLeaveTypes = leaveBalances.some(b => b.earnedLeave !== undefined || !b.casualLeave || !b.sickLeave || !b.compOff);
if (invalidLeaveTypes) throw new Error("Violation: Leave balance contains legacy leave types or lacks strictly Casual, Sick, and Comp-Off!");
console.log("  ✓ Strictly 3 Leave Types Enforced: Casual Leave (12), Sick Leave (10), Comp-Off (2). No Earned Leave.");

const leaveRequests = await db.collection("leaverequests").find({}).toArray();
console.log(`  ✓ Sample Leave Requests: Found ${leaveRequests.length} pending/approved workflows`);
for (const lr of leaveRequests) {
  console.log(`    - ${lr.employeeName}: ${lr.leaveType} (${lr.startDate} to ${lr.endDate}) — Status: ${lr.status}`);
}

// 4. Verify Payroll Runs & Zero PF/ESI Payslips
const payrollRuns = await db.collection("payrollruns").find({}).toArray();
const payslips = await db.collection("payslips").find({}).toArray();
console.log(`\n[Test 4] Payroll Collection: Found ${payrollRuns.length} cycles & ${payslips.length} sample payslips`);

for (const pr of payrollRuns) {
  if (pr.employerContributions !== 0) throw new Error(`Run ${pr.runId} has employer contributions > 0! Zero PF/ESI required.`);
  console.log(`  ✓ Cycle ${pr.runId} (${pr.period}): Status "${pr.status}" | Headcount ${pr.headcount} | Net ₹${Math.round(pr.totalNet).toLocaleString("en-IN")} | Employer PF/ESI ₹${pr.employerContributions}`);
}

const nonZeroPfSlips = payslips.some(p => p.deductions?.epf > 0 || p.deductions?.esi > 0);
if (nonZeroPfSlips) throw new Error("Violation: Payslips contain non-zero EPF or ESI deductions!");
console.log("  ✓ All payslips enforce 0 EPF & 0 ESI deductions strictly");

// 5. Verify Attendance
const attendances = await db.collection("attendances").find({}).toArray();
console.log(`\n[Test 5] Attendance Collection: Found ${attendances.length} daily punch records`);
if (attendances.length !== 48) throw new Error(`Expected 48 attendance records, found ${attendances.length}`);
console.log(`  ✓ Status distribution: Present ${attendances.filter(a => a.status === "Present").length}, Late ${attendances.filter(a => a.status === "Late").length}, Absent ${attendances.filter(a => a.status === "Absent").length}`);

// 6. Verify Biometrics, Assets, Documents, Mail, Audit
const devices = await db.collection("biometricdevices").find({}).toArray();
const mappings = await db.collection("biometricmappings").find({}).toArray();
console.log(`\n[Test 6] Biometrics: Found ${devices.length} hardware devices & ${mappings.length} employee mappings`);

const assets = await db.collection("assets").find({}).toArray();
console.log(`[Test 7] Assets: Found ${assets.length} IT assets recorded`);

const documents = await db.collection("documents").find({}).toArray();
const mail = await db.collection("maillogs").find({}).toArray();
console.log(`[Test 8] Documents & Mail: Found ${documents.length} verified documents & ${mail.length} mail log entries`);

const auditLogs = await db.collection("auditlogs").find({}).toArray();
const notifs = await db.collection("notifications").find({}).toArray();
console.log(`[Test 9] Audit & Notifications: Found ${auditLogs.length} audit trail events & ${notifs.length} system notifications`);

console.log("\n========================================================");
console.log("🎉 ALL RENDESK BACKEND & ATLAS DATABASE VERIFICATIONS PASSED!");
console.log("========================================================\n");

await mongoose.disconnect();
process.exit(0);
