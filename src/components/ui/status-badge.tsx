import { Badge } from "@/components/ui/badge";
import type { ReactNode } from "react";

type StatusBadgeProps = {
  status: "draft" | "active" | "archived" | "success" | "warning" | "danger" | "info";
  children: ReactNode;
};

const statusVariant = {
  draft: "warning",
  active: "success",
  archived: "danger",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
} as const;

export function StatusBadge({ status, children }: StatusBadgeProps) {
  return <Badge variant={statusVariant[status]}>{children}</Badge>;
}
