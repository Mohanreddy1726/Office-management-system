import ZKLib from "node-zklib";
import mongoose from "mongoose";
import dns from "node:dns";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {}

const MONGODB_URI = "mongodb+srv://mohanreddy:mohanreddy1726@cluster0.5ghmukt.mongodb.net/rendesk?retryWrites=true&w=majority";

async function syncAll() {
  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log("Connected to MongoDB!");

  const Schema = mongoose.Schema;
  const AttendanceSchema = new Schema({}, { strict: false });
  const Attendance = mongoose.models.Attendance || mongoose.model("Attendance", AttendanceSchema);

  const BiometricMappingSchema = new Schema({}, { strict: false });
  const BiometricMapping = mongoose.models.BiometricMapping || mongoose.model("BiometricMapping", BiometricMappingSchema);

  const EmployeeSchema = new Schema({}, { strict: false });
  const Employee = mongoose.models.Employee || mongoose.model("Employee", EmployeeSchema);

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

  // Group by (dateKey, pin)
  const groups = new Map();
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

    const key = `${dateKey}_${pin}`;
    if (!groups.has(key)) {
      groups.set(key, { date: dateKey, pin, punches: [] });
    }
    groups.get(key).punches.push(istDate);
  }

  console.log(`Grouped into ${groups.size} (date, pin) attendance sessions.`);

  const bulkOps = [];
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
    const isLate = firstMinutes > (9 * 60 + 30);
    const status = isLate ? "Late" : "Present";

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
            },
          },
          upsert: true,
        },
      });
    }
  }

  console.log(`Mapped ${matchedCount} attendance records to registered employees.`);
  if (bulkOps.length > 0) {
    console.log(`Executing bulkWrite with ${bulkOps.length} operations...`);
    const res = await Attendance.bulkWrite(bulkOps, { ordered: false });
    console.log("Bulk write complete:", {
      upserted: res.upsertedCount,
      modified: res.modifiedCount,
      matched: res.matchedCount,
    });
  }

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
