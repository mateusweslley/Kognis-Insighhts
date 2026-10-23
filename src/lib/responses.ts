import { createClient } from "@/lib/supabase/server";
import { loadAllSurveyQuestions, loadAllSurveyResponses } from "@/lib/survey-data-pages";
import { loadCompanyResponseCounts } from "@/lib/company-response-counts";
import { loadFeedbackMetadata } from "@/lib/feedback-metadata";
import { createFeedbackResponseSource } from "@/lib/feedback-response-source";
import { exportResponsesToCsv } from "@/lib/response-utils";
import { normalizeResponses } from "@/lib/response-normalizer";
import {
  readFeedbackPage,
  type FeedbackCursor,
  type FeedbackQuestion,
} from "@/lib/feedback-feed";
import type { PublicSurvey, ResponseAnswers, SurveyResponse, SurveyResponseWithSurvey } from "@/types/response";
import type { SurveyQuestion } from "@/types/survey-question";

type ResponsesResult = {
  responses: SurveyResponseWithSurvey[];
  error: string | null;
};

type SurveyResponsesResult = {
  responses: SurveyResponse[];
  error: string | null;
};

type PublicSurveyResult = {
  survey: PublicSurvey | null;
  error: string | null;
};

type PublicSurveyQuestionsResult = {
  questions: SurveyQuestion[];
  error: string | null;
};

const FEEDBACK_PAGE_SIZE = 20;
const FEEDBACK_BATCH_SIZE = 50;
const FEEDBACK_MAX_BATCHES = 4;

/** Read configuration with the same authenticated server client and RLS as responses. */
export async function getSurveySatisfactionConfig(surveyId: string) {
  const { data, error } = await createClient().from("surveys")
    .select("id,primary_question_id").eq("id", surveyId).maybeSingle();
  if (error || !data || data.id !== surveyId
      || (data.primary_question_id !== null
        && (typeof data.primary_question_id !== "string" || !data.primary_question_id.trim()))) {
    return { primaryQuestionId: null, error: "Não foi possível carregar a configuração de satisfação da pesquisa." };
  }
  return { primaryQuestionId: data.primary_question_id as string | null, error: null };
}

export async function getCompanyFeedbackPage(companyId: string, cursor: FeedbackCursor | null) {
  const supabase = createClient();
  const metadata = await loadFeedbackMetadata(supabase, companyId);
  if (metadata.error) return { page: null, error: metadata.error };
  const surveyRows = metadata.surveys;
  if (surveyRows.length === 0) {
    return {
      page: await readFeedbackPage({
        pageSize: FEEDBACK_PAGE_SIZE,
        batchSize: FEEDBACK_BATCH_SIZE,
        maxBatches: FEEDBACK_MAX_BATCHES,
        cursor,
        questionsBySurvey: new Map(),
        surveyTitles: new Map(),
        fetchBatch: async () => ({ rows: [], count: 0 }),
        fetchById: async () => null,
      }),
      error: null,
    };
  }

  const surveyIds = surveyRows.map(({ id }) => id);
  const surveyTitles = new Map(surveyRows.map(({ id, title }) => [id, title]));
  const questionsBySurvey = new Map<string, FeedbackQuestion[]>();
  metadata.questions.forEach((question) => {
    const current = questionsBySurvey.get(question.survey_id) ?? [];
    current.push({ id: question.id, type: question.type, title: question.title });
    questionsBySurvey.set(question.survey_id, current);
  });

  const { fetchBatch, fetchById } = createFeedbackResponseSource(supabase, surveyIds);

  try {
    const page = await readFeedbackPage({
      pageSize: FEEDBACK_PAGE_SIZE,
      batchSize: FEEDBACK_BATCH_SIZE,
      maxBatches: FEEDBACK_MAX_BATCHES,
      cursor,
      questionsBySurvey,
      surveyTitles,
      fetchBatch,
      fetchById,
    });
    return { page, error: null };
  } catch (error) {
    console.error("Erro ao carregar feed de feedbacks:", error);
    return { page: null, error: "Nao foi possivel carregar os feedbacks agora. Tente novamente." };
  }
}

export async function getCompanyFeedbackResponse(companyId: string, responseId: string) {
  const supabase = createClient();
  // Filter the parent survey in the same authorized read, without listing the company.
  const { data, error } = await supabase
    .from("responses")
    .select("id,survey_id,answers,created_at,surveys!inner(id,title,company_id)")
    .eq("surveys.company_id", companyId)
    .eq("id", responseId)
    .maybeSingle();
  if (error) return { response: null, error: getFriendlyResponsesError(error.message, error.code) };
  if (!data) return { response: null, error: null };

  const row = data as unknown as SurveyResponse & {
    surveys: { id: string; title: string; company_id: string };
  };
  if (row.id !== responseId || !row.surveys || row.surveys.id !== row.survey_id
      || row.surveys.company_id !== companyId || typeof row.surveys.title !== "string") {
    return { response: null, error: "INCOMPLETE_SURVEY_DATA: Associação da resposta não pôde ser validada." };
  }
  const { questions, error: questionsError } = await getSurveyQuestionsForResponses(row.survey_id);
  if (questionsError) return { response: null, error: questionsError };
  const normalized = normalizeResponses([row], questions)[0] ?? null;
  return {
    response: normalized
      ? { ...normalized, surveyTitle: row.surveys.title }
      : null,
    error: null,
  };
}

