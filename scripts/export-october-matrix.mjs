import ZKLib from "node-zklib";
import fs from "node:fs";
import path from "node:path";

async function run() {
  const zk = new ZKLib("192.168.29.201", 4370, 10000, 4000, 0, "tcp");
  await zk.createSocket();

  const usersRes = await zk.getUsers();
  const logsRes = await zk.getAttendances();
  await zk.disconnect();

  const users = usersRes.data || [];
  const logs = logsRes.data || [];

  // Sort users by numeric ID
  users.sort((a, b) => (parseInt(a.userId) || 0) - (parseInt(b.userId) || 0));

  // Map of "YYYY-MM-DD_userId" -> array of Date objects (IST)
  const punchMap = new Map();

  for (const log of logs) {
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
      if (!punchMap.has(key)) punchMap.set(key, []);
      punchMap.get(key).push(istDate);
    }
  }

  // All 31 dates in October 2026
  const dates = [];
  for (let i = 1; i <= 31; i++) {
    dates.push(`2026-10-${String(i).padStart(2, "0")}`);
  }

  // 1. Generate Matrix CSV: "ID", "Name", "Total Days Present", "Total Hours", "2026-10-01", ... "2026-10-31"
  // Each cell contains: "10:19 AM - 07:22 PM" (or "-" if absent)
  const header1 = ["ID", "Name", "Days Present", "Total Hours", ...dates].map(h => `"${h}"`).join(",");
  const rows1 = [];

  for (const u of users) {
    let daysPresent = 0;
    let totalHours = 0;
    const dateCells = [];

    for (const dt of dates) {
      const key = `${dt}_${u.userId}`;
      const punches = punchMap.get(key);

      if (!punches || punches.length === 0) {
        dateCells.push('""'); // empty/absent
      } else {
        punches.sort((a, b) => a - b);
        daysPresent += 1;
        const first = punches[0].toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        
        if (punches.length === 1) {
          dateCells.push(`"${first} (In only)"`);
        } else {
          const last = punches[punches.length - 1].toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
          const diffMs = punches[punches.length - 1].getTime() - punches[0].getTime();
          const hrs = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
          totalHours += hrs;
          dateCells.push(`"${first} - ${last}"`);
        }
      }
    }

    rows1.push([
      `"${u.userId}"`,
      `"${u.name || "Unknown"}"`,
      daysPresent,
      totalHours.toFixed(1),
      ...dateCells
    ].join(","));
  }

  const exportDir = path.resolve(process.cwd(), "exports");
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

  const file1Path = path.join(exportDir, "October_2026_Attendance_Matrix.csv");
  fs.writeFileSync(file1Path, header1 + "\n" + rows1.join("\n"), "utf-8");

  // 2. Also generate a Split In/Out Column Matrix:
  // "ID", "Name", "2026-10-01 In", "2026-10-01 Out", "2026-10-02 In", "2026-10-02 Out", ...
  const splitHeaders = ["ID", "Name", "Days Present", "Total Hours"];
  for (const dt of dates) {
    const dayNum = dt.split("-")[2];
    splitHeaders.push(`"Oct ${dayNum} In"`, `"Oct ${dayNum} Out"`);
  }

  const rows2 = [];
  for (const u of users) {
    let daysPresent = 0;
    let totalHours = 0;
    const splitCells = [];

    for (const dt of dates) {
      const key = `${dt}_${u.userId}`;
      const punches = punchMap.get(key);

      if (!punches || punches.length === 0) {
        splitCells.push('""', '""');
      } else {
        punches.sort((a, b) => a - b);
        daysPresent += 1;
        const first = punches[0].toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        
        if (punches.length === 1) {
          splitCells.push(`"${first}"`, '""');
        } else {
          const last = punches[punches.length - 1].toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
          const diffMs = punches[punches.length - 1].getTime() - punches[0].getTime();
          const hrs = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
          totalHours += hrs;
          splitCells.push(`"${first}"`, `"${last}"`);
        }
      }
    }

    rows2.push([
      `"${u.userId}"`,
      `"${u.name || "Unknown"}"`,
      daysPresent,
      totalHours.toFixed(1),
      ...splitCells
    ].join(","));
  }

  const file2Path = path.join(exportDir, "October_2026_Attendance_Matrix_Split_InOut.csv");
  fs.writeFileSync(file2Path, splitHeaders.join(",") + "\n" + rows2.join("\n"), "utf-8");

  console.log(`✅ Saved Attendance Matrix (In-Out in single cell): ${file1Path}`);
  console.log(`✅ Saved Attendance Matrix (Separate In/Out columns): ${file2Path}`);
}

run().catch(console.error);
