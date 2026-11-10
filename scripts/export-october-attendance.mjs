import ZKLib from "node-zklib";
import fs from "node:fs";
import path from "node:path";

async function generateReport() {
  const zk = new ZKLib("192.168.29.201", 4370, 10000, 4000, 0, "tcp");
  await zk.createSocket();

  const users = await zk.getUsers();
  const userMap = Object.fromEntries(users.data.map(u => [u.userId, u.name]));
  const logs = await zk.getAttendances();
  await zk.disconnect();

  // Filter October 2026 punches
  // We format dates in IST (Asia/Kolkata, UTC + 05:30)
  const recordsMap = new Map(); // key: "YYYY-MM-DD_userId" -> array of Date objects

  for (const log of logs.data) {
    const d = new Date(log.recordTime);
    // Convert to IST
    const istStr = d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const istDate = new Date(istStr);

    const year = istDate.getFullYear();
    const month = String(istDate.getMonth() + 1).padStart(2, "0");
    const day = String(istDate.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;

    if (dateKey.startsWith("2026-10")) {
      const key = `${dateKey}_${log.deviceUserId}`;
      if (!recordsMap.has(key)) {
        recordsMap.set(key, {
          date: dateKey,
          userId: log.deviceUserId,
          name: userMap[log.deviceUserId] || "Unknown",
          punches: [],
        });
      }
      recordsMap.get(key).punches.push(istDate);
    }
  }

  const dailyRows = [];
  for (const item of recordsMap.values()) {
    item.punches.sort((a, b) => a - b);
    const first = item.punches[0];
    const last = item.punches[item.punches.length - 1];

    const inTime = first.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const outTime = item.punches.length > 1
      ? last.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
      : "Single Punch (Missing Out)";

    let hoursWorked = 0;
    if (item.punches.length > 1) {
      const diffMs = last.getTime() - first.getTime();
      hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
    }

    dailyRows.push({
      date: item.date,
      userId: item.userId,
      name: item.name,
      checkIn: inTime,
      checkOut: outTime,
      punchCount: item.punches.length,
      hoursWorked,
    });
  }

  // Sort by date ascending, then userId
  dailyRows.sort((a, b) => a.date.localeCompare(b.date) || a.userId.localeCompare(b.userId));

  // Build CSV
  const csvHeaders = "Date,User ID (PIN),Employee Name,Check-In (IST),Check-Out (IST),Total Hours,Punches Recorded\n";
  const csvRows = dailyRows.map(r => 
    `"${r.date}","${r.userId}","${r.name}","${r.checkIn}","${r.checkOut}",${r.hoursWorked},${r.punchCount}`
  ).join("\n");

  const exportDir = path.resolve(process.cwd(), "exports");
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

  const csvPath = path.join(exportDir, "October_2026_Biometric_Attendance.csv");
  fs.writeFileSync(csvPath, csvHeaders + csvRows, "utf-8");

  console.log(`✅ CSV exported successfully to: ${csvPath}`);
  console.log(`Total Days Processed: ${new Set(dailyRows.map(r => r.date)).size}`);
  console.log(`Total Daily In/Out Attendance Records: ${dailyRows.length}`);

  // Summary per employee
  const empSummary = {};
  for (const r of dailyRows) {
    if (!empSummary[r.userId]) {
      empSummary[r.userId] = { name: r.name, daysPresent: 0, totalHours: 0 };
    }
    empSummary[r.userId].daysPresent += 1;
    empSummary[r.userId].totalHours += r.hoursWorked;
  }

  console.log("\n--- OCTOBER 2026 MONTHLY SUMMARY PER PERSON ---");
  for (const [uid, s] of Object.entries(empSummary)) {
    console.log(`PIN ${uid.padEnd(5)} | ${s.name.padEnd(24)} | Present: ${String(s.daysPresent).padStart(2)} days | Avg Hours: ${(s.totalHours / Math.max(1, s.daysPresent)).toFixed(1)} hrs/day`);
  }
}

generateReport().catch(console.error);
