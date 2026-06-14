import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
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
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-sm font-medium text-kognis-teal">Preview administrativo</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">{survey.title}</h1>
          {survey.description ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{survey.description}</p>
          ) : null}
        </div>

        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm text-muted-foreground">
              Este preview e visivel apenas no painel administrativo e nao salva respostas.
            </p>
            <p className="text-sm text-muted-foreground">
              Status atual: <span className="text-white">{surveyStatusLabels[survey.status]}</span>
            </p>
          </CardContent>
        </Card>

        {error ? (
          <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        {questions.length > 0 ? (
          <DynamicPublicResponseForm surveyId={survey.id} questions={questions} isPreview />
        ) : (
          <PublicResponseForm surveyId={survey.id} isPreview />
        )}
      </div>
    </AppShell>
  );
}
