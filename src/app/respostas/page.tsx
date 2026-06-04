import { ResponsesPanel } from "@/components/responses/responses-panel";
import { AppShell } from "@/components/layout/app-shell";
import { requireCurrentCompany } from "@/lib/company";
import { getResponsesByCompany } from "@/lib/responses";
import { getCompanySurveys } from "@/lib/surveys";

export default async function RespostasPage() {
  const company = await requireCurrentCompany();
  const [{ surveys, error: surveysError }, { responses, error: responsesError }] =
    await Promise.all([getCompanySurveys(company.id), getResponsesByCompany(company.id)]);

  return (
    <AppShell>
      <ResponsesPanel
        surveys={surveys}
        responses={responses}
        error={responsesError ?? surveysError}
      />
    </AppShell>
  );
}
