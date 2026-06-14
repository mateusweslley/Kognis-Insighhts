import { CampaignManager } from "@/components/campaigns/campaign-manager";
import { AppShell } from "@/components/layout/app-shell";
import { getCampaignsByCompany } from "@/lib/campaigns";
import { requireCurrentCompany } from "@/lib/company";
import { getCompanySurveys } from "@/lib/surveys";

export default async function CampanhasPage() {
  const company = await requireCurrentCompany();
  const [{ campaigns, error: campaignsError }, { surveys, error: surveysError }] =
    await Promise.all([getCampaignsByCompany(company.id), getCompanySurveys(company.id)]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <CampaignManager
          companyId={company.id}
          initialCampaigns={campaigns}
          surveys={surveys}
          initialError={campaignsError ?? surveysError}
        />
      </div>
    </AppShell>
  );
}
