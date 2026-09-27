import { ResponsesPanel } from "@/components/responses/responses-panel";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { requireCurrentCompany } from "@/lib/company";
import { getResponseCountsByCompany } from "@/lib/responses";
import { getCompanySurveys } from "@/lib/surveys";

export default async function RespostasPage() {
  const company = await requireCurrentCompany();
  const [{ surveys, error: surveysError }, { counts, error: responsesError }] = await Promise.all([
    getCompanySurveys(company.id),
    getResponseCountsByCompany(company.id),
  ]);

  return (
    <AppShell>
      <PageContainer size="wide">
        <ResponsesPanel
          surveys={surveys}
          responseCounts={Object.fromEntries(counts)}
          error={responsesError ?? surveysError}
        />
      </PageContainer>
    </AppShell>
  );
}
