import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Asset } from "@/models/Asset";
import { Employee } from "@/models/Employee";
import { Notification } from "@/models/Notification";
import { AuditLog } from "@/models/AuditLog";
import { getCurrentUser } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";
import { GVK_ASSET_TERMS_VERSION } from "@/lib/policies";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

function extractAssignedEmpId(assignedTo: any): string | null {
  if (!assignedTo) return null;
  if (typeof assignedTo === "string") return assignedTo;
  if (typeof assignedTo === "object" && assignedTo.employeeId) return String(assignedTo.employeeId);
  return null;
}

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isEmployee = session.role === "employee";
    const empId = session.employeeId || session.userId;

    const conn = await connectToDatabase();
    if (conn) {
      const assetFilter = isEmployee && empId
        ? { $or: [{ "assignedTo.employeeId": empId }, { assignedTo: empId }] }
        : {};
      const [assets, employees] = await Promise.all([
        Asset.find(assetFilter).sort({ createdAt: -1 }).lean(),
        Employee.find({ status: { $in: ["Active", "Probation"] } }, "employeeId name department branch").lean(),
      ]);
      return NextResponse.json({ success: true, assets, employees });
    } else {
      const store = getMockStore();
      const assets = isEmployee && empId
        ? store.assets.filter((a: any) => extractAssignedEmpId(a.assignedTo) === empId)
        : store.assets;
      return NextResponse.json({ success: true, assets, employees: store.employees });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      action,
      name,
      category,
      brandModel,
      serialNumber,
      assetTag: customTag,
      branch,
      vendor,
      invoiceNo,
      purchaseDate,
      purchaseValue,
      warrantyExpiry,
      condition,
      specs,
      notes,
      assetId,
      employeeId,
      agreedToAllTerms,
      signatureName,
      termsVersion,
      reason,
    } = body;

    const isAdmin = session.role === "super_admin" || session.role === "hr_admin";
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    // Only HR Admin / Super Admin may create, issue/assign, or return assets
    if (["create_asset", "issue_asset", "return_asset"].includes(action) && !isAdmin) {
      return NextResponse.json(
        { error: "Only HR Admin or Super Admin can register, assign, or return company assets." },
        { status: 403 }
      );
    }

    const conn = await connectToDatabase();
    if (conn) {
      if (action === "create_asset") {
        if (!name || !serialNumber) {
          return NextResponse.json({ error: "Equipment name and serial number are required." }, { status: 400 });
        }
        const count = await Asset.countDocuments();
        const assetTag = customTag?.trim() || `AST-${String(count + 1).padStart(3, "0")}`;

        let initialAssignedTo: any = undefined;
        let initialStatus = "Available";
        let initialAcceptance: string | undefined = undefined;
        let assignedEmpName: string | undefined = undefined;
        const history: any[] = [{ date: todayStr, action: "Registered in Inventory", note: `By ${session.name}` }];

        if (employeeId && employeeId !== "none") {
          const emp = await Employee.findOne({ employeeId }).lean();
          if (!emp) {
            return NextResponse.json({ error: `Employee ${employeeId} not found.` }, { status: 404 });
          }
          initialStatus = "Pending Acceptance";
          initialAcceptance = "Pending";
          assignedEmpName = emp.name;
          initialAssignedTo = {
            employeeId: emp.employeeId,
            employeeName: emp.name,
            assignedDate: new Date(),
            conditionAtIssue: condition || "Good",
          };
          history.push({
            date: todayStr,
            action: "Assigned (Pending Employee Approval)",
            employeeId: emp.employeeId,
            note: `Assigned by ${session.name}; awaiting employee T&C approval`,
          });
        }

        const asset = await Asset.create({
          assetId: assetTag,
          assetTag,
          name: String(name).trim(),
          category: category || "Laptop",
          brandModel: brandModel || name,
          serialNumber: String(serialNumber).trim(),
          branch: branch || "Hyderabad",
          vendor: vendor || undefined,
          invoiceNo: invoiceNo || undefined,
          purchaseDate: purchaseDate || todayStr,
          purchaseValue: Number(purchaseValue) || 0,
          warrantyExpiry: warrantyExpiry || "",
          condition: condition || "Good",
          specs: specs || undefined,
          notes: notes || undefined,
          status: initialStatus,
          assignedTo: initialAssignedTo,
          assignedEmployeeName: assignedEmpName,
          assignedAt: initialAssignedTo ? new Date().toISOString() : undefined,
          assignedBy: initialAssignedTo ? session.name : undefined,
          acceptanceStatus: initialAcceptance,
          termsAccepted: false,
          history,
        });

        if (initialAssignedTo) {
          await Notification.create({
            recipientId: initialAssignedTo.employeeId,
            category: "Approvals",
            title: "Asset Assigned — Approval Required",
            description: `${session.name} assigned "${asset.name}" (${asset.assetTag}) to you. Review and accept the GVK Appointment Letter asset terms to approve.`,
            priority: "High",
            link: "/assets?tab=pending",
          }).catch(() => {});
        }

        await AuditLog.create({
          auditId: `AU-${Date.now()}`,
          user: session.name,
          userId: session.userId,
          role: session.role,
          action: initialAssignedTo ? "Registered & Assigned Asset (Pending Approval)" : "Registered Asset",
          module: "Assets",
          record: `${asset.name} (${asset.assetTag})`,
          outcome: "Success",
        }).catch(() => {});

        return NextResponse.json({ success: true, asset });
      }

      const assetQuery = {
        $or: [
          { assetTag: assetId },
          { assetId },
          ...(mongoose.Types.ObjectId.isValid(assetId) ? [{ _id: assetId }] : []),
        ],
      };

      if (action === "issue_asset") {
        const [asset, employee] = await Promise.all([
          Asset.findOne(assetQuery),
          Employee.findOne({ employeeId }),
        ]);
        if (!asset || !employee) {
          return NextResponse.json({ error: "Asset or employee not found." }, { status: 404 });
        }
        if (asset.status === "Assigned" || asset.status === "Pending Acceptance") {
          return NextResponse.json(
            { error: "Asset is already assigned or awaiting employee acceptance." },
            { status: 400 }
          );
        }

        asset.status = "Pending Acceptance";
        asset.acceptanceStatus = "Pending";
        asset.termsAccepted = false;
        asset.termsAcceptedAt = undefined;
        asset.termsVersion = undefined;
        asset.employeeSignature = undefined;
        asset.declineReason = undefined;
        asset.assignedAt = new Date().toISOString();
        asset.assignedBy = session.name;
        asset.assignedEmployeeName = employee.name;
        asset.assignedTo = {
          employeeId: employee.employeeId,
          employeeName: employee.name,
          assignedDate: new Date(),
          conditionAtIssue: condition || asset.condition || "Good",
        };
        asset.history = Array.isArray(asset.history) ? asset.history : [];
        asset.history.push({
          date: todayStr,
          action: "Assigned (Pending Employee Approval)",
          employeeId: employee.employeeId,
          note: body.note || `Assigned by ${session.name}; awaiting GVK terms acceptance`,
        });
        await asset.save();

        await Notification.create({
          recipientId: employee.employeeId,
          category: "Approvals",
          title: "Asset Assigned — Terms Approval Required",
          description: `${session.name} assigned "${asset.name}" (${asset.assetTag || asset.serialNumber}) to you. Agree to the Appointment Letter asset terms to approve.`,
          priority: "High",
          link: "/assets?tab=pending",
        }).catch(() => {});

        await AuditLog.create({
          auditId: `AU-${Date.now()}`,
          user: session.name,
          userId: session.userId,
          role: session.role,
          action: "Assigned Asset (Pending Employee Approval)",
          module: "Assets",
          record: `${asset.name} (${asset.assetTag}) → ${employee.name}`,
          outcome: "Success",
        }).catch(() => {});

        return NextResponse.json({ success: true, asset });
      }

      if (action === "accept_asset") {
        const asset = await Asset.findOne(assetQuery);
        if (!asset) return NextResponse.json({ error: "Asset not found." }, { status: 404 });

        const assignedEmpId = extractAssignedEmpId(asset.assignedTo);
        const sessionEmpId = session.employeeId || session.userId;
        if (!assignedEmpId || assignedEmpId !== sessionEmpId) {
          return NextResponse.json(
            { error: "Only the assigned employee can approve and accept this asset." },
            { status: 403 }
          );
        }
        if (asset.status !== "Pending Acceptance") {
          return NextResponse.json(
            { error: "This asset is not awaiting acceptance." },
            { status: 400 }
          );
        }
        if (agreedToAllTerms !== true) {
          return NextResponse.json(
            { error: "You must agree to all GVK Appointment Letter asset terms & conditions before approving." },
            { status: 400 }
          );
        }

        const acceptedAt = new Date().toISOString();
        const sigName = String(signatureName || session.name || assignedEmpId).trim();

        asset.status = "Assigned";
        asset.acceptanceStatus = "Accepted";
        asset.termsAccepted = true;
        asset.termsAcceptedAt = acceptedAt;
        asset.termsVersion = termsVersion || GVK_ASSET_TERMS_VERSION;
        asset.employeeSignature = sigName;
        asset.declineReason = undefined;
        asset.history = Array.isArray(asset.history) ? asset.history : [];
        asset.history.push({
          date: todayStr,
          action: "Approved & Accepted by Employee",
          employeeId: assignedEmpId,
          note: `Agreed to all GVK Appointment Letter T&Cs (${asset.termsVersion}) · Signed: ${sigName}`,
        });
        await asset.save();

        await AuditLog.create({
          auditId: `AU-${Date.now()}`,
          user: session.name,
          userId: session.userId,
          role: session.role,
          action: "Employee Approved Asset & Accepted Terms",
          module: "Assets",
          record: `${asset.name} (${asset.assetTag}) · ${assignedEmpId}`,
          outcome: "Success",
        }).catch(() => {});

        return NextResponse.json({ success: true, asset });
      }

      if (action === "decline_asset") {
        const asset = await Asset.findOne(assetQuery);
        if (!asset) return NextResponse.json({ error: "Asset not found." }, { status: 404 });

        const assignedEmpId = extractAssignedEmpId(asset.assignedTo);
        const sessionEmpId = session.employeeId || session.userId;
        if (!assignedEmpId || assignedEmpId !== sessionEmpId) {
          return NextResponse.json(
            { error: "Only the assigned employee can decline this assignment." },
            { status: 403 }
          );
        }
        const cleanReason = String(reason || "").trim();
        if (!cleanReason) {
          return NextResponse.json({ error: "Please provide a reason for declining this asset." }, { status: 400 });
        }

        asset.status = "Available";
        asset.assignedTo = undefined;
        asset.assignedEmployeeName = undefined;
        asset.acceptanceStatus = "Declined";
        asset.termsAccepted = false;
        asset.declineReason = cleanReason;
        asset.history = Array.isArray(asset.history) ? asset.history : [];
        asset.history.push({
          date: todayStr,
          action: "Employee Declined Assignment",
          employeeId: assignedEmpId,
          note: cleanReason,
        });
        await asset.save();

        await AuditLog.create({
          auditId: `AU-${Date.now()}`,
          user: session.name,
          userId: session.userId,
          role: session.role,
          action: "Employee Declined Asset Assignment",
          module: "Assets",
          record: `${asset.name} (${asset.assetTag}) · ${cleanReason}`,
          outcome: "Warning",
        }).catch(() => {});

        return NextResponse.json({ success: true, asset });
      }

      if (action === "return_asset") {
        const asset = await Asset.findOne(assetQuery);
        if (!asset) return NextResponse.json({ error: "Asset not found." }, { status: 404 });

        const prevEmpId = extractAssignedEmpId(asset.assignedTo);
        asset.status = "Available";
        asset.condition = condition || asset.condition || "Good";
        asset.assignedTo = undefined;
        asset.assignedEmployeeName = undefined;
        asset.acceptanceStatus = undefined;
        asset.termsAccepted = false;
        asset.termsAcceptedAt = undefined;
        asset.employeeSignature = undefined;
        asset.declineReason = undefined;
        asset.history = Array.isArray(asset.history) ? asset.history : [];
        asset.history.push({
          date: todayStr,
          action: "Returned to Stock",
          employeeId: prevEmpId || undefined,
          note: body.note || `Condition at return: ${asset.condition}`,
        });
        if (prevEmpId) {
          asset.returnHistory = Array.isArray(asset.returnHistory) ? asset.returnHistory : [];
          asset.returnHistory.push({
            employeeId: prevEmpId,
            returnedDate: new Date(),
            condition: asset.condition || "Good",
            notes: body.note || "Returned to IT inventory",
          });
        }
        await asset.save();

        await AuditLog.create({
          auditId: `AU-${Date.now()}`,
          user: session.name,
          userId: session.userId,
          role: session.role,
          action: "Returned Asset to Stock",
          module: "Assets",
          record: `${asset.name} (${asset.assetTag})`,
          outcome: "Success",
        }).catch(() => {});

        return NextResponse.json({ success: true, asset });
      }
    } else {
      const store = getMockStore();
      if (action === "create_asset") {
        const assetTag = `AST-${String(store.assets.length + 1).padStart(3, "0")}`;
        const hasAssignee = employeeId && employeeId !== "none";
        const newAsset = {
          _id: `ast-${Date.now()}`,
          assetTag,
          name,
          category,
          brandModel,
          serialNumber,
          purchaseValue: Number(purchaseValue) || 0,
          status: hasAssignee ? "Pending Acceptance" : "Available",
          assignedTo: hasAssignee ? { employeeId } : undefined,
          acceptanceStatus: hasAssignee ? "Pending" : undefined,
          termsAccepted: false,
        };
        store.assets.unshift(newAsset);
        return NextResponse.json({ success: true, asset: newAsset });
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
