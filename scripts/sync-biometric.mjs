import ZKLib from "node-zklib";
import dns from "node:dns";
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {}

const targetIp = process.argv[2] || "192.168.29.201";
const targetPort = parseInt(process.argv[3] || "4370", 10);
const commKey = parseInt(process.argv[4] || "0", 10);

console.log(`\n========================================================`);
console.log(`Connecting to eSSL K30 Pro at: ${targetIp}:${targetPort} (Key: ${commKey})`);
console.log(`========================================================\n`);

async function run() {
  const zk = new ZKLib(targetIp, targetPort, 10000, 4000, commKey, "tcp");

  try {
    await zk.createSocket();
    console.log("✅ Successfully connected to eSSL Biometric Terminal!");

    // 1. Fetch Terminal Information
    const info = await zk.getInfo();
    console.log("\n--- DEVICE INFORMATION ---");
    console.log(`Model / Version : ${info.version || "eSSL K30 Pro"}`);
    console.log(`OS / Platform   : ${info.os || "Linux ZEM"}`);
    console.log(`User Count      : ${info.userCounts || "N/A"}`);
    console.log(`Log / Record Ct : ${info.logCounts || "N/A"}`);

    // 2. Fetch Enrolled Users on the Machine
    console.log("\n--- ENROLLED USERS ON DEVICE ---");
    try {
      const users = await zk.getUsers();
      console.log(`Found ${users.data?.length || 0} enrolled users on device:`);
      for (const u of (users.data || []).slice(0, 15)) {
        console.log(`  - User ID (PIN): ${u.userId || u.uid} | Name: ${u.name || "Unnamed"} | Role: ${u.role}`);
      }
    } catch (e) {
      console.log("Could not read user list:", e.message);
    }

    // 3. Fetch Attendance Logs / Punches
    console.log("\n--- FETCHING ATTENDANCE PUNCHES ---");
    try {
      const logs = await zk.getAttendances((received, total) => {
        process.stdout.write(`Syncing punches: ${received}/${total}\r`);
      });
      console.log(`\nRetrieved ${logs.data?.length || 0} punch records from machine.`);

      if (logs.data && logs.data.length > 0) {
        console.log("\nLatest 5 Punches:");
        const recent = logs.data.slice(-5).reverse();
        for (const l of recent) {
          console.log(`  - User ID: ${l.deviceUserId} | Timestamp: ${l.recordTime}`);
        }
      }
    } catch (e) {
      console.log("Could not read logs:", e.message);
    }

    await zk.disconnect();
    console.log("\nDisconnected gracefully from biometric terminal.");
  } catch (err) {
    console.error("❌ Connection failed:", err.message);
    console.log("\nTroubleshooting tips:");
    console.log("1. Ensure device IP is reachable from this PC (ping <ip>).");
    console.log("2. Check if PC and Device are on the exact same subnet.");
    console.log("3. Verify port 4370 and comm key.");
  }
}

run();
