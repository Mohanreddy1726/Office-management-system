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
let superAdminEmail = "superadmin@gvkedutech.com";
let superAdminPassword = "Gvkedutech@123";

try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("MONGODB_URI=")) {
        mongoUri = trimmed.replace("MONGODB_URI=", "").trim();
      } else if (trimmed.startsWith("SUPERADMIN_EMAIL=")) {
        superAdminEmail = trimmed.replace("SUPERADMIN_EMAIL=", "").trim();
      } else if (trimmed.startsWith("SUPERADMIN_PASSWORD=")) {
        superAdminPassword = trimmed.replace("SUPERADMIN_PASSWORD=", "").trim();
      }
    }
  }
} catch (err) {
  // Use defaults
}

console.log("Connecting to MongoDB Atlas...");
await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
console.log("Connected successfully to DB:", mongoose.connection.name);

const db = mongoose.connection.db;

// 1. Remove all old demo users
const usersColl = db.collection("users");
const oldUsersResult = await usersColl.deleteMany({ email: { $ne: superAdminEmail.toLowerCase() } });
console.log(`[1] Cleared ${oldUsersResult.deletedCount} old/demo user accounts.`);

// 2. Remove all demo employees (user will add real employees from website)
const empColl = db.collection("employees");
const delEmpsResult = await empColl.deleteMany({});
console.log(`[2] Cleared ${delEmpsResult.deletedCount} old demo employee profiles.`);

// 3. Clear leave balances for old employees
const leaveBalColl = db.collection("leavebalances");
const delBalResult = await leaveBalColl.deleteMany({});
console.log(`[3] Cleared ${delBalResult.deletedCount} old leave balance records.`);

// 4. Create or update Super Admin user
const passwordHash = await bcrypt.hash(superAdminPassword, 10);
const now = new Date();

const superAdminDoc = {
  email: superAdminEmail.toLowerCase(),
  passwordHash,
  name: "Super Admin",
  role: "super_admin",
  employeeId: "ADM-001",
  branch: "Headquarters",
  isActive: true,
  createdAt: now,
  updatedAt: now,
};

await usersColl.updateOne(
  { email: superAdminEmail.toLowerCase() },
  { $set: superAdminDoc },
  { upsert: true }
);

console.log(`[4] Successfully created / verified Super Admin account:`);
console.log(`    - Email: ${superAdminEmail}`);
console.log(`    - Password: ${superAdminPassword}`);
console.log(`    - Role: super_admin`);
console.log(`    - Status: Active`);

const allUsers = await usersColl.find({}).toArray();
console.log(`\nCurrent Users in MongoDB (${allUsers.length}):`);
allUsers.forEach((u) => {
  console.log(`  - ${u.name} | ${u.email} | Role: ${u.role} | Active: ${u.isActive}`);
});

await mongoose.disconnect();
console.log("Done.");
process.exit(0);
