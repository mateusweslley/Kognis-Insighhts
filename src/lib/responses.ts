import { createClient } from "@/lib/supabase/server";
import { exportResponsesToCsv } from "@/lib/response-utils";
import type { PublicSurvey, ResponseAnswers, SurveyResponse, SurveyResponseWithSurvey } from "@/types/response";

type ResponsesResult = {
  responses: SurveyResponseWithSurvey[];
  error: string | null;
};

type PublicSurveyResult = {
  survey: PublicSurvey | null;
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
  }));

  return {
    responses,
    error: null,
  };
}

export async function getResponsesBySurveyId(surveyId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("responses")
    .select("id,survey_id,answers,created_at")
    .eq("survey_id", surveyId)
    .order("created_at", { ascending: false });

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
