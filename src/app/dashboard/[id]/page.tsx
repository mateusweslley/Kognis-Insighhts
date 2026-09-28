import { DashboardCanvas } from "@/components/dashboard/dashboard-canvas";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { requireCurrentCompany } from "@/lib/company";

type DashboardDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function DashboardDetailPage({ params }: DashboardDetailPageProps) {
  const company = await requireCurrentCompany();

  return (
    <AppShell>
      <PageContainer size="wide">
        <DashboardCanvas dashboardId={params.id} companyId={company.id} />
      </PageContainer>
    </AppShell>
  );
}
