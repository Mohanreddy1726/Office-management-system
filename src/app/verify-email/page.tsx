"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2, ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OfficeFlowLogoCard } from "@/components/login-brand";

export const dynamic = "force-dynamic";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [userData, setUserData] = useState<{ name?: string; email?: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setError("No verification token was provided in the link.");
      setLoading(false);
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (res.ok && data.success) {
          setSuccess(true);
          setUserData(data.user);
        } else {
          setError(data.error || "Verification failed or token has expired.");
        }
      } catch (err: any) {
        setError(err.message || "Failed to reach verification service.");
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg text-center">
      {/* Brand header */}
      <div className="flex justify-center mb-5">
        <OfficeFlowLogoCard size={48} />
      </div>
      <p className="text-xl font-bold tracking-tight text-foreground">
        Ren<span className="text-primary font-semibold">Desk</span>
      </p>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground mt-0.5">
        GVK EduTech Operations
      </p>

      <div className="mt-8">
        {loading && (
          <div className="py-8 space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="text-sm font-semibold text-foreground">Verifying your email address…</p>
            <p className="text-xs text-muted-foreground">Please wait while we activate your workplace account.</p>
          </div>
        )}

        {!loading && success && (
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Email Verified!</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Welcome <span className="font-semibold text-foreground">{userData?.name || "to the team"}</span>! Your email (<span className="font-mono text-foreground font-medium">{userData?.email}</span>) has been verified.
            </p>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-left text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
                <Mail className="h-4 w-4" /> Login Credentials Dispatched
              </div>
              <p className="text-muted-foreground text-[11px]">
                Your portal username and initial login password have been dispatched to your email inbox from <span className="font-mono font-medium">gvkdigital01@gmail.com</span>.
              </p>
            </div>

            <div className="pt-3">
              <Button asChild className="w-full gap-2 text-xs font-semibold">
                <Link href="/login">
                  Proceed to Sign in <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {!loading && !success && (
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 text-rose-600">
              <XCircle className="h-10 w-10" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Verification Failed</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {error || "This link may have expired or already been used."}
            </p>
            <div className="pt-3">
              <Button asChild variant="outline" className="w-full text-xs font-medium">
                <Link href="/login">Back to Sign in</Link>
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 border-t border-border/60 pt-4 text-[11px] text-muted-foreground">
        GVK EduTech Pvt. Ltd. · Secure Account Activation
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Suspense
        fallback={
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="mt-3 text-sm text-muted-foreground">Loading verification portal…</p>
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
