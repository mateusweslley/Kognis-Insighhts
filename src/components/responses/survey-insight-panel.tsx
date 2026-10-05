import type { SurveyInsight } from "@/lib/metrics/dashboard-metrics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SurveyInsightPanelProps = {
  insight: SurveyInsight;
};

export function SurveyInsightPanel({ insight }: SurveyInsightPanelProps) {
  const { totalResponses, avgRating, nps } = insight;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Insight</CardTitle>
        <CardDescription>Um resumo interpretável dos resultados desta pesquisa.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryMetric label="Respostas" value={formatCount(totalResponses)} />
          <SummaryMetric label="Satisfação" value={formatSatisfaction(avgRating)} />
          <SummaryMetric label="NPS" value={formatNps(nps.stats.score)} />
        </div>

        {nps.availability === "available" && nps.classification ? (
          <div className="rounded-md border border-border bg-surface-muted p-4">
            <p className="text-sm font-semibold text-text-primary">
              Leitura: {nps.classification.label}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {nps.classification.insight}
            </p>
          </div>
        ) : null}

        {nps.availability === "no_question" ? (
          <p className="rounded-md border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
            Adicione uma pergunta de avaliação de 0 a 10 para acompanhar o NPS.
          </p>
        ) : null}

        {nps.availability === "ambiguous" ? (
          <p className="rounded-md border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
            Há mais de uma pergunta de 0 a 10 nesta pesquisa. Defina uma única pergunta de
            avaliação para calcular o NPS.
          </p>
        ) : null}

        {nps.availability === "no_data" ? (
          <p className="rounded-md border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
            O NPS aparecerá quando houver respostas para a pergunta de 0 a 10.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function formatCount(count: number): string {
  return `${count} ${count === 1 ? "resposta" : "respostas"}`;
}

function formatSatisfaction(avg: number | null): string {
  if (avg === null) {
    return "—";
  }
  return `${avg.toFixed(1).replace(".", ",")} / 5`;
}

function formatNps(score: number | null): string {
  if (score === null) {
    return "Não disponível";
  }
  const sign = score > 0 ? "+" : "";
  return `${sign}${score}`;
}
