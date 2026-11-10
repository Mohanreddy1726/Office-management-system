import dns from "node:dns";
import mongoose from "mongoose";
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

console.log("Connecting to MongoDB Atlas at:", mongoUri.split("@").pop());
await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
console.log("Connected successfully to DB:", mongoose.connection.name);

const db = mongoose.connection.db;

const coreEmployeeIds = ["OF-1001", "OF-1010", "OF-1002", "OF-1011"];
const coreEmails = [
  "vikram.desai@rendesk.example",
  "ananya.sharma@rendesk.example",
  "rahul.verma@rendesk.example",
  "karthik.reddy@rendesk.example",
];

console.log("\n--- CLEARING DEMO DATA FROM ATLAS (KEEPING ONLY USERS) ---");

// 1. Users: Keep ONLY the 4 core users
const usersColl = db.collection("users");
const delUsers = await usersColl.deleteMany({ email: { $nin: coreEmails } });
const remainingUsers = await usersColl.find({}).toArray();
console.log(`[1] Users: Kept ${remainingUsers.length} accounts, removed ${delUsers.deletedCount} extra users.`);

// 2. Employees: Keep ONLY the 4 user employee profiles
const empColl = db.collection("employees");
const delEmps = await empColl.deleteMany({ employeeId: { $nin: coreEmployeeIds } });
const remainingEmps = await empColl.find({}).toArray();
console.log(`[2] Employees: Kept ${remainingEmps.length} core user profiles (OF-1001, OF-1010, OF-1002, OF-1011), removed ${delEmps.deletedCount} demo employees.`);

// 3. Leave Balances: Keep balances for the 4 users (reset used to 0) & remove all demo leave requests
const leaveBalColl = db.collection("leavebalances");
await leaveBalColl.deleteMany({ employeeId: { $nin: coreEmployeeIds } });
await leaveBalColl.updateMany(
  {},
  {
    $set: {
      "casualLeave.used": 0,
      "casualLeave.remaining": 12,
      "sickLeave.used": 0,
      "sickLeave.remaining": 10,
      "compOff.used": 0,
      "compOff.remaining": 2,
    },
  }
);
const remainingBalances = await leaveBalColl.find({}).toArray();
console.log(`[3] Leave Balances: Kept ${remainingBalances.length} user balances (reset to 0 used).`);

const leaveReqColl = db.collection("leaverequests");
const delReqs = await leaveReqColl.deleteMany({});
console.log(`[4] Leave Requests: Cleared all ${delReqs.deletedCount} demo leave requests.`);

// 4. Payroll: Clear all demo payroll runs & payslips
const payRunColl = db.collection("payrollruns");
const delRuns = await payRunColl.deleteMany({});
const payslipColl = db.collection("payslips");
const delSlips = await payslipColl.deleteMany({});
console.log(`[5] Payroll: Cleared all ${delRuns.deletedCount} demo payroll runs and ${delSlips.deletedCount} demo payslips.`);

// 5. Attendance: Clear all demo attendance records
const attColl = db.collection("attendances");
const delAtt = await attColl.deleteMany({});
console.log(`[6] Attendance: Cleared all ${delAtt.deletedCount} demo attendance records.`);

// 6. Biometrics: Clear demo devices and mappings
const devColl = db.collection("biometricdevices");
const delDev = await devColl.deleteMany({});
const mapColl = db.collection("biometricmappings");
const delMap = await mapColl.deleteMany({});
console.log(`[7] Biometrics: Cleared ${delDev.deletedCount} devices and ${delMap.deletedCount} mappings.`);

// 7. Assets: Clear demo IT assets
const assetColl = db.collection("assets");
const delAst = await assetColl.deleteMany({});
console.log(`[8] Assets: Cleared all ${delAst.deletedCount} demo company assets.`);

// 8. Documents & Mail: Clear demo documents and mail
const docColl = db.collection("documents");
const delDoc = await docColl.deleteMany({});
const mailColl = db.collection("maillogs");
const delMail = await mailColl.deleteMany({});
console.log(`[9] Documents & Mail: Cleared ${delDoc.deletedCount} demo documents and ${delMail.deletedCount} mail entries.`);

// 9. Audit Logs & Notifications: Clear demo audit events and notifications
const auditColl = db.collection("auditlogs");
const delAud = await auditColl.deleteMany({});
const notifColl = db.collection("notifications");
const delNotif = await notifColl.deleteMany({});
console.log(`[10] Audit & Notifications: Cleared ${delAud.deletedCount} audit logs and ${delNotif.deletedCount} notifications.`);

console.log("\n========================================================");
console.log("🎉 ALL DEMO DATA REMOVED FROM MONGODB ATLAS SUCCESSFULLY!");
console.log("Remaining in database: Only the 4 User Accounts & Profiles.");
console.log("========================================================\n");

await mongoose.disconnect();
process.exit(0);
