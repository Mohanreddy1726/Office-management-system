"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/data/store";
import { GVK_ASSET_TERMS, GVK_ASSET_TERMS_VERSION } from "@/lib/policies";
import { PageHeader, KpiCard, StatusBadge, TabsShell, Field, Timeline, EmployeeAvatar } from "@/components/shared";
import { DataTable, exportCsv, type Column } from "@/components/data-table";
import { Person, Sel, useScope, useNames } from "@/components/form-bits";
import { BRANCHES } from "@/lib/data/types";
import type { Asset, Branch } from "@/lib/data/types";
import { fmtDate, inr, daysUntil } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { AppShell } from "@/components/shell";
import {
  Boxes,
  Laptop,
  Wrench,
  PackageCheck,
  Plus,
  Download,
  Search,
  LayoutGrid,
  List,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Monitor,
  Printer,
  Headphones,
  UserCheck,
  Clock,
  ShieldCheck,
  FileCheck2,
  RefreshCw,
  Camera,
  XCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ASSET_CATEGORIES = [
  "Laptop",
  "Desktop",
  "Monitor",
  "Phone",
  "Camera Equipment",
  "Printer",
  "Accessory",
  "Office Equipment",
  "Furniture",
  "Other",
];

function getTodayIso(): string {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function AssetsPageInner() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const {
    data,
    session,
    refreshAssets,
    addAsset,
    issueAsset,
    returnAsset,
    acceptAsset,
    declineAsset,
  } = useStore();
  const { isAdmin, isEmployee, uid, inScope } = useScope();
  const nameOf = useNames();

  const todayIso = useMemo(() => getTodayIso(), []);
  const [tab, setTab] = useState<string>(tabParam ?? "all");
  const userChangedTabRef = useRef(Boolean(tabParam));
  const [view, setView] = useState<"cards" | "table">("table");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);

  // Modals & Slide-out Sheet
  const [addOpen, setAddOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [approvalAsset, setApprovalAsset] = useState<Asset | null>(null);

  useEffect(() => {
    refreshAssets().catch(() => {});
  }, [refreshAssets]);

  useEffect(() => {
    if (tabParam) setTab(tabParam);
  }, [tabParam]);

  // Scoped assets base
  const baseAssets = useMemo(() => {
    if (isEmployee) return data.assets.filter((a) => a.assignedTo === uid);
    if (isAdmin) return data.assets;
    return data.assets.filter((a) => a.assignedTo && inScope(a.assignedTo));
  }, [data.assets, isEmployee, isAdmin, uid, inScope]);

  const myAssets = useMemo(() => data.assets.filter((a) => a.assignedTo === uid), [data.assets, uid]);
  const myPendingAssets = useMemo(
    () => myAssets.filter((a) => a.status === "Pending Acceptance"),
    [myAssets]
  );

  // Auto-open Pending tab for employees when an asset requires T&C approval
  useEffect(() => {
    if (isEmployee && !tabParam && !userChangedTabRef.current && myPendingAssets.length > 0 && tab === "all") {
      setTab("pending");
    }
  }, [isEmployee, tabParam, myPendingAssets.length, tab]);

  const handleTabChange = (next: string) => {
    userChangedTabRef.current = true;
    setTab(next);
    setSearchQuery("");
  };

  // KPI figures
  const totalAssetsCount = baseAssets.length;
  const pendingAcceptanceCount = baseAssets.filter((a) => a.status === "Pending Acceptance").length;
  const assignedCount = baseAssets.filter((a) => a.status === "Assigned").length;
  const availableCount = baseAssets.filter((a) => a.status === "Available").length;
  const maintCount = baseAssets.filter((a) => a.status === "Under Maintenance" || a.status === "Damaged").length;

  // Tab & search filtered assets
  const filteredAssets = useMemo(() => {
    return baseAssets.filter((a) => {
      if (tab === "pending" && a.status !== "Pending Acceptance") return false;
      if (tab === "available" && a.status !== "Available") return false;
      if (tab === "assigned" && a.status !== "Assigned") return false;
      if (tab === "maintenance" && a.status !== "Under Maintenance" && a.status !== "Damaged") return false;
      if (tab === "mine" && a.assignedTo !== uid) return false;

      if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const assigneeName = a.assignedTo ? nameOf(a.assignedTo).toLowerCase() : "in stock";
        return (
          a.name.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          a.serial.toLowerCase().includes(q) ||
          a.brandModel.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q) ||
          assigneeName.includes(q)
        );
      }

      return true;
    });
  }, [baseAssets, tab, categoryFilter, statusFilter, searchQuery, uid, nameOf]);

  const currentAsset = data.assets.find((a) => a.id === selectedAssetId) ?? null;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshAssets();
    toast.success("Assets synchronized with database");
    setRefreshing(false);
  };

  // Table Columns (Desktop)
  const tableColumns: Column<Asset>[] = [
    {
      key: "i",
      header: "Asset",
      sortValue: (r) => r.id,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary">
            <Laptop className="h-4 w-4" />
          </div>
          <div>
            <span
              className="block cursor-pointer font-semibold text-foreground hover:underline"
              onClick={() => setSelectedAssetId(r.id)}
            >
              {r.name}
            </span>
            <span className="block text-[11px] text-muted-foreground">
              {r.id} · {r.serial}
            </span>
          </div>
        </div>
      ),
    },
    { key: "c", header: "Category", render: (r) => r.category },
    { key: "b", header: "Branch", render: (r) => r.branch, hideOnMobile: true },
    {
      key: "a",
      header: "Assigned To",
      render: (r) =>
        r.assignedTo ? (
          <Link
            href={`/employees/${r.assignedTo}`}
            onClick={(e) => e.stopPropagation()}
            className="group flex items-center gap-1.5 hover:underline"
          >
            <Person id={r.assignedTo} />
            <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ) : (
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            In Stock
          </span>
        ),
    },
    {
      key: "terms",
      header: "T&C Custody",
      hideOnMobile: true,
      render: (r) =>
        r.status === "Assigned" && r.termsAccepted ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" /> Accepted
          </span>
        ) : r.status === "Pending Acceptance" ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Clock className="h-3.5 w-3.5" /> Awaiting T&amp;C
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    { key: "cd", header: "Condition", render: (r) => <StatusBadge status={r.condition} />, hideOnMobile: true },
    { key: "s", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "act",
      header: "",
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {r.status === "Pending Acceptance" && r.assignedTo === uid ? (
            <Button
              size="sm"
              className="h-7 gap-1 bg-amber-600 px-2.5 text-xs font-semibold text-white hover:bg-amber-700"
              onClick={() => setApprovalAsset(r)}
            >
              <FileCheck2 className="h-3.5 w-3.5" /> Review &amp; Approve
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedAssetId(r.id)}
            >
              Details
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-0">
        {/* Mobile-First Premium Hero Header (< sm) */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-indigo-500/5 p-4 shadow-sm sm:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Boxes className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  {isAdmin ? "HR Asset Desk" : "Equipment Custody"}
                </span>
                <h1 className="truncate text-lg font-bold tracking-tight text-foreground">
                  {isEmployee ? "My Issued Assets" : "Company Assets"}
                </h1>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={refreshing}
              onClick={handleRefresh}
              className="h-9 w-9 shrink-0 rounded-xl bg-background/80"
              aria-label="Refresh assets"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
            {isAdmin
              ? "Only HR / Super Admin can add or assign assets. Employees must accept Appointment Letter terms before custody activates."
              : "Review equipment assigned to you by HR / Super Admin and accept the GVK Appointment Letter terms to approve custody."}
          </p>
          {isAdmin && (
            <div className="mt-3.5">
              <Button
                size="sm"
                onClick={() => setAddOpen(true)}
                className="h-10 w-full gap-1.5 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-sm"
              >
                <Plus className="h-4 w-4" /> Add / Assign Equipment
              </Button>
            </div>
          )}
        </div>

        {/* Desktop Header */}
        <div className="hidden sm:block">
          <PageHeader
            breadcrumb={["Operations", "Asset Inventory"]}
            title={isEmployee ? "My Issued Equipment" : "Company Asset Inventory & Equipment Desk"}
            description={
              isEmployee
                ? "Review equipment assigned by HR or Super Admin and accept the GVK Appointment Letter terms & conditions to confirm custody."
                : "Only HR Admin and Super Admin can assign company assets. Employees must agree to Appointment Letter terms & conditions to approve custody."
            }
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={refreshing}
                  onClick={handleRefresh}
                  className="gap-1.5 text-xs shadow-sm"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> Refresh
                </Button>
                {isAdmin && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs shadow-sm"
                      onClick={() =>
                        exportCsv(
                          "asset-inventory.csv",
                          ["Asset ID", "Name", "Category", "Model", "Serial", "Branch", "Assigned To", "Status", "Terms Accepted", "Condition", "Value", "Warranty"],
                          data.assets.map((a) => [
                            a.id,
                            a.name,
                            a.category,
                            a.brandModel,
                            a.serial,
                            a.branch,
                            a.assignedTo ? nameOf(a.assignedTo) : "Unassigned",
                            a.status,
                            a.termsAccepted ? `Yes (${a.termsAcceptedAt || ""})` : "Pending/No",
                            a.condition,
                            String(a.purchaseValue),
                            a.warrantyExpiry,
                          ])
                        )
                      }
                    >
                      <Download className="h-3.5 w-3.5" /> Export Inventory
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 bg-primary text-xs text-primary-foreground shadow-sm hover:bg-primary/90"
                      onClick={() => setAddOpen(true)}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Equipment
                    </Button>
                  </>
                )}
              </>
            }
          />
        </div>

        {/* Pending Approval Action Banner for Employees (or HR monitoring) */}
        {myPendingAssets.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3.5 text-xs text-amber-950 dark:text-amber-200 sm:mb-5 sm:rounded-xl">
            <div className="flex items-start gap-2.5 sm:items-center">
              <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 sm:mt-0" />
              <span>
                You have{" "}
                <strong>
                  {myPendingAssets.length} assigned asset{myPendingAssets.length > 1 ? "s" : ""}
                </strong>{" "}
                waiting for your approval. Read and agree to all GVK Appointment Letter asset terms &amp; conditions to activate custody.
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => setApprovalAsset(myPendingAssets[0])}
              className="h-8 gap-1.5 rounded-xl bg-amber-600 text-xs font-semibold text-white hover:bg-amber-700 sm:rounded-lg"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Review &amp; Approve
            </Button>
          </div>
        )}

        {/* Top KPI Cards Row */}
        <div className="grid grid-cols-2 gap-2.5 sm:mb-6 sm:gap-3 xl:grid-cols-4">
          <KpiCard
            label={isEmployee ? "My Total Assets" : "Total Equipment"}
            value={String(totalAssetsCount)}
            hint={isEmployee ? "Issued to your account" : "Hardware in inventory"}
            icon={<Boxes className="h-4 w-4 text-primary" />}
            onClick={() => handleTabChange("all")}
          />
          <KpiCard
            label="Pending Approval"
            value={String(pendingAcceptanceCount)}
            hint={pendingAcceptanceCount > 0 ? "Awaiting T&C acceptance" : "None pending"}
            icon={<Clock className="h-4 w-4 text-amber-500" />}
            onClick={() => handleTabChange("pending")}
          />
          <KpiCard
            label={isEmployee ? "Approved Custody" : "Active Assigned"}
            value={String(assignedCount)}
            hint="Terms agreed & verified"
            icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />}
            onClick={() => handleTabChange("assigned")}
          />
          {isEmployee ? (
            <KpiCard
              label="Total Asset Value"
              value={inr(baseAssets.reduce((sum, a) => sum + (a.purchaseValue || 0), 0), { compact: true })}
              hint="Under your custody"
              icon={<Laptop className="h-4 w-4 text-blue-500" />}
            />
          ) : (
            <KpiCard
              label="Available in Stock"
              value={String(availableCount)}
              hint={`${maintCount} in maintenance/damaged`}
              icon={<PackageCheck className="h-4 w-4 text-blue-500" />}
              onClick={() => handleTabChange("available")}
            />
          )}
        </div>

        {/* Tabs Shell */}
        <TabsShell
          tabs={[
            { key: "pending", label: `Pending Approval (${pendingAcceptanceCount})` },
            { key: "all", label: isEmployee ? `All My Assets (${totalAssetsCount})` : `All Assets (${totalAssetsCount})` },
            { key: "available", label: `Available (${availableCount})`, hidden: isEmployee },
            { key: "assigned", label: isEmployee ? `Approved Custody (${assignedCount})` : `Active Assigned (${assignedCount})` },
            { key: "maintenance", label: `Maintenance (${maintCount})`, hidden: isEmployee },
            { key: "mine", label: `My Equipment (${myAssets.length})`, hidden: isEmployee },
          ]}
          active={tab}
          onChange={handleTabChange}
        >
          <div className="space-y-4">
            {/* Filter Toolbar */}
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:rounded-xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-64 lg:w-72">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search asset name, serial, assignee..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 rounded-xl pl-8 text-xs sm:h-8.5 sm:rounded-md"
                  />
                </div>
                <Sel
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  className="h-9 flex-1 rounded-xl text-xs sm:h-8.5 sm:w-40 sm:flex-none sm:rounded-md"
                  options={[{ value: "all", label: "All Categories" }, ...ASSET_CATEGORIES]}
                />
                {!isEmployee && (
                  <Sel
                    value={statusFilter}
                    onChange={setStatusFilter}
                    className="h-9 flex-1 rounded-xl text-xs sm:h-8.5 sm:w-44 sm:flex-none sm:rounded-md"
                    options={[
                      { value: "all", label: "All Statuses" },
                      { value: "Available", label: "Available" },
                      { value: "Pending Acceptance", label: "Pending Acceptance" },
                      { value: "Assigned", label: "Assigned" },
                      { value: "Under Maintenance", label: "Under Maintenance" },
                      { value: "Damaged", label: "Damaged" },
                      { value: "Retired", label: "Retired" },
                    ]}
                  />
                )}
                {(searchQuery || categoryFilter !== "all" || statusFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setCategoryFilter("all");
                      setStatusFilter("all");
                    }}
                    className="h-8.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Reset
                  </Button>
                )}
              </div>

              {/* Desktop View Switcher */}
              <div className="hidden items-center rounded-lg border border-border bg-muted/40 p-0.5 sm:flex">
                <Button
                  variant={view === "table" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("table")}
                  className="h-7 gap-1 px-2.5 text-xs font-medium"
                >
                  <List className="h-3.5 w-3.5" />
                  Table
                </Button>
                <Button
                  variant={view === "cards" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("cards")}
                  className="h-7 gap-1 px-2.5 text-xs font-medium"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Cards
                </Button>
              </div>
            </div>

            {filteredAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                <Boxes className="mb-2 h-10 w-10 text-muted-foreground/60" />
                <p className="text-sm font-semibold text-foreground">
                  {tab === "pending"
                    ? "No assets pending approval"
                    : isEmployee
                      ? "No equipment assigned to you yet"
                      : "No assets found"}
                </p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  {isEmployee
                    ? "HR Admin or Super Admin will assign company equipment here when issued to you."
                    : "Register equipment into inventory and assign it to an employee to start the T&C approval flow."}
                </p>
                {isAdmin && (
                  <Button size="sm" className="mt-4 gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> Add Equipment
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Mobile always renders premium stacked rounded-2xl Cards */}
                <div className="grid grid-cols-1 gap-3.5 sm:hidden">
                  {filteredAssets.map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      isAdmin={isAdmin}
                      uid={uid}
                      onInspect={() => setSelectedAssetId(asset.id)}
                      onApproveTerms={() => setApprovalAsset(asset)}
                    />
                  ))}
                </div>

                {/* Desktop renders Table (default) or Cards */}
                <div className="hidden sm:block">
                  {view === "cards" ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {filteredAssets.map((asset) => (
                        <AssetCard
                          key={asset.id}
                          asset={asset}
                          isAdmin={isAdmin}
                          uid={uid}
                          onInspect={() => setSelectedAssetId(asset.id)}
                          onApproveTerms={() => setApprovalAsset(asset)}
                        />
                      ))}
                    </div>
                  ) : (
                    <DataTable
                      columns={tableColumns}
                      rows={filteredAssets}
                      rowKey={(r) => r.id}
                      pageSize={12}
                      onRowClick={(r) => setSelectedAssetId(r.id)}
                      emptyTitle="No equipment items found"
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </TabsShell>

        {/* DIALOG: Add Asset (HR / Super Admin only) */}
        {isAdmin && (
          <AddAssetDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            todayIso={todayIso}
            onSubmit={async (newAsset) => {
              const res = await addAsset(newAsset);
              if (!res.ok) {
                toast.error(res.error || "Could not register asset.");
                return;
              }
              setAddOpen(false);
              toast.success(
                newAsset.assignedTo
                  ? `Registered "${newAsset.name}" and sent to employee for GVK terms approval.`
                  : `Asset "${newAsset.name}" registered to inventory.`
              );
            }}
          />
        )}

        {/* DIALOG: Employee Terms & Conditions Approval */}
        <AssetTermsApprovalDialog
          asset={approvalAsset}
          employeeName={session?.name || nameOf(uid)}
          onClose={() => setApprovalAsset(null)}
          onAccept={async (signatureName) => {
            if (!approvalAsset) return;
            const res = await acceptAsset(approvalAsset.id, signatureName);
            if (!res.ok) {
              toast.error(res.error || "Failed to approve asset.");
              return;
            }
            toast.success(`Approved "${approvalAsset.name}" — GVK terms accepted & custody active.`);
            setApprovalAsset(null);
            setSelectedAssetId(null);
          }}
          onDecline={async (reason) => {
            if (!approvalAsset) return;
            const res = await declineAsset(approvalAsset.id, reason);
            if (!res.ok) {
              toast.error(res.error || "Failed to decline assignment.");
              return;
            }
            toast.warning(`Declined "${approvalAsset.name}" and notified HR.`);
            setApprovalAsset(null);
            setSelectedAssetId(null);
          }}
        />

        {/* SLIDE-OUT SHEET: Asset Specs, Approval & Issue/Return */}
        <Sheet open={!!currentAsset} onOpenChange={(v) => !v && setSelectedAssetId(null)}>
          <SheetContent className="w-full max-w-none overflow-y-auto overscroll-contain p-4 sm:max-w-lg sm:p-6">
            {currentAsset && (
              <AssetDetailSheetContent
                asset={currentAsset}
                isAdmin={isAdmin}
                uid={uid}
                onOpenApproval={() => setApprovalAsset(currentAsset)}
                onIssue={async (empId) => {
                  const res = await issueAsset(currentAsset.id, empId, "Assigned by HR/Super Admin (Pending Employee Approval)");
                  if (!res.ok) {
                    toast.error(res.error || "Could not assign asset.");
                    return;
                  }
                  toast.success(`Assigned to ${nameOf(empId)} — waiting for employee T&C approval.`);
                  setSelectedAssetId(null);
                }}
                onReturn={async (condition) => {
                  const res = await returnAsset(currentAsset.id, condition, "Returned to IT inventory");
                  if (!res.ok) {
                    toast.error(res.error || "Could not return asset.");
                    return;
                  }
                  toast.success("Asset returned and marked Available in stock.");
                  setSelectedAssetId(null);
                }}
              />
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AppShell>
  );
}

export default function AssetsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="p-6 text-xs text-muted-foreground">Loading company assets...</div>
        </AppShell>
      }
    >
      <AssetsPageInner />
    </Suspense>
  );
}

