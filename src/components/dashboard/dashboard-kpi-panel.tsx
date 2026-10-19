"use client";

import { useEffect, useState } from "react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  dashboardKpiPeriods,
  selectDashboardPeriod,
  type DashboardKpiSnapshot,
} from "@/lib/dashboard-kpi-snapshot";
import type {
  DashboardKpiComparison,
  DashboardKpiValue,
  DashboardPeriodDays,
} from "@/lib/metrics/dashboard-kpis";

const periodLabels: Record<DashboardPeriodDays, string> = {
  7: "Últimos 7 dias",
  30: "Últimos 30 dias",
  90: "Últimos 90 dias",
};

type DashboardKpiLoadState = "loading" | "ready" | "error";

let inFlightSnapshotRequest: Promise<DashboardKpiSnapshot> | null = null;

export function loadDashboardKpiSnapshot(): Promise<DashboardKpiSnapshot> {
  if (inFlightSnapshotRequest) return inFlightSnapshotRequest;

  const request = (async () => {
    const response = await fetch("/api/dashboard/kpis", { cache: "no-store" });
    if (!response.ok) throw new Error("Falha ao carregar os indicadores.");
    const payload = await response.json() as DashboardKpiSnapshot;
    if (!payload?.periods || !dashboardKpiPeriods.every((period) => payload.periods[period])
      || typeof payload.primaryQuestionConfigurationUnavailable !== "boolean") {
      throw new Error("Resposta inválida ao carregar os indicadores.");
    }
    return payload;
  })();

  inFlightSnapshotRequest = request;
  void request.then(
    () => { if (inFlightSnapshotRequest === request) inFlightSnapshotRequest = null; },
    () => { if (inFlightSnapshotRequest === request) inFlightSnapshotRequest = null; },
  );
  return request;
}

export function DashboardKpiPanel() {
  const [periodDays, setPeriodDays] = useState<DashboardPeriodDays>(30);
  const [snapshot, setSnapshot] = useState<DashboardKpiSnapshot | null>(null);
  const [loadState, setLoadState] = useState<DashboardKpiLoadState>("loading");
  const [retryAttempt, setRetryAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadState("loading");
    void loadDashboardKpiSnapshot().then(
      (data) => {
        if (!active) return;
        setSnapshot(data);
        setLoadState("ready");
      },
      () => {
        if (!active) return;
        setSnapshot(null);
        setLoadState("error");
      },
    );
    return () => { active = false; };
  }, [retryAttempt]);

  const kpis = snapshot ? selectDashboardPeriod(snapshot, periodDays) : null;
  const hasError = loadState === "error" || (kpis ? [
    kpis.current.responsesReceived,
    kpis.current.averageRating,
    kpis.current.positivePercent,
    kpis.activeSurveys,
  ].some((value) => value.status === "error") : false);

  return (
    <section className="space-y-4" aria-labelledby="dashboard-kpis-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="dashboard-kpis-heading" className="text-lg font-semibold text-text-primary">
            Indicadores principais
          </h2>
          {kpis ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {formatPeriod(kpis.current.start, kpis.current.end)} · comparação com o período anterior equivalente
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Indicadores da empresa no período escolhido.</p>
          )}
        </div>
        <div className="flex items-end gap-2">
          <div className="w-44 space-y-1">
            <label htmlFor="dashboard-kpi-period" className="text-xs font-medium text-muted-foreground">
              Período
            </label>
            <Select
              id="dashboard-kpi-period"
              value={String(periodDays)}
              onChange={(event) => setPeriodDays(Number(event.target.value) as DashboardPeriodDays)}
            >
              {dashboardKpiPeriods.map((days) => (
                <option key={days} value={String(days)}>
                  {periodLabels[days]}
                </option>
              ))}
            </Select>
          </div>
          {hasError ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSnapshot(null);
                setLoadState("loading");
                setRetryAttempt((value) => value + 1);
              }}
            >
              Tentar novamente
            </Button>
          ) : null}
        </div>
      </div>

      {snapshot?.primaryQuestionConfigurationUnavailable ? (
        <p role="alert" className="rounded-md border border-warning/25 bg-warning-soft px-3 py-2 text-sm text-warning">
          A configuração da pergunta principal não pôde ser validada. Verifique a migration `014_primary_survey_question.sql` e a pergunta configurada no projeto DEV.
        </p>
      ) : null}
      {loadState === "error" ? (
        <p role="alert" className="text-sm text-danger">Não foi possível carregar os indicadores. Tente novamente.</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-live="polite">
        <KpiCard
          title="Respostas recebidas"
          value={loadState === "error" ? { status: "error" } : kpis?.current.responsesReceived ?? null}
          comparison={kpis?.comparisons.responsesReceived}
          format="count"
        />
        <KpiCard
          title="Avaliação média"
          value={loadState === "error" ? { status: "error" } : kpis?.current.averageRating ?? null}
          comparison={kpis?.comparisons.averageRating}
          format="rating"
        />
        <KpiCard
          title="Percepção positiva"
          value={loadState === "error" ? { status: "error" } : kpis?.current.positivePercent ?? null}
          comparison={kpis?.comparisons.positivePercent}
          format="percent"
        />
        <KpiCard
          title="Pesquisas ativas"
          value={loadState === "error" ? { status: "error" } : kpis?.activeSurveys ?? null}
          format="count"
        />
      </div>
    </section>
  );
}
export function KpiCard({
  title,
  value,
  comparison,
  format,
}: {
  title: string;
  value: DashboardKpiValue | null;
  comparison?: DashboardKpiComparison;
  format: "count" | "rating" | "percent";
}) {
  const display = value ? getValueDisplay(value, format) : { value: "Carregando…", detail: null };
  const comparisonText = value?.status === "value" && comparison
    ? getComparisonDisplay(comparison, format)
    : null;

  return (
    <Card>
      <CardContent className="min-h-32 p-5">
        <p className="text-sm text-muted-foreground">{title}</p>
        {display.detail ? (
          <p className={`mt-3 text-sm leading-5 ${display.detailKind === "error" ? "text-danger" : "text-muted-foreground"}`}>
            {display.detail}
          </p>
        ) : (
          <p className="mt-3 text-3xl font-semibold text-text-primary">{display.value}</p>
        )}
        {comparisonText ? <p className="mt-2 text-xs text-muted-foreground">{comparisonText}</p> : null}
      </CardContent>
    </Card>
  );
}

