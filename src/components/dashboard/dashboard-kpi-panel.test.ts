import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DashboardKpiPanel, KpiCard, loadDashboardKpiSnapshot } from "@/components/dashboard/dashboard-kpi-panel";
import { selectDashboardPeriod, type DashboardKpiSnapshot } from "@/lib/dashboard-kpi-snapshot";
import { calculateDashboardKpis } from "@/lib/metrics/dashboard-kpis";

const asOf = "2026-10-18T12:00:00.000Z";

function makeSnapshot(): DashboardKpiSnapshot {
  const surveys = [{ id: "survey-1", status: "active" as const }];
  const input = {
    asOf,
    surveys,
    primaryQuestionIdBySurvey: new Map<string, string | null>([["survey-1", null]]),
    datasets: [],
  };
  return {
    periods: {
      7: calculateDashboardKpis({ ...input, periodDays: 7 }),
      30: calculateDashboardKpis({ ...input, periodDays: 30 }),
      90: calculateDashboardKpis({ ...input, periodDays: 90 }),
    },
    primaryQuestionConfigurationUnavailable: false,
  };
}

describe("dashboard KPI presentation", () => {
  it("offers only the approved 7, 30, and 90 day periods", () => {
    const markup = renderToStaticMarkup(createElement(DashboardKpiPanel));

    expect(markup).toContain("Últimos 7 dias");
    expect(markup).toContain("Últimos 30 dias");
    expect(markup).toContain("Últimos 90 dias");
    expect(markup).toContain("Carregando…");
  });

  it("selects the matching calculated period while active-survey count stays current", () => {
    const snapshot = makeSnapshot();
    const sevenDays = selectDashboardPeriod(snapshot, 7);
    const thirtyDays = selectDashboardPeriod(snapshot, 30);
    const ninetyDays = selectDashboardPeriod(snapshot, 90);

    expect(sevenDays.current.start).toBe("2026-10-11T12:00:00.000Z");
    expect(thirtyDays.current.start).toBe("2026-09-18T12:00:00.000Z");
    expect(ninetyDays.current.start).toBe("2026-07-20T12:00:00.000Z");
    expect([sevenDays.activeSurveys, thirtyDays.activeSurveys, ninetyDays.activeSurveys]).toEqual([
      { status: "value", value: 1 },
      { status: "value", value: 1 },
      { status: "value", value: 1 },
    ]);
  });

  it("shares a single in-flight API request for the full period snapshot", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeSnapshot(),
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const [first, second] = await Promise.all([
        loadDashboardKpiSnapshot(),
        loadDashboardKpiSnapshot(),
      ]);
      expect(first).toBe(second);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith("/api/dashboard/kpis", { cache: "no-store" });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("shows a configuration prompt instead of an invented rating", () => {
    const markup = renderToStaticMarkup(createElement(KpiCard, {
      title: "Avaliação média",
      value: { status: "no_data", reason: "no_primary_question_configured" },
      format: "rating",
    }));

    expect(markup).toContain("Configure uma pergunta principal de avaliação de 1 a 5.");
    expect(markup).not.toContain("0/5");
  });

  it("distinguishes valid rating results from missing values and source errors", () => {
    const emptyMarkup = renderToStaticMarkup(createElement(KpiCard, {
      title: "Percepção positiva",
      value: { status: "no_data", reason: "no_valid_ratings" },
      format: "percent",
    }));
    const errorMarkup = renderToStaticMarkup(createElement(KpiCard, {
      title: "Respostas recebidas",
      value: { status: "error" },
      format: "count",
    }));
    const valueMarkup = renderToStaticMarkup(createElement(KpiCard, {
      title: "Percepção positiva",
      value: { status: "value", value: 66.666 },
      comparison: { status: "value", deltaAbsolute: 10, deltaPercent: 17.6 },
      format: "percent",
    }));

    expect(emptyMarkup).toContain("Sem avaliações válidas neste período.");
    expect(errorMarkup).toContain("Não foi possível carregar este indicador.");
    expect(valueMarkup).toContain("66,7%");
    expect(valueMarkup).toContain("+10 p.p.");
    expect(valueMarkup).toContain("+17,6%");
  });
});
