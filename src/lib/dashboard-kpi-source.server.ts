import type { DashboardKpisInput, DashboardPeriodDays } from "@/lib/metrics/dashboard-kpis";
import { requireCurrentCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import type { SurveyResponse } from "@/types/response";
import type { Survey } from "@/types/survey";
import type { SurveyQuestion } from "@/types/survey-question";

const PAGE_SIZE = 500;
const SURVEY_ID_BATCH_SIZE = 100;
const MAX_PERIOD_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SourceRead<T> =
  | { status: "success"; data: T }
  | { status: "error"; message: string };

type SourceSurvey = Pick<Survey, "id" | "status"> & {
  primary_question_id?: string | null;
};

export type DashboardKpiSourceData = {
  asOf: string;
  company: SourceRead<{ id: string }>;
  surveys: SourceRead<SourceSurvey[]>;
  questions: SourceRead<SurveyQuestion[]>;
  responses: SourceRead<SurveyResponse[]>;
  primaryQuestionConfiguration: SourceRead<ReadonlyMap<string, string | null>>;
};

type PageResult = {
  rows: unknown[];
  error: string | null;
  errorCode?: string;
};

type PageCursor = string | { created_at: string; id: string };

/**
 * Server-side source loader. Authentication and company ownership come from
 * the existing server flow; only the authenticated company's survey IDs are
 * used for question and response reads.
 */
export async function loadCurrentDashboardKpiSourceData(
  reference: Date = new Date(),
): Promise<DashboardKpiSourceData> {
  if (Number.isNaN(reference.getTime())) throw new RangeError("reference must be a valid date");

  const asOf = reference.toISOString();
  let company: { id: string };

  try {
    company = await requireCurrentCompany();
  } catch (error) {
    // Keep Next.js login/onboarding redirects intact. Only convert the known
    // company query failure into a source state.
    if (!(error instanceof Error) || error.message !== "Nao foi possivel carregar os dados da empresa.") {
      throw error;
    }
    const message = error.message;
    return {
      asOf,
      company: { status: "error", message },
      surveys: { status: "error", message: "Pesquisas não consultadas: empresa indisponível." },
      questions: { status: "error", message: "Perguntas não consultadas: empresa indisponível." },
      responses: { status: "error", message: "Respostas não consultadas: empresa indisponível." },
      primaryQuestionConfiguration: { status: "error", message: "Configuração indisponível: empresa não carregada." },
    };
  }

  const companyState = { status: "success", data: { id: company.id } } as const;
  const supabase = createClient();
  let surveyResult = await fetchSurveyPages(supabase, company.id, true);
  let primaryColumnError: string | null = null;
  if (surveyResult.error && isMissingPrimaryQuestionColumn({
    message: surveyResult.error,
    code: surveyResult.errorCode,
  })) {
    primaryColumnError = "A coluna primary_question_id não está disponível. Verifique se a migration 014 foi aplicada neste ambiente.";
    surveyResult = await fetchSurveyPages(supabase, company.id, false);
  }
  if (surveyResult.error) {
    return surveyReadFailure(
      asOf,
      companyState,
      surveyResult.error,
      primaryColumnError ?? surveyResult.error,
    );
  }
  const rawSurveys = surveyResult.rows as Array<Record<string, unknown>>;

  const sourceSurveys: SourceSurvey[] = rawSurveys.map((survey) => ({
    id: String(survey.id),
    status: survey.status as Survey["status"],
    ...(Object.prototype.hasOwnProperty.call(survey, "primary_question_id")
      ? { primary_question_id: survey.primary_question_id as string | null }
      : {}),
  }));
  const surveysState = { status: "success", data: sourceSurveys } as const;
  const configuredColumnMissing = primaryColumnError !== null || sourceSurveys.some(
    (survey) => !Object.prototype.hasOwnProperty.call(survey, "primary_question_id"),
  );
  const primaryQuestionIdBySurvey = new Map<string, string | null>();
  for (const survey of sourceSurveys) {
    if (Object.prototype.hasOwnProperty.call(survey, "primary_question_id")) {
      primaryQuestionIdBySurvey.set(survey.id, survey.primary_question_id ?? null);
    }
  }

  if (sourceSurveys.length === 0) {
    return {
      asOf,
      company: companyState,
      surveys: surveysState,
      questions: { status: "success", data: [] },
      responses: { status: "success", data: [] },
      primaryQuestionConfiguration: configuredColumnMissing
        ? { status: "error", message: "A coluna primary_question_id não está disponível; verifique a migration 014." }
        : { status: "success", data: primaryQuestionIdBySurvey },
    };
  }

  const ids = sourceSurveys.map(({ id }) => id);
  const chunks = chunk(ids, SURVEY_ID_BATCH_SIZE);
  const earliest = new Date(reference.getTime() - 2 * MAX_PERIOD_DAYS * DAY_MS).toISOString();

  const [questionResults, responseResults] = await Promise.all([
    Promise.all(chunks.map((surveyIds) => fetchQuestionPages(supabase, surveyIds))),
    Promise.all(chunks.map((surveyIds) => fetchResponsePages(supabase, surveyIds, earliest, asOf))),
  ]);

  const questionFailure = questionResults.find((result) => result.error !== null);
  const responseFailure = responseResults.find((result) => result.error !== null);
  const questions = questionFailure
    ? { status: "error" as const, message: questionFailure.error! }
    : {
        status: "success" as const,
        data: questionResults.flatMap((result) => result.rows.map(normalizeQuestion)),
      };
  const responses = responseFailure
    ? { status: "error" as const, message: responseFailure.error! }
    : { status: "success" as const, data: responseResults.flatMap((result) => result.rows as SurveyResponse[]) };

  let configurationState: DashboardKpiSourceData["primaryQuestionConfiguration"] = configuredColumnMissing
    ? { status: "error", message: primaryColumnError ?? "A coluna primary_question_id não está disponível; verifique a migration 014." }
    : { status: "success", data: primaryQuestionIdBySurvey };

  if (!configuredColumnMissing && questions.status === "success") {
    for (const survey of sourceSurveys) {
      const questionId = survey.primary_question_id;
      if (!questionId) continue;
      const question = questions.data.find((item) => item.id === questionId);
      if (!question || question.survey_id !== survey.id || question.type !== "rating") {
        configurationState = {
          status: "error",
          message: `A pergunta principal configurada para a pesquisa ${survey.id} está ausente ou incompatível.`,
        };
        break;
      }
    }
  }

  return {
    asOf,
    company: companyState,
    surveys: surveysState,
    questions,
    responses,
    primaryQuestionConfiguration: configurationState,
  };
}

function isMissingPrimaryQuestionColumn(error: { message: string; code?: string }): boolean {
  return error.code === "42703" || error.message.toLowerCase().includes("primary_question_id");
}

async function fetchSurveyPages(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  includePrimaryQuestion: boolean,
): Promise<PageResult> {
  return fetchAllPages(async (cursor, pageSize) => {
    let query = supabase
      .from("surveys")
      .select(includePrimaryQuestion ? "id,status,primary_question_id" : "id,status", { count: "exact" })
      .eq("company_id", companyId)
      .order("id", { ascending: true });
    if (typeof cursor === "string") query = query.gt("id", cursor);
    const { data, error, count } = await query.limit(pageSize);
    return { data, error, count };
  }, (row) => {
    const id = (row as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }, "pesquisas");
}

function surveyReadFailure(
  asOf: string,
  company: SourceRead<{ id: string }>,
  message: string,
  configurationMessage: string,
): DashboardKpiSourceData {
  return {
    asOf,
    company,
    surveys: { status: "error", message },
    questions: { status: "error", message: "Perguntas não consultadas: falha ao carregar pesquisas." },
    responses: { status: "error", message: "Respostas não consultadas: falha ao carregar pesquisas." },
    primaryQuestionConfiguration: { status: "error", message: configurationMessage },
  };
}

/** Converts complete source states to the existing pure-engine contract. */
export function toDashboardKpisInput(
  source: DashboardKpiSourceData,
  periodDays: DashboardPeriodDays,
): DashboardKpisInput {
  const surveys = source.surveys.status === "success" ? source.surveys.data : [];
  const questions = source.questions.status === "success" ? source.questions.data : [];
  const responses = source.responses.status === "success" ? source.responses.data : [];
  const primaryQuestionIdBySurvey = source.primaryQuestionConfiguration.status === "success"
    ? source.primaryQuestionConfiguration.data
    : new Map<string, string | null>();
  const surveysError = source.company.status === "error" || source.surveys.status === "error";
  return {
    periodDays,
    asOf: source.asOf,
    surveys: surveys.map(({ id, status }) => ({ id, status })),
    primaryQuestionIdBySurvey,
    datasets: surveys.map(({ id }) => ({
      surveyId: id,
      questions: questions.filter((question) => question.survey_id === id),
      responses: responses.filter((response) => response.survey_id === id),
    })),
    surveysError,
    questionsError: source.questions.status === "error",
    responsesError: source.responses.status === "error",
    primaryQuestionConfigError: source.primaryQuestionConfiguration.status === "error",
  };
}

async function fetchQuestionPages(
  supabase: ReturnType<typeof createClient>,
  surveyIds: string[],
): Promise<PageResult> {
  return fetchAllPages(async (cursor, pageSize) => {
    let query = supabase
      .from("survey_questions")
      .select("id,survey_id,type,title,description,required,position,options,created_at,updated_at,topic", { count: "exact" })
      .in("survey_id", surveyIds)
      .order("id", { ascending: true });
    if (typeof cursor === "string") query = query.gt("id", cursor);
    const { data, error, count } = await query.limit(pageSize);
    return { data, error, count };
  }, (row) => {
    const id = (row as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }, "perguntas");
}

async function fetchResponsePages(
  supabase: ReturnType<typeof createClient>,
  surveyIds: string[],
  earliest: string,
  asOf: string,
): Promise<PageResult> {
  return fetchAllPages(async (cursor, pageSize) => {
    let query = supabase
      .from("responses")
      .select("id,survey_id,answers,created_at", { count: "exact" })
      .in("survey_id", surveyIds)
      .gte("created_at", earliest)
      .lt("created_at", asOf)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (cursor && typeof cursor === "object") {
      const responseCursor = cursor as { created_at: string; id: string };
      query = query.or(
        `created_at.gt.${responseCursor.created_at},and(created_at.eq.${responseCursor.created_at},id.gt.${responseCursor.id})`,
      );
    }
    const { data, error, count } = await query.limit(pageSize);
    return { data, error, count };
  }, (cursor) => {
    if (!cursor || typeof cursor !== "object") return null;
    const response = cursor as SurveyResponse;
    return { created_at: response.created_at, id: response.id };
  }, "respostas");
}

async function fetchAllPages(
  fetchPage: (cursor: PageCursor | null, pageSize: number) => Promise<{
    data: unknown[] | null;
    error: { message: string; code?: string } | null;
    count: number | null;
  }>,
  nextCursor: (row: unknown) => PageCursor | null,
  label: string,
): Promise<PageResult> {
  const rows: unknown[] = [];
  const seenIds = new Set<string>();
  let expectedCount: number | null = null;
  let cursor: PageCursor | null = null;

  while (expectedCount === null || rows.length < expectedCount) {
    const { data, error, count } = await fetchPage(cursor, PAGE_SIZE);
    if (error) return {
      rows: [],
      error: `Falha ao carregar ${label}: ${error.message}`,
      errorCode: error.code,
    };
    if (count === null) return { rows: [], error: `Não foi possível confirmar a quantidade completa de ${label}.` };
    if (expectedCount === null) expectedCount = count;
    // Keyset filters make the exact count represent the remaining tail, so add
    // already-read rows to detect changes in the source between requests.
    if (rows.length + count !== expectedCount) {
      return { rows: [], error: `A quantidade de ${label} mudou durante a paginação.` };
    }

    const page = data ?? [];
    if (page.length === 0 && rows.length < expectedCount) {
      return { rows: [], error: `A paginação de ${label} terminou antes de carregar todos os registros.` };
    }
    if (page.length > expectedCount - rows.length) {
      return { rows: [], error: `A paginação de ${label} retornou registros além da contagem confirmada.` };
    }

    for (const row of page) {
      const id = (row as { id?: unknown }).id;
      if (typeof id !== "string" || seenIds.has(id)) {
        return { rows: [], error: `A paginação de ${label} retornou IDs ausentes ou duplicados.` };
      }
      seenIds.add(id);
    }
    rows.push(...page);
    if (rows.length < expectedCount) {
      const lastRowCursor = page.length > 0 ? nextCursor(page[page.length - 1]) : null;
      if (lastRowCursor === null) {
        return { rows: [], error: `A paginação de ${label} não produziu um cursor estável.` };
      }
      cursor = lastRowCursor;
    }
  }

  if (rows.length !== expectedCount) {
    return { rows: [], error: `A paginação de ${label} não corresponde à contagem confirmada.` };
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
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}
