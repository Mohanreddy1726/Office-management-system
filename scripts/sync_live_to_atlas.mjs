import ZKLib from "node-zklib";
import mongoose from "mongoose";
import dns from "node:dns";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {}

const MONGODB_URI = "mongodb+srv://mohanreddy:mohanreddy1726@cluster0.5ghmukt.mongodb.net/rendesk?retryWrites=true&w=majority";

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

async function syncAll() {
  console.log("Connecting to MongoDB Atlas...");
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  } catch (err) {
    if (String(err?.message || "").includes("querySrv")) {
      const direct = await resolveSrvUriWithPublicDns(MONGODB_URI);
      if (direct) await mongoose.connect(direct, { serverSelectionTimeoutMS: 8000 });
      else throw err;
    } else {
      throw err;
    }
  }
  console.log("Connected to MongoDB!");

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
  const pinToMapping = new Map(mappings.map((m) => [String(m.biometricId), m]));
  console.log(`Loaded ${mappings.length} biometric mappings.`);

  const employees = await Employee.find({});
  const empMap = new Map(employees.map((e) => [e.employeeId, e]));
  console.log(`Loaded ${employees.length} employees.`);

  const targetIp = "192.168.29.201";
  const targetPort = 4370;

  console.log(`Connecting to eSSL K30 Pro at ${targetIp}:${targetPort}...`);
  const zk = new ZKLib(targetIp, targetPort, 15000, 4000, 0, "tcp");
  await zk.createSocket();
  console.log("Connected to machine! Fetching attendance logs...");

  const logsRes = await zk.getAttendances();
  const punches = logsRes.data || [];
  console.log(`Retrieved ${punches.length} raw punches from device.`);
  await zk.disconnect();
  console.log("Disconnected from machine.");

  const empMaxDates = await Attendance.aggregate([
    { $group: { _id: "$employeeId", maxDate: { $max: "$date" } } },
  ]);
  const empCutoffMap = new Map();
  for (const row of empMaxDates) {
    if (row._id && row.maxDate) {
      const d = new Date(row.maxDate + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      empCutoffMap.set(row._id, d.toISOString().slice(0, 10));
    }
  }
  const latestUnmapped = await UnmappedPunch.findOne({}).sort({ punchTime: -1 }).select("punchTime").lean();
  let unmappedCutoffIso = null;
  if (latestUnmapped?.punchTime) {
    const ld = new Date(latestUnmapped.punchTime).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const d = new Date(ld + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    unmappedCutoffIso = d.toISOString().slice(0, 10);
  }

  // Group by (dateKey, pin) - filter out old already-synced records
  const groups = new Map();
  let skippedOld = 0;
  for (const log of punches) {
    if (!log.deviceUserId || !log.recordTime) continue;
    const pin = String(log.deviceUserId).trim();
    if (!pin) continue;

    const d = new Date(log.recordTime);
    if (isNaN(d.getTime()) || d.getFullYear() < 2020) continue;

    const dateKey = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const istStr = d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const istDate = new Date(istStr);

    const mapping = pinToMapping.get(pin);
    if (mapping) {
      const cut = empCutoffMap.get(mapping.employeeId);
      if (cut && dateKey < cut) {
        skippedOld++;
        continue;
      }
    } else if (unmappedCutoffIso && dateKey < unmappedCutoffIso) {
      skippedOld++;
      continue;
    }

    const key = `${dateKey}_${pin}`;
    if (!groups.has(key)) {
      groups.set(key, { date: dateKey, pin, punches: [] });
    }
    groups.get(key).punches.push(istDate);
  }

  console.log(`Grouped into ${groups.size} recent/new sessions (${skippedOld} old logs skipped).`);

  const bulkOps = [];
  const unmappedBulk = [];
  let matchedCount = 0;

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
    // GVK Policy: 10:00 AM - 6:30 PM, 10-min grace (10:10 AM), > 12:00 PM = Half-day cut
    let status = firstMinutes > 12 * 60 ? "Half-day" : firstMinutes > 10 * 60 + 10 ? "Late" : "Present";
    if (totalHours > 0 && totalHours < 4.5 && item.punches.length > 1) {
      status = "Half-day";
    }

    const mapping = pinToMapping.get(item.pin);
    if (mapping) {
      matchedCount++;
      const emp = empMap.get(mapping.employeeId);
      bulkOps.push({
        updateOne: {
          filter: { employeeId: mapping.employeeId, date: item.date },
          update: {
            $set: {
              employeeId: mapping.employeeId,
              employeeName: mapping.employeeName || emp?.name || "Employee",
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
    } else {
      unmappedBulk.push({
        updateOne: {
          filter: { deviceId: "DEV-01", biometricId: item.pin, punchTime: first },
          update: {
            $set: {
              deviceId: "DEV-01",
              biometricId: item.pin,
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
            filter: { deviceId: "DEV-01", biometricId: item.pin, punchTime: last },
            update: {
              $set: {
                deviceId: "DEV-01",
                biometricId: item.pin,
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
  }

  console.log(`Mapped ${matchedCount} attendance records to registered employees.`);
  if (bulkOps.length > 0) {
    console.log(`Executing bulkWrite with ${bulkOps.length} operations...`);
    const res = await Attendance.bulkWrite(bulkOps, { ordered: false });
    console.log("Bulk write complete for Attendance:", {
      upserted: res.upsertedCount,
      modified: res.modifiedCount,
      matched: res.matchedCount,
    });
  }

  console.log(`Saving ${unmappedBulk.length} unmapped punches in batches of 500...`);
  for (let i = 0; i < unmappedBulk.length; i += 500) {
    const chunk = unmappedBulk.slice(i, i + 500);
    await UnmappedPunch.bulkWrite(chunk, { ordered: false });
  }
  console.log(`Saved ${unmappedBulk.length} unmapped punches to MongoDB Atlas.`);

  // Update BiometricDevice record
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

  console.log("✅ Synced successfully to MongoDB Atlas!");
  await mongoose.disconnect();
}

syncAll().catch(console.error);
