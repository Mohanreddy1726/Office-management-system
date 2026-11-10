import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Asset } from "@/models/Asset";
import { Employee } from "@/models/Employee";
import { getCurrentUser } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const conn = await connectToDatabase();
    if (conn) {
      const [assets, employees] = await Promise.all([
        Asset.find().sort({ createdAt: -1 }),
        Employee.find({ status: "Active" }, "employeeId name"),
      ]);
      return NextResponse.json({ success: true, assets, employees });
    } else {
      const store = getMockStore();
      return NextResponse.json({ success: true, assets: store.assets, employees: store.employees });
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
    const { action, name, category, brandModel, serialNumber, purchaseValue, assetId, employeeId, condition } = body;

    const conn = await connectToDatabase();
    if (conn) {
      if (action === "create_asset") {
        const count = await Asset.countDocuments();
        const assetTag = `AST-${String(count + 1).padStart(3, "0")}`;
        const asset = await Asset.create({
          assetTag,
          name,
          category,
          brandModel,
          serialNumber,
          purchaseValue: Number(purchaseValue) || 0,
          status: "Available",
        });
        return NextResponse.json({ success: true, asset });
      } else if (action === "issue_asset") {
        const asset = await Asset.findById(assetId);
        const employee = await Employee.findOne({ employeeId });
        if (!asset || !employee) return NextResponse.json({ error: "Not found" }, { status: 404 });
        asset.status = "Assigned";
        asset.assignedTo = {
          employeeId: employee.employeeId,
          employeeName: employee.name,
          assignedDate: new Date(),
          conditionAtIssue: condition || "Good",
        };
        await asset.save();
        return NextResponse.json({ success: true, asset });
      } else if (action === "return_asset") {
        const asset = await Asset.findById(assetId);
        if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
        asset.status = "Available";
        asset.assignedTo = undefined;
        await asset.save();
        return NextResponse.json({ success: true, asset });
      }
    } else {
      const store = getMockStore();
      if (action === "create_asset") {
        const assetTag = `AST-${String(store.assets.length + 1).padStart(3, "0")}`;
        const newAsset = {
          _id: `ast-${Date.now()}`,
          assetTag,
          name,
          category,
          brandModel,
          serialNumber,
          purchaseValue: Number(purchaseValue) || 0,
          status: "Available",
        };
        store.assets.unshift(newAsset);
        return NextResponse.json({ success: true, asset: newAsset });
      } else if (action === "issue_asset") {
        const asset = store.assets.find((a) => a._id === assetId);
        const emp = store.employees.find((e) => e.employeeId === employeeId);
        if (asset && emp) {
          asset.status = "Assigned";
          asset.assignedTo = {
            employeeId: emp.employeeId,
            employeeName: emp.name,
            assignedDate: new Date(),
            conditionAtIssue: condition || "Good",
          };
        }
        return NextResponse.json({ success: true, asset });
      } else if (action === "return_asset") {
        const asset = store.assets.find((a) => a._id === assetId);
        if (asset) {
          asset.status = "Available";
          asset.assignedTo = undefined;
        }
        return NextResponse.json({ success: true, asset });
      }
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
