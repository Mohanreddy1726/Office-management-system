"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Mail, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/data/store";
import { ROLE_LABELS, type Role } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, OfficeFlowLogoCard } from "@/components/login-brand";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const { session, hydrated, signIn } = useStore();
  const router = useRouter();
  const [role, setRole] = useState<Role>("super_admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [forgot, setForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  useEffect(() => {
    if (hydrated && session) {
      router.push("/dashboard");
    }
  }, [hydrated, session, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid work email address.");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    setBusy(true);

    try {
      // 1. Establish server session & token cookie
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid email or password.");
        toast.error(data.error || "Authentication failed");
        return;
      }

      // 2. Update local state store
      const userRole = (data.user?.role as Role) || role || "super_admin";
      signIn(userRole, {
        userId: data.user?.employeeId || data.user?.id,
        name: data.user?.name,
        email: data.user?.email,
        employeeId: data.user?.employeeId,
        originalRole: (data.user?.originalRole as Role) || userRole,
        originalUserId: data.user?.originalUserId || data.user?.employeeId || data.user?.id,
        originalName: data.user?.originalName || data.user?.name,
      });
      toast.success(`Signed in as ${ROLE_LABELS[userRole] || "Super Admin"}`);
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to connect to authentication server.");
      toast.error("Sign in failed");
    } finally {
      setBusy(false);
    }
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
                if (!/^\S+@\S+\.\S+$/.test(forgotEmail)) {
                  toast.error("Enter a valid email address.");
                  return;
                }
                setForgotSent(true);
              }}
            >
              <Field label="Work email" required>
                <Input
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@rendesk.example"
                />
              </Field>
              <Button type="submit" className="w-full">
                Send reset link
              </Button>
            </form>
          )}
          <button
            className="mt-4 text-xs font-medium text-primary hover:underline"
            onClick={() => {
              setForgot(false);
              setForgotSent(false);
            }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel */}
      <div
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-10 lg:flex"
        style={{
          background: "linear-gradient(160deg, #183153 0%, #22437a 60%, #356AE6 140%)",
        }}
      >
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="flex items-center gap-3 text-white">
          <OfficeFlowLogoCard size={42} />
          <div>
            <p className="text-xl font-bold tracking-tight">Ren<span className="text-cyan-400">Desk</span></p>
            <p className="text-[11px] uppercase tracking-widest text-white/70">
              Workplace Operations OS
            </p>
          </div>
        </div>
        <div className="relative text-white">
          <p className="text-3xl font-semibold leading-snug">
            One workspace for your
            <br />
            entire employee lifecycle.
          </p>
          <p className="mt-3 max-w-md text-sm text-white/70">
            People, attendance, leave, payroll, documents, mail and assets — organized for
            teams of 1–50 across multiple branches.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-white/80">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Role-based access for Super Admin, HR, Managers
              and Employees
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> Attendance confirmations and approvals with full audit
              history
            </li>
          </ul>
        </div>
        <p className="relative text-[11px] text-white/50">
          RenDesk Workplace Operations OS · Secured by Role-Based Access Control
        </p>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <OfficeFlowLogoCard size={36} />
            <p className="text-xl font-bold tracking-tight text-foreground">Ren<span className="text-primary font-semibold">Desk</span></p>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your work email and password to access your workspace.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Work email" required error={error && !email.includes("@") ? error : undefined}>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="username"
              />
            </Field>
            <Field label="Password" required error={error && email.includes("@") ? error : undefined}>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={remember}
                  onCheckedChange={(v) => setRemember(Boolean(v))}
                />{" "}
                Remember me
              </label>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => setForgot(true)}
              >
                Forgot password?
              </button>
            </div>
            {error && (
              <p className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