export async function getPublicSurveyById(surveyId: string): Promise<PublicSurveyResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("surveys")
    .select("id,title,description,status")
    .eq("id", surveyId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar pesquisa publica:", error);
    return {
      survey: null,
      error: "Nao foi possivel carregar esta pesquisa agora.",
    };
  }

  return {
    survey: data as PublicSurvey | null,
    error: null,
  };
}

export async function getPublicSurveyQuestions(
  surveyId: string,
): Promise<PublicSurveyQuestionsResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("survey_questions")
    .select("id,survey_id,type,title,description,required,position,options,created_at,updated_at")
    .eq("survey_id", surveyId)
    .order("position", { ascending: true });

  if (error) {
    console.error("Erro ao carregar perguntas publicas:", error);
    return {
      questions: [],
      error: getFriendlyResponsesError(error.message, error.code),
    };
  }

  return {
    questions: normalizeQuestions(data ?? []),
    error: null,
  };
}

export async function getResponsesByCompany(companyId: string): Promise<ResponsesResult> {
  const supabase = createClient();

  const { data: surveys, error: surveysError } = await supabase
    .from("surveys")
    .select("id,title")
    .eq("company_id", companyId);

  if (surveysError) {
    console.error("Erro ao carregar pesquisas para respostas:", surveysError);
    return {
      responses: [],
      error: "Nao foi possivel carregar as pesquisas da empresa.",
    };
  }

  const surveyList = (surveys ?? []) as Array<{ id: string; title: string }>;

  if (surveyList.length === 0) {
    return {
      responses: [],
      error: null,
    };
  }

  const surveyTitles = new Map(surveyList.map((survey) => [survey.id, survey.title]));
  const questionTitlesBySurvey = await getQuestionTitlesBySurvey(
    surveyList.map((survey) => survey.id),
  );
  const { data, error } = await supabase
    .from("responses")
    .select("id,survey_id,answers,created_at")
    .in(
      "survey_id",
      surveyList.map((survey) => survey.id),
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar respostas:", error);
    return {
      responses: [],
      error: getFriendlyResponsesError(error.message, error.code),
    };
  }

  const responses = ((data ?? []) as SurveyResponse[]).map((response) => ({
    ...response,
    survey_title: surveyTitles.get(response.survey_id) ?? "Pesquisa",
    question_titles: questionTitlesBySurvey.get(response.survey_id) ?? {},
  }));

  return {
    responses,
    error: null,
  };
}

export async function getResponseCountsByCompany(companyId: string) {
  return loadCompanyResponseCounts(createClient(), companyId);
}

export async function getResponsesBySurveyId(
  surveyId: string,
): Promise<SurveyResponsesResult> {
  // Complete analytical/export dataset, never an implicit first page.
  const result = await loadAllSurveyResponses(createClient(), surveyId);
  return { responses: result.rows, error: result.error };
}

export async function getSurveyQuestionsForResponses(
  surveyId: string,
): Promise<PublicSurveyQuestionsResult> {
  const result = await loadAllSurveyQuestions(createClient(), surveyId);
  return {
    questions: normalizeQuestions(result.rows),
    error: result.error,
  };
}

export async function createPublicResponse(surveyId: string, answers: ResponseAnswers) {
  const supabase = createClient();

  const { error } = await supabase.from("responses").insert({
    survey_id: surveyId,
    answers,
  });

  if (error) {
    console.error("Erro ao criar resposta publica:", error);
    return {
      error: getFriendlyResponsesError(error.message, error.code),
    };
  }

  return {
    error: null,
  };
}

export async function getResponseStats(companyId: string) {
  const { responses, error } = await getResponsesByCompany(companyId);

  return {
    totalResponses: responses.length,
    error,
  };
}

export { exportResponsesToCsv };

async function getQuestionTitlesBySurvey(surveyIds: string[]) {
  const supabase = createClient();
  const questionTitlesBySurvey = new Map<string, Record<string, string>>();

  const { data, error } = await supabase
    .from("survey_questions")
    .select("id,survey_id,title")
    .in("survey_id", surveyIds);

  if (error) {
    console.error("Erro ao carregar titulos de perguntas para CSV:", error);
    return questionTitlesBySurvey;
  }

  (data ?? []).forEach((question) => {
    const typedQuestion = question as { id: string; survey_id: string; title: string };
    const currentTitles = questionTitlesBySurvey.get(typedQuestion.survey_id) ?? {};
    questionTitlesBySurvey.set(typedQuestion.survey_id, {
      ...currentTitles,
      [typedQuestion.id]: typedQuestion.title,
    });
  });

  return questionTitlesBySurvey;
}

function normalizeQuestions(rows: unknown[]): SurveyQuestion[] {
  return rows.map((row) => normalizeQuestion(row));
}

function normalizeQuestion(row: unknown): SurveyQuestion {
  const question = row as SurveyQuestion;

  return {
    ...question,
    options: Array.isArray(question.options)
      ? question.options.filter((option): option is string => typeof option === "string")
      : [],
  };
}

function getFriendlyResponsesError(message: string, code?: string) {
  const normalizedMessage = message.toLowerCase();

  if (code === "42P01" || normalizedMessage.includes("does not exist")) {
    return "A tabela de respostas ainda nao foi criada no Supabase. Aplique o SQL de supabase/004_responses.sql.";
  }

  if (normalizedMessage.includes("permission") || normalizedMessage.includes("row-level security")) {
    return "Voce nao tem permissao para acessar estas respostas.";
  }

  return "Nao foi possivel carregar as respostas agora. Confira o Supabase e tente novamente.";
}
