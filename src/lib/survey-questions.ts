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

  const { data, error } = await supabase
    .from("survey_questions")
    .update(question)
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
  };
}

function getFriendlyQuestionError(message: string, code?: string) {
  const normalizedMessage = message.toLowerCase();

  if (code === "42P01" || normalizedMessage.includes("does not exist")) {
    return "A tabela de perguntas ainda nao foi criada no Supabase. Aplique o SQL de supabase/survey_questions.sql e recarregue esta pagina.";
  }

  if (code === "23514") {
    return "Revise a pergunta, o tipo e as opcoes antes de salvar.";
  }

  if (normalizedMessage.includes("permission") || normalizedMessage.includes("row-level security")) {
    return "Voce nao tem permissao para alterar perguntas desta pesquisa.";
  }

  return "Nao foi possivel salvar as perguntas agora. Tente novamente.";
}
