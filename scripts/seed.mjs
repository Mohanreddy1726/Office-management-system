import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/officeflow";

async function seed() {
  console.log("Connecting to MongoDB:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log("Connected!");

  const db = mongoose.connection.db;

  const defaultPassword = "password123";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // 1. Seed Users
  const usersColl = db.collection("users");
  await usersColl.deleteMany({});
  
  const users = [
    {
      email: "vikram.desai@officeflow.example",
      passwordHash,
      name: "Vikram Desai",
      role: "super_admin",
      employeeId: "OF-1001",
      branch: "Headquarters",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "ananya.sharma@officeflow.example",
      passwordHash,
      name: "Ananya Sharma",
      role: "hr_admin",
      employeeId: "OF-1002",
      branch: "Headquarters",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "rahul.verma@officeflow.example",
      passwordHash,
      name: "Rahul Verma",
      role: "manager",
      employeeId: "OF-1003",
      branch: "Headquarters",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "karthik.reddy@officeflow.example",
      passwordHash,
      name: "Karthik Reddy",
      role: "employee",
      employeeId: "OF-1004",
      branch: "Headquarters",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  await usersColl.insertMany(users);
  console.log("Seeded Users");

  // 2. Seed Employees
  const empColl = db.collection("employees");
  await empColl.deleteMany({});
  
  const employees = [
    {
      employeeId: "OF-1001",
      name: "Vikram Desai",
      email: "vikram.desai@officeflow.example",
      phone: "+91 98490 11001",
      designation: "Managing Director & CEO",
      department: "Executive",
      branch: "Headquarters",
      status: "Active",
      joiningDate: "2021-04-01",
      salary: {
        annualCtc: 3600000,
        monthlyGross: 300000,
        basic: 150000,
        hra: 75000,
        specialAllowance: 75000,
        professionalTax: 200,
        epfDeduction: 1800,
        tds: 35000,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      employeeId: "OF-1002",
      name: "Ananya Sharma",
      email: "ananya.sharma@officeflow.example",
      phone: "+91 98490 22002",
      designation: "Head of People & Culture",
      department: "Human Resources",
      branch: "Headquarters",
      status: "Active",
      joiningDate: "2022-01-15",
      reportingManagerId: "OF-1001",
      reportingManagerName: "Vikram Desai",
      salary: {
        annualCtc: 1800000,
        monthlyGross: 150000,
        basic: 75000,
        hra: 37500,
        specialAllowance: 37500,
        professionalTax: 200,
        epfDeduction: 1800,
        tds: 12000,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      employeeId: "OF-1003",
      name: "Rahul Verma",
      email: "rahul.verma@officeflow.example",
      phone: "+91 98490 33003",
      designation: "Engineering Lead",
      department: "Engineering",
      branch: "Headquarters",
      status: "Active",
      joiningDate: "2022-06-10",
      reportingManagerId: "OF-1001",
      reportingManagerName: "Vikram Desai",
      salary: {
        annualCtc: 2100000,
        monthlyGross: 175000,
        basic: 87500,
        hra: 43750,
        specialAllowance: 43750,
        professionalTax: 200,
        epfDeduction: 1800,
        tds: 16000,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      employeeId: "OF-1004",
      name: "Karthik Reddy",
      email: "karthik.reddy@officeflow.example",
      phone: "+91 98490 44004",
      designation: "Senior Frontend Engineer",
      department: "Engineering",
      branch: "Headquarters",
      status: "Active",
      joiningDate: "2023-02-01",
      reportingManagerId: "OF-1003",
      reportingManagerName: "Rahul Verma",
      salary: {
        annualCtc: 1200000,
        monthlyGross: 100000,
        basic: 50000,
        hra: 25000,
        specialAllowance: 25000,
        professionalTax: 200,
        epfDeduction: 1800,
        tds: 6000,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      employeeId: "OF-1005",
      name: "Priya Nair",
      email: "priya.nair@officeflow.example",
      phone: "+91 98490 55005",
      designation: "Product Designer",
      department: "Design",
      branch: "Headquarters",
      status: "Active",
      joiningDate: "2023-08-15",
      reportingManagerId: "OF-1001",
      reportingManagerName: "Vikram Desai",
      salary: {
        annualCtc: 960000,
        monthlyGross: 80000,
        basic: 40000,
        hra: 20000,
        specialAllowance: 20000,
        professionalTax: 200,
        epfDeduction: 1800,
        tds: 4000,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  await empColl.insertMany(employees);
  console.log("Seeded Employees");

  // 3. Seed Biometric Devices & Mappings
  const devColl = db.collection("biometricdevices");
  await devColl.deleteMany({});
  await devColl.insertOne({
    deviceId: "DEV-01",
    name: "Main Reception Terminal",
    location: "Floor 1 Reception",
    ipAddress: "192.168.1.105",
    status: "Online",
    lastSync: new Date(),
    branch: "Headquarters",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mapColl = db.collection("biometricmappings");
  await mapColl.deleteMany({});
  await mapColl.insertMany([
    { deviceId: "DEV-01", biometricId: "BIO-101", employeeId: "OF-1001", employeeName: "Vikram Desai", status: "Active", createdAt: new Date() },
    { deviceId: "DEV-01", biometricId: "BIO-102", employeeId: "OF-1002", employeeName: "Ananya Sharma", status: "Active", createdAt: new Date() },
    { deviceId: "DEV-01", biometricId: "BIO-103", employeeId: "OF-1003", employeeName: "Rahul Verma", status: "Active", createdAt: new Date() },
    { deviceId: "DEV-01", biometricId: "BIO-104", employeeId: "OF-1004", employeeName: "Karthik Reddy", status: "Active", createdAt: new Date() },
    { deviceId: "DEV-01", biometricId: "BIO-105", employeeId: "OF-1005", employeeName: "Priya Nair", status: "Active", createdAt: new Date() },
  ]);
  console.log("Seeded Biometric Devices & Mappings");

  // 4. Seed Attendance (Today)
  const todayStr = new Date().toISOString().slice(0, 10);
  const attColl = db.collection("attendances");
  await attColl.deleteMany({});
  await attColl.insertMany([
    {
      employeeId: "OF-1001",
      employeeName: "Vikram Desai",
      department: "Executive",
      date: todayStr,
      checkIn: "08:55",
      checkOut: "18:05",
      totalHours: 9.1,
      status: "Present",
      confirmation: "Confirmed",
      deviceUsed: "DEV-01",
      branch: "Headquarters",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      employeeId: "OF-1002",
      employeeName: "Ananya Sharma",
      department: "Human Resources",
      date: todayStr,
      checkIn: "09:02",
      checkOut: "18:10",
      totalHours: 9.1,
      status: "Present",
      confirmation: "Confirmed",
      deviceUsed: "DEV-01",
      branch: "Headquarters",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      employeeId: "OF-1003",
      employeeName: "Rahul Verma",
      department: "Engineering",
      date: todayStr,
      checkIn: "09:12",
      checkOut: "18:30",
      totalHours: 9.3,
      status: "Present",
      confirmation: "Awaiting HR",
      deviceUsed: "DEV-01",
      branch: "Headquarters",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      employeeId: "OF-1004",
      employeeName: "Karthik Reddy",
      department: "Engineering",
      date: todayStr,
      checkIn: "09:35",
      checkOut: "18:30",
      totalHours: 8.9,
      status: "Late",
      confirmation: "Awaiting Manager",
      deviceUsed: "DEV-01",
      branch: "Headquarters",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      employeeId: "OF-1005",
      employeeName: "Priya Nair",
      department: "Design",
      date: todayStr,
      status: "On Leave",
      confirmation: "Confirmed",
      branch: "Headquarters",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  console.log("Seeded Attendance");

  // 5. Seed Assets
  const assetColl = db.collection("assets");
  await assetColl.deleteMany({});
  await assetColl.insertMany([
    {
      assetTag: "AST-001",
      name: 'MacBook Pro 16" M3 Max',
      category: "Laptop",
      brandModel: "Apple MacBook Pro",
      serialNumber: "C02XYZ123456",
      purchaseValue: 249000,
      purchaseDate: "2024-01-15",
      warrantyExpiry: "2027-01-15",
      status: "Assigned",
      assignedTo: {
        employeeId: "OF-1001",
        employeeName: "Vikram Desai",
        assignedDate: new Date("2024-01-16"),
        conditionAtIssue: "New",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      assetTag: "AST-002",
      name: 'Dell XPS 15 9530',
      category: "Laptop",
      brandModel: "Dell XPS",
      serialNumber: "DELL-987654321",
      purchaseValue: 165000,
      purchaseDate: "2024-02-10",
      warrantyExpiry: "2027-02-10",
      status: "Assigned",
      assignedTo: {
        employeeId: "OF-1004",
        employeeName: "Karthik Reddy",
        assignedDate: new Date("2024-02-12"),
        conditionAtIssue: "New",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      assetTag: "AST-003",
      name: 'LG UltraFine 27" 4K Monitor',
      category: "Monitor",
      brandModel: "LG 27UN850",
      serialNumber: "LG-MON-554433",
      purchaseValue: 32000,
      purchaseDate: "2024-03-01",
      warrantyExpiry: "2027-03-01",
      status: "Available",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  console.log("Seeded Assets");

  // 6. Seed Inward/Outward Mails
  const mailColl = db.collection("maillogs");
  await mailColl.deleteMany({});
  await mailColl.insertMany([
    {
      refNo: "IN-2026-0001",
      direction: "Incoming",
      channel: "Speed Post",
      sender: "Ministry of Corporate Affairs (MCA)",
      recipient: "Vikram Desai",
      subject: "Annual Statutory Compliance Notice",
      department: "Executive",
      status: "Delivered",
      priority: "Urgent",
      trackingNumber: "EP123456789IN",
      timeline: [{ at: new Date(), event: "Received and delivered to executive desk", by: "Receptionist" }],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      refNo: "OUT-2026-0001",
      direction: "Outgoing",
      channel: "Physical Courier",
      sender: "Ananya Sharma",
      recipient: "BlueDart Logistics Ltd",
      subject: "Original Signed Client Service Agreement",
      department: "Human Resources",
      status: "Dispatched",
      priority: "Normal",
      trackingNumber: "BD998877665",
      timeline: [{ at: new Date(), event: "Dispatched via BlueDart courier", by: "Ananya Sharma" }],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  console.log("Seeded Mail Logs");

  // 7. Seed Notifications & Announcements
  const notifColl = db.collection("notifications");
  await notifColl.deleteMany({});
  await notifColl.insertMany([
    {
      title: "Diwali Festival Holidays 2026",
      message: "Office will remain closed on Oct 31st and Nov 1st on account of Diwali. Have a safe and prosperous festival!",
      type: "success",
      targetRole: "all",
      isAnnouncement: true,
      readBy: [],
      createdAt: new Date(),
    },
    {
      title: "Quarterly Attendance Regularization Due",
      message: "Please regularize any missing punch times before payroll locks on Friday at 6:00 PM.",
      type: "warning",
      targetRole: "all",
      isAnnouncement: true,
      readBy: [],
      createdAt: new Date(),
    },
  ]);
  console.log("Seeded Announcements");

  console.log("\n========================================================");
  console.log("SEEDING COMPLETED SUCCESSFULLY!");
  console.log("Default accounts created with password: 'password123'");
  console.log("1. Super Admin: vikram.desai@officeflow.example");
  console.log("2. HR Admin:    ananya.sharma@officeflow.example");
  console.log("3. Manager:     rahul.verma@officeflow.example");
  console.log("4. Employee:    karthik.reddy@officeflow.example");
  console.log("========================================================\n");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seeding failed:", err.message);
  process.exit(1);
});
