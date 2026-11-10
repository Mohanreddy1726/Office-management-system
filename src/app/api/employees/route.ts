import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Employee } from "@/models/Employee";
import { User } from "@/models/User";
import { AuditLog } from "@/models/AuditLog";
import { getCurrentUser } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";
import { sendVerificationEmail } from "@/lib/email";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const department = searchParams.get("department") || "";
    const status = searchParams.get("status") || "";

    const conn = await connectToDatabase();
    if (conn) {
      const query: any = {};
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { employeeId: { $regex: search, $options: "i" } },
          { designation: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { aadhaarNumber: { $regex: search, $options: "i" } },
        ];
      }
      if (department && department !== "All") query.department = department;
      if (status && status !== "All") query.status = status;

      const employees = await Employee.find(query).sort({ employeeId: 1 });
      return NextResponse.json({ success: true, employees });
    } else {
      const store = getMockStore();
      let emps = store.employees;
      if (search) {
        const s = search.toLowerCase();
        emps = emps.filter(
          (e) =>
            e.name.toLowerCase().includes(s) ||
            e.employeeId.toLowerCase().includes(s) ||
            e.designation.toLowerCase().includes(s) ||
            e.email.toLowerCase().includes(s) ||
            (e.aadhaarNumber && e.aadhaarNumber.includes(s))
        );
      }
      if (department && department !== "All") emps = emps.filter((e) => e.department === department);
      if (status && status !== "All") emps = emps.filter((e) => e.status === status);
      return NextResponse.json({ success: true, employees: emps });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session || (session.role !== "super_admin" && session.role !== "hr_admin")) {
      return NextResponse.json({ error: "Forbidden. HR or Admin role required." }, { status: 403 });
    }

    const body = await req.json();

    if (!body.name || !body.designation || !body.phone) {
      return NextResponse.json(
        { error: "Name, designation, and phone number are required." },
        { status: 400 }
      );
    }

    // Aadhaar Card Validation
    const cleanAadhaar = (body.aadhaarNumber || "").replace(/\s+/g, "").trim();
    if (cleanAadhaar && (!/^\d{12}$/.test(cleanAadhaar))) {
      return NextResponse.json(
        { error: "Aadhaar Card number must be exactly 12 digits." },
        { status: 400 }
      );
    }

    const annualCtc = Number(body.annualCTC || body.annualCtc) || 600000;
    const monthlyGross = Math.round(annualCtc / 12);
    const basic = Math.round(monthlyGross * 0.5);
    const hra = Math.round(monthlyGross * 0.25);
    const specialAllowance = monthlyGross - (basic + hra);

    const workEmail = (body.workEmail || body.email || "").toLowerCase().trim();
    const personalEmail = (body.personalEmail || "").toLowerCase().trim();
    const primaryEmail = workEmail || personalEmail;

    const loginEmail = (body.loginEmail || workEmail || personalEmail).toLowerCase().trim();
    const loginPassword = body.loginPassword || `GvkEmp@${Math.floor(1000 + Math.random() * 9000)}`;
    const userRole = body.role || "employee";
    const shouldSendVerification = body.sendVerification !== false;

    const conn = await connectToDatabase();
    if (conn) {
      // Check for duplicate work email
      const existingUser = await User.findOne({ email: loginEmail });
      if (existingUser) {
        return NextResponse.json(
          { error: `An account with email ${loginEmail} already exists.` },
          { status: 400 }
        );
      }

      // Check if Aadhaar is already registered
      if (cleanAadhaar) {
        const existingAadhaar = await Employee.findOne({ aadhaarNumber: cleanAadhaar });
        if (existingAadhaar) {
          return NextResponse.json(
            { error: `Employee with Aadhaar Number ${cleanAadhaar.slice(0, 4)}...${cleanAadhaar.slice(-4)} is already registered (${existingAadhaar.name}).` },
            { status: 400 }
          );
        }
      }

      const count = await Employee.countDocuments();
      const nextId = `OF-${1000 + count + 1}`;

      const employee = await Employee.create({
        employeeId: nextId,
        name: body.name.trim(),
        email: primaryEmail,
        workEmail,
        personalEmail,
        phone: body.phone.trim(),
        gender: body.gender || "Other",
        dateOfBirth: body.dob || body.dateOfBirth,
        bloodGroup: body.bloodGroup,
        address: body.address,
        panNumber: (body.pan || body.panNumber || "").toUpperCase().trim(),
        aadhaarNumber: cleanAadhaar,

        designation: body.designation.trim(),
        department: body.department || "Operations",
        branch: body.branch || "Headquarters",
        status: shouldSendVerification ? "Pending Verification" : (body.status || "Active"),
        joiningDate: body.joiningDate || new Date().toISOString().slice(0, 10),
        probationEndDate: body.probationMonths ? new Date(Date.now() + Number(body.probationMonths) * 30 * 86400000).toISOString().slice(0, 10) : undefined,

        bankDetails: {
          accountNumber: body.accountNumber || body.bankDetails?.accountNumber || "",
          ifscCode: (body.ifscCode || body.bankDetails?.ifscCode || "").toUpperCase(),
          bankName: body.bankName || body.bankDetails?.bankName || "HDFC Bank",
          panNumber: (body.pan || body.panNumber || "").toUpperCase().trim(),
          aadhaarNumber: cleanAadhaar,
          bankLast4: (body.accountNumber || "").slice(-4),
        },

        salary: {
          annualCtc,
          monthlyGross,
          basic,
          hra,
          specialAllowance,
          professionalTax: 200,
          epfDeduction: 0, // Zero PF Policy
          esiDeduction: 0, // Zero ESI Policy
          tds: Math.round(monthlyGross * 0.05),
        },
      });

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const verificationExpires = new Date(Date.now() + 48 * 3600 * 1000); // 48 hours validity

      const passwordHash = await bcrypt.hash(loginPassword, 10);

      const user = await User.create({
        email: loginEmail,
        passwordHash,
        initialPassword: loginPassword, // Stored temporarily until email verification
        name: employee.name,
        role: userRole,
        employeeId: employee.employeeId,
        branch: employee.branch,
        isActive: !shouldSendVerification, // Inactive until verified if verification is requested
        isEmailVerified: !shouldSendVerification,
        emailVerificationToken: shouldSendVerification ? verificationToken : undefined,
        emailVerificationExpires: shouldSendVerification ? verificationExpires : undefined,
      });

      // Create detailed Audit Log
      await AuditLog.create({
        auditId: `AU-${Date.now()}`,
        user: session.name || "Super Admin",
        userId: session.userId,
        role: session.role,
        action: "Added Employee & Created Login Credentials",
        module: "Employees",
        record: `${employee.employeeId} - ${employee.name}`,
        outcome: "Success",
        details: `Aadhaar: ${cleanAadhaar ? cleanAadhaar.slice(0, 4) + " **** " + cleanAadhaar.slice(-4) : "N/A"} | Role: ${userRole} | Login: ${loginEmail} | Verification Dispatched: ${shouldSendVerification ? "Yes (gvkdigital01@gmail.com)" : "No"}`,
      });

      // Send Verification Email via Gmail SMTP
      let emailResult = null;
      if (shouldSendVerification) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`;
        const recipient = personalEmail || workEmail || loginEmail;

        emailResult = await sendVerificationEmail({
          name: employee.name,
          toEmail: recipient,
          verificationUrl,
          employeeId: employee.employeeId,
        });
      }

      return NextResponse.json({
        success: true,
        employee,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          isActive: user.isActive,
        },
        emailSent: emailResult?.success ?? false,
      });
    } else {
      // In-memory fallback
      const store = getMockStore();
      const nextId = `OF-${1000 + store.employees.length + 1}`;
      const newEmp = {
        employeeId: nextId,
        name: body.name,
        email: primaryEmail,
        workEmail,
        personalEmail,
        phone: body.phone,
        designation: body.designation,
        department: body.department,
        branch: body.branch || "Headquarters",
        status: "Active",
        aadhaarNumber: cleanAadhaar,
        panNumber: body.pan,
        salary: {
          annualCtc,
          monthlyGross,
          basic,
          hra,
          specialAllowance,
          professionalTax: 200,
          epfDeduction: 0,
          esiDeduction: 0,
          tds: Math.round(monthlyGross * 0.05),
        },
      };
      store.employees.push(newEmp);
      return NextResponse.json({ success: true, employee: newEmp, emailSent: false });
    }
  } catch (error: any) {
    console.error("[Create Employee API Error]", error);
    return NextResponse.json({ error: error.message || "Failed to create employee" }, { status: 500 });
  }
}
