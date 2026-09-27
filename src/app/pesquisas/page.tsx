import { SurveyManager } from "@/components/surveys/survey-manager";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { requireCurrentCompany } from "@/lib/company";
import { getCompanySurveys } from "@/lib/surveys";

export default async function PesquisasPage() {
  const company = await requireCurrentCompany();
  const { surveys, error } = await getCompanySurveys(company.id);

  return (
    <AppShell>
      <PageContainer size="wide">
        <SurveyManager companyId={company.id} initialSurveys={surveys} initialError={error} />
      </PageContainer>
    </AppShell>
  );
}
