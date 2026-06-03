import { SurveyManager } from "@/components/surveys/survey-manager";
import { AppShell } from "@/components/layout/app-shell";
import { requireCurrentCompany } from "@/lib/company";
import { getCompanySurveys } from "@/lib/surveys";

export default async function PesquisasPage() {
  const company = await requireCurrentCompany();
  const surveys = await getCompanySurveys(company.id);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <SurveyManager companyId={company.id} initialSurveys={surveys} />
      </div>
    </AppShell>
  );
}
