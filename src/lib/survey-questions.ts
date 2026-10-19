import { createClient } from "@/lib/supabase/client";
import type { NewSurveyQuestion, SurveyQuestion, SurveyQuestionUpdate } from "@/types/survey-question";

type SurveyQuestionsResult = {
  questions: SurveyQuestion[];
  error: string | null;
};

type SurveyQuestionResult = {
  question: SurveyQuestion | null;
  error: string | null;
};

type SurveyQuestionMutationResult = {
  error: string | null;
};

type PrimaryQuestionResult = {
  primaryQuestionId: string | null;
  error: string | null;
};

type PrimaryQuestionValidationInput = {
  id: string;
  survey_id: string;
  type: string;
} | null;

export function validatePrimaryQuestion(
  question: PrimaryQuestionValidationInput,
  surveyId: string,
): string | null {
  if (!question) {
    return "A pergunta selecionada não foi encontrada nesta pesquisa.";
  }

  if (question.survey_id !== surveyId) {
    return "A pergunta principal precisa pertencer a esta pesquisa.";
  }

  if (question.type !== "rating") {
    return "A pergunta principal precisa ser do tipo avaliação de 1 a 5.";
  }

  return null;
}

export async function getPrimaryQuestionId(surveyId: string): Promise<PrimaryQuestionResult> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("surveys")
    .select("primary_question_id")
    .eq("id", surveyId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar a pergunta principal:", error);
    return { primaryQuestionId: null, error: getFriendlyQuestionError(error.message, error.code) };
  }

  if (!data) {
    return { primaryQuestionId: null, error: "Pesquisa não encontrada ou sem permissão de acesso." };
  }

  return { primaryQuestionId: data.primary_question_id, error: null };
}

export async function setPrimaryQuestionId(
  surveyId: string,
  questionId: string | null,
): Promise<PrimaryQuestionResult> {
  const supabase = createClient();

  if (questionId !== null) {
    const { data: question, error: questionError } = await supabase
      .from("survey_questions")
      .select("id, survey_id, type")
      .eq("id", questionId)
      .eq("survey_id", surveyId)
      .maybeSingle();

    if (questionError) {
      console.error("Erro ao validar a pergunta principal:", questionError);
      return {
        primaryQuestionId: null,
        error: getFriendlyQuestionError(questionError.message, questionError.code),
      };
    }

    const validationError = validatePrimaryQuestion(question, surveyId);
    if (validationError) {
      return { primaryQuestionId: null, error: validationError };
    }
  }

  const { data, error } = await supabase
    .from("surveys")
    .update({ primary_question_id: questionId })
    .eq("id", surveyId)
    .select("primary_question_id")
    .maybeSingle();

  if (error) {
    console.error("Erro ao salvar a pergunta principal:", error);
    return { primaryQuestionId: null, error: getFriendlyQuestionError(error.message, error.code) };
  }

  if (!data) {
    return { primaryQuestionId: null, error: "Pesquisa não encontrada ou sem permissão para alterá-la." };
  }

  return { primaryQuestionId: data.primary_question_id, error: null };
}

export async function getSurveyQuestions(surveyId: string): Promise<SurveyQuestionsResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("survey_questions")
    .select("*")
    .eq("survey_id", surveyId)
    .order("position", { ascending: true });

  if (error) {
    console.error("Erro ao carregar perguntas:", error);
    return {
      questions: [],
      error: getFriendlyQuestionError(error.message, error.code),
    };
  }

  return {
    questions: normalizeQuestions(data ?? []),
    error: null,
  };
}

export async function createQuestion(question: NewSurveyQuestion): Promise<SurveyQuestionResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("survey_questions")
    .insert({
      survey_id: question.survey_id,
      type: question.type,
      title: question.title,
      description: question.description ?? null,
      required: question.required ?? false,
      position: question.position,
      options: question.options ?? [],
      topic: normalizeTopic(question.topic),
    })
    .select("*")
    .single();

  if (error) {
    console.error("Erro ao criar pergunta:", error);
    return {
      question: null,
      error: getFriendlyQuestionError(error.message, error.code),
    };
  }

  return {
    question: normalizeQuestion(data),
    error: null,
  };
}

