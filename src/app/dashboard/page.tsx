import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { AppShell } from "@/components/layout/app-shell";
import { requireCurrentCompany } from "@/lib/company";
import { getCompanySurveys } from "@/lib/surveys";

export default async function DashboardPage() {
  const company = await requireCurrentCompany();
  const { surveys, error } = await getCompanySurveys(company.id);

  return (
    <AppShell>
      <DashboardOverview surveys={surveys} error={error} />
    </AppShell>
  );
}
