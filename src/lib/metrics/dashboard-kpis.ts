// Camada pura para os KPIs consolidados. A entrada já deve estar limitada à
// empresa autenticada; este módulo não consulta Supabase nem importa UI.
import { extractResponseData } from "@/lib/metrics/extract";
import {
  calculateConsolidatedRatingMetricsFromValues,
  type ConsolidatedRatingHealth,
} from "@/lib/metrics/consolidated-metrics";
import type { SurveyResponse } from "@/types/response";
import type { SurveyQuestion } from "@/types/survey-question";
import type { SurveyStatus } from "@/types/survey";

export type DashboardPeriodDays = 7 | 30 | 90;

export type DashboardKpiValue =
  | { status: "value"; value: number }
  | {
      status: "no_data";
      reason:
        | "no_primary_question_configured"
        | "no_compatible_primary_question"
        | "no_valid_ratings";
    }
  | { status: "error" };

export type DashboardKpiComparison =
  | { status: "value"; deltaAbsolute: number; deltaPercent: number | null }
  | { status: "no_data" }
  | { status: "error" };

export type DashboardPeriodKpis = {
  start: string;
  end: string;
  responsesReceived: DashboardKpiValue;
  averageRating: DashboardKpiValue;
  positivePercent: DashboardKpiValue;
  validRatingCount: number | null;
  health: DashboardHealthState;
};

export type DashboardHealthState =
  | { status: "error" }
  | { status: "no_data"; label: "Aguardando dados" }
  | { status: "insufficient_sample"; label: "Aguardando mais respostas"; sampleSize: number }
  | { status: "classified"; label: Exclude<ConsolidatedRatingHealth, "Aguardando dados" | "Aguardando mais respostas">; sampleSize: number };

export type DashboardKpisInput = {
  periodDays: DashboardPeriodDays;
  /** Instante único de referência, em formato aceito por Date. Todos os limites são UTC. */
  asOf: string | Date;
  surveys: Array<{ id: string; status: SurveyStatus }>;
  /** Só informe IDs selecionados explicitamente como principais pelo produto. */
  primaryQuestionIdBySurvey: ReadonlyMap<string, string | null>;
  datasets: Array<{
    surveyId: string;
    questions: SurveyQuestion[];
    responses: SurveyResponse[];
  }>;
  responsesError?: boolean;
  questionsError?: boolean;
  surveysError?: boolean;
  primaryQuestionConfigError?: boolean;
};

