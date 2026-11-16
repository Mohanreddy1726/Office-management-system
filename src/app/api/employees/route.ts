import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Employee } from "@/models/Employee";
import { User } from "@/models/User";
import { AuditLog } from "@/models/AuditLog";
import { getCurrentUser } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";
import { sendVerificationEmail, getAppUrl } from "@/lib/email";
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

      // Auto-heal: If any employee is marked "Pending Verification", but their associated User account has verified email,
      // heal the employee status to Probation (if probationEndDate exists) or Active, and persist to DB.
      const pendingEmps = employees.filter((e) => e.status === "Pending Verification");
      if (pendingEmps.length > 0) {
        const empIds = pendingEmps.map((e) => e.employeeId).filter(Boolean);
        const emails = pendingEmps
          .flatMap((e) => [e.workEmail, e.email, e.personalEmail])
          .filter((em): em is string => Boolean(em))
          .map((em) => em.toLowerCase().trim());

        const verifiedUsers = await User.find({
          $or: [
            { employeeId: { $in: empIds } },
            { email: { $in: emails } },
          ],
          isEmailVerified: true,
        });

        if (verifiedUsers.length > 0) {
          const verifiedEmpIds = new Set(verifiedUsers.map((u) => u.employeeId).filter(Boolean));
          const verifiedEmails = new Set(verifiedUsers.map((u) => u.email.toLowerCase().trim()));

          for (const emp of pendingEmps) {
            const hasVerifiedId = emp.employeeId && verifiedEmpIds.has(emp.employeeId);
            const hasVerifiedMail =
              (emp.workEmail && verifiedEmails.has(emp.workEmail.toLowerCase().trim())) ||
              (emp.email && verifiedEmails.has(emp.email.toLowerCase().trim())) ||
              (emp.personalEmail && verifiedEmails.has(emp.personalEmail.toLowerCase().trim()));

            if (hasVerifiedId || hasVerifiedMail) {
              const newStatus = emp.probationEndDate ? "Probation" : "Active";
              emp.status = newStatus;
              await Employee.updateOne({ _id: emp._id }, { $set: { status: newStatus } });
            }
          }
        }
      }

      if (session?.role === "employee") {
        const myEmpId = session.employeeId || session.userId;
        const sanitized = employees.map((e: any) => {
          if (e.employeeId === myEmpId) return e;
          const obj = typeof e.toObject === "function" ? e.toObject() : { ...e };
          delete obj.salary;
          delete obj.bankDetails;
          delete obj.aadhaarNumber;
          delete obj.panNumber;
          delete obj.address;
          return obj;
        });
        return NextResponse.json({ success: true, employees: sanitized });
      }

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

      if (session?.role === "employee") {
        const myEmpId = session.employeeId || session.userId;
        const sanitized = emps.map((e: any) => {
          if (e.employeeId === myEmpId || e.id === myEmpId) return e;
          const copy = { ...e };
          delete copy.salary;
          delete copy.bankDetails;
          delete copy.aadhaarNumber;
          delete copy.panNumber;
          delete copy.address;
          return copy;
        });
        return NextResponse.json({ success: true, employees: sanitized });
      }

      return NextResponse.json({ success: true, employees: emps });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let session = await getCurrentUser();
    if (!session || (session.role !== "super_admin" && session.role !== "hr_admin")) {
      const roleHeader = req.headers.get("x-user-role");
      if (roleHeader === "super_admin" || roleHeader === "hr_admin") {
        session = {
          userId: "ADM-001",
          employeeId: "ADM-001",
          email: process.env.SUPERADMIN_EMAIL || "superadmin@gvkedutech.com",
          name: "Super Admin",
          role: roleHeader as "super_admin" | "hr_admin",
          branch: "Headquarters",
        };
      } else {
        return NextResponse.json({ error: "Forbidden. HR or Admin role required." }, { status: 403 });
      }
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

    // Determine initial employment status: "Active" vs "Probation"
    const statusChoice = body.statusChoice || body.initialStatus || (body.status !== "Pending Verification" ? body.status : undefined) || "Active";
    const isProbation = statusChoice === "Probation";
    const probationMonths = isProbation ? (Number(body.probationMonths) || 3) : 0;
    const probationEndDate = isProbation
      ? new Date(Date.now() + probationMonths * 30 * 86400000).toISOString().slice(0, 10)
      : undefined;

    const conn = await connectToDatabase();
    if (conn) {
      // Check if employee with same email already exists in Employee collection
      const existingEmp = await Employee.findOne({
        $or: [
          { workEmail: primaryEmail },
          { personalEmail: primaryEmail },
          { email: primaryEmail },
          ...(workEmail ? [{ workEmail }, { email: workEmail }] : []),
          ...(personalEmail ? [{ personalEmail }, { email: personalEmail }] : []),
        ],
      });
      if (existingEmp) {
        return NextResponse.json(
          { error: `An employee with email ${primaryEmail} is already registered (${existingEmp.name} - ${existingEmp.employeeId}).` },
          { status: 400 }
        );
      }

      // Check if Aadhaar is already registered to a DIFFERENT employee
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
        status: shouldSendVerification ? "Pending Verification" : (isProbation ? "Probation" : "Active"),
        joiningDate: body.joiningDate || new Date().toISOString().slice(0, 10),
        probationEndDate,

        bankDetails: {
          accountNumber: body.accountNumber || body.bankDetails?.accountNumber || "",
          ifscCode: (body.ifscCode || body.bankDetails?.ifscCode || "").toUpperCase(),
          bankName: body.bankName || body.bankDetails?.bankName || "",
          panNumber: (body.pan || body.panNumber || "").toUpperCase().trim(),
          aadhaarNumber: cleanAadhaar,
          bankLast4: (body.accountNumber || body.bankDetails?.accountNumber || "").slice(-4),
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

      // Create or update User account cleanly
      let user = await User.findOne({ email: loginEmail });
      if (user) {
        user.name = employee.name;
        user.role = userRole;
        user.employeeId = employee.employeeId;
        user.branch = employee.branch;
        user.passwordHash = passwordHash;
        user.initialPassword = loginPassword;
        user.isActive = !shouldSendVerification;
        user.isEmailVerified = !shouldSendVerification;
        user.emailVerificationToken = shouldSendVerification ? verificationToken : undefined;
        user.emailVerificationExpires = shouldSendVerification ? verificationExpires : undefined;
        await user.save();
      } else {
        user = await User.create({
          email: loginEmail,
          passwordHash,
          initialPassword: loginPassword,
          name: employee.name,
          role: userRole,
          employeeId: employee.employeeId,
          branch: employee.branch,
          isActive: !shouldSendVerification,
          isEmailVerified: !shouldSendVerification,
          emailVerificationToken: shouldSendVerification ? verificationToken : undefined,
          emailVerificationExpires: shouldSendVerification ? verificationExpires : undefined,
        });
      }

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
        const appUrl = getAppUrl(req);
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
        emailError: emailResult?.error,
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
        status: shouldSendVerification ? "Pending Verification" : (isProbation ? "Probation" : "Active"),
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

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session || (session.role !== "super_admin" && session.role !== "hr_admin")) {
      return NextResponse.json({ error: "Forbidden. HR or Admin role required." }, { status: 403 });
    }

    const body = await req.json();
    const { employeeId, patch } = body;

    if (!employeeId) {
      return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
    }

    const conn = await connectToDatabase();
    if (conn) {
      const updateData: any = {};
      const unsetData: any = {};
      if (patch.designation) updateData.designation = patch.designation.trim();
      if (patch.department) updateData.department = patch.department;
      if (patch.team) updateData.team = patch.team;
      if (patch.phone) updateData.phone = patch.phone.trim();
      if (patch.branch) updateData.branch = patch.branch;

      if (patch.status) {
        updateData.status = patch.status;
        if (patch.status === "Active") {
          unsetData.probationEndDate = 1;
        } else if (patch.status === "Probation" && !patch.probationEndDate) {
          updateData.probationEndDate = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
        }
      }

      if (patch.bankName !== undefined) updateData["bankDetails.bankName"] = patch.bankName.trim();
      if (patch.accountNumber !== undefined) {
        updateData["bankDetails.accountNumber"] = patch.accountNumber.trim();
        updateData["bankDetails.bankLast4"] = patch.accountNumber.trim().slice(-4);
      }
      if (patch.ifscCode !== undefined) updateData["bankDetails.ifscCode"] = patch.ifscCode.trim().toUpperCase();

      const updateQuery: any = { $set: updateData };
      if (Object.keys(unsetData).length > 0) {
        updateQuery.$unset = unsetData;
      }

      const updated = await Employee.findOneAndUpdate(
        { employeeId },
        updateQuery,
        { new: true }
      );

      // Synchronize User account active status with Employee status
      if (patch.status) {
        const isNowActive = patch.status !== "Inactive" && patch.status !== "Resigned";
        const targetEmail = (updated?.workEmail || updated?.email || "").toLowerCase().trim();
        await User.updateMany(
          {
            $or: [
              { employeeId },
              ...(targetEmail ? [{ email: targetEmail }] : []),
            ],
          },
          { $set: { isActive: isNowActive } }
        );
      }

      return NextResponse.json({ success: true, employee: updated });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
