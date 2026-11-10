import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, Mail, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/data/store";
import { ROLE_LABELS, type Role } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, OfficeFlowLogoCard } from "@/components/login-brand";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OfficeFlow — Sign in" },
      { name: "description", content: "Sign in to the OfficeFlow office management demo." },
      { property: "og:title", content: "OfficeFlow — Sign in" },
      { property: "og:description", content: "Sign in to the OfficeFlow office management demo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Login,
});

const DEMO_CREDENTIALS: Record<Role, string> = {
  super_admin: "vikram.desai@officeflow.example",
  hr_admin: "ananya.sharma@officeflow.example",
  manager: "rahul.verma@officeflow.example",
  employee: "karthik.reddy@officeflow.example",
};

function Login() {
  const { session, hydrated, signIn } = useStore();
  const router = useNavigate();
  const [role, setRole] = useState<Role>("hr_admin");
  const [email, setEmail] = useState(DEMO_CREDENTIALS.hr_admin);
  const [password, setPassword] = useState("demo1234");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [forgot, setForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  useEffect(() => {
    if (hydrated && session) router({ to: "/dashboard" });
  }, [hydrated, session, router]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError("Enter a valid work email address."); return; }
    if (password.length < 4) { setError("Password must be at least 4 characters."); return; }
    setBusy(true);
    setTimeout(() => {
      signIn(role);
      toast.success(`Signed in as ${ROLE_LABELS[role]} (demo)`);
      router({ to: "/dashboard" });
    }, 500);
  };

  if (forgot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-lg font-semibold text-foreground">Reset your password</p>
          {forgotSent ? (
            <div className="mt-3 rounded-md border border-success/25 bg-success-soft px-3 py-2 text-xs text-success">
              If an account exists for {forgotEmail}, a reset link has been sent (simulated).
            </div>
          ) : (
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!/^\S+@\S+\.\S+$/.test(forgotEmail)) { toast.error("Enter a valid email address."); return; }
                setForgotSent(true);
              }}
            >
              <Field label="Work email" required>
                <Input value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="you@officeflow.example" />
              </Field>
              <Button type="submit" className="w-full">Send reset link</Button>
            </form>
          )}
          <button className="mt-4 text-xs font-medium text-primary hover:underline" onClick={() => setForgot(false)}>
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-10 lg:flex" style={{ background: "linear-gradient(160deg, #183153 0%, #22437a 60%, #356AE6 140%)" }}>
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/5 blur-2xl" />
        <div className="flex items-center gap-3 text-white">
          <OfficeFlowLogoCard />
          <div>
            <p className="text-lg font-semibold">OfficeFlow</p>
            <p className="text-[11px] uppercase tracking-widest text-white/70">Office Management System</p>
          </div>
        </div>
        <div className="relative text-white">
          <p className="text-3xl font-semibold leading-snug">One workspace for your<br />entire employee lifecycle.</p>
          <p className="mt-3 max-w-md text-sm text-white/70">
            People, attendance, leave, payroll, documents, assets and performance — organized for teams of 1–50 across multiple branches.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-white/80">
            <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Role-based access for Super Admin, HR, Managers and Employees</li>
            <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> Attendance confirmations and approvals with full audit history</li>
          </ul>
        </div>
        <p className="relative text-[11px] text-white/50">Frontend demo with simulated data — no production authentication.</p>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <OfficeFlowLogoCard />
            <p className="text-lg font-semibold text-foreground">OfficeFlow</p>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use a demo account below to explore each role.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Work email" required error={error && !email.includes("@") ? error : undefined}>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </Field>
            <Field label="Password" required error={error && email.includes("@") ? error : undefined}>
              <div className="relative">
                <Input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="pr-9" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showPw ? "Hide password" : "Show password"}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} /> Remember me
              </label>
              <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setForgot(true)}>
                Forgot password?
              </button>
            </div>
            {error && <p className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</> : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold text-foreground">Demo access</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Pick a role — the workspace loads that role's view.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setRole(r); setEmail(DEMO_CREDENTIALS[r]); }}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors",
                    role === r ? "border-primary bg-blue-soft text-primary" : "border-border text-foreground hover:bg-muted",
                  )}
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
