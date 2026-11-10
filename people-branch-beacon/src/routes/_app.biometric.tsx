import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/data/store";
import { TODAY } from "@/lib/data/seed";
import { PageHeader, KpiCard, StatusBadge, TabsShell, Field } from "@/components/shared";
import { DataTable, type Column } from "@/components/data-table";
import { Person, Sel } from "@/components/form-bits";
import { BRANCHES } from "@/lib/data/types";
import type { BiometricDevice, BiometricMapping, UnmappedBiometricId, ImportBatch, Branch } from "@/lib/data/types";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Fingerprint, Plus, RefreshCw, Upload, Wifi, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/biometric")({
  head: () => ({ meta: [
    { title: "Biometric Mapping — OfficeFlow" },
    { name: "description", content: "Biometric devices, employee ID mapping, unmapped IDs and punch imports." },
    { property: "og:title", content: "Biometric Mapping — OfficeFlow" },
    { property: "og:description", content: "Biometric devices, employee ID mapping, unmapped IDs and punch imports." },
  ] }),
  component: BiometricPage,
});

function BiometricPage() {
  const { data, addDevice, addMapping, addImport } = useStore();
  const [tab, setTab] = useState("devices");
  const [devOpen, setDevOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState<{ bio?: string; dev?: string } | null>(null);
  const devName = (id: string) => data.devices.find((d) => d.id === id || d.deviceId === id)?.name ?? id;

  const devCols: Column<BiometricDevice>[] = [
    { key: "n", header: "Device", render: (r) => <span><span className="block font-medium">{r.name}</span><span className="text-[11px] text-muted-foreground">{r.deviceId} · {r.brand} {r.model}</span></span> },
    { key: "b", header: "Branch", render: (r) => `${r.branch} · ${r.location}` },
    { key: "c", header: "Connection", render: (r) => r.connection, hideOnMobile: true },
    { key: "l", header: "Last sync", render: (r) => r.lastSync },
    { key: "s", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "a", header: "", render: () => <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => toast.success("Sync requested (demo)")}><RefreshCw className="h-3 w-3" /> Sync</Button> },
  ];
  const mapCols: Column<BiometricMapping>[] = [
    { key: "e", header: "Employee", render: (r) => <Person id={r.employeeId} /> },
    { key: "b", header: "Biometric ID", render: (r) => <code className="text-xs">{r.biometricId}</code> },
    { key: "d", header: "Device", render: (r) => devName(r.deviceId) },
    { key: "f", header: "Effective", render: (r) => `${fmtDate(r.effectiveFrom)}${r.effectiveTo ? " → " + fmtDate(r.effectiveTo) : ""}` },
    { key: "s", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];
  const unCols: Column<UnmappedBiometricId>[] = [
    { key: "b", header: "Biometric ID", render: (r) => <code className="text-xs">{r.biometricId}</code> },
    { key: "d", header: "Device", render: (r) => devName(r.deviceId) },
    { key: "f", header: "First seen", render: (r) => r.firstSeen },
    { key: "p", header: "Punches", render: (r) => r.punchCount },
    { key: "a", header: "", render: (r) => <Button size="sm" className="h-7 text-xs" onClick={() => setMapOpen({ bio: r.biometricId, dev: r.deviceId })}>Map to employee</Button> },
  ];
  const impCols: Column<ImportBatch>[] = [
    { key: "b", header: "Batch", render: (r) => <span className="font-medium">{r.batch}</span> },
    { key: "f", header: "Source", render: (r) => r.sourceFile, hideOnMobile: true },
    { key: "t", header: "Started", render: (r) => r.startedAt },
    { key: "r", header: "Received", render: (r) => r.received },
    { key: "p", header: "Processed", render: (r) => r.processed },
    { key: "x", header: "Dup / Fail", render: (r) => `${r.duplicates} / ${r.failures}` },
    { key: "s", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Biometric Mapping" description="Connect devices, map biometric IDs to employees and import punch files."
        actions={<>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
            const n = 180 + Math.floor(Math.random() * 60);
            addImport({ batch: `BATCH-${TODAY.replace(/-/g, "")}-${data.imports.length + 1}`, sourceFile: "punches_export.csv", deviceId: data.devices[0]?.deviceId ?? "", startedAt: `${TODAY} 10:00`, received: n, processed: n - 3, duplicates: 2, failures: 1, status: "Completed with Failures" });
            toast.success(`Imported ${n} punches (demo)`); setTab("imports");
          }}><Upload className="h-3.5 w-3.5" /> Import CSV</Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setMapOpen({})}><Fingerprint className="h-3.5 w-3.5" /> New mapping</Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setDevOpen(true)}><Plus className="h-3.5 w-3.5" /> Add device</Button>
        </>} />
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Devices online" value={`${data.devices.filter((d) => d.status === "Online").length}/${data.devices.length}`} icon={<Wifi className="h-4 w-4" />} />
        <KpiCard label="Active mappings" value={String(data.mappings.filter((m) => m.status === "Active").length)} icon={<Fingerprint className="h-4 w-4" />} />
        <KpiCard label="Unmapped IDs" value={String(data.unmappedIds.length)} icon={<AlertTriangle className="h-4 w-4" />} onClick={() => setTab("unmapped")} />
        <KpiCard label="Import batches" value={String(data.imports.length)} icon={<Upload className="h-4 w-4" />} />
      </div>
      <TabsShell tabs={[{ key: "devices", label: "Devices" }, { key: "mappings", label: "Mappings" }, { key: "unmapped", label: `Unmapped (${data.unmappedIds.length})` }, { key: "imports", label: "Import history" }]} active={tab} onChange={setTab}>
        {tab === "devices" && <DataTable columns={devCols} rows={data.devices} rowKey={(r) => r.id} />}
        {tab === "mappings" && <DataTable columns={mapCols} rows={data.mappings} rowKey={(r) => r.id} pageSize={12} />}
        {tab === "unmapped" && <DataTable columns={unCols} rows={data.unmappedIds} rowKey={(r) => r.id} emptyTitle="All biometric IDs are mapped" />}
        {tab === "imports" && <DataTable columns={impCols} rows={data.imports} rowKey={(r) => r.id} />}
      </TabsShell>

      <DeviceDialog open={devOpen} onOpenChange={setDevOpen} onSubmit={(d) => { addDevice(d); setDevOpen(false); toast.success("Device registered"); }} />
      {mapOpen && <MappingDialog init={mapOpen} onClose={() => setMapOpen(null)} onSubmit={(m) => {
        const res = addMapping(m);
        if (res === "duplicate") { toast.error("That biometric ID is already mapped on this device"); return; }
        setMapOpen(null); toast.success("Mapping saved");
      }} />}
    </div>
  );
}

function DeviceDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (v: boolean) => void; onSubmit: (d: Omit<BiometricDevice, "id" | "lastSync" | "status">) => void }) {
  const [name, setName] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [branch, setBranch] = useState<string>("Hyderabad");
  const [location, setLocation] = useState("Main entrance");
  const [connection, setConnection] = useState("TCP/IP");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Register biometric device</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Device name" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HYD Lobby" /></Field>
          <Field label="Device ID" required><Input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="ZK-0005" /></Field>
          <Field label="Branch"><Sel value={branch} onChange={setBranch} options={BRANCHES} /></Field>
          <Field label="Connection"><Sel value={connection} onChange={setConnection} options={["TCP/IP", "USB", "CSV Import"]} /></Field>
          <div className="col-span-2"><Field label="Location"><Input value={location} onChange={(e) => setLocation(e.target.value)} /></Field></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={name.length < 3 || deviceId.length < 3} onClick={() => onSubmit({ name, deviceId, brand: "ZKTeco", model: "K40", branch: branch as Branch, location, connection: connection as BiometricDevice["connection"] })}>Register</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MappingDialog({ init, onClose, onSubmit }: { init: { bio?: string; dev?: string }; onClose: () => void; onSubmit: (m: Omit<BiometricMapping, "id" | "status">) => void }) {
  const { data } = useStore();
  const [emp, setEmp] = useState(data.employees[0]?.id ?? "");
  const [bio, setBio] = useState(init.bio ?? "");
  const [dev, setDev] = useState(init.dev ?? data.devices[0]?.deviceId ?? "");
  const [from, setFrom] = useState(TODAY);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Map biometric ID</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Field label="Employee"><Sel value={emp} onChange={setEmp} options={data.employees.map((e) => ({ value: e.id, label: `${e.name} (${e.id})` }))} /></Field></div>
          <Field label="Biometric ID" required><Input value={bio} onChange={(e) => setBio(e.target.value)} /></Field>
          <Field label="Device"><Sel value={dev} onChange={setDev} options={data.devices.map((d) => ({ value: d.deviceId, label: d.name }))} /></Field>
          <div className="col-span-2"><Field label="Effective from"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!bio.trim()} onClick={() => onSubmit({ employeeId: emp, biometricId: bio.trim(), deviceId: dev, effectiveFrom: from })}>Save mapping</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
