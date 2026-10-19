import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { getCampaignStats } from "@/lib/campaigns";
import { requireCurrentCompany } from "@/lib/company";
import { getCompanySurveys } from "@/lib/surveys";

export default async function DashboardPage() {
  const company = await requireCurrentCompany();
  const [
    { surveys, error: surveysError },
    { totalCampaigns, error: campaignsError },
  ] = await Promise.all([
    getCompanySurveys(company.id),
    getCampaignStats(company.id),
  ]);

  return (
    <AppShell>
      <PageContainer size="wide">
        <DashboardWorkspace
          companyId={company.id}
          surveys={surveys}
          totalCampaigns={totalCampaigns}
          error={surveysError ?? campaignsError}
        />
      </PageContainer>
    </AppShell>
  );
}
