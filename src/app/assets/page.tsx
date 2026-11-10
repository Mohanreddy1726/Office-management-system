"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/data/store";
import { TODAY } from "@/lib/data/seed";
import { PageHeader, KpiCard, StatusBadge, TabsShell, Field, Timeline, EmployeeAvatar } from "@/components/shared";
import { DataTable, exportCsv, type Column } from "@/components/data-table";
import { Person, Sel, useScope, useNames } from "@/components/form-bits";
import { BRANCHES } from "@/lib/data/types";
import type { Asset, Branch } from "@/lib/data/types";
import { fmtDate, inr, daysUntil, initials, avatarColor } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { AppShell } from "@/components/shell";
import {
  Boxes, Laptop, Wrench, PackageCheck, Plus, Download, Search,
  LayoutGrid, List, Building2, Shield, ArrowUpRight, HardDrive,
  RotateCcw, CheckCircle2, AlertTriangle, Check, X, Smartphone,
  Monitor, Printer, Headphones, Sparkles, Calendar, UserCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

const ASSET_CATEGORIES = ["Laptop", "Monitor", "Phone", "Printer", "Accessory", "Office Equipment", "Furniture", "Other"];

export default function AssetsPage() {
  const { data, addAsset, issueAsset, returnAsset } = useStore();
  const { isAdmin, isEmployee, uid, inScope } = useScope();
  const nameOf = useNames();

  const [tab, setTab] = useState<string>("all");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals & Slide-out Sheet
  const [addOpen, setAddOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // Scoped assets base
  const baseAssets = useMemo(() => {
    if (isEmployee) return data.assets.filter((a) => a.assignedTo === uid);
    if (isAdmin) return data.assets;
    return data.assets.filter((a) => a.assignedTo && inScope(a.assignedTo));
  }, [data.assets, isEmployee, isAdmin, uid, inScope]);

  // Tab & search filtered assets
  const filteredAssets = useMemo(() => {
    return baseAssets.filter((a) => {
      // Tab filter
      if (tab === "available" && a.status !== "Available") return false;
      if (tab === "assigned" && a.status !== "Assigned") return false;
      if (tab === "maintenance" && a.status !== "Under Maintenance" && a.status !== "Damaged") return false;
      if (tab === "mine" && a.assignedTo !== uid) return false;

      // Category filter
      if (categoryFilter !== "all" && a.category !== categoryFilter) return false;

      // Status filter
      if (statusFilter !== "all" && a.status !== statusFilter) return false;

      // Search query
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

  const currentAsset = data.assets.find((a) => a.id === selectedAssetId);

  // KPI figures
  const totalAssetsCount = baseAssets.length;
  const assignedCount = baseAssets.filter((a) => a.status === "Assigned").length;
  const availableCount = baseAssets.filter((a) => a.status === "Available").length;
  const maintCount = baseAssets.filter((a) => a.status === "Under Maintenance" || a.status === "Damaged").length;
  const myAssets = data.assets.filter((a) => a.assignedTo === uid);

  // Table Columns
  const tableColumns: Column<Asset>[] = [
    {
      key: "i",
      header: "Asset",
      sortValue: (r) => r.id,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
            <Laptop className="h-4 w-4" />
          </div>
          <div>
            <span
              className="font-semibold text-foreground hover:underline cursor-pointer block"
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
          <Link href={`/employees/${r.assignedTo}`} className="group flex items-center gap-1.5 hover:underline">
            <Person id={r.assignedTo} />
            <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ) : (
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            In Stock
          </span>
        ),
    },
    {
      key: "w",
      header: "Warranty",
      render: (r) => {
        const n = daysUntil(r.warrantyExpiry);
        const isExpired = n !== undefined && n < 0;
        return (
          <span className={cn(isExpired ? "font-semibold text-rose-600 dark:text-rose-400" : "text-foreground")}>
            {fmtDate(r.warrantyExpiry)}
            {isExpired && " (Expired)"}
          </span>
        );
      },
      hideOnMobile: true,
    },
    { key: "cd", header: "Condition", render: (r) => <StatusBadge status={r.condition} /> },
    { key: "s", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "act",
      header: "",
      render: (r) => (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setSelectedAssetId(r.id)}
        >
          Details
        </Button>
      ),
    },
  ];

  return (
    <AppShell>
      <div>
        <PageHeader
          breadcrumb={["Operations", "Asset Inventory"]}
          title={isEmployee ? "My Issued Equipment" : "Company Asset Inventory & Equipment Desk"}
          description={
            isEmployee
              ? "View IT equipment, laptops, monitors and hardware issued to your custody."
              : "Track hardware inventory across office branches, manage equipment assignments, returns, conditions, and warranty lifecycles."
          }
          actions={
            isAdmin && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs shadow-sm"
                  onClick={() =>
                    exportCsv(
                      "asset-inventory.csv",
                      ["Asset ID", "Name", "Category", "Model", "Serial", "Branch", "Assigned To", "Status", "Condition", "Value", "Warranty"],
                      data.assets.map((a) => [
                        a.id,
                        a.name,
                        a.category,
                        a.brandModel,
                        a.serial,
                        a.branch,
                        a.assignedTo ? nameOf(a.assignedTo) : "Unassigned",
                        a.status,
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
                  className="gap-1.5 text-xs shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Equipment
                </Button>
              </>
            )
          }
        />

        {/* Top KPI Cards Row */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total Equipment"
            value={String(totalAssetsCount)}
            hint="Active hardware in system"
            icon={<Boxes className="h-4 w-4 text-primary" />}
            onClick={() => setTab("all")}
          />
          <KpiCard
            label="Currently Assigned"
            value={String(assignedCount)}
            hint={`${Math.round((assignedCount / Math.max(1, totalAssetsCount)) * 100)}% utilization rate`}
            icon={<Laptop className="h-4 w-4 text-blue-500" />}
            onClick={() => setTab("assigned")}
          />
          <KpiCard
            label="Available in Stock"
            value={String(availableCount)}
            hint="Ready for new joiners"
            icon={<PackageCheck className="h-4 w-4 text-emerald-600" />}
            onClick={() => setTab("available")}
          />
          <KpiCard
            label="Under Maintenance"
            value={String(maintCount)}
            hint={maintCount > 0 ? "Repair ticket open" : "All equipment healthy"}
            icon={<Wrench className="h-4 w-4 text-amber-500" />}
            onClick={() => setTab("maintenance")}
          />
        </div>

        {/* Tabs Shell */}
        <TabsShell
          tabs={[
            { key: "all", label: `All Assets (${totalAssetsCount})` },
            { key: "available", label: `Available in Stock (${availableCount})`, hidden: isEmployee },
            { key: "assigned", label: `Assigned Equipment (${assignedCount})`, hidden: isEmployee },
            { key: "maintenance", label: `In Maintenance (${maintCount})`, hidden: isEmployee },
            { key: "mine", label: `My Equipment (${myAssets.length})` },
          ]}
          active={tab}
          onChange={(t) => {
            setTab(t);
            setSearchQuery("");
          }}
        >
          <div className="space-y-4">
            {/* Filter Toolbar */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-56 sm:w-72">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search asset name, serial, assignee..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8.5 pl-8 text-xs"
                  />
                </div>
                <Sel
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  className="h-8.5 w-40 text-xs"
                  options={[{ value: "all", label: "All Categories" }, ...ASSET_CATEGORIES]}
                />
                {!isEmployee && (
                  <Sel
                    value={statusFilter}
                    onChange={setStatusFilter}
                    className="h-8.5 w-40 text-xs"
                    options={[
                      { value: "all", label: "All Statuses" },
                      { value: "Available", label: "Available" },
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

              {/* View Switcher */}
              <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
                <Button
                  variant={view === "cards" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("cards")}
                  className="h-7 gap-1 px-2.5 text-xs font-medium"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Cards
                </Button>
                <Button
                  variant={view === "table" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("table")}
                  className="h-7 gap-1 px-2.5 text-xs font-medium"
                >
                  <List className="h-3.5 w-3.5" />
                  Table
                </Button>
              </div>
            </div>

            {/* CARDS VIEW */}
            {view === "cards" && (
              <div>
                {filteredAssets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                    <Boxes className="h-10 w-10 text-muted-foreground/60 mb-2" />
                    <p className="text-sm font-semibold text-foreground">
                      {isEmployee ? "No Equipment Assigned to You" : "No Assets Found"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isEmployee
                        ? "Contact IT Support if you require hardware allocation."
                        : "No equipment matches the selected filters."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredAssets.map((asset) => (
                      <AssetCard
                        key={asset.id}
                        asset={asset}
                        isAdmin={isAdmin}
                        onInspect={() => setSelectedAssetId(asset.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TABLE VIEW */}
            {view === "table" && (
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
        </TabsShell>

        {/* DIALOG: Add Asset */}
        <AddAssetDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onSubmit={(newAsset) => {
            addAsset(newAsset);
            setAddOpen(false);
            toast.success(`Asset "${newAsset.name}" registered to inventory`);
          }}
        />

        {/* SLIDE-OUT SHEET: Asset Specs & Issue/Return */}
        <Sheet open={!!currentAsset} onOpenChange={(v) => !v && setSelectedAssetId(null)}>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            {currentAsset && (
              <AssetDetailSheetContent
                asset={currentAsset}
                isAdmin={isAdmin}
                onIssue={(empId) => {
                  issueAsset(currentAsset.id, empId, "Issued via Asset Desk");
                  toast.success(`Asset issued to ${nameOf(empId)}`);
                  setSelectedAssetId(null);
                }}
                onReturn={(condition) => {
                  returnAsset(currentAsset.id, condition, "Returned to IT inventory");
                  toast.success("Asset returned and marked Available in stock");
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

/* =========================================================================================
 * COMPONENT: AssetCard (Rich custom card matching photo aesthetic)
 * ========================================================================================= */
function AssetCard({
  asset,
  isAdmin,
  onInspect,
}: {
  asset: Asset;
  isAdmin: boolean;
  onInspect: () => void;
}) {
  const { data } = useStore();
  const emp = asset.assignedTo ? data.employees.find((e) => e.id === asset.assignedTo) : null;
  const isAvailable = asset.status === "Available";
  const daysWarranty = daysUntil(asset.warrantyExpiry);
  const isWarrantyExpired = daysWarranty !== undefined && daysWarranty < 0;

  // Category Icon & Color
  const getIcon = () => {
    switch (asset.category) {
      case "Laptop":
        return <Laptop className="h-6 w-6" />;
      case "Monitor":
        return <Monitor className="h-6 w-6" />;
      case "Phone":
        return <Smartphone className="h-6 w-6" />;
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
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all duration-200 dark:bg-card dark:border-border hover:shadow-md">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-primary text-white font-bold shadow-sm">
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
                onClick={onInspect}
                className="font-semibold text-foreground text-[14px] truncate cursor-pointer hover:text-primary transition-colors"
                title={asset.name}
              >
                {asset.name}
              </h4>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <code className="rounded bg-slate-100 px-1.5 py-0.2 font-mono text-[11px] font-semibold text-slate-800 dark:bg-muted dark:text-muted-foreground">
                  {asset.id}
                </code>
                <span className="text-[11px] text-muted-foreground">{asset.branch}</span>
              </div>
            </div>
          </div>

          <StatusBadge status={asset.status} />
        </div>

        {/* Divider */}
        <div className="my-3.5 border-t border-slate-100 dark:border-slate-800" />

        {/* Assignee / Stock Banner */}
        <div className="mb-3.5 flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-foreground dark:bg-muted/30">
          <div className="flex items-center gap-2 truncate">
            {asset.assignedTo ? (
              <Link href={`/employees/${asset.assignedTo}`} className="flex items-center gap-1.5 hover:underline truncate">
                <EmployeeAvatar id={asset.assignedTo} name={emp?.name || asset.assignedTo} size={22} />
                <span className="font-semibold text-foreground truncate">{emp?.name || asset.assignedTo}</span>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                <PackageCheck className="h-3.5 w-3.5" /> In Stock (Unallocated)
              </span>
            )}
          </div>
          <span className="font-semibold text-foreground shrink-0">{inr(asset.purchaseValue)}</span>
        </div>

        {/* 3 Metric Boxes (photo style) */}
        <div className="grid grid-cols-3 gap-2">
          {/* Box 1: Category */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Category</p>
            <p className="mt-0.5 truncate text-[11px] font-bold text-slate-900 dark:text-white">
              {asset.category}
            </p>
          </div>

          {/* Box 2: Serial / Model */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Model</p>
            <p className="mt-0.5 truncate text-[11px] font-bold text-primary">
              {asset.brandModel.split(" ")[0]}
            </p>
          </div>

          {/* Box 3: Condition */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Condition</p>
            <p className="mt-0.5 truncate text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              {asset.condition}
            </p>
          </div>
        </div>

        {/* Warranty Expiry Alert */}
        {isWarrantyExpired && (
          <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>Warranty lapsed on {fmtDate(asset.warrantyExpiry)}</span>
          </div>
        )}
      </div>

      {/* Footer / Actions */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground truncate">
          SN: <strong className="text-foreground font-mono">{asset.serial}</strong>
        </span>

        <div className="flex items-center gap-1.5">
          {isAdmin && isAvailable ? (
            <Button
              size="sm"
              className="h-7 px-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              onClick={onInspect}
            >
              <UserCheck className="mr-1 h-3 w-3" /> Issue Asset
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs font-medium"
              onClick={onInspect}
            >
              Specs & History
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
  onIssue,
  onReturn,
}: {
  asset: Asset;
  isAdmin: boolean;
  onIssue: (empId: string) => void;
  onReturn: (cond: Asset["condition"]) => void;
}) {
  const { data } = useStore();
  const nameOf = useNames();
  const emp = asset.assignedTo ? data.employees.find((e) => e.id === asset.assignedTo) : null;

  const [issueTarget, setIssueTarget] = useState(data.employees[0]?.id || "");
  const [returnCondition, setReturnCondition] = useState<Asset["condition"]>("Good");

  return (
    <div className="space-y-6 pt-4">
      <SheetHeader>
        <div className="flex items-start justify-between gap-2">
          <SheetTitle className="text-base font-bold pr-2">{asset.name}</SheetTitle>
          <StatusBadge status={asset.status} />
        </div>
      </SheetHeader>

      {/* Badges strip */}
      <div className="flex flex-wrap gap-2 text-xs">
        <code className="rounded bg-muted px-2 py-0.5 font-mono font-semibold">{asset.id}</code>
        <StatusBadge status={asset.condition} />
        <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-muted dark:text-muted-foreground">
          {asset.branch}
        </span>
      </div>

      {/* Specs Details */}
      <div className="space-y-2 rounded-xl border border-border p-3.5 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Category:</span>
          <span className="font-semibold text-foreground">{asset.category}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Model & Specs:</span>
          <span className="font-semibold text-foreground">{asset.brandModel}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Serial Number:</span>
          <span className="font-mono font-semibold text-foreground">{asset.serial}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Purchase Value:</span>
          <span className="font-semibold text-foreground">{inr(asset.purchaseValue)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Purchased Date:</span>
          <span className="font-semibold text-foreground">{fmtDate(asset.purchaseDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Warranty Until:</span>
          <span className="font-semibold text-foreground">{fmtDate(asset.warrantyExpiry)}</span>
        </div>
      </div>

      {/* Assignee Box */}
      {asset.assignedTo && (
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-muted/30">
          <EmployeeAvatar id={asset.assignedTo} name={emp?.name || asset.assignedTo} size={40} />
          <div>
            <p className="font-semibold text-foreground text-xs">Currently Issued To</p>
            <p className="text-sm font-semibold text-foreground">{emp?.name || nameOf(asset.assignedTo)}</p>
            <p className="text-[11px] text-muted-foreground">
              {emp?.designation} · {emp?.department}
            </p>
          </div>
        </div>
      )}

      {/* Admin Action: Issue Asset */}
      {isAdmin && asset.status === "Available" && (
        <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-xs">
          <p className="font-semibold text-foreground">Deploy to Employee</p>
          <Field label="Select Employee">
            <Sel
              value={issueTarget}
              onChange={setIssueTarget}
              options={data.employees.filter((e) => e.status !== "Inactive").map((e) => ({ value: e.id, label: `${e.name} (${e.id})` }))}
            />
          </Field>
          <Button
            size="sm"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            onClick={() => onIssue(issueTarget)}
          >
            Confirm & Issue Equipment
          </Button>
        </div>
      )}

      {/* Admin Action: Record Return */}
      {isAdmin && asset.status === "Assigned" && (
        <div className="space-y-3 rounded-xl border border-border p-3.5 text-xs">
          <p className="font-semibold text-foreground">Record Equipment Return</p>
          <Field label="Return Condition Assessment">
            <Sel
              value={returnCondition}
              onChange={(v) => setReturnCondition(v as Asset["condition"])}
              options={["Excellent", "Good", "Fair", "Poor"]}
            />
          </Field>
          <Button
            size="sm"
            variant="outline"
            className="w-full text-rose-600 border-rose-200 hover:bg-rose-50"
            onClick={() => onReturn(returnCondition)}
          >
            Return to Stock
          </Button>
        </div>
      )}

      {/* Assignment & Service History Timeline */}
      <div className="space-y-3 pt-2 border-t border-border">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Asset Lifecycle History</h4>
        {asset.history.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No historical movements logged.</p>
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
 * DIALOG: Add Asset Dialog
 * ========================================================================================= */
function AddAssetDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (a: Omit<Asset, "id" | "history" | "status"> & { initialAssignee?: string }) => void;
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

  const valid = name.trim().length >= 3 && serial.trim().length >= 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Laptop className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Register Asset into Inventory</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Catalog hardware & office assets, serial numbers, procurement warranty, and staff assignment.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2 text-xs">
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

          <Field label="Initial Allocation">
            <Sel
              value={assignedTo}
              onChange={setAssignedTo}
              options={[
                { value: "none", label: "📦 Keep in Stock (Unassigned)" },
                ...data.employees.map((e) => ({ value: e.id, label: `👤 ${e.name} (${e.department})` })),
              ]}
            />
          </Field>

          <div className="col-span-2">
            <Field label="Hardware Specifications / Peripheral Notes">
              <Input
                value={specs}
                onChange={(e) => setSpecs(e.target.value)}
                placeholder="e.g. 18GB Unified RAM, 512GB SSD, includes 70W USB-C Charger & Sleeve"
                className="h-9"
              />
            </Field>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!valid}
            onClick={() =>
              onSubmit({
                name,
                category,
                brandModel: model || name,
                serial,
                assetTag: assetTag || undefined,
                vendor,
                invoiceNo: invoiceNo || undefined,
                branch: branch as Branch,
                assignedTo: assignedTo === "none" ? null : assignedTo,
                purchaseDate: TODAY,
                purchaseValue: Number(value) || 0,
                warrantyExpiry: warranty,
                condition,
                specs: specs || undefined,
              })
            }
            className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            Add to Inventory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
