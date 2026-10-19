import { createClient } from "@/lib/supabase/client";
import type { SurveyResponse } from "@/types/response";
import type { Survey } from "@/types/survey";
import type { SurveyQuestion } from "@/types/survey-question";

const MAX_DASHBOARD_PERIOD_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 500;
const SURVEY_ID_BATCH_SIZE = 100;

export type DashboardKpiSourceData = {
  asOf: string;
  surveys: Array<Pick<Survey, "id" | "status">>;
  primaryQuestionIdBySurvey: ReadonlyMap<string, string | null>;
  datasets: Array<{
    surveyId: string;
    questions: SurveyQuestion[];
    responses: SurveyResponse[];
  }>;
  responsesError: boolean;
  questionsError: boolean;
  primaryQuestionConfigError: boolean;
};

type PageResult = {
  rows: unknown[];
  error: string | null;
};

/**
 * Loads only the authenticated company's survey IDs and the response window
 * needed by the KPI engine (90 current days + 90 previous days).
 */
export async function loadDashboardKpiSourceData(
  surveys: Survey[],
  reference: Date = new Date(),
): Promise<DashboardKpiSourceData> {
  const asOf = reference.toISOString();
  const ids = surveys.map((survey) => survey.id);
  const primaryQuestionIdBySurvey = new Map<string, string | null>();
  const datasetsBySurvey = new Map<string, {
    surveyId: string;
    questions: SurveyQuestion[];
    responses: SurveyResponse[];
  }>();
  for (const survey of surveys) {
    datasetsBySurvey.set(survey.id, { surveyId: survey.id, questions: [], responses: [] });
  }

  const primaryQuestionConfigError = surveys.some(
    (survey) => !Object.prototype.hasOwnProperty.call(survey, "primary_question_id"),
  );
  for (const survey of surveys) {
    if (!primaryQuestionConfigError) {
      primaryQuestionIdBySurvey.set(survey.id, survey.primary_question_id ?? null);
    }
  }

  if (ids.length === 0) {
    return {
      asOf,
      surveys: surveys.map(({ id, status }) => ({ id, status })),
      primaryQuestionIdBySurvey,
      datasets: [],
      responsesError: false,
      questionsError: false,
      primaryQuestionConfigError,
    };
  }

  const supabase = createClient();
  const earliest = new Date(reference.getTime() - 2 * MAX_DASHBOARD_PERIOD_DAYS * DAY_MS).toISOString();
  const allowedSurveyIds = new Set(ids);
  const chunks = chunk(ids, SURVEY_ID_BATCH_SIZE);

  const [questionPages, responsePages] = await Promise.all([
    Promise.all(chunks.map((surveyIds) => fetchQuestionPages(supabase, surveyIds))),
    Promise.all(chunks.map((surveyIds) => fetchResponsePages(supabase, surveyIds, earliest, asOf))),
  ]);

  const questionsError = questionPages.some((page) => page.error !== null);
  const responsesError = responsePages.some((page) => page.error !== null);

  for (const page of questionPages) {
    for (const row of page.rows) {
      const question = normalizeQuestion(row);
      if (!allowedSurveyIds.has(question.survey_id)) continue;
      datasetsBySurvey.get(question.survey_id)?.questions.push(question);
    }
  }

  for (const page of responsePages) {
    for (const row of page.rows) {
      const response = row as SurveyResponse;
      if (!allowedSurveyIds.has(response.survey_id)) continue;
      datasetsBySurvey.get(response.survey_id)?.responses.push(response);
    }
  }

  return {
    asOf,
    surveys: surveys.map(({ id, status }) => ({ id, status })),
    primaryQuestionIdBySurvey,
    datasets: Array.from(datasetsBySurvey.values()),
    responsesError,
    questionsError,
    primaryQuestionConfigError,
  };
}

async function fetchQuestionPages(supabase: ReturnType<typeof createClient>, surveyIds: string[]): Promise<PageResult> {
  return fetchAllPages(async (from, to) => {
    const { data, error, count } = await supabase
      .from("survey_questions")
      .select("id,survey_id,type,title,description,required,position,options,created_at,updated_at,topic", { count: "exact" })
      .in("survey_id", surveyIds)
      .order("survey_id", { ascending: true })
      .order("position", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);

    return { data, error, count };
  }, "questions");
}

async function fetchResponsePages(
  supabase: ReturnType<typeof createClient>,
  surveyIds: string[],
  earliest: string,
  asOf: string,
): Promise<PageResult> {
  return fetchAllPages(async (from, to) => {
    const { data, error, count } = await supabase
      .from("responses")
      .select("id,survey_id,answers,created_at", { count: "exact" })
      .in("survey_id", surveyIds)
      .gte("created_at", earliest)
      .lt("created_at", asOf)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);

    return { data, error, count };
  }, "responses");
}

async function fetchAllPages(
  fetchPage: (from: number, to: number) => Promise<{
    data: unknown[] | null;
    error: { message: string } | null;
    count: number | null;
  }>,
  kind: "questions" | "responses",
): Promise<PageResult> {
  const rows: unknown[] = [];
  let offset = 0;
  let expectedCount: number | null = null;

  while (expectedCount === null || rows.length < expectedCount) {
    const { data, error, count } = await fetchPage(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.error(`Erro ao carregar ${kind} dos KPIs:`, error);
      return { rows, error: error.message };
    }

    if (count === null) {
      return { rows, error: `Não foi possível confirmar a quantidade completa de ${kind}.` };
    }
    if (expectedCount === null) expectedCount = count;

    const page = data ?? [];
    rows.push(...page);
    if (rows.length >= expectedCount) break;
    if (page.length === 0) {
      return { rows, error: `A consulta de ${kind} terminou antes de carregar todos os registros.` };
    }
    offset += page.length;
  }

  return { rows, error: null };
}

function normalizeQuestion(row: unknown): SurveyQuestion {
  const question = row as SurveyQuestion;
  return {
    ...question,
    options: Array.isArray(question.options)
      ? question.options.filter((option): option is string => typeof option === "string")
      : [],
    topic: question.topic ?? null,
  };
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}
