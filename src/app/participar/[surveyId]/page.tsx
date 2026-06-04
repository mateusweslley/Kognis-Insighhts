import { PublicResponseForm } from "@/components/responses/public-response-form";
import { BrandMark } from "@/components/marketing/brand-mark";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicSurveyById } from "@/lib/responses";

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
            <CardTitle>Pesquisa indisponivel</CardTitle>
            <CardDescription>
              Esta pesquisa nao existe ou nao esta aceitando respostas no momento.
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
            <CardTitle>Pesquisa indisponivel</CardTitle>
            <CardDescription>
              Esta pesquisa nao esta aceitando respostas no momento.
            </CardDescription>
          </CardHeader>
        </Card>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-white">{survey.title}</h1>
        {survey.description ? (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{survey.description}</p>
        ) : null}
      </div>
      <PublicResponseForm surveyId={survey.id} />
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
      </div>
    </main>
  );
}
