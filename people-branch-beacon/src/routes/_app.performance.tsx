import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/data/store";
import { PageHeader, KpiCard, StatusBadge, TabsShell, Field } from "@/components/shared";
import { DataTable, type Column } from "@/components/data-table";
import { Person, Sel, useScope } from "@/components/form-bits";
import type { Goal, Review } from "@/lib/data/types";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Target, Plus, Star, ClipboardCheck, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/performance")({
  head: () => ({ meta: [
    { title: "Performance Management — OfficeFlow" },
    { name: "description", content: "Goals, review cycles, self-assessments and manager ratings." },
    { property: "og:title", content: "Performance Management — OfficeFlow" },
    { property: "og:description", content: "Goals, review cycles, self-assessments and manager ratings." },
  ] }),
  component: PerformancePage,
});

const NEXT_STAGE: Record<Review["stage"], Review["stage"]> = { "Self-Assessment": "Manager Review", "Manager Review": "HR Review", "HR Review": "Finalized", Finalized: "Finalized" };

function PerformancePage() {
  const { data, addGoal, updateGoal, advanceReview } = useStore();
  const { isAdmin, isManager, isEmployee, uid, inScope } = useScope();
  const [tab, setTab] = useState("goals");
  const [goalOpen, setGoalOpen] = useState(false);
  const [review, setReview] = useState<Review | null>(null);

  const goals = data.goals.filter((g) => inScope(g.employeeId));
  const reviews = data.reviews.filter((r) => inScope(r.employeeId));
  const active = data.reviewCycles.find((c) => c.status === "Active");

  const goalCols: Column<Goal>[] = [
    { key: "t", header: "Goal", render: (r) => <span><span className="block font-medium">{r.title}</span><span className="text-[11px] text-muted-foreground">{r.metric}: {r.target}</span></span> },
    ...(!isEmployee ? [{ key: "e", header: "Owner", render: (r: Goal) => <Person id={r.employeeId} /> }] : []),
    { key: "d", header: "Due", sortValue: (r) => r.dueDate, render: (r) => fmtDate(r.dueDate) },
    { key: "p", header: "Progress", sortValue: (r) => r.progress, render: (r) => <span className="flex w-32 items-center gap-2"><Progress value={r.progress} className="h-1.5" /><span className="text-[11px]">{r.progress}%</span></span> },
    { key: "s", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "a", header: "", render: (r) => (r.employeeId === uid || isManager || isAdmin) && r.status !== "Completed" ? (
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { const p = Math.min(100, r.progress + 10); updateGoal(r.id, { progress: p, status: p >= 100 ? "Completed" : p < 40 ? "At Risk" : "On Track" }); toast.success(`Progress updated to ${p}%`); }}>+10%</Button>
    ) : null },
  ];
  const revCols: Column<Review>[] = [
    { key: "e", header: "Employee", render: (r) => <Person id={r.employeeId} /> },
    { key: "c", header: "Cycle", render: (r) => data.reviewCycles.find((c) => c.id === r.cycleId)?.name ?? r.cycleId },
    { key: "s", header: "Stage", render: (r) => <StatusBadge status={r.stage} /> },
    { key: "d", header: "Due", render: (r) => fmtDate(r.dueDate) },
    { key: "r", header: "Rating", render: (r) => { const v = r.finalRating ?? r.managerRating ?? r.selfRating; return v ? <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-warning text-warning" />{v.toFixed(1)}</span> : "—"; } },
    { key: "a", header: "", render: (r) => {
      const can = (r.stage === "Self-Assessment" && r.employeeId === uid) || (r.stage === "Manager Review" && (isManager || isAdmin) && r.employeeId !== uid) || (r.stage === "HR Review" && isAdmin);
      return can ? <Button size="sm" className="h-7 text-xs" onClick={() => setReview(r)}>{r.stage === "Self-Assessment" ? "Self-assess" : r.stage === "Manager Review" ? "Rate" : "Finalize"}</Button> : null;
    } },
  ];

  return (
    <div>
      <PageHeader title="Performance Management" description={active ? `${active.name} · ${fmtDate(active.startDate)} – ${fmtDate(active.endDate)}` : "Goals and reviews"}
        actions={<Button size="sm" className="gap-1.5 text-xs" onClick={() => setGoalOpen(true)}><Plus className="h-3.5 w-3.5" /> New goal</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Goals" value={String(goals.length)} icon={<Target className="h-4 w-4" />} />
        <KpiCard label="At risk" value={String(goals.filter((g) => g.status === "At Risk").length)} icon={<AlertTriangle className="h-4 w-4" />} />
        <KpiCard label="Reviews finalized" value={`${reviews.filter((r) => r.stage === "Finalized").length}/${reviews.length}`} icon={<ClipboardCheck className="h-4 w-4" />} />
        <KpiCard label="Avg. goal progress" value={`${goals.length ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : 0}%`} />
      </div>
      <TabsShell tabs={[{ key: "goals", label: "Goals" }, { key: "reviews", label: "Reviews" }, { key: "cycles", label: "Review cycles" }]} active={tab} onChange={setTab}>
        {tab === "goals" && <DataTable columns={goalCols} rows={goals} rowKey={(r) => r.id} emptyTitle="No goals yet" />}
        {tab === "reviews" && <DataTable columns={revCols} rows={reviews} rowKey={(r) => r.id} emptyTitle="No reviews in scope" />}
        {tab === "cycles" && <div className="grid gap-3 md:grid-cols-3">
          {data.reviewCycles.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-card p-4 text-sm">
              <div className="flex items-center justify-between"><p className="font-semibold">{c.name}</p><StatusBadge status={c.status} /></div>
              <p className="mt-1 text-xs text-muted-foreground">{c.period} · {fmtDate(c.startDate)} – {fmtDate(c.endDate)}</p>
              <p className="mt-3 text-xs">{data.reviews.filter((r) => r.cycleId === c.id).length} reviews</p>
            </div>
          ))}
        </div>}
      </TabsShell>
      <GoalDialog open={goalOpen} onOpenChange={setGoalOpen} onSubmit={(g) => { addGoal(g); setGoalOpen(false); toast.success("Goal created"); }} />
      {review && <ReviewDialog review={review} onClose={() => setReview(null)} onSubmit={(patch) => { advanceReview(review.id, patch, NEXT_STAGE[review.stage]); setReview(null); toast.success(`Review moved to ${NEXT_STAGE[review.stage]}`); }} />}
    </div>
  );
}

function GoalDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (v: boolean) => void; onSubmit: (g: Omit<Goal, "id">) => void }) {
  const { data } = useStore();
  const { isEmployee, uid, inScope } = useScope();
  const [emp, setEmp] = useState(uid);
  const [title, setTitle] = useState("");
  const [metric, setMetric] = useState("");
  const [target, setTarget] = useState("");
  const [due, setDue] = useState("2026-12-31");
  const [priority, setPriority] = useState("Medium");
  const [desc, setDesc] = useState("");
  const owner = data.employees.find((e) => e.id === emp);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New goal</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {!isEmployee && <div className="col-span-2"><Field label="Employee"><Sel value={emp} onChange={setEmp} options={data.employees.filter((e) => inScope(e.id)).map((e) => ({ value: e.id, label: e.name }))} /></Field></div>}
          <div className="col-span-2"><Field label="Title" required><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field></div>
          <Field label="Metric" required><Input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="e.g. Ticket resolution time" /></Field>
          <Field label="Target" required><Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. < 4 hours" /></Field>
          <Field label="Due date"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          <Field label="Priority"><Sel value={priority} onChange={setPriority} options={["Low", "Medium", "High"]} /></Field>
          <div className="col-span-2"><Field label="Description"><Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={title.length < 3 || !metric || !target} onClick={() => onSubmit({ title, description: desc, employeeId: emp, managerId: owner?.managerId ?? uid, category: "Business", startDate: "2026-10-22", dueDate: due, priority: priority as Goal["priority"], metric, target, progress: 0, status: "Not Started" })}>Create goal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialog({ review, onClose, onSubmit }: { review: Review; onClose: () => void; onSubmit: (p: Partial<Review>) => void }) {
  const [rating, setRating] = useState(review.managerRating ?? review.selfRating ?? 3.5);
  const [strengths, setStrengths] = useState(review.strengths ?? "");
  const [improve, setImprove] = useState(review.improvements ?? "");
  const field = review.stage === "Self-Assessment" ? "selfRating" : review.stage === "Manager Review" ? "managerRating" : "finalRating";
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{review.stage}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Person id={review.employeeId} />
          <Field label={`Rating: ${rating.toFixed(1)} / 5`}><Slider min={1} max={5} step={0.5} value={[rating]} onValueChange={(v) => setRating(v[0] ?? 3)} /></Field>
          <Field label="Strengths"><Textarea rows={2} value={strengths} onChange={(e) => setStrengths(e.target.value)} /></Field>
          <Field label="Areas to improve"><Textarea rows={2} value={improve} onChange={(e) => setImprove(e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSubmit({ [field]: rating, strengths, improvements: improve })}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
