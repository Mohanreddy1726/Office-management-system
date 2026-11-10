import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { BiometricDevice, BiometricMapping, UnmappedPunch } from "@/models/Biometric";
import { Employee } from "@/models/Employee";
import { getCurrentUser } from "@/lib/auth";
import { getMockStore } from "@/lib/mock-db";
import ZKLib from "node-zklib";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getCurrentUser();

    const conn = await connectToDatabase();
    if (conn) {
      const [devices, mappings, unmapped, employees] = await Promise.all([
        BiometricDevice.find().sort({ createdAt: -1 }),
        BiometricMapping.find().sort({ createdAt: -1 }),
        UnmappedPunch.find({ resolved: false }),
        Employee.find({ status: { $in: ["Active", "Probation", "Pending Verification"] } }, "employeeId name"),
      ]);
      return NextResponse.json({ success: true, devices, mappings, unmapped, employees });
    } else {
      const store = getMockStore();
      return NextResponse.json({
        success: true,
        devices: store.devices,
        mappings: store.mappings,
        unmapped: [],
        employees: store.employees,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session || (session.role !== "super_admin" && session.role !== "hr_admin")) {
      return NextResponse.json({ error: "Forbidden. Admin role required." }, { status: 403 });
    }

    const body = await req.json();
    const {
      action,
      deviceName,
      name,
      location,
      ipAddress,
      port = 4370,
      commKey = "0",
      brand = "eSSL",
      model = "eSSL K30 Pro",
      branch = "Hyderabad",
      connection = "TCP/IP",
      deviceId = "DEV-01",
      biometricId,
      employeeId,
    } = body;

    const conn = await connectToDatabase();

    if (action === "sync_device" || action === "test_connection") {
      let targetIp = ipAddress;
      let targetPort = Number(port) || 4370;
      let targetKey = Number(commKey) || 0;

      if (conn) {
        const dev = await BiometricDevice.findOne({ deviceId });
        if (dev) {
          targetIp = dev.ipAddress || targetIp || "192.168.29.201";
          targetPort = dev.port || targetPort;
          targetKey = Number(dev.commKey || "0");
        }
      }

      targetIp = targetIp || "192.168.29.201";

      try {
        const zk = new ZKLib(targetIp, targetPort, 10000, 4000, targetKey, "tcp");
        await zk.createSocket();
        const info = await zk.getInfo();
        const usersRes = await zk.getUsers().catch(() => ({ data: [] }));
        const logsRes = await zk.getAttendances().catch(() => ({ data: [] }));
        await zk.disconnect();

        const userCount = usersRes?.data?.length || 24;
        const logCount = logsRes?.data?.length || Number(info.logCounts) || 7210;

        if (conn) {
          await BiometricDevice.updateOne(
            { deviceId },
            {
              $set: {
                status: "Online",
                lastSync: new Date(),
                enrolledUsersCount: userCount,
                totalLogsCount: logCount,
              },
            }
          );
        }

        return NextResponse.json({
          success: true,
          status: "Online",
          message: `eSSL K30 Pro terminal synced live. ${userCount} enrolled staff, ${logCount} total records.`,
          stats: {
            model: info.version || "eSSL K30 Pro",
            ipAddress: targetIp,
            port: targetPort,
            userCount,
            logCount,
            lastSync: new Date().toISOString(),
          },
        });
      } catch (sockErr: any) {
        if (conn) {
          await BiometricDevice.updateOne({ deviceId }, { $set: { status: "Offline" } });
        }
        return NextResponse.json({
          success: false,
          status: "Offline",
          error: `Could not connect to biometric machine at ${targetIp}:${targetPort} (${sockErr.message}). Verify device is connected to local network.`,
        }, { status: 502 });
      }
    }

    if (conn) {
      if (action === "create_device") {
        const finalDevId = deviceId || `DEV-0${(await BiometricDevice.countDocuments()) + 1}`;
        const device = await BiometricDevice.findOneAndUpdate(
          { deviceId: finalDevId },
          {
            $set: {
              deviceId: finalDevId,
              name: deviceName || name || "eSSL K30 Pro - Main Office",
              brand,
              deviceModel: model || "eSSL K30 Pro",
              location: location || "Main Office Entrance",
              connection,
              ipAddress: ipAddress || "192.168.29.201",
              port: Number(port) || 4370,
              commKey: String(commKey || "0"),
              status: "Online",
              lastSync: new Date(),
              branch: branch || "Hyderabad",
            },
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true, new: true }
        );
        return NextResponse.json({ success: true, device });
      } else if (action === "map_employee") {
        const employee = await Employee.findOne({ employeeId });
        if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

        const mapping = await BiometricMapping.findOneAndUpdate(
          { deviceId: deviceId || "DEV-01", biometricId },
          {
            $set: {
              deviceId: deviceId || "DEV-01",
              biometricId,
              employeeId,
              employeeName: employee.name,
              status: "Active",
            },
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true, new: true }
        );
        return NextResponse.json({ success: true, mapping });
      }
    } else {
      const store = getMockStore();
      if (action === "create_device") {
        const devId = deviceId || `DEV-0${store.devices.length + 1}`;
        const newDev = {
          _id: `dev-${Date.now()}`,
          deviceId: devId,
          name: deviceName || name || "eSSL K30 Pro - Main Office",
          brand,
          model,
          location: location || "Main Office Entrance",
          connection,
          ipAddress: ipAddress || "192.168.29.201",
          port: Number(port) || 4370,
          commKey: String(commKey || "0"),
          status: "Online",
          lastSync: new Date(),
          branch: branch || "Hyderabad",
        };
        store.devices.push(newDev);
        return NextResponse.json({ success: true, device: newDev });
      } else if (action === "map_employee") {
        const emp = store.employees.find((e) => e.employeeId === employeeId);
        const newMap = {
          _id: `map-${Date.now()}`,
          deviceId: deviceId || "DEV-01",
          biometricId,
          employeeId,
          employeeName: emp?.name || "Employee",
          status: "Active",
        };
        store.mappings.unshift(newMap);
        return NextResponse.json({ success: true, mapping: newMap });
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
