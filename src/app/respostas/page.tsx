import { ResponsesPanel } from "@/components/responses/responses-panel";
import { FeedbacksPanel } from "@/components/responses/feedbacks-panel";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { requireCurrentCompany } from "@/lib/company";
import { getResponseCountsByCompany } from "@/lib/responses";

export default async function RespostasPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const company = await requireCurrentCompany();
  if (searchParams.view === "feedbacks") {
    return (
      <AppShell>
        <PageContainer size="wide">
          <FeedbacksPanel />
        </PageContainer>
      </AppShell>
    );
  }

  const { surveys, counts, error } = await getResponseCountsByCompany(company.id);

  return (
    <AppShell>
      <PageContainer size="wide">
        <ResponsesPanel
          surveys={surveys}
          responseCounts={Object.fromEntries(counts)}
          error={error}
        />
      </PageContainer>
    </AppShell>
  );
}
