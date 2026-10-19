import { parseStrictNumericValue } from "@/lib/metrics/metrics-engine";
import type { SurveyQuestionType } from "@/types/survey-question";

export type ConsolidatedRatingHealth =
  | "Aguardando dados"
  | "Aguardando mais respostas"
  | "Excelente"
  | "Boa"
  | "Regular"
  | "Atenção necessária";

export type ConsolidatedRatingMetrics = {
  responsesReceived: number;
  validRatingCount: number;
  positiveCount: number;
  average: number | null;
  positivePercent: number | null;
  health: ConsolidatedRatingHealth;
};

type RatingQuestion = {
  id: string;
  type: SurveyQuestionType;
};

type CalculateConsolidatedRatingMetricsInput = {
  primaryQuestionId: string | null;
  questions: readonly RatingQuestion[];
  valuesByQuestion: ReadonlyMap<string, readonly unknown[]>;
  responsesReceived: number;
};

const MIN_HEALTH_SAMPLE_SIZE = 30;

export function calculateConsolidatedRatingMetrics({
  primaryQuestionId,
  questions,
  valuesByQuestion,
  responsesReceived,
}: CalculateConsolidatedRatingMetricsInput): ConsolidatedRatingMetrics {
  const primaryQuestion = primaryQuestionId
    ? questions.find((question) => question.id === primaryQuestionId)
    : undefined;

  if (!primaryQuestion || primaryQuestion.type !== "rating") {
    return emptyMetrics(responsesReceived, "Aguardando dados");
  }

  return calculateConsolidatedRatingMetricsFromValues(
    valuesByQuestion.get(primaryQuestion.id) ?? [],
    responsesReceived,
  );
}

export function calculateConsolidatedRatingMetricsFromValues(
  values: readonly unknown[],
  responsesReceived: number,
): ConsolidatedRatingMetrics {
  const validRatings = values
    .map(parseStrictNumericValue)
    .filter(
      (value): value is number =>
        value !== null && Number.isInteger(value) && value >= 1 && value <= 5,
    );

  if (validRatings.length === 0) {
    return emptyMetrics(responsesReceived, "Aguardando mais respostas");
  }

  const sum = validRatings.reduce((total, value) => total + value, 0);
  const positiveCount = validRatings.filter((value) => value === 4 || value === 5).length;
  const average = sum / validRatings.length;

  return {
    responsesReceived,
    validRatingCount: validRatings.length,
    positiveCount,
    average,
    positivePercent: (positiveCount / validRatings.length) * 100,
    health:
      validRatings.length < MIN_HEALTH_SAMPLE_SIZE
        ? "Aguardando mais respostas"
        : classifyRatingHealth(average),
  };
}

function classifyRatingHealth(average: number): ConsolidatedRatingHealth {
  if (average >= 4.5) return "Excelente";
  if (average >= 4) return "Boa";
  if (average >= 3) return "Regular";
  return "Atenção necessária";
}

function emptyMetrics(
  responsesReceived: number,
  health: "Aguardando dados" | "Aguardando mais respostas",
): ConsolidatedRatingMetrics {
  return {
    responsesReceived,
    validRatingCount: 0,
    positiveCount: 0,
    average: null,
    positivePercent: null,
    health,
  };
}
