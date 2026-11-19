"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/data/store";
import type { Employee } from "@/lib/data/types";

export interface DeleteEmployeeDialogProps {
  emp: Employee | { id: string; name: string; workEmail?: string; status?: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (empId: string) => void;
}

export function DeleteEmployeeDialog({
  emp,
  open,
  onOpenChange,
  onDeleted,
}: DeleteEmployeeDialogProps) {
  const { session, deleteEmployee } = useStore();
  const [isDeleting, setIsDeleting] = useState(false);

  if (!emp) return null;

  const isSuperAdmin = session?.role === "super_admin";
  const isSelf =
    Boolean(session?.employeeId && session.employeeId === emp.id) ||
    Boolean(session?.userId && session.userId === emp.id);

  const handleDelete = async () => {
    if (!emp || isDeleting) return;

    if (!isSuperAdmin) {
      toast.error("Access Denied: Only Super Admin has permission to delete employees.");
      return;
    }

    if (isSelf) {
      toast.error("You cannot delete your own active Super Admin account.");
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/employees?id=${encodeURIComponent(emp.id)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": session?.role || "super_admin",
        },
      });

      const resData = await res.json();

      if (!res.ok) {
        toast.error(resData.error || "Failed to delete employee");
        return;
      }

      // Immediately remove from client state
      deleteEmployee(emp.id, true);
      toast.success(resData.message || `Employee ${emp.name} (${emp.id}) permanently deleted`);
      onOpenChange(false);
      onDeleted?.(emp.id);
    } catch (err: any) {
      console.error("[Delete Employee Error]", err);
      toast.error(err.message || "Failed to delete employee");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isDeleting) onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
              <Trash2 className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-semibold text-rose-950">
                Delete Employee Permanently
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Action restricted to Super Admin only.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          {isSelf ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
              <div>
                <p className="font-semibold">Self-Deletion Prevented</p>
                <p className="mt-0.5 text-[11px] text-amber-800">
                  You are currently logged in as this user ({emp.name} - {emp.id}). You cannot delete your own active Super Admin account.
                </p>
              </div>
            </div>
          ) : !isSuperAdmin ? (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-900">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-semibold">Super Admin Privilege Required</p>
                <p className="mt-0.5 text-[11px] text-rose-700">
                  Only users with the Super Admin role are authorized to permanently delete employees from the system.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-foreground leading-relaxed">
                Are you sure you want to permanently delete{" "}
                <strong className="font-semibold text-rose-700">{emp.name}</strong> (
                <span className="font-mono text-muted-foreground">{emp.id}</span>)?
              </p>

              <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-rose-900 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-rose-900">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>Permanent Deletion Warning:</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-[11px] text-rose-800">
                  <li>Employee record and profile will be erased from MongoDB.</li>
                  <li>Login credentials and portal access will be permanently revoked.</li>
                  <li>Biometric mappings and punch records will be removed.</li>
                  <li>Assigned company assets will be unassigned and returned to inventory.</li>
                </ul>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="mt-2 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting || isSelf || !isSuperAdmin}
            className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-medium"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Permanently</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
