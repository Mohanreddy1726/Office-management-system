import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
import mongoose from "mongoose";

function parseTimeToMinutes(str) {
  if (!str) return null;
  const clean = str.toLowerCase().trim();
  const isPm = clean.includes("pm");
  const isAm = clean.includes("am");
  const bare = clean.replace(/am|pm/g, "").trim();
  const parts = bare.split(":");
  if (parts.length < 2) return null;
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  if (isPm && h < 12) h += 12;
  if (isAm && h === 12) h = 0;
  return h * 60 + m;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI missing");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const records = await db.collection("attendances").find({}).toArray();
  console.log(`Analyzing ${records.length} attendance records against 10:00 AM - 18:30 PM shift (grace: 15 mins)...`);

  const bulkOps = [];
  let updatedCount = 0;

  for (const r of records) {
    if (!r.checkIn) continue;
    if (["On Leave", "Leave", "Absent", "Holiday", "Week Off"].includes(r.status)) continue;

    const checkInMins = parseTimeToMinutes(r.checkIn);
    if (checkInMins === null) continue;

    // Shift starts at 10:00 AM (600 mins) with 15 mins grace (615 mins)
    const isLate = checkInMins > 615;
    let expectedStatus = isLate ? "Late" : "Present";
    if (r.totalHours > 0 && r.totalHours < 4.5 && r.checkOut) {
      expectedStatus = "Half-day";
    }

    if (r.status !== expectedStatus) {
      bulkOps.push({
        updateOne: {
          filter: { _id: r._id },
          update: {
            $set: {
              status: expectedStatus,
              updatedAt: new Date(),
            },
          },
        },
      });
      updatedCount++;
    }
  }

  if (bulkOps.length > 0) {
    await db.collection("attendances").bulkWrite(bulkOps);
    console.log(`Updated status for ${updatedCount} attendance records to reflect 10:00 AM shift timing.`);
  } else {
    console.log("All attendance records are already consistent with 10:00 AM shift.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
