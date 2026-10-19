// Resolve uma métrica de widget para um resultado pronto para renderização.
// Camada pura: recebe dados já extraídos e usa somente o Metrics Engine.

import {
  computeChoiceDistribution,
  computeNps,
  computeNumericStats,
  computeRatingStats,
  computeResponseVolumeOverTime,
  computeTopicMetrics,
  type TopicEntry,
} from "@/lib/metrics/metrics-engine";
import type { ExtractedResponseData } from "@/lib/metrics/extract";
import type { DashboardMetric, DashboardWidget } from "@/types/dashboard";
import type { SurveyQuestion } from "@/types/survey-question";

export type MetricResult =
  | { kind: "kpi"; value: number | null; label: string }
  | {
      kind: "distribution";
      labels: string[];
      values: number[];
      percentages?: number[];
      total?: number;
      emptyMessage?: string;
    }
  | { kind: "trend"; points: Array<{ period: string; value: number }> }
  | { kind: "topics"; items: Array<{ topic: string | null; count: number; avgRating: number | null }> };

// Resolve a métrica de um widget a partir dos dados extraídos e das perguntas.
export function resolveMetric(
  widget: DashboardWidget,
  data: ExtractedResponseData,
  questions: SurveyQuestion[],
): MetricResult {
  switch (widget.metric) {
    case "response_count":
      return { kind: "kpi", value: data.totalResponses, label: widget.title };

    case "average":
      return resolveAverage(widget, data, questions);

    case "distribution":
      return resolveDistribution(widget, data, questions);

    case "trend":
      return {
        kind: "trend",
        points: computeResponseVolumeOverTime(data.timestamps, "day"),
      };

    case "top_topics":
      return resolveTopics(data, questions);

    case "nps":
      return resolveNps(widget, data, questions);

    default:
      return { kind: "kpi", value: null, label: widget.title };
  }
}

function resolveAverage(
  widget: DashboardWidget,
  data: ExtractedResponseData,
  questions: SurveyQuestion[],
): MetricResult {
  if (widget.question_id) {
    const question = questions.find((q) => q.id === widget.question_id);
    const values = data.valuesByQuestion.get(widget.question_id) ?? [];

    if (question?.type === "rating") {
      const stats = computeRatingStats(values);
      return { kind: "kpi", value: stats.average, label: widget.title };
    }

    if (question?.type === "number" || question?.type === "rating_10") {
      const stats = computeNumericStats(values);
      return { kind: "kpi", value: stats.average, label: widget.title };
    }
  }

  // Sem pergunta específica: média dos ratings legados.
  const stats = computeRatingStats(data.legacyRatings);
  return { kind: "kpi", value: stats.average, label: widget.title };
}

function resolveDistribution(
  widget: DashboardWidget,
  data: ExtractedResponseData,
  questions: SurveyQuestion[],
): MetricResult {
  const question = widget.question_id
    ? questions.find((q) => q.id === widget.question_id)
    : undefined;

  if (question?.type === "single_choice") {
    const values = data.valuesByQuestion.get(question.id) ?? [];
    const dist = computeChoiceDistribution(values, question.options);
    return {
      kind: "distribution",
      labels: dist.buckets.map((b) => b.value),
      values: dist.buckets.map((b) => b.count),
      percentages: dist.buckets.map((b) => b.pct),
      total: dist.total,
      emptyMessage: "Ainda não há respostas para esta pergunta",
    };
  }

  if (question?.type === "rating" || question?.type === "rating_10") {
    const values = data.valuesByQuestion.get(question.id) ?? [];

    // Distribuição de rating usa a faixa própria do tipo.
    const min = question.type === "rating" ? 1 : 0;
    const max = question.type === "rating" ? 5 : 10;
    const labels: string[] = [];
    const counts: number[] = [];

    for (let value = min; value <= max; value += 1) {
      labels.push(String(value));
      counts.push(0);
    }

    for (const raw of values) {
      const number = typeof raw === "number" ? raw : Number(raw);
      if (Number.isInteger(number) && number >= min && number <= max) {
        counts[number - min] += 1;
      }
    }

    return { kind: "distribution", labels, values: counts };
  }

  // Sem pergunta elegível: retorna vazio.
  return { kind: "distribution", labels: [], values: [] };
}

function resolveTopics(
  data: ExtractedResponseData,
  questions: SurveyQuestion[],
): MetricResult {
  const entries: TopicEntry[] = [];

  for (const question of questions) {
    const values = data.valuesByQuestion.get(question.id) ?? [];
    const topic = question.topic ?? null;

    for (const value of values) {
      entries.push({ topic, value });
    }
  }

  const metrics = computeTopicMetrics(entries);

  return {
    kind: "topics",
    items: metrics.map((metric) => ({
      topic: metric.topic,
      count: metric.count,
      avgRating: metric.avgRating,
    })),
  };
}

// Resolve NPS com identificação determinística da pergunta 0–10:
// - usa o `question_id` do widget se ele for do tipo `rating_10`;
// - senão, exige exatamente uma pergunta `rating_10` na pesquisa.
// Múltiplas perguntas compatíveis ou ausência delas → NPS indisponível (null).
function resolveNps(
  widget: DashboardWidget,
  data: ExtractedResponseData,
  questions: SurveyQuestion[],
): MetricResult {
  let questionId: string | null = null;

  if (widget.question_id) {
    const target = questions.find((q) => q.id === widget.question_id);
    if (target?.type === "rating_10") {
      questionId = target.id;
    }
  } else {
    const rating10 = questions.filter((q) => q.type === "rating_10");
    if (rating10.length === 1) {
      questionId = rating10[0].id;
    }
  }

  if (!questionId) {
    return { kind: "kpi", value: null, label: widget.title };
  }

  const values = data.valuesByQuestion.get(questionId) ?? [];
  const stats = computeNps(values);

  return { kind: "kpi", value: stats.score, label: widget.title };
}
