import { DynamicPublicResponseForm } from "@/components/responses/dynamic-public-response-form";
import { PublicResponseForm } from "@/components/responses/public-response-form";
import { BrandMark } from "@/components/marketing/brand-mark";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicSurveyById, getPublicSurveyQuestions } from "@/lib/responses";

type PublicSurveyPageProps = {
  params: {
    surveyId: string;
  };
};

export default async function PublicSurveyPage({ params }: PublicSurveyPageProps) {
  const { survey, error } = await getPublicSurveyById(params.surveyId);

  if (error || !survey) {
    return (
      <PublicPageShell>
        <Card>
          <CardHeader>
            <CardTitle>Pesquisa indisponível</CardTitle>
            <CardDescription>
              Esta pesquisa não existe ou não está aceitando respostas no momento.
            </CardDescription>
          </CardHeader>
        </Card>
      </PublicPageShell>
    );
  }

  if (survey.status !== "active") {
    return (
      <PublicPageShell>
        <Card>
          <CardHeader>
            <CardTitle>Pesquisa indisponível</CardTitle>
            <CardDescription>
              Esta pesquisa não está aceitando respostas no momento.
            </CardDescription>
          </CardHeader>
        </Card>
      </PublicPageShell>
    );
  }

  const { questions, error: questionsError } = await getPublicSurveyQuestions(survey.id);

  if (questionsError) {
    return (
      <PublicPageShell>
        <Card>
          <CardHeader>
            <CardTitle>Pesquisa indisponível</CardTitle>
            <CardDescription>
              Não foi possível carregar as perguntas desta pesquisa agora.
            </CardDescription>
          </CardHeader>
        </Card>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-text-primary">{survey.title}</h1>
        {survey.description ? (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{survey.description}</p>
        ) : null}
      </div>
      {questions.length > 0 ? (
        <DynamicPublicResponseForm surveyId={survey.id} questions={questions} />
      ) : (
        <PublicResponseForm surveyId={survey.id} />
      )}
    </PublicPageShell>
  );
}

function PublicPageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-8 flex justify-center">
          <BrandMark />
        </div>
        {children}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Powered by Kognis Insights
        </p>
      </div>
    </main>
  );
}
