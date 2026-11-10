"use client";

import { StoreProvider } from "@/lib/data/store";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster position="top-right" richColors />
      </TooltipProvider>
    </StoreProvider>
  );
}
