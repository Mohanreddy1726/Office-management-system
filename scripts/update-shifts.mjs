import mongoose from "mongoose";
import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not found");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const generalShift = {
    shiftName: "General Shift",
    startTime: "10:00",
    endTime: "18:30",
    gracePeriodMinutes: 15,
    halfDayThresholdHours: 4.5,
    fullDayHours: 8.5,
  };

  // 1. Update all employees to have General Shift
  const empResult = await db.collection("employees").updateMany(
    {},
    {
      $set: {
        shift: generalShift,
        updatedAt: new Date(),
      },
    }
  );
  console.log(`Updated ${empResult.modifiedCount} employees with General Shift (10:00 AM - 06:30 PM).`);

  // Verify all employees
  const employees = await db.collection("employees").find({}, { projection: { employeeId: 1, name: 1, shift: 1 } }).toArray();
  for (const emp of employees) {
    console.log(`Employee: ${emp.employeeId} (${emp.name}) -> Shift: ${emp.shift?.shiftName} [${emp.shift?.startTime} - ${emp.shift?.endTime}]`);
  }

  // 2. Check if a 'shifts' collection exists in MongoDB
  const collections = await db.listCollections().toArray();
  const collNames = collections.map((c) => c.name);
  console.log("Database collections:", collNames);

  if (collNames.includes("shifts")) {
    await db.collection("shifts").deleteMany({});
    await db.collection("shifts").insertOne({
      id: "SH-GEN",
      name: "General Shift",
      start: "10:00",
      end: "18:30",
      breakMinutes: 60,
      graceMinutes: 15,
      weeklyOffs: ["Sunday"],
      minFullDayHours: 7.5,
      minHalfDayHours: 4,
      overtimeEligible: false,
      branches: ["Hyderabad", "Warangal", "Vijayawada", "Visakhapatnam"],
      overnight: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("Updated shifts collection to contain only General Shift.");
  }

  await mongoose.disconnect();
  console.log("Migration completed successfully.");
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