export type DashboardKpis = {
  current: DashboardPeriodKpis;
  previous: DashboardPeriodKpis;
  comparisons: {
    responsesReceived: DashboardKpiComparison;
    averageRating: DashboardKpiComparison;
    positivePercent: DashboardKpiComparison;
  };
  activeSurveys: DashboardKpiValue;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function calculateDashboardKpis(input: DashboardKpisInput): DashboardKpis {
  const reference = input.asOf instanceof Date ? new Date(input.asOf) : new Date(input.asOf);
  if (Number.isNaN(reference.getTime())) {
    throw new RangeError("asOf must be a valid date");
  }

  const end = reference.getTime();
  const duration = input.periodDays * DAY_MS;
  const current = calculatePeriod(input, end - duration, end);
  const previous = calculatePeriod(input, end - 2 * duration, end - duration);

  return {
    current,
    previous,
    comparisons: {
      responsesReceived: compareDashboardKpi(current.responsesReceived, previous.responsesReceived),
      averageRating: compareDashboardKpi(current.averageRating, previous.averageRating),
      positivePercent: compareDashboardKpi(current.positivePercent, previous.positivePercent),
    },
    activeSurveys: input.surveysError
      ? { status: "error" }
      : { status: "value", value: input.surveys.filter((survey) => survey.status === "active").length },
  };
}

export function compareDashboardKpi(
  current: DashboardKpiValue,
  previous: DashboardKpiValue,
): DashboardKpiComparison {
  if (current.status === "error" || previous.status === "error") return { status: "error" };
  if (current.status !== "value" || previous.status !== "value") return { status: "no_data" };

  const deltaAbsolute = current.value - previous.value;
  return {
    status: "value",
    deltaAbsolute,
    deltaPercent: previous.value === 0 ? null : (deltaAbsolute / previous.value) * 100,
  };
}

function calculatePeriod(
  input: DashboardKpisInput,
  startMs: number,
  endMs: number,
): DashboardPeriodKpis {
  const start = new Date(startMs).toISOString();
  const end = new Date(endMs).toISOString();

  if (input.responsesError || input.questionsError || input.surveysError) {
    return {
      start,
      end,
      responsesReceived: { status: "error" },
      averageRating: { status: "error" },
      positivePercent: { status: "error" },
      validRatingCount: null,
      health: { status: "error" },
    };
  }

  // PK da resposta evita contagem duplicada quando a mesma linha aparece em
  // mais de um resultado local. A regra de validade continua em extract.ts.
  const uniqueDatasets = new Map<string, DashboardKpisInput["datasets"][number]>();
  for (const dataset of input.datasets) {
    if (!uniqueDatasets.has(dataset.surveyId)) uniqueDatasets.set(dataset.surveyId, dataset);
  }
  const uniqueResponses = new Map<string, SurveyResponse>();
  for (const dataset of uniqueDatasets.values()) {
    for (const response of dataset.responses) {
      if (!uniqueResponses.has(response.id)) uniqueResponses.set(response.id, response);
    }
  }

  const responsesBySurvey = new Map<string, SurveyResponse[]>();
  for (const response of uniqueResponses.values()) {
    const timestamp = new Date(response.created_at).getTime();
    if (Number.isNaN(timestamp) || timestamp < startMs || timestamp >= endMs) continue;
    const current = responsesBySurvey.get(response.survey_id) ?? [];
    current.push(response);
    responsesBySurvey.set(response.survey_id, current);
  }

  let responsesReceived = 0;
  const hasConfiguredPrimary = input.surveys.some((survey) =>
    Boolean(input.primaryQuestionIdBySurvey.get(survey.id)),
  );
  let hasCompatiblePrimary = false;
  const ratingValues: unknown[] = [];

  for (const dataset of uniqueDatasets.values()) {
    const extracted = extractResponseData(
      responsesBySurvey.get(dataset.surveyId) ?? [],
      dataset.questions,
    );
    responsesReceived += extracted.totalResponses;

    const primaryQuestionId = input.primaryQuestionIdBySurvey.get(dataset.surveyId);
    if (!primaryQuestionId) continue;
    const primaryQuestion = dataset.questions.find((question) => question.id === primaryQuestionId);
    if (primaryQuestion?.survey_id !== dataset.surveyId || primaryQuestion.type !== "rating") continue;
    hasCompatiblePrimary = true;
    ratingValues.push(...(extracted.valuesByQuestion.get(primaryQuestionId) ?? []));
  }

  const responseMetric: DashboardKpiValue = { status: "value", value: responsesReceived };
  if (input.primaryQuestionConfigError) {
    return {
      start,
      end,
      responsesReceived: responseMetric,
      averageRating: { status: "error" },
      positivePercent: { status: "error" },
      validRatingCount: null,
      health: { status: "error" },
    };
  }

  if (!hasCompatiblePrimary) {
    const reason = hasConfiguredPrimary
      ? "no_compatible_primary_question"
      : "no_primary_question_configured";
    return {
      start,
      end,
      responsesReceived: responseMetric,
      averageRating: { status: "no_data", reason },
      positivePercent: { status: "no_data", reason },
      validRatingCount: null,
      health: { status: "no_data", label: "Aguardando dados" },
    };
  }

  const ratingMetrics = calculateConsolidatedRatingMetricsFromValues(ratingValues, responsesReceived);
  if (ratingMetrics.validRatingCount === 0) {
    return {
      start,
      end,
      responsesReceived: responseMetric,
      averageRating: { status: "no_data", reason: "no_valid_ratings" },
      positivePercent: { status: "no_data", reason: "no_valid_ratings" },
      validRatingCount: 0,
      health: { status: "insufficient_sample", label: "Aguardando mais respostas", sampleSize: 0 },
    };
  }

  const health: DashboardHealthState =
    ratingMetrics.health === "Aguardando mais respostas"
      ? {
          status: "insufficient_sample",
          label: "Aguardando mais respostas",
          sampleSize: ratingMetrics.validRatingCount,
        }
      : {
          status: "classified",
          label: ratingMetrics.health as Exclude<
            ConsolidatedRatingHealth,
            "Aguardando dados" | "Aguardando mais respostas"
          >,
          sampleSize: ratingMetrics.validRatingCount,
        };

  return {
    start,
    end,
    responsesReceived: responseMetric,
    averageRating: { status: "value", value: ratingMetrics.average! },
    positivePercent: { status: "value", value: ratingMetrics.positivePercent! },
    validRatingCount: ratingMetrics.validRatingCount,
    health,
  };
}
