import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";

interface DashboardShellProps {
  children: React.ReactNode;
}

export async function DashboardShell({ children }: DashboardShellProps) {
  const session = await getCurrentUser();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role={session.role} />
      <div className="pl-64 flex flex-col min-h-screen">
        <Header user={session} />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
