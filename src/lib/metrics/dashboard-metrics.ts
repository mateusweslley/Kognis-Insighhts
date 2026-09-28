// Integração entre Supabase e o Metrics Engine.
// Toda a leitura de dados e normalização acontece aqui; o engine permanece puro.

import {
  getResponsesByCompany,
  getResponsesBySurveyId,
  getSurveyQuestionsForResponses,
} from "@/lib/responses";
import { isDynamicResponseAnswers } from "@/lib/response-utils";
import {
  computeChoiceDistribution,
  computeRatingStats,
  computeResponseVolumeOverTime,
  computeTopicMetrics,
  computeTrend,
  type TopicEntry,
} from "@/lib/metrics/metrics-engine";
import type {
  ChoiceDistribution,
  PeriodMetrics,
  RatingStats,
  TimeBucket,
  TimeSeriesPoint,
  TopicMetric,
  TrendResult,
} from "@/lib/metrics/types";
import type { SurveyResponse } from "@/types/response";
import type { SurveyQuestion } from "@/types/survey-question";

export type SurveyMetrics = {
  rating: RatingStats;
  topicMetrics: TopicMetric[];
  choices: Record<string, ChoiceDistribution>;
  volume: TimeSeriesPoint[];
  totalResponses: number;
  error: string | null;
};

export type CompanyMetrics = {
  totalResponses: number;
  avgRating: number | null;
  error: string | null;
};

type RatingPool = Array<string | number>;
type ChoicePools = Map<string, { values: Array<string | number>; options: string[] }>;
type TopicEntries = TopicEntry[];

export async function getSurveyMetrics(
  surveyId: string,
  bucket: TimeBucket = "day",
): Promise<SurveyMetrics> {
  const questionsResult = await getSurveyQuestionsForResponses(surveyId);
  if (questionsResult.error) {
    return emptySurveyMetrics(questionsResult.error);
  }

  const responsesResult = await getResponsesBySurveyId(surveyId);
  if (responsesResult.error) {
    return emptySurveyMetrics(responsesResult.error);
  }

  const questions = questionsResult.questions;
  const responses = responsesResult.responses;

  const { ratingPool, choicePools, topicEntries, timestamps } = extractPools(
    responses,
    questions,
  );

  return {
    rating: computeRatingStats(ratingPool),
    topicMetrics: computeTopicMetrics(topicEntries),
    choices: buildChoiceDistributions(choicePools),
    volume: computeResponseVolumeOverTime(timestamps, bucket),
    totalResponses: responses.length,
    error: null,
  };
}

export async function getCompanyMetrics(companyId: string): Promise<CompanyMetrics> {
  // A agregação por empresa reusa a busca de respostas existente (que já filtra por company).
  const { responses, error } = await getResponsesByCompany(companyId);

  if (error) {
    return { totalResponses: 0, avgRating: null, error };
  }

  const ratingPool: RatingPool = [];

  for (const response of responses) {
    pushLegacyRating(response, ratingPool);
  }

  const ratingStats = computeRatingStats(ratingPool);

  return {
    totalResponses: responses.length,
    avgRating: ratingStats.average,
    error: null,
  };
}

export async function getPeriodMetrics(
  surveyId: string,
  since: string | null,
  until: string | null,
): Promise<PeriodMetrics> {
  // Snapshot agregado de um período, para alimentar computeTrend.
  const result = await getSurveyMetrics(surveyId, "day");

  return {
    totalResponses: result.totalResponses,
    avgRating: result.rating.average,
  };
}

// Reexport para conveniência dos consumidores do dashboard.
export { computeTrend };

function extractPools(responses: SurveyResponse[], questions: SurveyQuestion[]) {
  const ratingPool: RatingPool = [];
  const choicePools: ChoicePools = new Map();
  const topicEntries: TopicEntries = [];
  const timestamps: string[] = [];

  const questionById = new Map(questions.map((question) => [question.id, question]));

  for (const response of responses) {
    timestamps.push(response.created_at);

    if (isDynamicResponseAnswers(response.answers)) {
      for (const [questionId, value] of Object.entries(response.answers.answers)) {
        const question = questionById.get(questionId);

        if (value === null || value === undefined || value === "") continue;

        if (question) {
          collectValue(value, question, ratingPool, choicePools, topicEntries);
        } else {
          // Perfil dinâmico sem pergunta conhecida (pergunta excluída): sem tópico, sem tipo.
          topicEntries.push({ topic: null, value });
        }
      }
    } else {
      pushLegacyRating(response, ratingPool);
      // Respostas legadas não possuem tópico; não são associadas artificialmente.
    }
  }

  return { ratingPool, choicePools, topicEntries, timestamps };
}

function collectValue(
  value: string | number,
  question: SurveyQuestion,
  ratingPool: RatingPool,
  choicePools: ChoicePools,
  topicEntries: TopicEntries,
) {
  topicEntries.push({ topic: question.topic ?? null, value });

  if (question.type === "rating") {
    ratingPool.push(value);
  }

  if (question.type === "single_choice") {
    const pool = choicePools.get(question.id) ?? { values: [], options: question.options };
    pool.values.push(value);
    choicePools.set(question.id, pool);
  }
}

function pushLegacyRating(response: SurveyResponse, ratingPool: RatingPool) {
  // Resposta legada tem `rating` numérico. Nunca é associada a tópico.
  if (isDynamicResponseAnswers(response.answers)) return;

  const rating = response.answers.rating;
  if (rating !== undefined && rating !== null) {
    ratingPool.push(rating);
  }
}

function buildChoiceDistributions(choicePools: ChoicePools): Record<string, ChoiceDistribution> {
  const result: Record<string, ChoiceDistribution> = {};

  for (const [questionId, pool] of choicePools.entries()) {
    result[questionId] = computeChoiceDistribution(pool.values, pool.options);
  }

  return result;
}

function emptySurveyMetrics(error: string | null): SurveyMetrics {
  return {
    rating: computeRatingStats([]),
    topicMetrics: [],
    choices: {},
    volume: [],
    totalResponses: 0,
    error,
  };
}
