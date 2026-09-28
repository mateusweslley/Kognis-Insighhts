import { createClient } from "@/lib/supabase/server";
import type { CampaignSurvey } from "@/types/campaign";

type CampaignSurveysResult = {
  surveys: CampaignSurvey[];
  error: string | null;
};

/**
 * Retorna os vínculos N:N de uma campanha. A coluna legada campaigns.survey_id
 * é preservada separadamente; esta tabela contém os vínculos adicionais.
 */
export async function getCampaignSurveys(campaignId: string): Promise<CampaignSurveysResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("campaign_surveys")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao carregar pesquisas da campanha:", error);
    return { surveys: [], error: getFriendlyCampaignSurveysError(error.message, error.code) };
  }

  return { surveys: (data ?? []) as CampaignSurvey[], error: null };
}

/**
 * Sincroniza o vínculo 1:1 do MVP na tabela N:N `campaign_surveys`,
 * mantendo `campaign_surveys` alinhado com `campaigns.survey_id`.
 */
export async function syncCampaignSurveyLink(
  campaignId: string,
  surveyId: string | null,
): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { error: deleteError } = await supabase
    .from("campaign_surveys")
    .delete()
    .eq("campaign_id", campaignId);

  if (deleteError) {
    console.error("Erro ao limpar vínculos de pesquisa da campanha:", deleteError);
    return { error: getFriendlyCampaignSurveysError(deleteError.message, deleteError.code) };
  }

  if (!surveyId) {
    return { error: null };
  }

  const { error: insertError } = await supabase.from("campaign_surveys").insert({
    campaign_id: campaignId,
    survey_id: surveyId,
  });

  if (insertError) {
    console.error("Erro ao vincular pesquisa à campanha:", insertError);
    return { error: getFriendlyCampaignSurveysError(insertError.message, insertError.code) };
  }

  return { error: null };
}

function getFriendlyCampaignSurveysError(message: string, code?: string) {
  if (code === "42P01" || message.toLowerCase().includes("does not exist")) {
    return "A tabela de vínculos de campanha ainda nao foi criada no Supabase. Aplique o SQL de supabase/2026_campaigns_foundation.sql.";
  }
  if (message.toLowerCase().includes("permission") || message.toLowerCase().includes("row-level security")) {
    return "Voce nao tem permissao para acessar estas pesquisas.";
  }
  return "Nao foi possivel carregar as pesquisas da campanha agora.";
}
