// Carrega dados reais (respostas + perguntas) e prepara a entrada extraída
// para o resolvedor de métricas. Usado pelo Dashboard Builder (client).

import { createClient } from "@/lib/supabase/client";
import { loadAllSurveyQuestions, loadAllSurveyResponses } from "@/lib/survey-data-pages";
import { extractResponseData, type ExtractedResponseData } from "@/lib/metrics/extract";
import type { SurveyQuestion } from "@/types/survey-question";

export type LoadedMetricData = {
  data: ExtractedResponseData;
  questions: SurveyQuestion[];
  error: string | null;
};

export async function loadMetricData(surveyId: string): Promise<LoadedMetricData> {
  const supabase = createClient();

  const [questionsResult, responsesResult] = await Promise.all([
    loadAllSurveyQuestions(supabase, surveyId, true),
    loadAllSurveyResponses(supabase, surveyId, true),
  ]);

  if (questionsResult.error) {
    return { data: emptyData(), questions: [], error: questionsResult.error };
  }

  if (responsesResult.error) {
    const questions = normalizeQuestions(questionsResult.rows);
    return { data: emptyData(), questions, error: responsesResult.error };
  }

  const questions = normalizeQuestions(questionsResult.rows);
  const responses = responsesResult.rows;
  const data = extractResponseData(responses, questions);

  return { data, questions, error: null };
}

function normalizeQuestions(rows: unknown[]): SurveyQuestion[] {
  return rows.map((row) => {
    const question = row as SurveyQuestion;
    return {
      ...question,
      options: Array.isArray(question.options)
        ? question.options.filter((option): option is string => typeof option === "string")
        : [],
      topic: question.topic ?? null,
    };
  });
}

function emptyData(): ExtractedResponseData {
  return {
    timestamps: [],
    totalResponses: 0,
    valuesByQuestion: new Map(),
    topicByQuestion: new Map(),
    legacyRatings: [],
  };
}
