// Integração entre Supabase e o Metrics Engine.
// Toda a leitura de dados e normalização acontece aqui; o engine permanece puro.

import {
  getResponsesByCompany,
  getResponsesBySurveyId,
  getSurveyQuestionsForResponses,
  getSurveySatisfactionConfig,
} from "@/lib/responses";
import { isDynamicResponseAnswers } from "@/lib/response-utils";
import {
  classifyNps,
  computeChoiceDistribution,
  computeNps,
  computeRatingStats,
  computeResponseVolumeOverTime,
  computeTopicMetrics,
  computeTrend,
  type TopicEntry,
} from "@/lib/metrics/metrics-engine";
import type {
  ChoiceDistribution,
  NpsClassification,
  NpsStats,
  PeriodMetrics,
  RatingStats,
  TimeBucket,
  TimeSeriesPoint,
  TopicMetric,
  TrendResult,
} from "@/lib/metrics/types";
import type { SurveyResponse } from "@/types/response";
import type { SurveyQuestion } from "@/types/survey-question";
import { extractResponseData, type ExtractedResponseData } from "@/lib/metrics/extract";
import { calculateConsolidatedRatingMetricsFromValues } from "@/lib/metrics/consolidated-metrics";

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

// Disponibilidade do NPS em uma pesquisa. Não confundir "sem dados" com "sem pergunta".
export type NpsAvailability =
  | "available"
  | "ambiguous"
  | "no_question"
  | "no_data";

export type SurveyNps = {
  availability: NpsAvailability;
  stats: NpsStats;
  classification: NpsClassification | null;
};

export type SurveyInsight = {
  totalResponses: number;
  avgRating: number | null;
  nps: SurveyNps;
  error: string | null;
};

// Identifica de forma determinística qual pergunta (0–10) alimenta o NPS.
//
// - 0 perguntas `rating_10`  -> no_question
// - exatamente 1             -> available (usa essa pergunta)
// - 2 ou mais                -> ambiguous (não escolhe arbitrariamente)
export function identifyNpsQuestion(
  questions: SurveyQuestion[],
): { availability: NpsAvailability; questionId: string | null } {
  const rating10 = questions.filter((question) => question.type === "rating_10");

  if (rating10.length === 0) {
    return { availability: "no_question", questionId: null };
  }

  if (rating10.length > 1) {
    return { availability: "ambiguous", questionId: null };
  }

  return { availability: "available", questionId: rating10[0].id };
}

// Extrai os valores 0–10 de uma pergunta `rating_10` a partir dos dados já
// extraídos, reutilizando a infraestrutura de extração existente.
export function extractNpsValues(
  data: ExtractedResponseData,
  questionId: string | null,
): Array<string | number> {
  if (!questionId) return [];
  return data.valuesByQuestion.get(questionId) ?? [];
}

// Insight unificado para o dashboard MVP: respostas, satisfação e NPS.
export async function getSurveyInsight(surveyId: string): Promise<SurveyInsight> {
  const [questionsResult, responsesResult, config] = await Promise.all([
    getSurveyQuestionsForResponses(surveyId), getResponsesBySurveyId(surveyId),
    getSurveySatisfactionConfig(surveyId),
  ]);
  return calculateSurveyInsight({
    questions: questionsResult.questions,
    responses: responsesResult.responses,
    error: questionsResult.error ?? responsesResult.error ?? config.error,
    surveyId,
    primaryQuestionId: config.primaryQuestionId,
  });
}

/** Reuse the same complete source for the list, insight and CSV. */
export function calculateSurveyInsight({ questions, responses, error, surveyId, primaryQuestionId = null }: {
  questions: SurveyQuestion[];
  responses: SurveyResponse[];
  error: string | null;
  surveyId?: string;
  primaryQuestionId?: string | null;
}): SurveyInsight {
  if (error) return emptySurveyInsight(error);
  if (surveyId && (questions.some((question) => question.survey_id !== surveyId)
      || responses.some((response) => response.survey_id !== surveyId))) {
    return emptySurveyInsight("INCOMPLETE_SURVEY_DATA: Dados fora da pesquisa.");
  }
  const primaryQuestion = primaryQuestionId
    ? questions.find((question) => question.id === primaryQuestionId) : undefined;
  if (primaryQuestionId !== null && (!surveyId || !primaryQuestion || primaryQuestion.type !== "rating")) {
    return emptySurveyInsight("Não foi possível interpretar a configuração de satisfação da pesquisa.");
  }
  const data = extractResponseData(responses, questions);

  // Explicit primary 1–5 rating only, as in consolidated KPIs. Legacy rows
  // contribute separately; extraction never reads their value from dynamic rows.
  // Denominator: valid evaluations, at most one per response. No scale conversion.
  const satisfaction = calculateConsolidatedRatingMetricsFromValues([
    ...data.legacyRatings,
    ...(primaryQuestion ? data.valuesByQuestion.get(primaryQuestion.id) ?? [] : []),
  ], data.totalResponses);

  const identification = identifyNpsQuestion(questions);
  const { availability, questionId } = identification;

  let stats: NpsStats = { count: 0, promoters: 0, passives: 0, detractors: 0, score: null };
  if (availability === "available") {
    stats = computeNps(extractNpsValues(data, questionId));
  } else if (availability === "ambiguous") {
    stats = { count: 0, promoters: 0, passives: 0, detractors: 0, score: null };
  }

  // Se há pergunta compatível mas zero respostas válidas, o estado é "no_data".
  const resolvedAvailability: NpsAvailability =
    availability === "available" && stats.count === 0 ? "no_data" : availability;

  return {
    totalResponses: data.totalResponses,
    avgRating: satisfaction.average,
    nps: {
      availability: resolvedAvailability,
      stats,
      classification: classifyNps(stats.score),
    },
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

function emptySurveyInsight(error: string | null): SurveyInsight {
  return {
    totalResponses: 0,
    avgRating: null,
    nps: {
      availability: "no_data",
      stats: { count: 0, promoters: 0, passives: 0, detractors: 0, score: null },
      classification: null,
    },
    error,
  };
}