export async function updateQuestion(
  questionId: string,
  question: SurveyQuestionUpdate,
): Promise<SurveyQuestionResult> {
  const supabase = createClient();

  if (question.type && question.type !== "rating") {
    const { data: primarySurvey, error: primarySurveyError } = await supabase
      .from("surveys")
      .select("id")
      .eq("primary_question_id", questionId)
      .maybeSingle();

    if (primarySurveyError) {
      console.error("Erro ao verificar a configuração principal:", primarySurveyError);
      return {
        question: null,
        error: getFriendlyQuestionError(primarySurveyError.message, primarySurveyError.code),
      };
    }

    if (primarySurvey) {
      return {
        question: null,
        error: "Remova esta pergunta da configuração principal antes de alterar seu tipo.",
      };
    }
  }

  const { data, error } = await supabase
    .from("survey_questions")
    .update({
      ...question,
      topic: question.topic === undefined ? undefined : normalizeTopic(question.topic),
    })
    .eq("id", questionId)
    .select("*")
    .single();

  if (error) {
    console.error("Erro ao atualizar pergunta:", error);
    return {
      question: null,
      error: getFriendlyQuestionError(error.message, error.code),
    };
  }

  return {
    question: normalizeQuestion(data),
    error: null,
  };
}

export async function deleteQuestion(questionId: string): Promise<SurveyQuestionMutationResult> {
  const supabase = createClient();

  const { error } = await supabase.from("survey_questions").delete().eq("id", questionId);

  if (error) {
    console.error("Erro ao excluir pergunta:", error);
    return {
      error: getFriendlyQuestionError(error.message, error.code),
    };
  }

  return { error: null };
}

export async function reorderQuestions(questions: SurveyQuestion[]): Promise<SurveyQuestionMutationResult> {
  const supabase = createClient();

  const updates = questions.map((question, index) =>
    supabase
      .from("survey_questions")
      .update({ position: index + 1 })
      .eq("id", question.id),
  );

  const results = await Promise.all(updates);
  const failedResult = results.find((result) => result.error);

  if (failedResult?.error) {
    console.error("Erro ao reordenar perguntas:", failedResult.error);
    return {
      error: getFriendlyQuestionError(failedResult.error.message, failedResult.error.code),
    };
  }

  return { error: null };
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
    topic: normalizeTopic(question.topic),
  };
}

function normalizeTopic(topic: unknown): string | null {
  if (topic === null || topic === undefined) {
    return null;
  }

  const trimmed = String(topic).trim();

  return trimmed.length > 0 ? trimmed : null;
}

function getFriendlyQuestionError(message: string, code?: string) {
  const normalizedMessage = message.toLowerCase();

  if (code === "42703" || normalizedMessage.includes("primary_question_id")) {
    return "A configuração da pergunta principal ainda não está disponível. Aplique a migration supabase/014_primary_survey_question.sql e tente novamente.";
  }

  if (code === "42P01" || normalizedMessage.includes("does not exist")) {
    return "A tabela de perguntas ainda nao foi criada no Supabase. Aplique o SQL de supabase/003_survey_questions.sql e recarregue esta pagina.";
  }

  if (code === "23514") {
    if (normalizedMessage.includes("primary question")) {
      return "A pergunta principal precisa ser uma avaliação de 1 a 5 pertencente a esta pesquisa.";
    }

    return "Revise a pergunta, o tipo e as opcoes antes de salvar.";
  }

  if (normalizedMessage.includes("permission") || normalizedMessage.includes("row-level security")) {
    return "Voce nao tem permissao para alterar perguntas desta pesquisa.";
  }

  return "Nao foi possivel salvar as perguntas agora. Tente novamente.";
}
