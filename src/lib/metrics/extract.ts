// Extração pura dos dados de respostas para cálculo de métricas.
// Separa "ler os dados" de "calcular". Sem React/Supabase.
// Reutilizada tanto pelo dashboard-metrics quanto pelo resolvedor de métricas do Dashboard.

import { isDynamicResponseAnswers } from "@/lib/response-utils";
import { parseStrictNumericValue } from "@/lib/metrics/metrics-engine";
import type { SurveyResponse } from "@/types/response";
import type { SurveyQuestion } from "@/types/survey-question";

export type ExtractedResponseData = {
  timestamps: string[];
  totalResponses: number;
  // Valores (dinâmicos) por question_id, preservando a ordem de chegada.
  valuesByQuestion: Map<string, Array<string | number>>;
  // Tópico (ou null) de cada question_id conhecido.
  topicByQuestion: Map<string, string | null>;
  // Rating legado (respostas sem formato dinâmico), sem tópico associado.
  legacyRatings: number[];
};

export function extractResponseData(
  responses: SurveyResponse[],
  questions: SurveyQuestion[],
): ExtractedResponseData {
  const timestamps: string[] = [];
  let totalResponses = 0;
  const valuesByQuestion = new Map<string, Array<string | number>>();
  const topicByQuestion = new Map<string, string | null>();
  const legacyRatings: number[] = [];
  const questionsById = new Map(questions.map((question) => [question.id, question]));

  for (const question of questions) {
    topicByQuestion.set(question.id, question.topic ?? null);
  }

  for (const response of responses) {
    let hasValidAnswer = false;

    if (isDynamicResponseAnswers(response.answers)) {
      for (const [questionId, value] of Object.entries(response.answers.answers)) {
        const question = questionsById.get(questionId);
        if (!question || !isValidAnswerForQuestion(value, question)) continue;

        const current = valuesByQuestion.get(questionId) ?? [];
        current.push(value);
        valuesByQuestion.set(questionId, current);
        hasValidAnswer = true;

        topicByQuestion.set(questionId, question.topic ?? null);
      }
    } else {
      const answers = response.answers;
      const rating = parseStrictNumericValue(answers.rating);
      if (rating !== null && Number.isInteger(rating) && rating >= 1 && rating <= 5) {
        legacyRatings.push(rating);
        hasValidAnswer = true;
      }
      hasValidAnswer ||= [answers.name, answers.email, answers.comment].some(isNonBlankString);
    }

    if (hasValidAnswer) {
      totalResponses += 1;
      timestamps.push(response.created_at);
    }
  }

  return {
    timestamps,
    totalResponses,
    valuesByQuestion,
    topicByQuestion,
    legacyRatings,
  };
}

function isValidAnswerForQuestion(
  value: string | number,
  question: SurveyQuestion,
): boolean {
  if (question.type === "rating") {
    const number = parseStrictNumericValue(value);
    return number !== null && Number.isInteger(number) && number >= 1 && number <= 5;
  }

  if (question.type === "rating_10") {
    const number = parseStrictNumericValue(value);
    return number !== null && Number.isInteger(number) && number >= 0 && number <= 10;
  }

  if (question.type === "number") {
    return parseStrictNumericValue(value) !== null;
  }

  if (question.type === "single_choice") {
    return typeof value === "string" && question.options.includes(value);
  }

  return isNonBlankString(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
