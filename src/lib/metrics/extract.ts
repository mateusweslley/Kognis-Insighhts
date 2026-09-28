// Extração pura dos dados de respostas para cálculo de métricas.
// Separa "ler os dados" de "calcular". Sem React/Supabase.
// Reutilizada tanto pelo dashboard-metrics quanto pelo resolvedor de métricas do Dashboard.

import { isDynamicResponseAnswers } from "@/lib/response-utils";
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
  const valuesByQuestion = new Map<string, Array<string | number>>();
  const topicByQuestion = new Map<string, string | null>();
  const legacyRatings: number[] = [];

  for (const question of questions) {
    topicByQuestion.set(question.id, question.topic ?? null);
  }

  for (const response of responses) {
    timestamps.push(response.created_at);

    if (isDynamicResponseAnswers(response.answers)) {
      for (const [questionId, value] of Object.entries(response.answers.answers)) {
        if (value === null || value === undefined || value === "") continue;

        const current = valuesByQuestion.get(questionId) ?? [];
        current.push(value);
        valuesByQuestion.set(questionId, current);

        // Pergunta excluída (não está mais em `questions`) fica sem tópico mapeado.
        if (!topicByQuestion.has(questionId)) {
          topicByQuestion.set(questionId, null);
        }
      }
    } else {
      const rating = response.answers.rating;
      if (rating !== undefined && rating !== null) {
        legacyRatings.push(rating);
      }
    }
  }

  return {
    timestamps,
    totalResponses: responses.length,
    valuesByQuestion,
    topicByQuestion,
    legacyRatings,
  };
}
