import ZKLib from "node-zklib";

async function main() {
  const zk = new ZKLib("192.168.29.201", 4370, 10000, 4000, 0, "tcp");
  await zk.createSocket();
  const logs = await zk.getAttendances();
  const users = await zk.getUsers();
  await zk.disconnect();

  const userMap = Object.fromEntries(users.data.map(u => [String(u.userId), u.name]));
  console.log("Total punches on device:", logs.data.length);

  // Group punches by date
  const punchesByDate = {};
  for (const l of logs.data) {
    const d = new Date(l.recordTime);
    const istStr = d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const istDate = new Date(istStr);
    const y = istDate.getFullYear();
    const m = String(istDate.getMonth() + 1).padStart(2, "0");
    const day = String(istDate.getDate()).padStart(2, "0");
    const dateKey = `${y}-${m}-${day}`;

    if (!punchesByDate[dateKey]) punchesByDate[dateKey] = [];
    punchesByDate[dateKey].push({
      deviceUserId: String(l.deviceUserId),
      name: userMap[String(l.deviceUserId)] || "Unknown",
      time: istDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
      timestamp: istDate
    });
  }

  const sortedDates = Object.keys(punchesByDate).sort().reverse();
  console.log("\nRecent Dates with Punches on Machine:");
  for (const date of sortedDates.slice(0, 10)) {
    console.log(`  Date: ${date} -> ${punchesByDate[date].length} punches`);
  }

  const today = "2026-11-09";
  console.log(`\nDetailed Punches for Today (${today}):`);
  if (punchesByDate[today]) {
    for (const p of punchesByDate[today]) {
      console.log(`  PIN: ${p.deviceUserId} | Name: ${p.name} | Time: ${p.time}`);
    }
  } else {
    console.log("  No punches found for today!");
  }
}

main().catch(console.error);
