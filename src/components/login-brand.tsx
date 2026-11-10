import { type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { RenDeskLogo } from "@/components/logo";

export { RenDeskLogo, RenDeskLogo as OfficeFlowLogo, RenDeskLogo as OfficeFlowLogoCard };

export function Field({
  label,
  required,
  children,
  error,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </Label>
      {children}
      {error && <p className="text-[11px] font-medium text-danger">{error}</p>}
    </div>
  );
}
