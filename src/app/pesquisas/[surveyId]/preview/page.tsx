import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { DynamicPublicResponseForm } from "@/components/responses/dynamic-public-response-form";
import { PublicResponseForm } from "@/components/responses/public-response-form";
import { Card, CardContent } from "@/components/ui/card";
import { requireCurrentCompany } from "@/lib/company";
import { getSurveyQuestionsForResponses } from "@/lib/responses";
import { getCompanySurveys } from "@/lib/surveys";
import { surveyStatusLabels } from "@/types/survey";

type SurveyPreviewPageProps = {
  params: {
    surveyId: string;
  };
};

export default async function SurveyPreviewPage({ params }: SurveyPreviewPageProps) {
  const company = await requireCurrentCompany();
  const { surveys } = await getCompanySurveys(company.id);
  const survey = surveys.find((item) => item.id === params.surveyId);

  if (!survey) {
    notFound();
  }

  const { questions, error } = await getSurveyQuestionsForResponses(survey.id);

  return (
    <AppShell>
      <PageContainer size="narrow">
        <PageHeader
          eyebrow="Preview administrativo"
          title={survey.title}
          description={survey.description ?? "Visualize como esta pesquisa será exibida para o cliente."}
        />

        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm text-muted-foreground">
              Este preview é visível apenas no painel administrativo e não salva respostas.
            </p>
            <p className="text-sm text-muted-foreground">
              Status atual: <span className="text-text-primary">{surveyStatusLabels[survey.status]}</span>
            </p>
          </CardContent>
        </Card>

        {error ? (
          <p className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {questions.length > 0 ? (
          <DynamicPublicResponseForm surveyId={survey.id} questions={questions} isPreview />
        ) : (
          <PublicResponseForm surveyId={survey.id} isPreview />
        )}
      </PageContainer>
    </AppShell>
  );
}
