import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
import mongoose from "mongoose";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const emp = await db.collection("employees").findOne({ employeeId: "OF-1002" });
  if (!emp) {
    console.error("Employee OF-1002 not found");
    process.exit(1);
  }

  // Check if leave already exists
  const existing = await db.collection("leaverequests").findOne({ employeeId: "OF-1002" });
  if (existing) {
    console.log("Leave for OF-1002 already exists in MongoDB:", existing._id, existing.status);
  } else {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const doc = {
      employeeId: "OF-1002",
      employeeName: emp.name || "Regula Shiva",
      department: emp.department || "Design",
      branch: emp.branch || "Headquarters",
      leaveType: "Casual Leave",
      type: "Casual Leave",
      startDate: today,
      endDate: tomorrow,
      daysCount: 2,
      days: 2,
      isHalfDay: false,
      reason: "Personal / Family: Urgent family matters requiring travel",
      reasonCategory: "Personal / Family",
      emergencyContact: emp.phone || "+91 98765 43210",
      status: "Submitted",
      timeline: [
        {
          stage: "Submitted",
          actor: emp.name || "Regula Shiva",
          at: new Date(),
          note: "Application submitted for review",
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const res = await db.collection("leaverequests").insertOne(doc);
    console.log("Successfully created leave request in MongoDB for Regula Shiva:", res.insertedId);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
