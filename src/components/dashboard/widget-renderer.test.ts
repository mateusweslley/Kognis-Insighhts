import { createElement, type ReactNode } from "react";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  vi.stubGlobal("React", React);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

vi.mock("recharts", async () => {
  const React = await import("react");
  const wrapper = ({ children }: { children?: unknown }) =>
    React.createElement("div", null, children as React.ReactNode);
  const ResponsiveContainer = ({ children }: { children?: unknown }) =>
    React.createElement("div", { "data-chart": "true" }, children as React.ReactNode);
  const Tooltip = ({
    formatter,
  }: {
    formatter?: (
      value: number,
      name: string,
      item: { payload?: { pct?: number } },
    ) => [ReactNode, ReactNode];
  }) => {
    if (!formatter) return null;
    const [value] = formatter(2, "count", { payload: { pct: 0.5 } });
    return React.createElement("span", null, String(value));
  };

  return {
    Bar: wrapper,
    BarChart: wrapper,
    CartesianGrid: wrapper,
    Cell: wrapper,
    Line: wrapper,
    LineChart: wrapper,
    Pie: wrapper,
    PieChart: wrapper,
    ResponsiveContainer,
    Tooltip,
    XAxis: wrapper,
    YAxis: wrapper,
  };
});

import { WidgetRenderer } from "@/components/dashboard/widget-renderer";
import type { MetricResult } from "@/lib/dashboard-metric-resolver";

const distribution: MetricResult = {
  kind: "distribution",
  labels: ["Sim", "Não"],
  values: [2, 0],
  percentages: [1, 0],
  total: 2,
  emptyMessage: "Ainda não há respostas para esta pergunta",
};

describe("WidgetRenderer distribution", () => {
  it.each(["bar", "pie"] as const)(
    "exibe contagem e percentual no tooltip e junto ao gráfico %s",
    (visualization) => {
      const markup = renderToStaticMarkup(
        createElement(WidgetRenderer, { metric: distribution, visualization }),
      );

      expect(markup).toContain("2 (50%)");
      expect(markup).toContain("100%");
      expect(markup).toContain("0%");
    },
  );

  it("mostra quantidade e percentual na tabela", () => {
    const markup = renderToStaticMarkup(
      createElement(WidgetRenderer, { metric: distribution, visualization: "table" }),
    );

    expect(markup).toContain("Quantidade");
    expect(markup).toContain("Percentual");
    expect(markup).toContain("Sim");
    expect(markup).toContain("100%");
    expect(markup).toContain("Não");
    expect(markup).toContain("0%");
  });

  it("mostra o estado vazio e alternativas zeradas sem renderizar gráfico", () => {
    const noResponses: MetricResult = {
      kind: "distribution",
      labels: ["Sim", "Não"],
      values: [0, 0],
      percentages: [0, 0],
      total: 0,
      emptyMessage: "Ainda não há respostas para esta pergunta",
    };
    const markup = renderToStaticMarkup(
      createElement(WidgetRenderer, { metric: noResponses, visualization: "bar" }),
    );

    expect(markup).toContain("Ainda não há respostas para esta pergunta");
    expect(markup).toContain("Sim");
    expect(markup).toContain("Não");
    expect(markup).toContain("0%");
    expect(markup).not.toContain("data-chart");
  });
});
