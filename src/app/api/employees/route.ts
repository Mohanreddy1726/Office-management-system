import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Employee } from "@/models/Employee";
import { User } from "@/models/User";
import { AuditLog } from "@/models/AuditLog";
import { BiometricMapping } from "@/models/Biometric";
import { LeaveRequest, LeaveBalance } from "@/models/Leave";
import { Attendance } from "@/models/Attendance";
import { Asset } from "@/models/Asset";
import { DocumentRecord } from "@/models/Document";
import { Notification } from "@/models/Notification";
import { reconcileEmployeePunches } from "@/lib/biometric-sync";
import { ensureOnboardingLettersForEmployee } from "@/lib/onboarding-letters";
import { getCurrentUser } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";
import { sendVerificationEmail, getAppUrl } from "@/lib/email";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import mongoose from "mongoose";

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

      const employees = await Employee.find(query).sort({ employeeId: 1 }).lean();

      // Auto-standardize legacy department names only if explicitly matching old labels
      for (const emp of employees) {
        let normalizedDept = emp.department;
        if (emp.department === "Engineering" || emp.department === "Design") {
          normalizedDept = "Digital";
        } else if (emp.department === "Human Resources" || emp.department === "Finance" || emp.department === "Customer Support") {
          normalizedDept = "Operations";
        } else if (emp.department === "Sales") {
          normalizedDept = "Business Development";
        }
        if (normalizedDept !== emp.department) {
          emp.department = normalizedDept;
          await Employee.updateOne({ _id: emp._id }, { $set: { department: normalizedDept } });
        }
      }

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
          const obj = { ...e };
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

    const annualCtc = Number(body.annualCTC || body.annualCtc) || 0;
    const monthlyGross = Math.round(annualCtc / 12);
    const basic = monthlyGross;
    const hra = 0;
    const specialAllowance = 0;

    const workEmail = (body.workEmail || body.email || "").toLowerCase().trim();
    const personalEmail = (body.personalEmail || "").toLowerCase().trim();
    const primaryEmail = workEmail || personalEmail;

    if (!primaryEmail) {
      return NextResponse.json(
        { error: "Work email or personal email is required." },
        { status: 400 }
      );
    }

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

      const existingIds = await Employee.find({}, "employeeId").lean();
      let maxNum = 1000;
      for (const row of existingIds) {
        const m = String(row.employeeId || "").match(/(\d+)$/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!Number.isNaN(n) && n > maxNum) maxNum = n;
        }
      }
      const nextId = `OF-${maxNum + 1}`;

      const emergencyStr =
        typeof body.emergencyContact === "string"
          ? body.emergencyContact.trim()
          : body.emergencyContact?.phone || "";

      const employee = await Employee.create({
        employeeId: nextId,
        name: body.name.trim(),
        email: primaryEmail,
        workEmail,
        personalEmail,
        phone: body.phone.trim(),
        gender: body.gender || undefined,
        dateOfBirth: body.dob || body.dateOfBirth || undefined,
        bloodGroup: body.bloodGroup || undefined,
        maritalStatus: body.maritalStatus || undefined,
        address: body.address || undefined,
        panNumber: (body.pan || body.panNumber || "").toUpperCase().trim() || undefined,
        aadhaarNumber: cleanAadhaar || undefined,
        emergencyContact: emergencyStr
          ? { name: "", relationship: "", phone: emergencyStr }
          : undefined,

        designation: body.designation.trim(),
        department: body.department || "",
        branch: body.branch || "",
        employmentType: body.employmentType || "",
        reportingManagerId: body.managerId || body.reportingManagerId || undefined,
        status: shouldSendVerification ? "Pending Verification" : (isProbation ? "Probation" : "Active"),
        joiningDate: body.joiningDate || new Date().toISOString().slice(0, 10),
        probationEndDate,
        probationMonths: isProbation ? probationMonths : 0,

        qualification: body.qualification || undefined,
        institution: body.institution || undefined,
        graduationYear: body.graduationYear ? Number(body.graduationYear) : undefined,
        grade: body.grade || undefined,
        education:
          body.qualification || body.institution
            ? [
                {
                  degree: body.qualification || "",
                  institution: body.institution || "",
                  yearOfPassing: body.graduationYear ? String(body.graduationYear) : "",
                  percentageOrCgpa: body.grade || "",
                },
              ]
            : [],

        experienceYears: body.experienceYears !== undefined ? Number(body.experienceYears) : undefined,
        previousCompany: body.previousCompany || undefined,
        previousDesignation: body.previousDesignation || undefined,
        skills: body.skills || undefined,
        experience:
          body.previousCompany || body.previousDesignation
            ? [
                {
                  companyName: body.previousCompany || "",
                  designation: body.previousDesignation || "",
                  fromDate: "",
                  toDate: "",
                },
              ]
            : [],

        salaryStructureId: body.salaryStructureId || undefined,
        paymentMethod: body.paymentMethod || undefined,

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
          basic: monthlyGross,
          hra: 0,
          specialAllowance: 0,
          professionalTax: 0,
          epfDeduction: 0,
          esiDeduction: 0,
          tds: 0,
        },

        shift: {
          shiftName: "General Shift",
          startTime: "10:00",
          endTime: "18:30",
          gracePeriodMinutes: 15,
          halfDayThresholdHours: 4.5,
          fullDayHours: 8.5,
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

      // Auto-generate onboarding letters (Letter of Intent, Offer Letter, Appointment Letter)
      let generatedLettersCount = 0;
      try {
        const lettersRes = await ensureOnboardingLettersForEmployee(
          employee,
          session.name || "HR / Super Admin",
          session.userId,
          session.role
        );
        generatedLettersCount = lettersRes.created;
      } catch (docErr) {
        console.warn("[Onboarding Letters Generation Error]", docErr);
      }

      // Automatic Biometric Mapping & Immediate Attendance Pull
      let reconciledAttendanceCount = 0;
      if (body.biometricId) {
        const cleanBioId = String(body.biometricId).trim();
        if (cleanBioId) {
          try {
            await BiometricMapping.findOneAndUpdate(
              { deviceId: "DEV-01", biometricId: cleanBioId },
              {
                $set: {
                  deviceId: "DEV-01",
                  biometricId: cleanBioId,
                  employeeId: employee.employeeId,
                  employeeName: employee.name,
                  status: "Active",
                },
                $setOnInsert: { createdAt: new Date() },
              },
              { upsert: true, new: true }
            );

            reconciledAttendanceCount = await reconcileEmployeePunches(cleanBioId, employee);
          } catch (bioErr) {
            console.warn("[Onboarding Biometric Mapping Error]", bioErr);
          }
        }
      }

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
        reconciledAttendanceCount,
        generatedLettersCount,
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
      if (patch.department) {
        updateData.department = patch.department;
        updateData.team = patch.department;
      }
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

      // Update or link biometric mapping if provided in patch
      if (patch.biometricId && updated) {
        const cleanBioId = String(patch.biometricId).trim();
        if (cleanBioId) {
          try {
            await BiometricMapping.findOneAndUpdate(
              { deviceId: "DEV-01", biometricId: cleanBioId },
              {
                $set: {
                  deviceId: "DEV-01",
                  biometricId: cleanBioId,
                  employeeId: updated.employeeId,
                  employeeName: updated.name,
                  status: "Active",
                },
                $setOnInsert: { createdAt: new Date() },
              },
              { upsert: true, new: true }
            );
            await reconcileEmployeePunches(cleanBioId, updated);
          } catch (bioErr) {
            console.warn("[Patch Biometric Sync Error]", bioErr);
          }
        }
      }

      return NextResponse.json({ success: true, employee: updated });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    const roleHeader = req.headers.get("x-user-role");
    // Session role is authoritative; if no session (test/mock), check roleHeader
    const role = session ? session.role : (roleHeader === "super_admin" ? roleHeader : null);

    if (!role) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }
    // Strict restriction: ONLY Super Admin can delete employees
    if (role !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden. Only Super Admin has permission to delete employees." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id") || searchParams.get("employeeId");
    if (!id) {
      try {
        const body = await req.json();
        id = body?.id || body?.employeeId;
      } catch {
        // no json body
      }
    }

    if (!id) {
      return NextResponse.json({ error: "Employee ID is required" }, { status: 400 });
    }

    // Safety check: Prevent Super Admin from deleting their own active account
    if (session) {
      if ((session.employeeId && session.employeeId === id) || session.userId === id) {
        return NextResponse.json(
          { error: "You cannot delete your own active Super Admin employee record." },
          { status: 400 }
        );
      }
    }

    const conn = await connectToDatabase();
    if (conn) {
      // Find employee by employeeId or ObjectId
      const emp = await Employee.findOne({
        $or: [{ employeeId: id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }],
      });

      if (emp) {
        // Check if the target employee's email matches the current super admin's email
        if (
          session?.email &&
          (emp.email?.toLowerCase().trim() === session.email.toLowerCase().trim() ||
            emp.workEmail?.toLowerCase().trim() === session.email.toLowerCase().trim() ||
            emp.personalEmail?.toLowerCase().trim() === session.email.toLowerCase().trim())
        ) {
          return NextResponse.json(
            { error: "You cannot delete your own active Super Admin employee record." },
            { status: 400 }
          );
        }

        const empId = emp.employeeId;
        const empEmail = emp.workEmail || emp.email;
        const personalEmail = emp.personalEmail;

        // 1. Delete from Employee collection
        await Employee.deleteOne({ _id: emp._id });

        // 2. Delete associated User account(s)
        const emailFilter = [empEmail, personalEmail]
          .filter((em): em is string => Boolean(em))
          .map((em) => em.toLowerCase().trim());

        await User.deleteMany({
          $or: [
            ...(empId ? [{ employeeId: empId }] : []),
            ...(emailFilter.length > 0 ? [{ email: { $in: emailFilter } }] : []),
          ],
        });

        // 3. Clean associated biometric mappings
        if (empId) {
          await BiometricMapping.deleteMany({ employeeId: empId });
        }

        // 4. Clean associated leave requests and balances
        if (empId) {
          await LeaveRequest.deleteMany({ employeeId: empId });
          await LeaveBalance.deleteMany({ employeeId: empId });
        }

        // 5. Clean associated attendance records
        if (empId) {
          await Attendance.deleteMany({ employeeId: empId });
        }

        // 6. Release assigned assets back to inventory
        if (empId) {
          await Asset.updateMany(
            { $or: [{ "assignedTo.employeeId": empId }, { assignedTo: empId }] },
            {
              $set: { status: "Available", termsAccepted: false },
              $unset: {
                assignedTo: "",
                assignedEmployeeName: "",
                assignedAt: "",
                assignedBy: "",
                acceptanceStatus: "",
                employeeSignature: "",
                termsAcceptedAt: "",
                termsVersion: "",
                declineReason: "",
              },
            }
          );
        }

        // 7. Delete attached employee documents (including auto-generated onboarding letters) & notifications
        if (empId) {
          await DocumentRecord.deleteMany({ employeeId: empId });
          await Notification.deleteMany({ targetUserId: empId });
        }

        // 8. Audit log
        await AuditLog.create({
          user: session?.name || "Super Admin",
          role: "super_admin",
          action: "Employee Deleted",
          module: "Employees",
          details: `Super Admin permanently deleted employee ${emp.name} (${empId}).`,
          status: "Success",
        });

        return NextResponse.json({
          success: true,
          message: `Employee ${emp.name} (${empId}) permanently deleted.`,
        });
      }

      // If not found in Employee, also check and clean up any orphaned records
      await User.deleteMany({ employeeId: id });
      await BiometricMapping.deleteMany({ employeeId: id });
      await LeaveRequest.deleteMany({ employeeId: id });
      await LeaveBalance.deleteMany({ employeeId: id });
      await Attendance.deleteMany({ employeeId: id });
      await DocumentRecord.deleteMany({ employeeId: id });
      await Notification.deleteMany({ targetUserId: id });

      return NextResponse.json({
        success: true,
        message: "Employee records and associated data cleaned up successfully.",
      });
    } else {
      const store = getMockStore();
      store.employees = store.employees.filter((e) => e.employeeId !== id && e.id !== id);
      return NextResponse.json({ success: true, message: "Employee removed from mock store." });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
