import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DocumentRecord } from "@/models/Document";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const conn = await connectToDatabase();
    if (conn) {
      const query: any = {};
      if (session.role === "employee" && session.employeeId) {
        query.$or = [{ employeeId: session.employeeId }, { category: "Company Policy" }];
      }
      const docs = await DocumentRecord.find(query).sort({ createdAt: -1 });
      return NextResponse.json({ success: true, documents: docs });
    } else {
      const sampleDocs = [
        {
          _id: "doc-1",
          docId: "DOC-001",
          title: "Aadhaar Card — Karthik Reddy",
          category: "Identity Proof",
          fileUrl: "https://example.com/aadhaar.pdf",
          employeeId: "OF-1004",
          employeeName: "Karthik Reddy",
          status: "Verified",
        },
        {
          _id: "doc-2",
          docId: "DOC-002",
          title: "Standard Employment Code of Conduct",
          category: "Company Policy",
          fileUrl: "https://example.com/policy.pdf",
          status: "Verified",
        },
      ];
      return NextResponse.json({ success: true, documents: sampleDocs });
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
    const { title, category, fileUrl, expiryDate } = body;

    const conn = await connectToDatabase();
    if (conn) {
      const count = await DocumentRecord.countDocuments();
      const docId = `DOC-${String(count + 1).padStart(3, "0")}`;
      const doc = await DocumentRecord.create({
        docId,
        title,
        category,
        fileUrl: fileUrl || "https://example.com/doc.pdf",
        employeeId: session.employeeId || "OF-1001",
        employeeName: session.name,
        expiryDate,
        status: "Pending",
      });
      return NextResponse.json({ success: true, document: doc });
    } else {
      const newDoc = {
        _id: `doc-${Date.now()}`,
        docId: `DOC-${Date.now().toString().slice(-3)}`,
        title,
        category,
        fileUrl,
        employeeId: session.employeeId || "OF-1001",
        employeeName: session.name,
        expiryDate,
        status: "Pending",
      };
      return NextResponse.json({ success: true, document: newDoc });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { docId, action } = body;

    const conn = await connectToDatabase();
    if (conn) {
      const doc = await DocumentRecord.findOne({ docId });
      if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
      doc.status = action === "verify" ? "Verified" : "Rejected";
      await doc.save();
      return NextResponse.json({ success: true, document: doc });
    } else {
      return NextResponse.json({ success: true, document: { docId, status: action === "verify" ? "Verified" : "Rejected" } });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
