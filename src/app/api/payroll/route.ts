import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { PayrollRun, Payslip } from "@/models/Payroll";
import { Employee } from "@/models/Employee";
import { getCurrentUser } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || new Date().toISOString().slice(0, 7);

    const conn = await connectToDatabase();
    if (conn) {
      if (session.role === "employee" && session.employeeId) {
        const myPayslips = await Payslip.find({ employeeId: session.employeeId }).sort({ period: -1 });
        return NextResponse.json({ success: true, isEmployee: true, payslips: myPayslips });
      }

      let run = await PayrollRun.findOne({ period });
      let payslips: any[] = [];
      if (run) payslips = await Payslip.find({ payrollRunId: run.runId });
      return NextResponse.json({ success: true, isEmployee: false, run, payslips, period });
    } else {
      const store = getMockStore();
      if (session.role === "employee" && session.employeeId) {
        const myPayslips = store.payslips.filter((p) => p.employeeId === session.employeeId);
        return NextResponse.json({ success: true, isEmployee: true, payslips: myPayslips });
      }
      const run = store.payrollRuns.find((r) => r.period === period) || null;
      const slips = store.payslips.filter((p) => p.period === period);
      return NextResponse.json({ success: true, isEmployee: false, run, payslips: slips, period });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session || (session.role !== "super_admin" && session.role !== "hr_admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const period = body.period || new Date().toISOString().slice(0, 7);
    const runId = `PR-${period}`;

    const conn = await connectToDatabase();
    if (conn) {
      const employees = await Employee.find({ status: { $in: ["Active", "Probation", "Notice"] } });
      let totalGross = 0;
      let totalDeductions = 0;
      let employerContributions = 0;
      let totalNet = 0;

      await Payslip.deleteMany({ payrollRunId: runId });

      for (const emp of employees) {
        const gross = emp.salary?.monthlyGross || 50000;
        const basic = emp.salary?.basic || Math.round(gross * 0.45);
        const hra = emp.salary?.hra || Math.round(basic * 0.5);
        const specialAllowance = Math.max(0, gross - (basic + hra));
        const epf = 0; // Zero PF Policy
        const esi = 0; // Zero ESI Policy
        const pt = emp.salary?.professionalTax ?? 200;
        const tds = emp.salary?.tds ?? (gross > 100000 ? Math.round(gross * 0.1) : 0);
        const deductions = pt + tds;
        const net = Math.max(0, gross - deductions);

        totalGross += gross;
        totalDeductions += deductions;
        employerContributions += 0;
        totalNet += net;

        await Payslip.create({
          payrollRunId: runId,
          employeeId: emp.employeeId,
          employeeName: emp.name,
          designation: emp.designation,
          department: emp.department,
          period,
          workDays: 30,
          presentDays: 30,
          paidLeaves: 0,
          lopDays: 0,
          earnings: { basic, hra, specialAllowance, gross },
          deductions: { epf: 0, esi: 0, professionalTax: pt, tds, total: deductions },
          netSalary: net,
          status: "Pending",
        });
      }

      let run = await PayrollRun.findOne({ period });
      if (!run) {
        run = await PayrollRun.create({
          runId,
          period,
          status: "Calculated",
          headcount: employees.length,
          totalGross,
          totalDeductions,
          employerContributions,
          totalNet,
        });
      } else {
        run.headcount = employees.length;
        run.totalGross = totalGross;
        run.totalDeductions = totalDeductions;
        run.employerContributions = employerContributions;
        run.totalNet = totalNet;
        run.status = "Calculated";
        await run.save();
      }

      const slips = await Payslip.find({ payrollRunId: runId });
      return NextResponse.json({ success: true, run, payslips: slips });
    } else {
      const store = getMockStore();
      const employees = store.employees;
      let totalGross = 0;
      let totalDeductions = 0;
      let employerContributions = 0;
      let totalNet = 0;
      const newPayslips: any[] = [];

      for (const emp of employees) {
        const gross = emp.salary?.monthlyGross || 50000;
        const basic = emp.salary?.basic || Math.round(gross * 0.45);
        const hra = emp.salary?.hra || Math.round(basic * 0.5);
        const specialAllowance = Math.max(0, gross - (basic + hra));
        const epf = 0; // Zero PF Policy
        const pt = emp.salary?.professionalTax ?? 200;
        const tds = emp.salary?.tds ?? (gross > 100000 ? Math.round(gross * 0.1) : 0);
        const deductions = pt + tds;
        const net = Math.max(0, gross - deductions);

        totalGross += gross;
        totalDeductions += deductions;
        employerContributions += 0;
        totalNet += net;

        newPayslips.push({
          _id: `ps-${Date.now()}-${emp.employeeId}`,
          payrollRunId: runId,
          employeeId: emp.employeeId,
          employeeName: emp.name,
          designation: emp.designation,
          department: emp.department,
          period,
          workDays: 30,
          presentDays: 30,
          paidLeaves: 0,
          lopDays: 0,
          earnings: { basic, hra, specialAllowance, gross },
          deductions: { epf: 0, esi: 0, professionalTax: pt, tds, total: deductions },
          netSalary: net,
          status: "Pending",
        });
      }

      const mockRun = {
        _id: `run-${Date.now()}`,
        runId,
        period,
        status: "Calculated",
        headcount: employees.length,
        totalGross,
        totalDeductions,
        employerContributions,
        totalNet,
      };

      store.payrollRuns.push(mockRun);
      store.payslips.push(...newPayslips);

      return NextResponse.json({ success: true, run: mockRun, payslips: newPayslips });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session || (session.role !== "super_admin" && session.role !== "hr_admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { runId, action, status, paymentDetails } = body;

    const conn = await connectToDatabase();
    if (conn) {
      const run = await PayrollRun.findOne({ runId });
      if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
      if (status) run.status = status;
      else if (action === "approve") {
        run.status = "Approved";
        run.approvedBy = session.name;
      } else if (action === "lock") {
        run.status = "Locked";
        run.lockedBy = session.name;
      } else if (action === "record_payment") {
        run.status = "Payment Recorded";
        if (paymentDetails) run.paymentDetails = paymentDetails;
      }
      await run.save();
      return NextResponse.json({ success: true, run });
    } else {
      const store = getMockStore();
      const run = store.payrollRuns.find((r) => r.runId === runId);
      if (run) {
        if (status) run.status = status;
        else if (action === "approve") run.status = "Approved";
        else if (action === "lock") run.status = "Locked";
        else if (action === "record_payment") run.status = "Payment Recorded";
      }
      return NextResponse.json({ success: true, run: run || {} });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
