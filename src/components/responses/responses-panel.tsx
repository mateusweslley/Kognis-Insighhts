"use client";

import { Download } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exportResponsesToCsv } from "@/lib/response-utils";
import type { SurveyResponseWithSurvey } from "@/types/response";
import type { Survey } from "@/types/survey";

type ResponsesPanelProps = {
  surveys: Survey[];
  responses: SurveyResponseWithSurvey[];
  error?: string | null;
};

export function ResponsesPanel({ surveys, responses, error }: ResponsesPanelProps) {
  const responsesBySurvey = new Map<string, number>();

  responses.forEach((response) => {
    responsesBySurvey.set(response.survey_id, (responsesBySurvey.get(response.survey_id) ?? 0) + 1);
  });

  function handleExportCsv() {
    const csv = exportResponsesToCsv(responses);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "respostas-kognis.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold text-white">Respostas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Veja as respostas coletadas pelas pesquisas publicas da sua marca.
          </p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={handleExportCsv}
          disabled={responses.length === 0}
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      {responses.length === 0 ? (
        <EmptyState
          title="Nenhuma resposta recebida ainda."
          description="As respostas aparecerão aqui quando consumidores acessarem os links publicos das pesquisas ativas."
          actionLabel="Ver pesquisas"
          actionHref="/pesquisas"
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {surveys.map((survey) => (
          <Card key={survey.id}>
            <CardContent className="p-5">
              <p className="truncate text-sm font-medium text-muted-foreground">{survey.title}</p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {responsesBySurvey.get(survey.id) ?? 0}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">respostas</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {responses.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Ultimas respostas</CardTitle>
            <CardDescription>
              Respostas mais recentes coletadas por links publicos de pesquisas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {responses.slice(0, 10).map((response) => (
              <div
                key={response.id}
                className="rounded-md border border-white/10 bg-white/[0.035] px-4 py-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{response.survey_title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {response.answers.name} · Nota {response.answers.rating}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(response.created_at)}
                  </span>
                </div>
                {response.answers.comment ? (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {response.answers.comment}
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
