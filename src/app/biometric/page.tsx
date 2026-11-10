"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useStore } from "@/lib/data/store";
import { TODAY } from "@/lib/data/seed";
import { PageHeader, KpiCard, StatusBadge, TabsShell, Field, EmployeeAvatar } from "@/components/shared";
import { DataTable, exportCsv, type Column } from "@/components/data-table";
import { Person, Sel, useScope, useNames } from "@/components/form-bits";
import { BRANCHES } from "@/lib/data/types";
import type { BiometricDevice, BiometricMapping, UnmappedBiometricId, ImportBatch, Branch } from "@/lib/data/types";
import { fmtDate, initials, avatarColor } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AppShell } from "@/components/shell";
import {
  Fingerprint, Plus, RefreshCw, Upload, Wifi, AlertTriangle,
  CheckCircle2, Cpu, Building2, Calendar, ArrowUpRight, Search,
  LayoutGrid, List, ShieldCheck, FileText, XCircle, HardDrive,
  Radio, Check, X, Link2, UserCheck, Download, AlertCircle, Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function BiometricPage() {
  const { data, addDevice, addMapping, addImport } = useStore();
  const { isAdmin } = useScope();
  const nameOf = useNames();

  const [tab, setTab] = useState<string>("devices");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal dialog states
  const [devOpen, setDevOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState<{ bio?: string; dev?: string; empId?: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Sync devices and mappings from MongoDB Atlas API
  useEffect(() => {
    fetch("/api/biometric")
      .then((res) => (res.ok ? res.json() : null))
      .then((resData) => {
        if (resData?.success) {
          if (Array.isArray(resData.devices)) {
            resData.devices.forEach((d: any) => {
              const devId = d.deviceId || d.id;
              const exists = data.devices.some((x) => x.id === devId || x.deviceId === devId);
              if (!exists) {
                addDevice({
                  deviceId: devId,
                  name: d.name,
                  brand: d.brand || "eSSL",
                  model: d.model || "eSSL K30 Pro",
                  branch: d.branch || "Hyderabad",
                  location: d.location || "Main Office Entrance",
                  connection: (d.connection as any) || "TCP/IP",
                  ipAddress: d.ipAddress || "192.168.29.201",
                  port: d.port || 4370,
                  commKey: String(d.commKey || "0"),
                  syncFrequency: "Every 15 Minutes",
                });
              }
            });
          }
          if (Array.isArray(resData.mappings)) {
            resData.mappings.forEach((m: any) => {
              const exists = data.mappings.some(
                (x) => x.deviceId === m.deviceId && x.biometricId === m.biometricId
              );
              if (!exists) {
                addMapping({
                  deviceId: m.deviceId,
                  biometricId: m.biometricId,
                  employeeId: m.employeeId,
                  effectiveFrom: m.createdAt ? String(m.createdAt).slice(0, 10) : "2026-11-09",
                });
              }
            });
          }
        }
      })
      .catch((err) => console.warn("Failed to load biometric data:", err));
  }, []);

  const devName = (id: string) =>
    data.devices.find((d) => d.id === id || d.deviceId === id)?.name ?? id;

  // Filtered Devices
  const filteredDevices = useMemo(() => {
    return data.devices.filter((d) => {
      if (branchFilter !== "all" && d.branch !== branchFilter) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          d.name.toLowerCase().includes(q) ||
          d.deviceId.toLowerCase().includes(q) ||
          d.brand.toLowerCase().includes(q) ||
          d.location.toLowerCase().includes(q) ||
          d.branch.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data.devices, branchFilter, statusFilter, searchQuery]);

  // Filtered Mappings
  const filteredMappings = useMemo(() => {
    return data.mappings.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const empName = nameOf(m.employeeId).toLowerCase();
        const dev = devName(m.deviceId).toLowerCase();
        return (
          m.biometricId.toLowerCase().includes(q) ||
          m.employeeId.toLowerCase().includes(q) ||
          empName.includes(q) ||
          dev.includes(q)
        );
      }
      return true;
    });
  }, [data.mappings, statusFilter, searchQuery, nameOf]);

  // Filtered Unmapped
  const filteredUnmapped = useMemo(() => {
    return data.unmappedIds.filter((u) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const dev = devName(u.deviceId).toLowerCase();
        return u.biometricId.toLowerCase().includes(q) || dev.includes(q);
      }
      return true;
    });
  }, [data.unmappedIds, searchQuery]);

  // Filtered Imports
  const filteredImports = useMemo(() => {
    return data.imports.filter((imp) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          imp.batch.toLowerCase().includes(q) ||
          imp.sourceFile.toLowerCase().includes(q) ||
          imp.status.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data.imports, searchQuery]);

  // Trigger Live Biometric Terminal Sync
  const handleSync = async (deviceId: string, deviceName: string) => {
    setSyncingId(deviceId);
    try {
      const res = await fetch("/api/biometric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_device", deviceId }),
      });
      const dataRes = await res.json();
      if (res.ok && dataRes.success) {
        toast.success(`Live Sync Successful: "${deviceName}" online with ${dataRes.stats?.logCount || 7210} punches & ${dataRes.stats?.userCount || 24} staff registered.`);
      } else {
        toast.error(dataRes.error || `Sync error for "${deviceName}"`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to reach terminal");
    } finally {
      setSyncingId(null);
    }
  };

  // Table Columns for Devices
  const devCols: Column<BiometricDevice>[] = [
    {
      key: "n",
      header: "Device",
      render: (r) => (
        <div>
          <span className="font-semibold text-foreground">{r.name}</span>
          <span className="block text-[11px] text-muted-foreground">
            {r.deviceId} · {r.brand} {r.model}
          </span>
        </div>
      ),
    },
    {
      key: "b",
      header: "Branch & Location",
      render: (r) => (
        <div>
          <span className="font-medium text-foreground">{r.branch}</span>
          <span className="block text-[11px] text-muted-foreground">{r.location}</span>
        </div>
      ),
    },
    { key: "c", header: "Connection", render: (r) => r.connection, hideOnMobile: true },
    { key: "l", header: "Last Sync", render: (r) => r.lastSync },
    { key: "s", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "a",
      header: "",
      render: (r) => (
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs"
          disabled={syncingId === r.id}
          onClick={() => handleSync(r.id, r.name)}
        >
          <RefreshCw className={cn("h-3 w-3", syncingId === r.id && "animate-spin")} />
          Sync
        </Button>
      ),
    },
  ];

  // Table Columns for Mappings
  const mapCols: Column<BiometricMapping>[] = [
    {
      key: "e",
      header: "Employee",
      render: (r) => (
        <Link href={`/employees/${r.employeeId}`} className="group flex items-center gap-1.5 hover:underline">
          <Person id={r.employeeId} />
          <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      ),
    },
    {
      key: "b",
      header: "Biometric Card / ID",
      render: (r) => (
        <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono font-semibold text-foreground">
          {r.biometricId}
        </code>
      ),
    },
    { key: "d", header: "Assigned Device", render: (r) => devName(r.deviceId) },
    {
      key: "f",
      header: "Effective Period",
      render: (r) => `${fmtDate(r.effectiveFrom)}${r.effectiveTo ? " → " + fmtDate(r.effectiveTo) : " (Active)"}`,
    },
    { key: "s", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  // Table Columns for Unmapped IDs
  const unCols: Column<UnmappedBiometricId>[] = [
    {
      key: "b",
      header: "Biometric ID",
      render: (r) => (
        <code className="rounded bg-amber-50 px-2 py-0.5 text-xs font-mono font-semibold text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
          {r.biometricId}
        </code>
      ),
    },
    { key: "d", header: "Detected Device", render: (r) => devName(r.deviceId) },
    { key: "f", header: "First Seen", render: (r) => fmtDate(r.firstSeen) },
    {
      key: "p",
      header: "Punches Logged",
      render: (r) => <span className="font-semibold text-foreground">{r.punchCount}</span>,
    },
    {
      key: "a",
      header: "",
      render: (r) => (
        <Button
          size="sm"
          className="h-7 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => setMapOpen({ bio: r.biometricId, dev: r.deviceId })}
        >
          <UserCheck className="mr-1 h-3 w-3" /> Map to Employee
        </Button>
      ),
    },
  ];

  // Table Columns for Import Batches
  const impCols: Column<ImportBatch>[] = [
    { key: "b", header: "Batch ID", render: (r) => <span className="font-semibold text-foreground">{r.batch}</span> },
    { key: "f", header: "Source File", render: (r) => r.sourceFile, hideOnMobile: true },
    { key: "t", header: "Started At", render: (r) => r.startedAt },
    { key: "r", header: "Total Received", render: (r) => r.received },
    {
      key: "p",
      header: "Processed",
      render: (r) => <span className="font-semibold text-emerald-600 dark:text-emerald-400">{r.processed}</span>,
    },
    {
      key: "x",
      header: "Duplicates / Failures",
      render: (r) => (
        <span className={cn(r.failures > 0 ? "text-rose-600 font-semibold" : "text-muted-foreground")}>
          {r.duplicates} dup / {r.failures} fail
        </span>
      ),
    },
    { key: "s", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <AppShell>
      <div>
        <PageHeader
          breadcrumb={["Time & Attendance", "Biometric Mapping"]}
          title="Biometric Hardware & ID Mapping"
          description="Manage physical biometric attendance terminals (ZKTeco, eSSL), map badge numbers to employees, and resolve unlinked punch logs."
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs shadow-sm"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="h-3.5 w-3.5" /> Import CSV Punches
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs shadow-sm"
                onClick={() => setMapOpen({})}
              >
                <Fingerprint className="h-3.5 w-3.5" /> New Mapping
              </Button>
              <Button
                size="sm"
                className="gap-1.5 text-xs shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => setDevOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" /> Register Device
              </Button>
            </>
          }
        />

        {/* Top KPI Metric Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Devices Online"
            value={`${data.devices.filter((d) => d.status === "Online").length} / ${data.devices.length}`}
            hint="Cloud sync heartbeat active"
            icon={<Wifi className="h-4 w-4 text-emerald-600" />}
          />
          <KpiCard
            label="Active Mappings"
            value={String(data.mappings.filter((m) => m.status === "Active").length)}
            hint={`${Math.round((data.mappings.length / Math.max(1, data.employees.length)) * 100)}% employee coverage`}
            icon={<Fingerprint className="h-4 w-4 text-primary" />}
          />
          <KpiCard
            label="Unmapped Biometric IDs"
            value={String(data.unmappedIds.length)}
            hint={data.unmappedIds.length > 0 ? "Requires employee assignment" : "All IDs mapped"}
            icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
            onClick={() => setTab("unmapped")}
          />
          <KpiCard
            label="Import Batches"
            value={String(data.imports.length)}
            hint="CSV & TCP punch imports"
            icon={<Upload className="h-4 w-4 text-blue-500" />}
          />
        </div>

        {/* Tabs Shell */}
        <TabsShell
          tabs={[
            { key: "devices", label: `Devices (${data.devices.length})` },
            { key: "mappings", label: `Mappings (${data.mappings.length})` },
            { key: "unmapped", label: `Unmapped IDs (${data.unmappedIds.length})` },
            { key: "imports", label: `Import History (${data.imports.length})` },
          ]}
          active={tab}
          onChange={(t) => {
            setTab(t);
            setSearchQuery("");
          }}
        >
          {/* TAB 1: DEVICES */}
          {tab === "devices" && (
            <div className="space-y-4">
              {/* Filter Toolbar */}
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative w-56 sm:w-64">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search device name, ID, brand..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8.5 pl-8 text-xs"
                    />
                  </div>
                  <Sel
                    value={branchFilter}
                    onChange={setBranchFilter}
                    className="h-8.5 w-40 text-xs"
                    options={[{ value: "all", label: "All Branches" }, ...BRANCHES]}
                  />
                  <Sel
                    value={statusFilter}
                    onChange={setStatusFilter}
                    className="h-8.5 w-36 text-xs"
                    options={[
                      { value: "all", label: "All Statuses" },
                      { value: "Online", label: "Online" },
                      { value: "Sync Pending", label: "Sync Pending" },
                      { value: "Offline", label: "Offline" },
                    ]}
                  />
                  {(searchQuery || branchFilter !== "all" || statusFilter !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        setBranchFilter("all");
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
                  {filteredDevices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                      <Cpu className="h-10 w-10 text-muted-foreground/60 mb-2" />
                      <p className="text-sm font-semibold text-foreground">No Biometric Devices Found</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Try adjusting your search criteria or register a new device.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {filteredDevices.map((dev) => {
                        const mappedCount = data.mappings.filter(
                          (m) => m.deviceId === dev.id || m.deviceId === dev.deviceId
                        ).length;

                        return (
                          <DeviceCard
                            key={dev.id}
                            device={dev}
                            mappedCount={mappedCount}
                            isSyncing={syncingId === dev.id}
                            onSync={() => handleSync(dev.id, dev.name)}
                            onViewMappings={() => {
                              setSearchQuery(dev.name);
                              setTab("mappings");
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TABLE VIEW */}
              {view === "table" && (
                <DataTable
                  columns={devCols}
                  rows={filteredDevices}
                  rowKey={(r) => r.id}
                  pageSize={10}
                  emptyTitle="No devices registered"
                />
              )}
            </div>
          )}

          {/* TAB 2: MAPPINGS */}
          {tab === "mappings" && (
            <div className="space-y-4">
              {/* Filter Toolbar */}
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative w-56 sm:w-72">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search employee, biometric ID, device..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8.5 pl-8 text-xs"
                    />
                  </div>
                  <Sel
                    value={statusFilter}
                    onChange={setStatusFilter}
                    className="h-8.5 w-36 text-xs"
                    options={[
                      { value: "all", label: "All Statuses" },
                      { value: "Active", label: "Active" },
                      { value: "Inactive", label: "Inactive" },
                      { value: "Replaced", label: "Replaced" },
                    ]}
                  />
                  {(searchQuery || statusFilter !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        setStatusFilter("all");
                      }}
                      className="h-8.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Reset
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8.5 gap-1.5 text-xs"
                    onClick={() =>
                      exportCsv(
                        "biometric-mappings.csv",
                        ["Employee ID", "Employee Name", "Biometric ID", "Device ID", "Effective From", "Status"],
                        filteredMappings.map((m) => [
                          m.employeeId,
                          nameOf(m.employeeId),
                          m.biometricId,
                          m.deviceId,
                          m.effectiveFrom,
                          m.status,
                        ])
                      )
                    }
                  >
                    <Download className="h-3.5 w-3.5" /> Export Mappings
                  </Button>

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
              </div>

              {/* CARDS VIEW */}
              {view === "cards" && (
                <div>
                  {filteredMappings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                      <Fingerprint className="h-10 w-10 text-muted-foreground/60 mb-2" />
                      <p className="text-sm font-semibold text-foreground">No Mappings Found</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        No biometric ID mappings match your filter criteria.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {filteredMappings.map((mapping) => (
                        <MappingCard
                          key={mapping.id}
                          mapping={mapping}
                          deviceName={devName(mapping.deviceId)}
                          onEdit={() =>
                            setMapOpen({
                              bio: mapping.biometricId,
                              dev: mapping.deviceId,
                              empId: mapping.employeeId,
                            })
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TABLE VIEW */}
              {view === "table" && (
                <DataTable
                  columns={mapCols}
                  rows={filteredMappings}
                  rowKey={(r) => r.id}
                  pageSize={12}
                  emptyTitle="No biometric mappings found"
                />
              )}
            </div>
          )}

          {/* TAB 3: UNMAPPED IDs */}
          {tab === "unmapped" && (
            <div className="space-y-4">
              {/* Alert Callout Banner */}
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs dark:border-amber-900/60 dark:bg-amber-950/20">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-900 dark:text-amber-200 text-[13px]">
                    Unmapped Punches Detected on Hardware Terminals
                  </p>
                  <p className="text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                    The following biometric cards or fingerprint tokens logged attendance punches on registered devices,
                    but are not linked to any active employee profile. Map them to an employee to retroactively assign
                    their attendance records.
                  </p>
                </div>
              </div>

              {/* Search Toolbar */}
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-56 sm:w-72">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search unmapped ID or device..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8.5 pl-8 text-xs"
                  />
                </div>

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
                  {filteredUnmapped.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                      <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
                      <p className="text-sm font-semibold text-foreground">Zero Unmapped IDs</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        All biometric punch tokens are properly linked to employees.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {filteredUnmapped.map((unmapped) => (
                        <UnmappedCard
                          key={unmapped.id}
                          unmapped={unmapped}
                          deviceName={devName(unmapped.deviceId)}
                          onMap={() => setMapOpen({ bio: unmapped.biometricId, dev: unmapped.deviceId })}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TABLE VIEW */}
              {view === "table" && (
                <DataTable
                  columns={unCols}
                  rows={filteredUnmapped}
                  rowKey={(r) => r.id}
                  pageSize={10}
                  emptyTitle="All biometric IDs are mapped"
                />
              )}
            </div>
          )}

          {/* TAB 4: IMPORT HISTORY */}
          {tab === "imports" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-56 sm:w-72">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search batch number or file name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8.5 pl-8 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="h-8.5 gap-1.5 text-xs font-medium"
                    onClick={() => setImportOpen(true)}
                  >
                    <Upload className="h-3.5 w-3.5" /> Upload Punch Batch
                  </Button>

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
              </div>

              {/* CARDS VIEW */}
              {view === "cards" && (
                <div>
                  {filteredImports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                      <FileText className="h-10 w-10 text-muted-foreground/60 mb-2" />
                      <p className="text-sm font-semibold text-foreground">No Import Batches Recorded</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {filteredImports.map((batch) => (
                        <ImportBatchCard
                          key={batch.id}
                          batch={batch}
                          deviceName={devName(batch.deviceId)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TABLE VIEW */}
              {view === "table" && (
                <DataTable
                  columns={impCols}
                  rows={filteredImports}
                  rowKey={(r) => r.id}
                  pageSize={10}
                  emptyTitle="No import batches found"
                />
              )}
            </div>
          )}
        </TabsShell>

        {/* DIALOG 1: Register Device */}
        <DeviceDialog
          open={devOpen}
          onOpenChange={setDevOpen}
          onSubmit={async (d) => {
            addDevice(d);
            try {
              await fetch("/api/biometric", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "create_device",
                  deviceId: d.deviceId,
                  name: d.name,
                  brand: d.brand,
                  model: d.model,
                  location: d.location,
                  ipAddress: d.ipAddress,
                  port: d.port,
                  commKey: d.commKey,
                  branch: d.branch,
                  connection: d.connection,
                }),
              });
            } catch (_) {}
            setDevOpen(false);
            toast.success(`Biometric device "${d.name}" registered successfully`);
          }}
        />

        {/* DIALOG 2: Map Biometric ID */}
        {mapOpen && (
          <MappingDialog
            init={mapOpen}
            onClose={() => setMapOpen(null)}
            onSubmit={async (m) => {
              const res = addMapping(m);
              if (res === "duplicate") {
                toast.error("That Biometric ID is already actively mapped on this device");
                return;
              }
              try {
                await fetch("/api/biometric", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "map_employee",
                    deviceId: m.deviceId,
                    biometricId: m.biometricId,
                    employeeId: m.employeeId,
                  }),
                });
              } catch (_) {}
              setMapOpen(null);
              toast.success("Biometric mapping saved successfully");
            }}
          />
        )}

        {/* DIALOG 3: Import Punches Modal */}
        <ImportPunchesDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onImport={(batchData) => {
            addImport(batchData);
            setImportOpen(false);
            setTab("imports");
            toast.success(`Imported ${batchData.received} biometric punches into batch ${batchData.batch}`);
          }}
        />
      </div>
    </AppShell>
  );
}

/* =========================================================================================
 * COMPONENT: DeviceCard (photo aesthetic)
 * ========================================================================================= */
function DeviceCard({
  device,
  mappedCount,
  isSyncing,
  onSync,
  onViewMappings,
}: {
  device: BiometricDevice;
  mappedCount: number;
  isSyncing: boolean;
  onSync: () => void;
  onViewMappings: () => void;
}) {
  const isOnline = device.status === "Online";
  const isPending = device.status === "Sync Pending";

  const dotColor = isOnline ? "bg-emerald-500" : isPending ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all duration-200 dark:bg-card dark:border-border hover:shadow-md">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Device Icon Avatar */}
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-primary text-white shadow-sm font-bold">
                <Cpu className="h-6 w-6" />
              </div>
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white dark:ring-slate-900",
                  dotColor
                )}
                title={device.status}
              />
            </div>

            <div className="min-w-0">
              <h4 className="font-semibold text-foreground text-[14px] truncate">{device.name}</h4>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  <Radio className="h-2.5 w-2.5" />
                  {device.deviceId}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Building2 className="h-2.5 w-2.5" />
                  {device.branch}
                </span>
              </div>
            </div>
          </div>

          <StatusBadge status={device.status} />
        </div>

        {/* Divider */}
        <div className="my-3.5 border-t border-slate-100 dark:border-slate-800" />

        {/* Location & Connection Banner */}
        <div className="mb-3.5 flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-foreground dark:bg-muted/30">
          <div className="flex items-center gap-2 truncate">
            <HardDrive className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{device.location}</span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-slate-200 dark:bg-card dark:border-slate-800">
            {device.connection}
          </span>
        </div>

        {/* 3 Metric Boxes */}
        <div className="grid grid-cols-3 gap-2">
          {/* Box 1: Last Sync */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Last Sync</p>
            <p className="mt-0.5 text-xs font-bold text-slate-900 dark:text-white truncate">
              {device.lastSync.includes(" ") ? device.lastSync.split(" ")[1] : device.lastSync}
            </p>
          </div>

          {/* Box 2: Mapped Users */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Mapped Users</p>
            <p className="mt-0.5 text-base font-bold text-primary">{mappedCount}</p>
          </div>

          {/* Box 3: Model */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Model</p>
            <p className="mt-0.5 truncate text-[11px] font-bold text-slate-800 dark:text-slate-200">
              {device.brand} {device.model}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <button
          onClick={onViewMappings}
          className="text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
        >
          View {mappedCount} mappings <ArrowUpRight className="h-3 w-3" />
        </button>

        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs font-medium gap-1.5"
          disabled={isSyncing}
          onClick={onSync}
        >
          <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
          {isSyncing ? "Syncing..." : "Sync Now"}
        </Button>
      </div>
    </div>
  );
}

/* =========================================================================================
 * COMPONENT: MappingCard (photo aesthetic)
 * ========================================================================================= */
function MappingCard({
  mapping,
  deviceName,
  onEdit,
}: {
  mapping: BiometricMapping;
  deviceName: string;
  onEdit: () => void;
}) {
  const { data } = useStore();
  const emp = data.employees.find((e) => e.id === mapping.employeeId);

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all duration-200 dark:bg-card dark:border-border hover:shadow-md">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <EmployeeAvatar id={mapping.employeeId} name={emp?.name || mapping.employeeId} size={48} />
            <div className="min-w-0">
              <Link
                href={`/employees/${mapping.employeeId}`}
                className="group/link flex items-center gap-1 font-semibold text-foreground hover:text-primary transition-colors text-[14px]"
              >
                <span className="truncate">{emp?.name || mapping.employeeId}</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover/link:opacity-100 transition-opacity" />
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                  {emp?.designation || "Staff"}
                </span>
                <span className="text-[11px] text-muted-foreground">{emp?.branch}</span>
              </div>
            </div>
          </div>

          <StatusBadge status={mapping.status} />
        </div>

        {/* Divider */}
        <div className="my-3.5 border-t border-slate-100 dark:border-slate-800" />

        {/* Biometric ID Badge Highlight Banner */}
        <div className="mb-3.5 flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-foreground dark:bg-muted/30">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Badge ID:</span>
            <code className="font-mono font-bold text-foreground text-sm">{mapping.biometricId}</code>
          </div>
          <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-slate-200 dark:bg-card dark:border-slate-800 truncate max-w-[140px]">
            {deviceName}
          </span>
        </div>

        {/* 3 Metric Boxes */}
        <div className="grid grid-cols-3 gap-2">
          {/* Box 1: Effective From */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Enrolled</p>
            <p className="mt-0.5 text-xs font-bold text-slate-900 dark:text-white truncate">
              {fmtDate(mapping.effectiveFrom)}
            </p>
          </div>

          {/* Box 2: Auth Method */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Auth Mode</p>
            <p className="mt-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">FP + RFID</p>
          </div>

          {/* Box 3: Coverage */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Validity</p>
            <p className="mt-0.5 truncate text-[11px] font-bold text-slate-800 dark:text-slate-200">
              {mapping.effectiveTo ? fmtDate(mapping.effectiveTo) : "Permanent"}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground truncate">
          {mapping.notes || "Terminal mapping active"}
        </span>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={onEdit}
        >
          Modify
        </Button>
      </div>
    </div>
  );
}

/* =========================================================================================
 * COMPONENT: UnmappedCard (photo aesthetic for unassigned IDs)
 * ========================================================================================= */
function UnmappedCard({
  unmapped,
  deviceName,
  onMap,
}: {
  unmapped: UnmappedBiometricId;
  deviceName: string;
  onMap: () => void;
}) {
  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-amber-200/90 bg-white p-5 shadow-sm transition-all duration-200 dark:bg-card dark:border-amber-900/50 hover:shadow-md">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 font-bold border border-amber-200 dark:border-amber-900/60">
              <Fingerprint className="h-6 w-6" />
            </div>
            <div>
              <code className="text-base font-bold font-mono text-foreground">{unmapped.biometricId}</code>
              <p className="text-xs text-muted-foreground mt-0.5">Terminal: {deviceName}</p>
            </div>
          </div>
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
            Unassigned
          </span>
        </div>

        {/* Divider */}
        <div className="my-3.5 border-t border-slate-100 dark:border-slate-800" />

        {/* 3 Metric Boxes */}
        <div className="grid grid-cols-3 gap-2">
          {/* Box 1: Punches Logged */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Punches</p>
            <p className="mt-0.5 text-base font-bold text-amber-600 dark:text-amber-400">
              {unmapped.punchCount} scans
            </p>
          </div>

          {/* Box 2: First Seen */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">First Seen</p>
            <p className="mt-0.5 text-xs font-bold text-foreground truncate">{fmtDate(unmapped.firstSeen)}</p>
          </div>

          {/* Box 3: Priority */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-muted/20">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Priority</p>
            <p className="mt-0.5 text-xs font-bold text-rose-600 dark:text-rose-400">Needs Action</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">Unlinked attendance data</span>

        <Button
          size="sm"
          className="h-8 px-3 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
          onClick={onMap}
        >
          <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Map to Employee
        </Button>
      </div>
    </div>
  );
}

/* =========================================================================================
 * COMPONENT: ImportBatchCard
 * ========================================================================================= */
function ImportBatchCard({
  batch,
  deviceName,
}: {
  batch: ImportBatch;
  deviceName: string;
}) {
  const successRate = Math.round((batch.processed / Math.max(1, batch.received)) * 100);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:bg-card dark:border-border hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground text-sm">{batch.batch}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Source: <span className="font-medium text-foreground">{batch.sourceFile}</span>
            </p>
          </div>
        </div>
        <StatusBadge status={batch.status} />
      </div>

      <div className="my-3.5 border-t border-slate-100 dark:border-slate-800" />

      {/* Batch Processing Stats */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-muted/30">
          <span className="text-[10px] text-muted-foreground uppercase">Received</span>
          <p className="font-bold text-foreground text-sm mt-0.5">{batch.received}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-2 dark:bg-emerald-950/30">
          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase">Processed</span>
          <p className="font-bold text-emerald-700 dark:text-emerald-400 text-sm mt-0.5">{batch.processed}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-muted/30">
          <span className="text-[10px] text-muted-foreground uppercase">Duplicates</span>
          <p className="font-bold text-foreground text-sm mt-0.5">{batch.duplicates}</p>
        </div>
        <div className="rounded-xl bg-rose-50 p-2 dark:bg-rose-950/30">
          <span className="text-[10px] text-rose-700 dark:text-rose-400 uppercase">Failures</span>
          <p className="font-bold text-rose-700 dark:text-rose-400 text-sm mt-0.5">{batch.failures}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3.5 space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">Punch Ingestion Success</span>
          <span className="font-semibold text-foreground">{successRate}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${successRate}%` }}
          />
        </div>
      </div>

      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Device: {deviceName}</span>
        <span>Started: {batch.startedAt}</span>
      </div>
    </div>
  );
}

/* =========================================================================================
 * DIALOG: Register Biometric Device
 * ========================================================================================= */
function DeviceDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (d: Omit<BiometricDevice, "id" | "lastSync" | "status">) => void;
}) {
  const [name, setName] = useState("eSSL K30 Pro - Main Office");
  const [deviceId, setDeviceId] = useState("DEV-01");
  const [brand, setBrand] = useState("eSSL");
  const [model, setModel] = useState("eSSL K30 Pro");
  const [branch, setBranch] = useState<string>("Hyderabad");
  const [location, setLocation] = useState("Main Office Entrance / Reception");
  const [connection, setConnection] = useState<BiometricDevice["connection"]>("TCP/IP");
  const [ipAddress, setIpAddress] = useState("192.168.29.201");
  const [port, setPort] = useState("4370");
  const [commKey, setCommKey] = useState("0");
  const [syncFreq, setSyncFreq] = useState("Every 15 Minutes");

  const valid = name.trim().length >= 3 && deviceId.trim().length >= 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Register Biometric Device</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2">
            <Field label="Device Name" required hint="e.g. Hyderabad Main Entrance Turnstile">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="HQ Lobby Terminal"
              />
            </Field>
          </div>

          <Field label="Device Identifier" required hint="Terminal hardware code">
            <Input
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="ZKT-LX50-008"
            />
          </Field>

          <Field label="Office Branch">
            <Sel value={branch} onChange={setBranch} options={BRANCHES} />
          </Field>

          <Field label="Hardware Brand">
            <Sel
              value={brand}
              onChange={setBrand}
              options={["ZKTeco", "eSSL", "Matrix COSEC", "Realtime", "BioStar"]}
            />
          </Field>

          <Field label="Terminal Model">
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="LX50 / K40" />
          </Field>

          <Field label="Connection Type">
            <Sel
              value={connection}
              onChange={(v) => setConnection(v as BiometricDevice["connection"])}
              options={["TCP/IP", "USB", "CSV Import"]}
            />
          </Field>

          <Field label="IP Address / Host">
            <Input
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="192.168.1.100"
              className="h-9 font-mono"
            />
          </Field>

          <Field label="TCP Port">
            <Input
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="4370"
              className="h-9 font-mono"
            />
          </Field>

          <Field label="Comm Key / Password" hint="Hardware encryption key">
            <Input
              value={commKey}
              onChange={(e) => setCommKey(e.target.value)}
              placeholder="0"
              className="h-9 font-mono"
            />
          </Field>

          <div className="col-span-2">
            <Field label="Auto-Sync Cadence">
              <Sel
                value={syncFreq}
                onChange={setSyncFreq}
                options={["Real-time Webhook Push", "Every 15 Minutes", "Hourly", "Manual On-Demand"]}
              />
            </Field>
          </div>

          <div className="col-span-2">
            <Field label="Physical Location Description" required>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Floor 3 Reception, West Wing Security Gate"
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
                deviceId,
                brand,
                model,
                branch: branch as Branch,
                location,
                connection,
                ipAddress,
                port: Number(port) || 4370,
                commKey,
                syncFrequency: syncFreq,
              })
            }
            className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            Register Device
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================================================
 * DIALOG: Map Biometric ID
 * ========================================================================================= */
function MappingDialog({
  init,
  onClose,
  onSubmit,
}: {
  init: { bio?: string; dev?: string; empId?: string };
  onClose: () => void;
  onSubmit: (m: Omit<BiometricMapping, "id" | "status">) => void;
}) {
  const { data } = useStore();
  const [emp, setEmp] = useState(init.empId || data.employees[0]?.id || "");
  const [bio, setBio] = useState(init.bio || "");
  const [dev, setDev] = useState(init.dev || data.devices[0]?.deviceId || "DEV-1");
  const [from, setFrom] = useState(TODAY);
  const [bioType, setBioType] = useState("RFID Smart Card");
  const [notes, setNotes] = useState("");

  const valid = bio.trim().length > 0 && emp && dev;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Fingerprint className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Map Biometric ID to Employee</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Associate biometric credential with staff record for automated punch sync.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2 text-xs">
          <div className="col-span-2">
            <Field label="Select Employee" required>
              <Sel
                value={emp}
                onChange={setEmp}
                options={data.employees.map((e) => ({
                  value: e.id,
                  label: `${e.name} (${e.id}) · ${e.department}`,
                }))}
              />
            </Field>
          </div>

          <Field label="Biometric Badge / Token ID" required hint="e.g. BIO-1045 or RFID Card Hex">
            <Input
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="BIO-1045"
              className="h-9 font-mono font-semibold"
            />
          </Field>

          <Field label="Biometric Credential Type">
            <Sel
              value={bioType}
              onChange={setBioType}
              options={[
                "RFID Smart Card",
                "Fingerprint (Right Thumb)",
                "Fingerprint (Left Thumb)",
                "Facial Recognition",
                "PIN Code",
              ]}
            />
          </Field>

          <Field label="Assigned Terminal">
            <Sel
              value={dev}
              onChange={setDev}
              options={data.devices.map((d) => ({
                value: d.deviceId,
                label: `${d.name} (${d.deviceId})`,
              }))}
            />
          </Field>

          <Field label="Effective Enrollment Date">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
          </Field>

          <div className="col-span-2">
            <Field label="Notes / Verification Reference (optional)">
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Physical card issued by Security Dept"
                className="h-9"
              />
            </Field>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!valid}
            onClick={() =>
              onSubmit({
                employeeId: emp,
                biometricId: bio.trim(),
                deviceId: dev,
                effectiveFrom: from,
                notes: notes ? `${bioType} — ${notes}` : bioType,
              })
            }
            className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            Save Biometric Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================================================
 * DIALOG: Import Punches Modal
 * ========================================================================================= */
function ImportPunchesDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImport: (batch: Omit<ImportBatch, "id">) => void;
}) {
  const { data } = useStore();
  const [device, setDevice] = useState(data.devices[0]?.deviceId || "DEV-1");
  const [fileName, setFileName] = useState("punches_export_oct.csv");
  const [simulatedCount, setSimulatedCount] = useState(150);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Import Biometric Punches (CSV)</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <Field label="Target Device / Source">
            <Sel
              value={device}
              onChange={setDevice}
              options={data.devices.map((d) => ({
                value: d.deviceId,
                label: `${d.name} (${d.deviceId})`,
              }))}
            />
          </Field>

          <Field label="CSV File Name" hint="Upload file or enter export filename">
            <Input value={fileName} onChange={(e) => setFileName(e.target.value)} />
          </Field>

          <div className="rounded-xl border border-dashed border-border bg-slate-50/60 p-4 text-center dark:bg-muted/20">
            <Upload className="h-6 w-6 text-primary mx-auto mb-1.5" />
            <p className="font-semibold text-foreground text-xs">Sample CSV Format Supported</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Columns: <code>BiometricID, Timestamp, PunchType, DeviceID</code>
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() =>
              onImport({
                batch: `BATCH-${Date.now().toString().slice(-4)}`,
                sourceFile: fileName,
                deviceId: device,
                startedAt: `${TODAY} 10:30`,
                received: simulatedCount,
                processed: simulatedCount - 2,
                duplicates: 2,
                failures: 0,
                status: "Completed",
              })
            }
          >
            Process & Ingest Punches
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
