import { createElement } from "react";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  loadWidgetMetricState,
  WidgetMetricStateView,
  type WidgetMetricState,
} from "@/components/dashboard/widget-metric-state";
import type { LoadedMetricData } from "@/lib/dashboard-metric-loader";
import type { DashboardWidget } from "@/types/dashboard";

beforeAll(() => {
  vi.stubGlobal("React", React);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

const widget = {
  id: "widget-1",
  title: "Respostas",
  metric: "response_count",
  survey_id: "survey-1",
} as DashboardWidget;

const loadedData: LoadedMetricData = {
  data: {
    timestamps: [],
    totalResponses: 0,
    valuesByQuestion: new Map(),
    topicByQuestion: new Map(),
    legacyRatings: [],
  },
  questions: [],
  error: null,
};

describe("widget metric loading states", () => {
  it("returns empty without querying when the widget has no survey", async () => {
    const loader = vi.fn();
    const state = await loadWidgetMetricState({ ...widget, survey_id: null }, loader);

    expect(state.status).toBe("empty");
    expect(loader).not.toHaveBeenCalled();
  });

  it("represents query failures as an error", async () => {
    const state = await loadWidgetMetricState(widget, async () => ({ ...loadedData, error: "db detail" }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.message).toContain("Não foi possível carregar");
      expect(state.message).not.toContain("db detail");
    }
  });

  it("represents thrown failures as an error", async () => {
    const state = await loadWidgetMetricState(widget, async () => {
      throw new Error("network detail");
    });

    expect(state.status).toBe("error");
  });

  it("represents successful responses with no valid answers as empty", async () => {
    const state = await loadWidgetMetricState(widget, async () => loadedData);

    expect(state.status).toBe("empty");
  });

  it("transitions from an error to success when retried", async () => {
    const loader = vi
      .fn<[surveyId: string], Promise<LoadedMetricData>>()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce({
        ...loadedData,
        data: { ...loadedData.data, totalResponses: 3 },
      });

    const failed = await loadWidgetMetricState(widget, loader);
    const retried = await loadWidgetMetricState(widget, loader);

    expect(failed.status).toBe("error");
    expect(retried.status).toBe("success");
  });
});

describe("WidgetMetricStateView", () => {
  it("renders a loading status", () => {
    const markup = renderToStaticMarkup(
      createElement(WidgetMetricStateView, {
        state: { status: "loading" },
        visualization: "kpi",
        onRetry: vi.fn(),
      }),
    );

    expect(markup).toContain("role=\"status\"");
    expect(markup).toContain("Carregando");
  });

  it("renders an error message and retry action", () => {
    const markup = renderToStaticMarkup(
      createElement(WidgetMetricStateView, {
        state: { status: "error", message: "Falha ao carregar." },
        visualization: "kpi",
        onRetry: vi.fn(),
      }),
    );

    expect(markup).toContain("role=\"alert\"");
    expect(markup).toContain("Falha ao carregar.");
    expect(markup).toContain("Tentar novamente");
  });

  it("renders the empty message", () => {
    const state: WidgetMetricState = {
      status: "empty",
      result: { kind: "kpi", value: 0, label: "Respostas" },
      message: "Sem respostas.",
    };
    const markup = renderToStaticMarkup(
      createElement(WidgetMetricStateView, { state, visualization: "kpi", onRetry: vi.fn() }),
    );

    expect(markup).toContain("Sem respostas.");
    expect(markup).toContain(">0<");
  });

  it("invokes the retry action", () => {
    const onRetry = vi.fn();
    const element = WidgetMetricStateView({
      state: { status: "error", message: "Falha." },
      visualization: "kpi",
      onRetry,
    });
    const children = (element.props as { children: React.ReactNode }).children as React.ReactElement[];
    const button = children.find((child) => child.type !== "p");

    expect(button).toBeDefined();
    (button!.props as { onClick: () => void }).onClick();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
