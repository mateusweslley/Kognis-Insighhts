import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Survey, SurveyStatus } from "@/types/survey";
import { surveyStatusLabels } from "@/types/survey";

type DashboardOverviewProps = {
  surveys: Survey[];
  totalResponses?: number;
  totalCampaigns?: number;
  error?: string | null;
};

export function DashboardOverview({
  surveys,
  totalResponses = 0,
  totalCampaigns = 0,
  error,
}: DashboardOverviewProps) {
  const totalSurveys = surveys.length;
  const activeSurveys = countSurveysByStatus(surveys, "active");
  const draftSurveys = countSurveysByStatus(surveys, "draft");
  const archivedSurveys = countSurveysByStatus(surveys, "archived");
  const latestSurveys = surveys.slice(0, 3);

  if (totalSurveys === 0) {
    return (
      <div className="space-y-7">
        <PageHeader
          title="Visão geral"
          description="Acompanhe os principais sinais das pesquisas e campanhas da sua marca."
        />
        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        <EmptyState
          title="Dashboard aguardando respostas."
          description="Quando consumidores responderem suas pesquisas, os indicadores principais aparecerão aqui."
          actionLabel="Criar primeira pesquisa"
          actionHref="/pesquisas"
        />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <PageHeader
        title="Visão geral"
        description="Você já possui pesquisas cadastradas. As métricas aparecerão quando consumidores começarem a responder."
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/pesquisas">Ver pesquisas</Link>
          </Button>
        }
      />

      {error ? <ErrorMessage>{error}</ErrorMessage> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard title="Total de pesquisas" value={totalSurveys} />
        <SummaryCard title="Total de campanhas" value={totalCampaigns} />
        <SummaryCard title="Pesquisas ativas" value={activeSurveys} />
        <SummaryCard title="Em rascunho" value={draftSurveys} />
        <SummaryCard title="Encerradas" value={archivedSurveys} />
        <SummaryCard title="Respostas recebidas" value={totalResponses} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas pesquisas</CardTitle>
          <CardDescription>
            Resumo das pesquisas mais recentes da sua empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {latestSurveys.map((survey) => (
            <div
              key={survey.id}
              className="flex flex-col gap-2 rounded-md border border-border bg-surface-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-text-primary">{survey.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Criada em {formatDate(survey.created_at)}
                </p>
              </div>
              <span className="w-fit rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-text-secondary">
                {surveyStatusLabels[survey.status]}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-3 text-3xl font-semibold text-text-primary">{value}</p>
      </CardContent>
    </Card>
  );
}

function ErrorMessage({ children }: { children: string }) {
  return (
    <p className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

function countSurveysByStatus(surveys: Survey[], status: SurveyStatus) {
  return surveys.filter((survey) => survey.status === status).length;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}
