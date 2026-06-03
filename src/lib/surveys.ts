import { createClient } from "@/lib/supabase/server";
import type { Survey } from "@/types/survey";

export type CompanySurveysResult = {
  surveys: Survey[];
  error: string | null;
};

export async function getCompanySurveys(companyId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("surveys")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar pesquisas:", error);
    return {
      surveys: [],
      error: getFriendlySurveyLoadError(error.message, error.code),
    } satisfies CompanySurveysResult;
  }

  return {
    surveys: (data ?? []) as Survey[],
    error: null,
  } satisfies CompanySurveysResult;
}

function getFriendlySurveyLoadError(message: string, code?: string) {
  const normalizedMessage = message.toLowerCase();

  if (code === "42P01" || normalizedMessage.includes("does not exist")) {
    return "A tabela de pesquisas ainda nao foi criada no Supabase. Aplique o SQL de supabase/surveys.sql e recarregue esta pagina.";
  }

  if (normalizedMessage.includes("permission") || normalizedMessage.includes("row-level security")) {
    return "Nao foi possivel carregar as pesquisas por uma regra de permissao do Supabase.";
  }

  return "Nao foi possivel carregar as pesquisas agora. Confira o Supabase e tente novamente.";
}
