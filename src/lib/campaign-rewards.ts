import { createClient } from "@/lib/supabase/server";
import type { CampaignReward } from "@/types/campaign";

type CampaignRewardResult = {
  reward: CampaignReward | null;
  error: string | null;
};

/**
 * No MVP cada campanha possui uma única recompensa.
 */
export async function getCampaignReward(campaignId: string): Promise<CampaignRewardResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("campaign_rewards")
    .select("*")
    .eq("campaign_id", campaignId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar recompensa:", error);
    return { reward: null, error: getFriendlyCampaignRewardError(error.message, error.code) };
  }

  return { reward: (data ?? null) as CampaignReward | null, error: null };
}

export async function upsertCampaignReward(params: {
  campaignId: string;
  type: CampaignReward["type"];
  codeMode: CampaignReward["code_mode"];
  fixedCode: string | null;
  title: string | null;
  description: string | null;
  value: number | null;
  instructions: string | null;
  terms: string | null;
}): Promise<CampaignRewardResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("campaign_rewards")
    .upsert(
      {
        campaign_id: params.campaignId,
        type: params.type,
        code_mode: params.codeMode,
        fixed_code: params.codeMode === "fixed" ? params.fixedCode : null,
        title: params.title,
        description: params.description,
        value: params.value,
        instructions: params.instructions,
        terms: params.terms,
      },
      { onConflict: "campaign_id" },
    )
    .select("*")
    .single();

  if (error) {
    console.error("Erro ao salvar recompensa da campanha:", error);
    return { reward: null, error: getFriendlyCampaignRewardError(error.message, error.code) };
  }

  return { reward: data as CampaignReward, error: null };
}

export async function deleteCampaignReward(
  campaignId: string,
): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { error } = await supabase
    .from("campaign_rewards")
    .delete()
    .eq("campaign_id", campaignId);

  if (error) {
    console.error("Erro ao remover recompensa da campanha:", error);
    return { error: getFriendlyCampaignRewardError(error.message, error.code) };
  }

  return { error: null };
}

function getFriendlyCampaignRewardError(message: string, code?: string) {
  if (code === "42P01" || message.toLowerCase().includes("does not exist")) {
    return "A tabela de recompensas ainda nao foi criada no Supabase. Aplique o SQL de supabase/2026_campaigns_foundation.sql.";
  }
  if (message.toLowerCase().includes("permission") || message.toLowerCase().includes("row-level security")) {
    return "Voce nao tem permissao para acessar esta recompensa.";
  }
  return "Nao foi possivel carregar a recompensa agora.";
}
