import ZKLib from "node-zklib";
import mongoose from "mongoose";
import dns from "node:dns";
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

const INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

async function resolveSrvUriWithPublicDns(srvUri) {
  if (!srvUri.startsWith("mongodb+srv://")) return null;
  const parsed = new URL(srvUri);
  const resolver = new dns.Resolver();
  resolver.setServers(["8.8.8.8", "1.1.1.1"]);
  const srvRecords = await new Promise((resolve, reject) =>
    resolver.resolveSrv(`_mongodb._tcp.${parsed.hostname}`, (err, recs) => (err ? reject(err) : resolve(recs)))
  );
  const txtChunks = await new Promise((resolve) =>
    resolver.resolveTxt(parsed.hostname, (err, recs) => (err ? resolve([]) : resolve(recs)))
  );
  const hosts = srvRecords.map((r) => `${r.name}:${r.port}`).join(",");
  const params = new URLSearchParams(parsed.searchParams.toString());
  for (const chunk of txtChunks) {
    new URLSearchParams(chunk.join("")).forEach((v, k) => {
      if (!params.has(k)) params.set(k, v);
    });
  }
  if (!params.has("tls") && !params.has("ssl")) params.set("tls", "true");
  const auth = parsed.username ? `${encodeURIComponent(decodeURIComponent(parsed.username))}:${encodeURIComponent(decodeURIComponent(parsed.password))}@` : "";
  return `mongodb://${auth}${hosts}${parsed.pathname || "/"}?${params.toString()}`;
}

async function runSyncIteration() {
  const timestamp = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
  console.log(`\n[${timestamp}] Starting biometric synchronization...`);

  if (mongoose.connection.readyState !== 1) {
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    } catch (err) {
      if (String(err?.message || "").includes("querySrv")) {
        const direct = await resolveSrvUriWithPublicDns(mongoUri);
        if (direct) await mongoose.connect(direct, { serverSelectionTimeoutMS: 10000 });
        else throw err;
      } else {
        throw err;
      }
    }
  }

  const Schema = mongoose.Schema;
  const AttendanceSchema = new Schema({}, { strict: false });
  const Attendance = mongoose.models.Attendance || mongoose.model("Attendance", AttendanceSchema);

  const BiometricMappingSchema = new Schema({}, { strict: false });
  const BiometricMapping = mongoose.models.BiometricMapping || mongoose.model("BiometricMapping", BiometricMappingSchema);

  const EmployeeSchema = new Schema({}, { strict: false });
  const Employee = mongoose.models.Employee || mongoose.model("Employee", EmployeeSchema);

  const UnmappedPunchSchema = new Schema({}, { strict: false });
  const UnmappedPunch = mongoose.models.UnmappedPunch || mongoose.model("UnmappedPunch", UnmappedPunchSchema);

  const mappings = await BiometricMapping.find({ status: "Active" });
  const pinToMapping = new Map(mappings.map((m) => [String(m.biometricId).trim(), m]));

  const employees = await Employee.find({});
  const empMap = new Map(employees.map((e) => [e.employeeId, e]));

  const targetIp = "192.168.29.201";
  const targetPort = 4370;

  let punches = [];
  try {
    const zk = new ZKLib(targetIp, targetPort, 15000, 4000, 0, "tcp");
    await zk.createSocket();
    const logsRes = await zk.getAttendances();
    punches = logsRes?.data || [];
    await zk.disconnect();
    console.log(`[${timestamp}] Connected to terminal ${targetIp}. Retrieved ${punches.length} punches.`);
  } catch (err) {
    console.warn(`[${timestamp}] Biometric terminal connection warning: ${err.message}`);
    return;
  }

  if (punches.length === 0) return;

  const groups = new Map();
  const unmappedGroups = new Map();

  for (const log of punches) {
    if (!log.deviceUserId || !log.recordTime) continue;
    const pin = String(log.deviceUserId).trim();
    if (!pin) continue;

    const d = new Date(log.recordTime);
    if (isNaN(d.getTime()) || d.getFullYear() < 2020) continue;

    const istStr = d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const istDate = new Date(istStr);
    const y = istDate.getFullYear();
    const m = String(istDate.getMonth() + 1).padStart(2, "0");
    const day = String(istDate.getDate()).padStart(2, "0");
    const dateKey = `${y}-${m}-${day}`;

    const mapping = pinToMapping.get(pin);
    if (mapping) {
      const key = `${dateKey}_${mapping.employeeId}`;
      if (!groups.has(key)) {
        groups.set(key, { date: dateKey, employeeId: mapping.employeeId, punches: [] });
      }
      groups.get(key).punches.push(istDate);
    } else {
      const unKey = `${dateKey}_${pin}`;
      if (!unmappedGroups.has(unKey)) {
        unmappedGroups.set(unKey, { date: dateKey, pin, punches: [] });
      }
      unmappedGroups.get(unKey).punches.push(istDate);
    }
  }

  const bulkOps = [];
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

    const firstMinutes = first.getHours() * 60 + first.getMinutes();
    let status = firstMinutes > 12 * 60 ? "Half-day" : firstMinutes > 10 * 60 + 10 ? "Late" : "Present";
    if (totalHours > 0 && totalHours < 4.5 && item.punches.length > 1) {
      status = "Half-day";
    }

    const emp = empMap.get(item.employeeId);
    bulkOps.push({
      updateOne: {
        filter: { employeeId: item.employeeId, date: item.date },
        update: {
          $set: {
            employeeId: item.employeeId,
            employeeName: emp?.name || "Employee",
            department: emp?.department || "Operations",
            branch: emp?.branch || "Headquarters",
            date: item.date,
            checkIn: checkInTime,
            checkOut: checkOutTime,
            totalHours,
            status,
            confirmation: "Confirmed",
            deviceUsed: "eSSL K30 Pro - Main Office",
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        upsert: true,
      },
    });
  }

  if (bulkOps.length > 0) {
    const res = await Attendance.bulkWrite(bulkOps, { ordered: false });
    console.log(`[${timestamp}] Attendance updated: ${res.modifiedCount} modified, ${res.upsertedCount} inserted.`);
  }

  // Update BiometricDevice status
  const BiometricDeviceSchema = new Schema({}, { strict: false });
  const BiometricDevice = mongoose.models.BiometricDevice || mongoose.model("BiometricDevice", BiometricDeviceSchema);
  await BiometricDevice.updateOne(
    { deviceId: "DEV-01" },
    {
      $set: {
        status: "Online",
        lastSync: new Date(),
        totalLogsCount: punches.length,
      },
    }
  );
}

async function startDaemon() {
  console.log("=== Biometric Auto-Sync Daemon Started ===");
  console.log(`Sync interval: every ${INTERVAL_MS / 60000} minutes.`);
  while (true) {
    try {
      await runSyncIteration();
    } catch (err) {
      console.error("[Daemon Loop Error]", err);
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

startDaemon().catch(console.error);