/* =========================================================================================
 * COMPONENT: AssetCard
 * ========================================================================================= */
function AssetCard({
  asset,
  isAdmin,
  uid,
  onInspect,
  onApproveTerms,
}: {
  asset: Asset;
  isAdmin: boolean;
  uid: string;
  onInspect: () => void;
  onApproveTerms: () => void;
}) {
  const { data } = useStore();
  const emp = asset.assignedTo ? data.employees.find((e) => e.id === asset.assignedTo) : null;
  const isAvailable = asset.status === "Available";
  const isPendingForMe = asset.status === "Pending Acceptance" && asset.assignedTo === uid;
  const daysWarranty = daysUntil(asset.warrantyExpiry);
  const isWarrantyExpired = daysWarranty !== undefined && daysWarranty < 0;

  const getIcon = () => {
    switch (asset.category) {
      case "Laptop":
        return <Laptop className="h-6 w-6" />;
      case "Monitor":
      case "Desktop":
        return <Monitor className="h-6 w-6" />;
      case "Phone":
        return <Smartphone className="h-6 w-6" />;
      case "Camera Equipment":
        return <Camera className="h-6 w-6" />;
      case "Printer":
        return <Printer className="h-6 w-6" />;
      case "Accessory":
        return <Headphones className="h-6 w-6" />;
      default:
        return <Boxes className="h-6 w-6" />;
    }
  };

  const conditionDot = {
    Excellent: "bg-emerald-500",
    Good: "bg-emerald-500",
    Fair: "bg-amber-500",
    Poor: "bg-rose-500",
  }[asset.condition] ?? "bg-slate-400";

  return (
    <div
      onClick={onInspect}
      className={cn(
        "group relative flex cursor-pointer flex-col justify-between rounded-2xl border bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.99] dark:bg-card sm:p-5",
        isPendingForMe ? "border-amber-500/40 ring-1 ring-amber-500/20" : "border-slate-200/90 dark:border-border"
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-primary font-bold text-white shadow-sm">
                {getIcon()}
              </div>
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white dark:ring-slate-900",
                  conditionDot
                )}
                title={`Condition: ${asset.condition}`}
              />
            </div>

            <div className="min-w-0">
              <h4
                className="truncate text-[14px] font-semibold text-foreground transition-colors group-hover:text-primary"
                title={asset.name}
              >
                {asset.name}
              </h4>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-800 dark:bg-muted dark:text-muted-foreground">
                  {asset.id}
                </code>
                <span className="text-[11px] text-muted-foreground">{asset.branch}</span>
              </div>
            </div>
          </div>

          <StatusBadge status={asset.status} />
        </div>

        <div className="my-3.5 border-t border-slate-100 dark:border-slate-800" />

        {/* Assignee / Stock Banner */}
        <div className="mb-3.5 flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-foreground dark:bg-muted/30">
          <div className="flex items-center gap-2 truncate">
            {asset.assignedTo ? (
              <Link
                href={`/employees/${asset.assignedTo}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 truncate hover:underline"
              >
                <EmployeeAvatar id={asset.assignedTo} name={emp?.name || asset.assignedTo} size={22} />
                <span className="truncate font-semibold text-foreground">{emp?.name || asset.assignedTo}</span>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                <PackageCheck className="h-3.5 w-3.5" /> In Stock (Unallocated)
              </span>
            )}
          </div>
          <span className="shrink-0 font-semibold text-foreground">{inr(asset.purchaseValue)}</span>
        </div>

        {/* T&C Status Pill */}
        {asset.status === "Assigned" && asset.termsAccepted && (
          <div className="mb-3 flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">GVK Appointment Letter Terms Accepted</span>
          </div>
        )}
        {asset.status === "Pending Acceptance" && (
          <div className="mb-3 flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Awaiting employee approval &amp; T&amp;C acceptance</span>
          </div>
        )}

        {/* 3 Metric Boxes */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Category</p>
            <p className="mt-0.5 truncate text-[11px] font-bold text-slate-900 dark:text-white">
              {asset.category}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Model</p>
            <p className="mt-0.5 truncate text-[11px] font-bold text-primary">
              {asset.brandModel.split(" ")[0] || "—"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Condition</p>
            <p className="mt-0.5 truncate text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              {asset.condition}
            </p>
          </div>
        </div>

        {isWarrantyExpired && (
          <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>Warranty lapsed on {fmtDate(asset.warrantyExpiry)}</span>
          </div>
        )}
      </div>

      {/* Footer / Actions */}
      <div
        className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3.5 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="truncate text-[11px] text-muted-foreground">
          SN: <strong className="font-mono text-foreground">{asset.serial}</strong>
        </span>

        <div className="flex items-center gap-1.5">
          {isPendingForMe ? (
            <Button
              size="sm"
              className="h-8 gap-1 rounded-xl bg-amber-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 sm:h-7 sm:rounded-md"
              onClick={onApproveTerms}
            >
              <FileCheck2 className="h-3.5 w-3.5" /> Approve &amp; Sign Terms
            </Button>
          ) : isAdmin && isAvailable ? (
            <Button
              size="sm"
              className="h-8 gap-1 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 sm:h-7 sm:rounded-md"
              onClick={onInspect}
            >
              <UserCheck className="h-3 w-3" /> Assign to Employee
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-xl px-2.5 text-xs font-medium sm:h-7 sm:rounded-md"
              onClick={onInspect}
            >
              Specs &amp; History
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================================
 * COMPONENT: AssetDetailSheetContent
 * ========================================================================================= */
function AssetDetailSheetContent({
  asset,
  isAdmin,
  uid,
  onOpenApproval,
  onIssue,
  onReturn,
}: {
  asset: Asset;
  isAdmin: boolean;
  uid: string;
  onOpenApproval: () => void;
  onIssue: (empId: string) => Promise<void>;
  onReturn: (cond: Asset["condition"]) => Promise<void>;
}) {
  const { data } = useStore();
  const nameOf = useNames();
  const emp = asset.assignedTo ? data.employees.find((e) => e.id === asset.assignedTo) : null;

  const activeEmployees = useMemo(
    () => data.employees.filter((e) => e.status !== "Inactive" && e.status !== "Resigned"),
    [data.employees]
  );

  const [issueTarget, setIssueTarget] = useState(activeEmployees[0]?.id || "");
  const [returnCondition, setReturnCondition] = useState<Asset["condition"]>("Good");
  const [busy, setBusy] = useState(false);

  const isPendingForMe = asset.status === "Pending Acceptance" && asset.assignedTo === uid;

  return (
    <div className="space-y-5 pt-2">
      <SheetHeader className="text-left">
        <div className="flex items-start justify-between gap-2 pr-6">
          <SheetTitle className="text-base font-bold">{asset.name}</SheetTitle>
          <StatusBadge status={asset.status} />
        </div>
      </SheetHeader>

      <div className="flex flex-wrap gap-2 text-xs">
        <code className="rounded bg-muted px-2 py-0.5 font-mono font-semibold">{asset.id}</code>
        <StatusBadge status={asset.condition} />
        <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-muted dark:text-muted-foreground">
          {asset.branch}
        </span>
      </div>

      {/* Pending Employee Approval Callout */}
      {isPendingForMe && (
        <div className="space-y-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs">
          <div className="flex items-start gap-2.5">
            <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold text-foreground">Action Required: Approve Asset Custody</p>
              <p className="mt-1 text-muted-foreground">
                Please read and agree to all GVK Edutech Appointment Letter terms &amp; conditions (Annexure A) to confirm receipt of this equipment.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="h-9 w-full gap-1.5 rounded-xl bg-amber-600 text-xs font-semibold text-white hover:bg-amber-700"
            onClick={onOpenApproval}
          >
            <ShieldCheck className="h-4 w-4" /> Review Terms &amp; Approve Asset
          </Button>
        </div>
      )}

      {/* Signed Terms Confirmation Receipt */}
      {asset.status === "Assigned" && asset.termsAccepted && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs">
          <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            GVK Appointment Letter Terms Accepted
          </div>
          <p className="mt-1 text-[11px] text-emerald-700/90 dark:text-emerald-300/80">
            Signed by <strong>{asset.employeeSignature || nameOf(asset.assignedTo || "")}</strong>
            {asset.termsAcceptedAt ? ` on ${new Date(asset.termsAcceptedAt).toLocaleString("en-IN")}` : ""} ·{" "}
            {asset.termsVersion || GVK_ASSET_TERMS_VERSION}
          </p>
        </div>
      )}

      {/* Specs Details */}
      <div className="space-y-2 rounded-2xl border border-border p-4 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Category</span>
          <span className="font-semibold text-foreground">{asset.category}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Model &amp; Specs</span>
          <span className="font-semibold text-foreground">{asset.brandModel}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Serial Number</span>
          <span className="font-mono font-semibold text-foreground">{asset.serial}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Purchase Value</span>
          <span className="font-semibold text-foreground">{inr(asset.purchaseValue)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Purchased Date</span>
          <span className="font-semibold text-foreground">{fmtDate(asset.purchaseDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Warranty Until</span>
          <span className="font-semibold text-foreground">{fmtDate(asset.warrantyExpiry)}</span>
        </div>
        {asset.specs && (
          <div className="border-t border-border pt-2">
            <span className="block text-muted-foreground">Specifications / Accessories</span>
            <span className="mt-0.5 block font-medium text-foreground">{asset.specs}</span>
          </div>
        )}
      </div>

      {/* Assignee Box */}
      {asset.assignedTo && (
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3.5 dark:bg-muted/30">
          <EmployeeAvatar id={asset.assignedTo} name={emp?.name || asset.assignedTo} size={40} />
          <div>
            <p className="text-xs font-semibold text-muted-foreground">
              {asset.status === "Pending Acceptance" ? "Assigned (Awaiting Approval)" : "Currently In Custody Of"}
            </p>
            <p className="text-sm font-semibold text-foreground">{emp?.name || nameOf(asset.assignedTo)}</p>
            <p className="text-[11px] text-muted-foreground">
              {emp?.designation} · {emp?.department}
            </p>
          </div>
        </div>
      )}

      {/* HR / Super Admin ONLY: Assign Asset */}
      {isAdmin && asset.status === "Available" && (
        <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs">
          <p className="font-semibold text-foreground">Assign Equipment to Employee</p>
          <p className="text-[11px] text-muted-foreground">
            Once assigned, the employee must approve this asset and agree to all GVK Appointment Letter terms from their portal.
          </p>
          <Field label="Select Employee">
            <Sel
              value={issueTarget}
              onChange={setIssueTarget}
              options={activeEmployees.map((e) => ({ value: e.id, label: `${e.name} (${e.id})` }))}
            />
          </Field>
          <Button
            size="sm"
            disabled={!issueTarget || busy}
            className="h-9 w-full rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            onClick={async () => {
              setBusy(true);
              await onIssue(issueTarget);
              setBusy(false);
            }}
          >
            {busy ? "Assigning..." : "Assign & Request Employee Approval"}
          </Button>
        </div>
      )}

      {/* HR / Super Admin ONLY: Record Return */}
      {isAdmin && (asset.status === "Assigned" || asset.status === "Pending Acceptance") && (
        <div className="space-y-3 rounded-2xl border border-border p-4 text-xs">
          <p className="font-semibold text-foreground">
            {asset.status === "Pending Acceptance" ? "Cancel Assignment / Return to Stock" : "Record Equipment Return"}
          </p>
          <Field label="Condition Assessment">
            <Sel
              value={returnCondition}
              onChange={(v) => setReturnCondition(v as Asset["condition"])}
              options={["Excellent", "Good", "Fair", "Poor"]}
            />
          </Field>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            className="h-9 w-full rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50"
            onClick={async () => {
              setBusy(true);
              await onReturn(returnCondition);
              setBusy(false);
            }}
          >
            {busy ? "Updating..." : "Return to Stock"}
          </Button>
        </div>
      )}

      {/* GVK Custody Terms Summary inside Details */}
      <div className="space-y-2.5 border-t border-border pt-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
          GVK Appointment Letter Asset Terms
        </h4>
        <div className="space-y-2 rounded-2xl border border-border bg-muted/15 p-3 text-[11px] text-muted-foreground">
          {GVK_ASSET_TERMS.map((c, idx) => (
            <p key={c.id}>
              <strong className="text-foreground">
                {idx + 1}. {c.title}:
              </strong>{" "}
              {c.text}
            </p>
          ))}
        </div>
      </div>

      {/* History Timeline */}
      <div className="space-y-3 border-t border-border pt-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">Asset Lifecycle History</h4>
        {asset.history.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">No historical movements logged.</p>
        ) : (
          <Timeline
            items={[...asset.history].reverse().map((h) => ({
              at: h.date,
              title: `${h.action}${h.employeeId ? ` — ${nameOf(h.employeeId)}` : ""}`,
              note: h.note,
            }))}
          />
        )}
      </div>
    </div>
  );
}

/* =========================================================================================
 * DIALOG: Employee Asset Custody & GVK Appointment Letter T&C Acceptance Modal
 * ========================================================================================= */
function AssetTermsApprovalDialog({
  asset,
  employeeName,
  onClose,
  onAccept,
  onDecline,
}: {
  asset: Asset | null;
  employeeName: string;
  onClose: () => void;
  onAccept: (signatureName: string) => Promise<void>;
  onDecline: (reason: string) => Promise<void>;
}) {
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [signature, setSignature] = useState(employeeName);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!asset) return;
    setCheckedIds({});
    setSignature(employeeName);
    setShowDecline(false);
    setDeclineReason("");
  }, [asset, employeeName]);

  if (!asset) return null;

  const allAgreed = GVK_ASSET_TERMS.every((c) => Boolean(checkedIds[c.id]));
  const canApprove = allAgreed && signature.trim().length >= 2 && !submitting;

  const toggleClause = (id: string, val: boolean) => {
    setCheckedIds((prev) => ({ ...prev, [id]: val }));
  };

  const toggleAll = (val: boolean) => {
    const next: Record<string, boolean> = {};
    for (const c of GVK_ASSET_TERMS) next[c.id] = val;
    setCheckedIds(next);
  };

  return (
    <Dialog open={!!asset} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[92dvh] overflow-y-auto overscroll-contain rounded-2xl p-4 sm:w-full sm:max-w-2xl sm:p-6">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Approve Asset &amp; Accept GVK Terms
              </DialogTitle>
              <DialogDescription className="text-xs">
                Review hardware details and agree to all Appointment Letter terms &amp; conditions (Annexure A) to confirm custody.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Equipment Summary */}
        <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-border bg-muted/25 p-3.5 text-xs sm:grid-cols-3">
          <div>
            <span className="block text-[10px] uppercase text-muted-foreground">Equipment</span>
            <span className="font-semibold text-foreground">{asset.name}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-muted-foreground">Asset Tag / Serial</span>
            <span className="font-mono font-semibold text-foreground">
              {asset.id} · {asset.serial}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-muted-foreground">Condition / Value</span>
            <span className="font-semibold text-foreground">
              {asset.condition} · {inr(asset.purchaseValue)}
            </span>
          </div>
        </div>

        {!showDecline ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">
                GVK Edutech Pvt. Ltd. — Appointment Letter Terms &amp; Conditions
              </p>
              <button
                type="button"
                onClick={() => toggleAll(!allAgreed)}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                {allAgreed ? "Uncheck All" : "Agree to All Terms"}
              </button>
            </div>

            <div className="space-y-2.5">
              {GVK_ASSET_TERMS.map((clause) => {
                const isChecked = Boolean(checkedIds[clause.id]);
                return (
                  <label
                    key={clause.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-xs transition-colors",
                      isChecked
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-border bg-card hover:bg-muted/30"
                    )}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(v) => toggleClause(clause.id, v === true)}
                      className="mt-0.5"
                    />
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{clause.title}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {clause.section}
                        </Badge>
                      </div>
                      <p className="leading-relaxed text-muted-foreground">{clause.text}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            <Field
              label="Employee Digital Confirmation (Full Name)"
              required
              hint={`Version ${GVK_ASSET_TERMS_VERSION} · Timestamp will be recorded on approval`}
            >
              <Input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Type your full name to sign"
                className="h-10 rounded-xl sm:h-9 sm:rounded-md"
              />
            </Field>

            <DialogFooter className="flex-col-reverse gap-2 border-t border-border pt-3 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                onClick={() => setShowDecline(true)}
              >
                <XCircle className="mr-1.5 h-3.5 w-3.5" /> Report Issue / Decline
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-xl sm:rounded-md">
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!canApprove}
                  onClick={async () => {
                    setSubmitting(true);
                    await onAccept(signature.trim());
                    setSubmitting(false);
                  }}
                  className="gap-1.5 rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-700 sm:rounded-md"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve &amp; Accept Asset
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Reason for Declining / Discrepancy Note" required>
              <Input
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g. Wrong serial number, screen scratch, charger missing..."
                className="h-10 rounded-xl sm:h-9 sm:rounded-md"
              />
            </Field>
            <DialogFooter className="gap-2 border-t border-border pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowDecline(false)}>
                Back to Terms
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={declineReason.trim().length < 3 || submitting}
                className="bg-rose-600 text-white hover:bg-rose-700"
                onClick={async () => {
                  setSubmitting(true);
                  await onDecline(declineReason.trim());
                  setSubmitting(false);
                }}
              >
                {submitting ? "Submitting..." : "Confirm Decline"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================================================
 * DIALOG: Add Asset Dialog (HR / Super Admin Only)
 * ========================================================================================= */
function AddAssetDialog({
  open,
  onOpenChange,
  todayIso,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  todayIso: string;
  onSubmit: (a: Omit<Asset, "id" | "history" | "status">) => Promise<void>;
}) {
  const { data } = useStore();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Laptop");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [assetTag, setAssetTag] = useState("");
  const [branch, setBranch] = useState<string>("Hyderabad");
  const [vendor, setVendor] = useState("Apple Commercial India");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [value, setValue] = useState("75000");
  const [warranty, setWarranty] = useState("2028-10-22");
  const [condition, setCondition] = useState<Asset["condition"]>("Excellent");
  const [assignedTo, setAssignedTo] = useState<string>("none");
  const [specs, setSpecs] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const valid = name.trim().length >= 3 && serial.trim().length >= 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[92dvh] overflow-y-auto overscroll-contain rounded-2xl p-4 sm:w-full sm:max-w-xl sm:p-6">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Laptop className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Register Asset into Inventory</DialogTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                If assigned to an employee now, they must accept GVK Appointment Letter terms to approve custody.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 py-2 text-xs sm:grid-cols-2">
          <Field label="Equipment Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. MacBook Pro 14 M3"
              className="h-9"
            />
          </Field>

          <Field label="Asset Category">
            <Sel value={category} onChange={setCategory} options={ASSET_CATEGORIES} />
          </Field>

          <Field label="Make & Detailed Model">
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. Apple M3 Pro 18GB/512GB"
              className="h-9"
            />
          </Field>

          <Field label="Serial / Service Tag Number" required>
            <Input
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="C02XK1YZLVDL"
              className="h-9 font-mono font-semibold"
            />
          </Field>

          <Field label="Internal Asset Barcode Tag (optional)">
            <Input
              value={assetTag}
              onChange={(e) => setAssetTag(e.target.value)}
              placeholder="AST-IT-2026-088"
              className="h-9 font-mono"
            />
          </Field>

          <Field label="Deployment Office Branch">
            <Sel value={branch} onChange={setBranch} options={BRANCHES} />
          </Field>

          <Field label="Vendor / Authorized Reseller">
            <Sel
              value={vendor}
              onChange={setVendor}
              options={[
                "Apple Commercial India",
                "Dell Technologies Direct",
                "Lenovo Enterprise",
                "Croma Business Solution",
                "Amazon Corporate",
                "Local IT Distributor",
              ]}
            />
          </Field>

          <Field label="Invoice / PO Reference #">
            <Input
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              placeholder="PO-2026-9812"
              className="h-9 font-mono"
            />
          </Field>

          <Field label="Procurement Price (₹)">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
              placeholder="75000"
              className="h-9 font-semibold"
            />
          </Field>

          <Field label="Warranty Expiry Date">
            <Input type="date" value={warranty} onChange={(e) => setWarranty(e.target.value)} className="h-9" />
          </Field>

          <Field label="Initial Physical Condition">
            <Sel
              value={condition}
              onChange={(v) => setCondition(v as Asset["condition"])}
              options={["Excellent", "Good", "Fair", "Poor"]}
            />
          </Field>

          <Field label="Assign to Employee (Requires T&C Approval)">
            <Sel
              value={assignedTo}
              onChange={setAssignedTo}
              options={[
                { value: "none", label: "Keep in Stock (Unassigned)" },
                ...data.employees
                  .filter((e) => e.status !== "Inactive" && e.status !== "Resigned")
                  .map((e) => ({ value: e.id, label: `${e.name} (${e.department})` })),
              ]}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Hardware Specifications / Peripheral Notes">
              <Input
                value={specs}
                onChange={(e) => setSpecs(e.target.value)}
                placeholder="e.g. 18GB Unified RAM, 512GB SSD, includes Charger & Sleeve"
                className="h-9"
              />
            </Field>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!valid || submitting}
            onClick={async () => {
              setSubmitting(true);
              await onSubmit({
                name,
                category,
                brandModel: model || name,
                serial,
                assetTag: assetTag || undefined,
                vendor,
                invoiceNo: invoiceNo || undefined,
                branch: branch as Branch,
                assignedTo: assignedTo === "none" ? null : assignedTo,
                purchaseDate: todayIso,
                purchaseValue: Number(value) || 0,
                warrantyExpiry: warranty,
                condition,
                specs: specs || undefined,
              });
              setSubmitting(false);
            }}
            className="bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {submitting ? "Saving..." : assignedTo === "none" ? "Add to Inventory" : "Register & Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
