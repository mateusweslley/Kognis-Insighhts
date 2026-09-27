import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { SurveyResponsesPanel } from "@/components/responses/survey-responses-panel";
import { requireCurrentCompany } from "@/lib/company";
import { normalizeResponses } from "@/lib/response-normalizer";
import { getResponsesBySurveyId, getSurveyQuestionsForResponses } from "@/lib/responses";
import { getCompanySurveys } from "@/lib/surveys";

type SurveyResponsesPageProps = {
  params: {
    surveyId: string;
  };
};

export default async function SurveyResponsesPage({ params }: SurveyResponsesPageProps) {
  const company = await requireCurrentCompany();
  const { surveys, error: surveysError } = await getCompanySurveys(company.id);
  const survey = surveys.find((item) => item.id === params.surveyId);

  if (!survey) {
    notFound();
  }

  const [{ responses, error: responsesError }, { questions, error: questionsError }] =
    await Promise.all([
      getResponsesBySurveyId(survey.id),
      getSurveyQuestionsForResponses(survey.id),
    ]);
  const normalizedResponses = normalizeResponses(responses, questions);

  return (
    <AppShell>
      <PageContainer size="wide">
        <SurveyResponsesPanel
          survey={survey}
          responses={normalizedResponses}
          error={responsesError ?? questionsError ?? surveysError}
        />
      </PageContainer>
    </AppShell>
  );
}
