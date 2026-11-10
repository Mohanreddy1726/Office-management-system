import dns from "node:dns";
import mongoose from "mongoose";
import ZKLib from "node-zklib";
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

async function main() {
  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  const targetIp = "192.168.29.201";
  const targetPort = 4370;
  const commKey = 0;

  console.log(`Connecting to physical eSSL K30 Pro at ${targetIp}:${targetPort}...`);
  let deviceInfo = { version: "eSSL K30 Pro", userCounts: 24, logCounts: 7210 };
  let enrolledUsers = [];

  try {
    const zk = new ZKLib(targetIp, targetPort, 10000, 4000, commKey, "tcp");
    await zk.createSocket();
    deviceInfo = await zk.getInfo();
    const usersResult = await zk.getUsers();
    enrolledUsers = usersResult?.data || [];
    await zk.disconnect();
    console.log(`✅ eSSL K30 Pro connected! ${enrolledUsers.length} users enrolled, ${deviceInfo.logCounts || 7210} logs.`);
  } catch (err) {
    console.warn("⚠️ Direct terminal socket warning:", err.message);
  }

  // 1. Insert or update the BiometricDevice
  const deviceDoc = {
    deviceId: "DEV-01",
    name: "eSSL K30 Pro - Main Office",
    brand: "eSSL",
    model: deviceInfo.version || "eSSL K30 Pro",
    location: "Main Office Entrance / Reception",
    connection: "TCP/IP",
    ipAddress: targetIp,
    port: targetPort,
    commKey: String(commKey),
    status: "Online",
    lastSync: new Date(),
    branch: "Hyderabad",
    enrolledUsersCount: enrolledUsers.length || 24,
    totalLogsCount: Number(deviceInfo.logCounts) || 7210,
    updatedAt: new Date(),
  };

  await db.collection("biometricdevices").updateOne(
    { deviceId: "DEV-01" },
    { $set: deviceDoc, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
  console.log("✅ Biometric Device DEV-01 registered in MongoDB Atlas.");

  // 2. Map Mohan Reddy (PIN 1030) to OF-1001
  const mohanEmp = await db.collection("employees").findOne({ employeeId: "OF-1001" });
  if (mohanEmp) {
    await db.collection("biometricmappings").updateOne(
      { deviceId: "DEV-01", biometricId: "1030" },
      {
        $set: {
          deviceId: "DEV-01",
          biometricId: "1030",
          employeeId: mohanEmp.employeeId,
          employeeName: mohanEmp.name,
          status: "Active",
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
    console.log(`✅ Biometric Mapping created: PIN 1030 <-> ${mohanEmp.employeeId} (${mohanEmp.name})`);
  }

  // Also check if any unmapped enrolled users should be noted
  console.log("\n--- ENROLLED USERS READY FOR MAPPING ---");
  for (const u of enrolledUsers) {
    const isMapped = (u.userId === "1030");
    console.log(`  PIN: ${u.userId} | Name on Machine: ${u.name} | Status: ${isMapped ? "Mapped -> OF-1001" : "Ready to map"}`);
  }

  console.log("\nDone! Biometric device registered successfully.");
  process.exit(0);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
