import ZKLib from "node-zklib";
import mongoose from "mongoose";
import dns from "node:dns";
import fs from "node:fs";
import path from "node:path";

/**
 * RenDesk On-Demand Biometric Bridge (Manual Sync Only — Zero Auto-Sync)
 *
 * Sits completely idle on an office LAN computer using MongoDB Change Streams.
 * Only wakes up when an admin manually clicks "Sync Biometric" in the web/mobile UI
 * (e.g. from Vercel cloud), connects to the local eSSL terminal (192.168.29.201:4370),
 * syncs only recent/changed records to MongoDB Atlas, and marks the SyncJob completed.
 */

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {}

let mongoUri =
  process.env.MONGODB_URI ||
  "mongodb+srv://mohanreddy:mohanreddy1726@cluster0.5ghmukt.mongodb.net/rendesk?retryWrites=true&w=majority";

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
  const auth = parsed.username
    ? `${encodeURIComponent(decodeURIComponent(parsed.username))}:${encodeURIComponent(
        decodeURIComponent(parsed.password)
      )}@`
    : "";
  return `mongodb://${auth}${hosts}${parsed.pathname || "/"}?${params.toString()}`;
}

async function connectMongo() {
  if (mongoose.connection.readyState === 1) return;
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

function getISTParts(d) {
  const dateStr = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const timeStr = d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const hour24Raw = Number(
    d.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hourCycle: "h23" })
  );
  const hour24 = hour24Raw === 24 ? 0 : hour24Raw;
  const minute = Number(d.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", minute: "numeric" }));
  return { dateStr, timeStr, hour24, minute };
}

function classifyISTCheckIn(hour24, minute) {
  const totalMins = hour24 * 60 + minute;
  // GVK Policy: Shift 10:00 AM - 6:30 PM, 10-min grace (10:10 AM), > 12:00 PM = Half-day
  if (totalMins > 12 * 60) return "Half-day";
  if (totalMins > 10 * 60 + 10) return "Late";
  return "Present";
}

