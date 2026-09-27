import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
  size?: "default" | "narrow" | "wide";
};

const sizeClassNames = {
  default: "max-w-6xl",
  narrow: "max-w-3xl",
  wide: "max-w-7xl",
};

export function PageContainer({ children, className, size = "default" }: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full space-y-7", sizeClassNames[size], className)}>
      {children}
    </div>
  );
}
