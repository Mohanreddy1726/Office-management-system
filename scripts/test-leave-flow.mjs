import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
import mongoose from "mongoose";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const leaves = await db.collection("leaverequests").find({}).toArray();
  console.log(`Found ${leaves.length} leave requests in MongoDB:`);
  for (const l of leaves) {
    console.log(`- ID: ${l._id}`);
    console.log(`  Employee: ${l.employeeName} (${l.employeeId})`);
    console.log(`  Type: ${l.leaveType}`);
    console.log(`  Period: ${l.startDate} -> ${l.endDate} (${l.daysCount} days)`);
    console.log(`  Status: ${l.status}`);
    console.log(`  Reason: ${l.reason}`);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
