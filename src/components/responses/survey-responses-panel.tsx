"use client";

import { ArrowLeft, Download, Eye, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exportNormalizedResponsesToCsv, type NormalizedResponse } from "@/lib/response-normalizer";
import type { Survey } from "@/types/survey";

type SurveyResponsesPanelProps = {
  survey: Survey;
  responses: NormalizedResponse[];
  error?: string | null;
};

export function SurveyResponsesPanel({ survey, responses, error }: SurveyResponsesPanelProps) {
  const [selectedResponse, setSelectedResponse] = useState<NormalizedResponse | null>(null);

  function handleExportCsv() {
    const csv = exportNormalizedResponsesToCsv(responses);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `respostas-${slugifyFileName(survey.title)}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-7">
      <PageHeader
        title={survey.title}
        description={survey.description || "Respostas recebidas nesta pesquisa."}
        eyebrow="Respostas"
        actions={
          <>
            <Button className="w-full sm:w-auto" variant="secondary" asChild>
              <Link href="/respostas">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Link>
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={handleExportCsv}
              disabled={responses.length === 0}
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </>
        }
      />

      {error ? (
        <p className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {responses.length === 0 ? (
        <EmptyState
          title="Nenhuma resposta nesta pesquisa."
          description="Quando consumidores responderem pelo link público ou QR Code, as respostas aparecerão aqui."
          actionLabel="Ver pesquisas"
          actionHref="/pesquisas"
        />
      ) : null}

      {responses.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Respostas recebidas</CardTitle>
            <CardDescription>
              Lista operacional para leitura rápida. Abra os detalhes para ver todos os campos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {responses.map((response) => (
              <div
                key={response.id}
                className="grid gap-3 rounded-md border border-border bg-surface-muted px-4 py-3 md:grid-cols-[150px_1fr_auto] md:items-center"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {formatShortDate(response.createdAt)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatShortTime(response.createdAt)}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{response.respondentLabel}</p>
                  <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">
                    {response.summary}
                  </p>
                </div>
                <Button
                  className="w-full md:w-auto"
                  variant="secondary"
                  onClick={() => setSelectedResponse(response)}
                >
                  <Eye className="h-4 w-4" />
                  Ver detalhes
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {selectedResponse ? (
        <ResponseDetailsModal
          response={selectedResponse}
          onClose={() => setSelectedResponse(null)}
        />
      ) : null}
    </div>
  );
}

function ResponseDetailsModal({
  response,
  onClose,
}: {
  response: NormalizedResponse;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-surface p-5 shadow-floating">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Detalhes da resposta</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Enviada em {formatFullDate(response.createdAt)}
            </p>
          </div>
          <Button variant="secondary" onClick={onClose}>
            <X className="h-4 w-4" />
            Fechar
          </Button>
        </div>

        <div className="mt-5 max-h-[65vh] space-y-3 overflow-y-auto pr-1">
          {response.fields.map((field) => (
            <div
              key={`${field.questionId ?? field.label}-${field.position ?? ""}`}
              className="rounded-md border border-border bg-surface-muted p-4"
            >
              <p className="text-sm font-medium text-muted-foreground">{field.label}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-base text-text-primary">
                {formatFieldValue(field.value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function formatShortTime(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatFullDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatFieldValue(value: string | number | boolean | null) {
  if (value === null || value === "") {
    return "Não respondido";
  }

  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }

  return String(value);
}

function slugifyFileName(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "pesquisa";
}
