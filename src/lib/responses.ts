import { createClient } from "@/lib/supabase/server";
import { exportResponsesToCsv } from "@/lib/response-utils";
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

type SurveyResponsesQueryOptions = {
  limit?: number;
  offset?: number;
  cursor?: string;
};

type ResponseCountsResult = {
  counts: Map<string, number>;
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

export async function getResponseCountsByCompany(companyId: string): Promise<ResponseCountsResult> {
  const supabase = createClient();

  const { data: surveys, error: surveysError } = await supabase
    .from("surveys")
    .select("id")
    .eq("company_id", companyId);

  if (surveysError) {
    console.error("Erro ao carregar pesquisas para contagem de respostas:", surveysError);
    return {
      counts: new Map(),
      error: "Nao foi possivel carregar as pesquisas da empresa.",
    };
  }

  const surveyIds = (surveys ?? []).map((survey) => (survey as { id: string }).id);

  if (surveyIds.length === 0) {
    return {
      counts: new Map(),
      error: null,
    };
  }

  const { data, error } = await supabase
    .from("responses")
    .select("survey_id")
    .in("survey_id", surveyIds);

  if (error) {
    console.error("Erro ao contar respostas:", error);
    return {
      counts: new Map(),
      error: getFriendlyResponsesError(error.message, error.code),
    };
  }

  const counts = new Map<string, number>();

  (data ?? []).forEach((response) => {
    const surveyId = (response as { survey_id: string }).survey_id;
    counts.set(surveyId, (counts.get(surveyId) ?? 0) + 1);
  });

  return {
    counts,
    error: null,
  };
}

export async function getResponsesBySurveyId(
  surveyId: string,
  options: SurveyResponsesQueryOptions = {},
): Promise<SurveyResponsesResult> {
  const supabase = createClient();

  let query = supabase
    .from("responses")
    .select("id,survey_id,answers,created_at")
    .eq("survey_id", surveyId)
    .order("created_at", { ascending: false });

  if (options.cursor) {
    query = query.lt("created_at", options.cursor);
  }

  if (typeof options.offset === "number" && typeof options.limit === "number") {
    query = query.range(options.offset, options.offset + options.limit - 1);
  } else if (typeof options.limit === "number") {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao carregar respostas da pesquisa:", error);
    return {
      responses: [],
      error: getFriendlyResponsesError(error.message, error.code),
    };
  }

  return {
    responses: (data ?? []) as SurveyResponse[],
    error: null,
  };
}

export async function getSurveyQuestionsForResponses(
  surveyId: string,
): Promise<PublicSurveyQuestionsResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("survey_questions")
    .select("id,survey_id,type,title,description,required,position,options,created_at,updated_at")
    .eq("survey_id", surveyId)
    .order("position", { ascending: true });

  if (error) {
    console.error("Erro ao carregar perguntas para respostas:", error);
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
    return "A tabela de respostas ainda nao foi criada no Supabase. Aplique o SQL de supabase/responses.sql.";
  }

  if (normalizedMessage.includes("permission") || normalizedMessage.includes("row-level security")) {
    return "Voce nao tem permissao para acessar estas respostas.";
  }

  return "Nao foi possivel carregar as respostas agora. Confira o Supabase e tente novamente.";
}
