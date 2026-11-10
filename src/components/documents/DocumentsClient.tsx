"use client";

import { useState, useEffect } from "react";
import { FileText, Plus, CheckCircle, XCircle, Clock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface DocumentsClientProps {
  currentRole: string;
}

export function DocumentsClient({ currentRole }: DocumentsClientProps) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    category: "Identity Proof",
    fileUrl: "https://example.com/mock-doc.pdf",
    expiryDate: "",
  });

  const fetchDocs = async () => {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (data.success) {
        setDocuments(data.documents || []);
      }
    } catch {
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      toast.success("Document uploaded and submitted for HR verification!");
      setShowUploadModal(false);
      setFormData({
        title: "",
        category: "Identity Proof",
        fileUrl: "https://example.com/mock-doc.pdf",
        expiryDate: "",
      });
      fetchDocs();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    }
  };

  const handleDecision = async (docId: string, verify: boolean) => {
    try {
      const res = await fetch("/api/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId,
          action: verify ? "verify" : "reject",
          rejectionReason: verify ? undefined : "Legibility issues or expired ID",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");

      toast.success(verify ? "Document verified!" : "Document rejected");
      fetchDocs();
    } catch (err: any) {
      toast.error(err.message || "Failed to update document");
    }
  };

  const canVerify = currentRole === "super_admin" || currentRole === "hr_admin";

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Document Repository & KYC
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Identity proofs (Aadhaar/PAN), education, employment contracts, and compliance policies.
          </p>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition"
        >
          <Plus className="h-4 w-4" /> Upload Document
        </button>
      </div>

      {/* Documents Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground font-semibold">
              <tr>
                <th className="px-5 py-3.5">Doc ID</th>
                <th className="px-5 py-3.5">Title</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Belongs To</th>
                <th className="px-5 py-3.5">Expiry Date</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    Loading documents…
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No documents uploaded yet.
                  </td>
                </tr>
              ) : (
                documents.map((d) => (
                  <tr key={d._id} className="hover:bg-muted/30 transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-primary">{d.docId}</td>

                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-foreground">{d.title}</p>
                    </td>

                    <td className="px-5 py-3.5 font-medium text-foreground">{d.category}</td>

                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground">{d.employeeName || "Company"}</p>
                      {d.employeeId && (
                        <p className="font-mono text-[10px] text-muted-foreground">{d.employeeId}</p>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-muted-foreground">
                      {d.expiryDate ? formatDate(d.expiryDate) : "No Expiry"}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          d.status === "Verified"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : d.status === "Rejected"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canVerify && d.status === "Pending" && (
                          <>
                            <button
                              onClick={() => handleDecision(d.docId, true)}
                              className="rounded px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
                            >
                              Verify
                            </button>
                            <button
                              onClick={() => handleDecision(d.docId, false)}
                              className="rounded px-2.5 py-1 text-[11px] font-semibold bg-red-600 text-white hover:bg-red-700 transition"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded px-2 py-1 text-[11px] font-medium border border-border text-foreground hover:bg-muted transition inline-flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" /> View
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-base font-bold text-foreground">Upload Document</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-muted-foreground text-sm font-semibold">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Aadhaar Card / B.Tech Degree Certificate"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                >
                  <option value="Identity Proof">Identity Proof (Aadhaar / PAN / Passport)</option>
                  <option value="Education">Education Degree / Marksheet</option>
                  <option value="Experience">Previous Experience / Relieving Letter</option>
                  <option value="Offer Letter">Signed Offer Letter</option>
                  <option value="Company Policy">Company Policy Document</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Document URL / File Link *</label>
                <input
                  type="text"
                  required
                  value={formData.fileUrl}
                  onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                  placeholder="https://example.com/document.pdf"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Expiry Date (Optional)</label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90"
                >
                  Upload & Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