async function executeHardwareSync(overrideIp, overridePort, deviceId = "DEV-01") {
  const db = mongoose.connection.db;
  const AttendanceCol = db.collection("attendances");
  const MappingCol = db.collection("biometricmappings");
  const EmployeeCol = db.collection("employees");
  const DeviceCol = db.collection("biometricdevices");
  const UnmappedCol = db.collection("unmappedpunches");

  const dev =
    (await DeviceCol.findOne({ deviceId })) || (await DeviceCol.findOne({ connection: "TCP/IP" }));
  const targetIp = overrideIp || dev?.ipAddress || "192.168.29.201";
  const targetPort = Number(overridePort || dev?.port || 4370);
  const commKey = Number(dev?.commKey || 0);

  const zk = new ZKLib(targetIp, targetPort, 12000, 4000, commKey, "tcp");
  await zk.createSocket();
  const usersRes = await zk.getUsers().catch(() => null);
  const logsRes = await zk.getAttendances();
  await zk.disconnect();

  const punches = logsRes?.data || [];
  const enrolledUsersCount = usersRes?.data?.length || dev?.enrolledUsersCount || 25;

  const mappings = await MappingCol.find({ status: "Active" }).toArray();
  const pinToMapping = new Map(mappings.map((m) => [String(m.biometricId).trim(), m]));

  const employees = await EmployeeCol.find({}).toArray();
  const empMap = new Map(employees.map((e) => [e.employeeId, e]));

  // Incremental watermark per employee (1-day overlap catches evening check-outs without rewriting old history)
  const empMaxDates = await AttendanceCol.aggregate([
    { $group: { _id: "$employeeId", maxDate: { $max: "$date" } } },
  ]).toArray();
  const empCutoffMap = new Map();
  for (const row of empMaxDates) {
    if (row._id && row.maxDate) {
      const dt = new Date(row.maxDate + "T00:00:00Z");
      dt.setUTCDate(dt.getUTCDate() - 1);
      empCutoffMap.set(row._id, dt.toISOString().slice(0, 10));
    }
  }

  const latestUnmapped = await UnmappedCol.find({})
    .sort({ punchTime: -1 })
    .limit(1)
    .project({ punchTime: 1 })
    .toArray();
  let unmappedCutoffIso = null;
  if (latestUnmapped[0]?.punchTime) {
    const ld = getISTParts(new Date(latestUnmapped[0].punchTime)).dateStr;
    const dt = new Date(ld + "T00:00:00Z");
    dt.setUTCDate(dt.getUTCDate() - 1);
    unmappedCutoffIso = dt.toISOString().slice(0, 10);
  }

  const groups = new Map();
  const unmappedGroups = new Map();
  let recentLogsChecked = 0;
  let skippedOldLogs = 0;

  for (const log of punches) {
    if (!log.deviceUserId || !log.recordTime) continue;
    const pin = String(log.deviceUserId).trim();
    if (!pin) continue;

    const d = new Date(log.recordTime);
    if (isNaN(d.getTime()) || d.getFullYear() < 2020) continue;

    const { dateStr } = getISTParts(d);
    const mapping = pinToMapping.get(pin);

    if (mapping) {
      const cut = empCutoffMap.get(mapping.employeeId);
      if (cut && dateStr < cut) {
        skippedOldLogs++;
        continue;
      }
      recentLogsChecked++;
      const key = `${mapping.employeeId}_${dateStr}`;
      if (!groups.has(key)) {
        groups.set(key, { employeeId: mapping.employeeId, date: dateStr, punches: [] });
      }
      groups.get(key).punches.push(d);
    } else {
      if (unmappedCutoffIso && dateStr < unmappedCutoffIso) {
        skippedOldLogs++;
        continue;
      }
      recentLogsChecked++;
      const unKey = `${pin}_${dateStr}`;
      if (!unmappedGroups.has(unKey)) {
        unmappedGroups.set(unKey, { biometricId: pin, date: dateStr, punches: [] });
      }
      unmappedGroups.get(unKey).punches.push(d);
    }
  }

  const candidateDates = Array.from(new Set(Array.from(groups.values()).map((g) => g.date)));
  const existingDocs =
    candidateDates.length > 0
      ? await AttendanceCol.find({ date: { $in: candidateDates } }).toArray()
      : [];
  const existingMap = new Map(existingDocs.map((doc) => [`${doc.employeeId}_${doc.date}`, doc]));

  const bulkOps = [];
  for (const item of groups.values()) {
    item.punches.sort((a, b) => a.getTime() - b.getTime());
    const first = item.punches[0];
    const last = item.punches[item.punches.length - 1];

    const firstComp = getISTParts(first);
    const checkInTime = firstComp.timeStr;
    const hasMultiplePunches = item.punches.length > 1;
    const checkOutTime = hasMultiplePunches ? getISTParts(last).timeStr : null;

    let totalHours = 0;
    if (hasMultiplePunches) {
      const diffMs = last.getTime() - first.getTime();
      totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
    }

    let status = classifyISTCheckIn(firstComp.hour24, firstComp.minute);
    if (totalHours > 0 && totalHours < 4.5 && hasMultiplePunches) {
      status = "Half-day";
    }

    const existing = existingMap.get(`${item.employeeId}_${item.date}`);
    if (
      existing &&
      (existing.checkIn || null) === (checkInTime || null) &&
      (existing.checkOut || null) === (checkOutTime || null) &&
      existing.status === status &&
      Number(existing.totalHours || 0) === totalHours
    ) {
      continue;
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
            deviceUsed: dev?.name || "eSSL K30 Pro - Main Office",
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        upsert: true,
      },
    });
  }

  if (bulkOps.length > 0) {
    await AttendanceCol.bulkWrite(bulkOps, { ordered: false });
  }

  const unmappedBulk = [];
  for (const item of unmappedGroups.values()) {
    item.punches.sort((a, b) => a.getTime() - b.getTime());
    const first = item.punches[0];
    const last = item.punches[item.punches.length - 1];

    unmappedBulk.push({
      updateOne: {
        filter: { deviceId: dev?.deviceId || "DEV-01", biometricId: item.biometricId, punchTime: first },
        update: {
          $set: {
            deviceId: dev?.deviceId || "DEV-01",
            biometricId: item.biometricId,
            punchTime: first,
            punchType: item.punches.length > 1 ? "CheckIn" : "Unknown",
            resolved: false,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        upsert: true,
      },
    });

    if (item.punches.length > 1) {
      unmappedBulk.push({
        updateOne: {
          filter: { deviceId: dev?.deviceId || "DEV-01", biometricId: item.biometricId, punchTime: last },
          update: {
            $set: {
              deviceId: dev?.deviceId || "DEV-01",
              biometricId: item.biometricId,
              punchTime: last,
              punchType: "CheckOut",
              resolved: false,
              updatedAt: new Date(),
            },
            $setOnInsert: { createdAt: new Date() },
          },
          upsert: true,
        },
      });
    }
  }

  if (unmappedBulk.length > 0) {
    for (let i = 0; i < unmappedBulk.length; i += 500) {
      await UnmappedCol.bulkWrite(unmappedBulk.slice(i, i + 500), { ordered: false }).catch(() => {});
    }
  }

  const mappedPins = Array.from(pinToMapping.keys());
  if (mappedPins.length > 0) {
    await UnmappedCol.updateMany(
      { biometricId: { $in: mappedPins }, resolved: false },
      { $set: { resolved: true, updatedAt: new Date() } }
    );
  }

  await DeviceCol.updateOne(
    { deviceId: dev?.deviceId || "DEV-01" },
    {
      $set: {
        status: "Online",
        lastSync: new Date(),
        totalLogsCount: punches.length,
        enrolledUsersCount,
      },
    }
  );

  return {
    totalLogs: punches.length,
    recentLogsChecked,
    skippedOldLogs,
    updatedRecords: bulkOps.length,
    userCount: enrolledUsersCount,
  };
}

let processingJob = false;

async function processJobDoc(job) {
  if (!job?._id || processingJob) return;
  processingJob = true;
  const SyncJobsCol = mongoose.connection.db.collection("syncjobs");

  try {
    const claimed = await SyncJobsCol.findOneAndUpdate(
      { _id: job._id, status: "pending" },
      { $set: { status: "running" } },
      { returnDocument: "after" }
    );
    const activeJob = claimed?.value ?? claimed;
    if (!activeJob || activeJob.status !== "running") {
      processingJob = false;
      return;
    }

    const stamp = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
    console.log(`[${stamp}] Manual sync request received (${activeJob.jobId}). Connecting to eSSL...`);

    const summary = await executeHardwareSync(
      activeJob.ipAddress,
      activeJob.port,
      activeJob.deviceId || "DEV-01"
    );

    await SyncJobsCol.updateOne(
      { _id: job._id },
      {
        $set: {
          status: "completed",
          summary,
          completedAt: new Date(),
        },
      }
    );
    console.log(
      `[${stamp}] Completed ${activeJob.jobId}: ${summary.recentLogsChecked} recent checked, ${summary.updatedRecords} updated, ${summary.skippedOldLogs} old skipped.`
    );
  } catch (err) {
    console.error(`[Bridge Error]`, err?.message || err);
    await SyncJobsCol.updateOne(
      { _id: job._id },
      {
        $set: {
          status: "failed",
          error: err?.message || "Failed to connect to biometric terminal",
          completedAt: new Date(),
        },
      }
    ).catch(() => {});
  } finally {
    processingJob = false;
  }
}

async function processAnyPendingJobs() {
  const SyncJobsCol = mongoose.connection.db.collection("syncjobs");
  const cutoff = new Date(Date.now() - 30_000);
  const pending = await SyncJobsCol.find({
    status: "pending",
    createdAt: { $gte: cutoff },
  })
    .sort({ createdAt: 1 })
    .toArray();
  for (const job of pending) {
    await processJobDoc(job);
  }
}

async function startBridge() {
  await connectMongo();
  console.log("RenDesk On-Demand Biometric Bridge connected to MongoDB Atlas.");
  console.log("Mode: Manual Sync Only (waiting via Change Stream — 0% idle CPU, no auto-sync).");

  // Process any just-created pending jobs on startup
  await processAnyPendingJobs();

  const SyncJobsCol = mongoose.connection.db.collection("syncjobs");
  const openStream = () => {
    const stream = SyncJobsCol.watch([{ $match: { operationType: "insert" } }], {
      fullDocument: "updateLookup",
    });

    stream.on("change", async (change) => {
      if (change.fullDocument?.status === "pending") {
        await processJobDoc(change.fullDocument);
      }
    });

    stream.on("error", (err) => {
      console.warn("Change stream interrupted, reconnecting in 5s:", err?.message || err);
      try {
        stream.close();
      } catch {}
      setTimeout(async () => {
        try {
          await connectMongo();
          await processAnyPendingJobs();
          openStream();
        } catch (e) {
          console.error("Reconnect failed, retrying in 10s:", e?.message || e);
          setTimeout(openStream, 10_000);
        }
      }, 5000);
    });
  };

  openStream();
}

startBridge().catch((err) => {
  console.error("Fatal biometric bridge startup error:", err);
  process.exit(1);
});
