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

export async function syncBiometricAttendance() {
  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  const targetIp = "192.168.29.201";
  const targetPort = 4370;

  console.log(`Connecting to physical eSSL K30 Pro at ${targetIp}:${targetPort}...`);
  const zk = new ZKLib(targetIp, targetPort, 10000, 4000, 0, "tcp");
  await zk.createSocket();
  const logsRes = await zk.getAttendances();
  const usersRes = await zk.getUsers().catch(() => ({ data: [] }));
  await zk.disconnect();

  const userMap = Object.fromEntries((usersRes.data || []).map(u => [String(u.userId), u.name]));
  const punches = logsRes.data || [];
  console.log(`Retrieved ${punches.length} total punch records from machine.`);

  // Load all mappings from DB
  const mappings = await db.collection("biometricmappings").find({ status: "Active" }).toArray();
  const pinToMapping = new Map(mappings.map(m => [String(m.biometricId), m]));
  console.log(`Loaded ${mappings.length} active mappings from MongoDB:`, mappings.map(m => `${m.biometricId} -> ${m.employeeId} (${m.employeeName})`));

  // Load all employees from DB for department & branch metadata
  const employees = await db.collection("employees").find({}).toArray();
  const empMap = new Map(employees.map(e => [e.employeeId, e]));

  // Group punches by Date and PIN
  // key: "YYYY-MM-DD_PIN" -> { date, pin, times: [Date] }
  const groups = new Map();

  for (const log of punches) {
    const d = new Date(log.recordTime);
    // Convert to IST
    const istStr = d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const istDate = new Date(istStr);
    const y = istDate.getFullYear();
    const m = String(istDate.getMonth() + 1).padStart(2, "0");
    const day = String(istDate.getDate()).padStart(2, "0");
    const dateKey = `${y}-${m}-${day}`;
    const pin = String(log.deviceUserId);

    const groupKey = `${dateKey}_${pin}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        date: dateKey,
        pin,
        punches: [],
      });
    }
    groups.get(groupKey).punches.push(istDate);
  }

  let mappedCount = 0;
  let unmappedCount = 0;

  for (const item of groups.values()) {
    item.punches.sort((a, b) => a.getTime() - b.getTime());
    const first = item.punches[0];
    const last = item.punches[item.punches.length - 1];

    const checkInTime = first.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const checkOutTime = item.punches.length > 1
      ? last.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
      : undefined;

    let totalHours = 0;
    if (checkOutTime && item.punches.length > 1) {
      const diffMs = last.getTime() - first.getTime();
      totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
    }

    // Status: Check-in after 09:30 AM is considered Late
    const firstMinutes = first.getHours() * 60 + first.getMinutes();
    const isLate = firstMinutes > (9 * 60 + 30);
    const status = isLate ? "Late" : "Present";

    const mapping = pinToMapping.get(item.pin);

    if (mapping) {
      const emp = empMap.get(mapping.employeeId);
      const attDoc = {
        employeeId: mapping.employeeId,
        employeeName: mapping.employeeName || emp?.name || "Employee",
        department: emp?.department || "Operations",
        branch: emp?.branch || "Hyderabad",
        date: item.date,
        checkIn: checkInTime,
        checkOut: checkOutTime,
        totalHours,
        status,
        confirmation: "Confirmed",
        deviceUsed: "eSSL K30 Pro - Main Office",
        updatedAt: new Date(),
      };

      await db.collection("attendances").updateOne(
        { employeeId: mapping.employeeId, date: item.date },
        {
          $set: attDoc,
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );
      mappedCount++;

      if (item.date === "2026-11-09") {
        console.log(`🎯 Mapped TODAY's Attendance: ${mapping.employeeName} (${mapping.employeeId}) | In: ${checkInTime} | Status: ${status}`);
      }
    } else {
      // Store into unmapped punches
      await db.collection("unmappedpunches").updateOne(
        { deviceId: "DEV-01", biometricId: item.pin, punchTime: first },
        {
          $set: {
            deviceId: "DEV-01",
            biometricId: item.pin,
            punchTime: first,
            punchType: item.punches.length > 1 ? "CheckIn" : "Unknown",
            resolved: false,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
      );
      unmappedCount++;
    }
  }

  // Update BiometricDevice record with latest sync stats
  await db.collection("biometricdevices").updateOne(
    { deviceId: "DEV-01" },
    {
      $set: {
        status: "Online",
        lastSync: new Date(),
        totalLogsCount: punches.length,
      }
    }
  );

  console.log(`\n✅ Ingestion Complete!`);
  console.log(`   - Mapped Attendances created: ${mappedCount}`);
  console.log(`   - Unmapped Punches recorded: ${unmappedCount}`);
}

syncBiometricAttendance()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Ingestion failed:", err);
    process.exit(1);
  });
