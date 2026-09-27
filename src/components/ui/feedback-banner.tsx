import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type FeedbackBannerProps = {
  tone?: "success" | "warning" | "danger" | "info";
  children: ReactNode;
  className?: string;
};

const toneStyles = {
  success: "border-success/20 bg-success-soft text-success",
  warning: "border-warning/25 bg-warning-soft text-warning",
  danger: "border-danger/20 bg-danger-soft text-danger",
  info: "border-info/20 bg-info-soft text-info",
} as const;

export function FeedbackBanner({
  tone = "info",
  children,
  className,
}: FeedbackBannerProps) {
  return (
    <p className={cn("rounded-md border px-3 py-2 text-sm", toneStyles[tone], className)}>
      {children}
    </p>
  );
}
