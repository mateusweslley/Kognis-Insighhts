import { AppShellClient } from "@/components/layout/app-shell-client";
import { requireCurrentCompany } from "@/lib/company";

type AppShellProps = {
  children: React.ReactNode;
};

export async function AppShell({ children }: AppShellProps) {
  const company = await requireCurrentCompany();

  return <AppShellClient companyName={company.name}>{children}</AppShellClient>;
}
