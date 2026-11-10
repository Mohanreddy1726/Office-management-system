import { useEffect } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useStore } from "@/lib/data/store";
import { AppShell } from "@/components/shell";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, hydrated } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (hydrated && !session) navigate({ to: "/" });
  }, [hydrated, session, navigate]);

  if (!hydrated || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return <AppShell><Outlet /></AppShell>;
}
