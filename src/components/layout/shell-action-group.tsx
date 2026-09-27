import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ShellActionGroupProps = {
  children: ReactNode;
  className?: string;
};

export function ShellActionGroup({ children, className }: ShellActionGroupProps) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)}>
      {children}
    </div>
  );
}