function getValueDisplay(
  value: DashboardKpiValue,
  format: "count" | "rating" | "percent",
): { value: string; detail: string | null; detailKind?: "error" | "empty" } {
  if (value.status === "error") {
    return { value: "", detail: "Não foi possível carregar este indicador.", detailKind: "error" };
  }
  if (value.status === "no_data") {
    if (value.reason === "no_primary_question_configured") {
      return { value: "", detail: "Configure uma pergunta principal de avaliação de 1 a 5." };
    }
    if (value.reason === "no_compatible_primary_question") {
      return { value: "", detail: "A pergunta principal está indisponível ou não é compatível." };
    }
    return { value: "", detail: "Sem avaliações válidas neste período." };
  }

  const formatted = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: format === "count" ? 0 : 1,
    minimumFractionDigits: 0,
  }).format(value.value);
  return {
    value: format === "rating" ? `${formatted}/5` : format === "percent" ? `${formatted}%` : formatted,
    detail: null,
  };
}

function getComparisonDisplay(
  comparison: DashboardKpiComparison,
  format: "count" | "rating" | "percent",
): string {
  if (comparison.status === "error") return "Comparação indisponível.";
  if (comparison.status === "no_data") return "Sem dados no período anterior para comparar.";

  const delta = comparison.deltaAbsolute;
  const signedDelta = `${delta > 0 ? "+" : ""}${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: format === "count" ? 0 : 1,
  }).format(delta)}`;
  const absolute = format === "count"
    ? `${signedDelta} respostas`
    : format === "rating"
      ? `${signedDelta} ponto${Math.abs(delta) === 1 ? "" : "s"} na escala`
      : `${signedDelta} p.p.`;
  const relative = comparison.deltaPercent === null
    ? " · sem base percentual"
    : ` · ${comparison.deltaPercent > 0 ? "+" : ""}${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(comparison.deltaPercent)}%`;

  return `${absolute} vs. período anterior${relative}`;
}

function formatPeriod(start: string, end: string): string {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
  const lastInstant = new Date(Date.parse(end) - 1);
  return `Janela UTC: ${formatter.format(new Date(start))}–${formatter.format(lastInstant)}`;
}
