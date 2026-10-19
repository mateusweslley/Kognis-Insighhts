import * as React from "react";
import { Button } from "@/components/ui/button";
import { WidgetRenderer } from "@/components/dashboard/widget-renderer";
import { loadMetricData, type LoadedMetricData } from "@/lib/dashboard-metric-loader";
import { resolveMetric, type MetricResult } from "@/lib/dashboard-metric-resolver";
import type { DashboardVisualization, DashboardWidget } from "@/types/dashboard";

export type WidgetMetricState =
  | { status: "loading" }
  | { status: "success"; result: MetricResult }
  | { status: "empty"; result: MetricResult; message: string }
  | { status: "error"; message: string };

type MetricLoader = (surveyId: string) => Promise<LoadedMetricData>;

const EMPTY_MESSAGE = "Ainda não há respostas válidas para esta pesquisa.";
const LOAD_ERROR_MESSAGE =
  "Não foi possível carregar os dados deste widget. Verifique sua conexão e tente novamente.";

export async function loadWidgetMetricState(
  widget: DashboardWidget,
  loader: MetricLoader = loadMetricData,
): Promise<WidgetMetricState> {
  if (!widget.survey_id) {
    return {
      status: "empty",
      result: resolveMetric(widget, emptyData(), []),
      message: "Selecione uma pesquisa para visualizar os dados.",
    };
  }

  try {
    const loaded = await loader(widget.survey_id);
    if (loaded.error) return { status: "error", message: LOAD_ERROR_MESSAGE };

    const result = resolveMetric(widget, loaded.data, loaded.questions);
    if (loaded.data.totalResponses === 0) {
      return { status: "empty", result, message: EMPTY_MESSAGE };
    }

    return { status: "success", result };
  } catch {
    return { status: "error", message: LOAD_ERROR_MESSAGE };
  }
}

export function WidgetMetricStateView({
  state,
  visualization,
  onRetry,
}: {
  state: WidgetMetricState;
  visualization: DashboardVisualization;
  onRetry: () => void;
}) {
  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        Carregando…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div role="alert" className="space-y-3">
        <p className="text-sm text-danger">{state.message}</p>
        <Button type="button" variant="secondary" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div>
      {state.status === "empty" ? (
        <p className="mb-3 text-sm text-muted-foreground">{state.message}</p>
      ) : null}
      <WidgetRenderer metric={state.result} visualization={visualization} />
    </div>
  );
}

function emptyData() {
  return {
    timestamps: [],
    totalResponses: 0,
    valuesByQuestion: new Map<string, Array<string | number>>(),
    topicByQuestion: new Map<string, string | null>(),
    legacyRatings: [],
  };
}
