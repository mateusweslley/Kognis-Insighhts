"use client";

import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Survey } from "@/types/survey";

type ResponsesPanelProps = {
  surveys: Survey[];
  responseCounts: Record<string, number>;
  error?: string | null;
};

export function ResponsesPanel({ surveys, responseCounts, error }: ResponsesPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const totalResponses = Object.values(responseCounts).reduce((total, count) => total + count, 0);
  const filteredSurveys = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchTerm);

    if (!normalizedSearch) {
      return surveys;
    }

    return surveys.filter((survey) => {
      const searchableText = normalizeSearch(`${survey.title} ${survey.description ?? ""}`);

      return searchableText.includes(normalizedSearch);
    });
  }, [searchTerm, surveys]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold text-white">Respostas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Abra uma pesquisa para visualizar quem respondeu, quando respondeu e o que respondeu.
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      {surveys.length === 0 ? (
        <EmptyState
          title="Nenhuma pesquisa criada ainda."
          description="Crie uma pesquisa para comecar a coletar respostas dos consumidores."
          actionLabel="Ver pesquisas"
          actionHref="/pesquisas"
        />
      ) : null}

      {surveys.length > 0 && totalResponses === 0 ? (
        <p className="rounded-md border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-muted-foreground">
          Nenhuma resposta recebida ainda. As respostas aparecerao aqui quando consumidores
          acessarem os links publicos ou QR Codes das pesquisas ativas.
        </p>
      ) : null}

      {surveys.length > 0 ? (
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar pesquisa..."
            className="pl-10"
          />
        </div>
      ) : null}

      {surveys.length > 0 && filteredSurveys.length === 0 ? (
        <p className="rounded-md border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-muted-foreground">
          Nenhuma pesquisa encontrada para a busca atual.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filteredSurveys.map((survey) => (
          <Card key={survey.id}>
            <CardContent className="flex h-full flex-col gap-5 p-5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-muted-foreground">{survey.title}</p>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {survey.description || "Sem descricao."}
                </p>
              </div>
              <div>
                <p className="text-3xl font-semibold text-white">
                  {responseCounts[survey.id] ?? 0}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">respostas</p>
              </div>
              <Button className="mt-auto w-full" asChild>
                <Link href={`/respostas/${survey.id}`}>
                  Ver respostas
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
