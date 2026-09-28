// Carrega dados reais (respostas + perguntas) e prepara a entrada extraída
// para o resolvedor de métricas. Usado pelo Dashboard Builder (client).

import { createClient } from "@/lib/supabase/client";
import { extractResponseData, type ExtractedResponseData } from "@/lib/metrics/extract";
import type { SurveyResponse } from "@/types/response";
import type { SurveyQuestion } from "@/types/survey-question";

export type LoadedMetricData = {
  data: ExtractedResponseData;
  questions: SurveyQuestion[];
  error: string | null;
};

export async function loadMetricData(surveyId: string): Promise<LoadedMetricData> {
  const supabase = createClient();

  const [questionsResult, responsesResult] = await Promise.all([
    supabase
      .from("survey_questions")
      .select("id,survey_id,type,title,description,required,position,options,created_at,updated_at,topic")
      .eq("survey_id", surveyId)
      .order("position", { ascending: true }),
    supabase
      .from("responses")
      .select("id,survey_id,answers,created_at")
      .eq("survey_id", surveyId)
      .order("created_at", { ascending: true }),
  ]);

  if (questionsResult.error) {
    return { data: emptyData(), questions: [], error: questionsResult.error.message };
  }

  if (responsesResult.error) {
    const questions = normalizeQuestions(questionsResult.data ?? []);
    return { data: emptyData(), questions, error: responsesResult.error.message };
  }

  const questions = normalizeQuestions(questionsResult.data ?? []);
  const responses = (responsesResult.data ?? []) as SurveyResponse[];
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
