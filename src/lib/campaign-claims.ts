import { createClient } from "@/lib/supabase/server";
import type { CampaignClaim } from "@/types/campaign";

type CampaignClaimsResult = {
  claims: CampaignClaim[];
  error: string | null;
};

/**
 * Retorna as claims (emissões de recompensa) de uma campanha, para a
 * empresa do usuário autenticado (isolamento garantido por RLS).
 */
export async function getCampaignClaims(campaignId: string): Promise<CampaignClaimsResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("campaign_claims")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("issued_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar claims da campanha:", error);
    return { claims: [], error: getFriendlyCampaignClaimsError(error.message, error.code) };
  }

  return { claims: (data ?? []) as CampaignClaim[], error: null };
}

function getFriendlyCampaignClaimsError(message: string, code?: string) {
  if (code === "42P01" || message.toLowerCase().includes("does not exist")) {
    return "A tabela de claims ainda nao foi criada no Supabase. Aplique o SQL de supabase/2026_campaigns_foundation.sql.";
  }
  if (message.toLowerCase().includes("permission") || message.toLowerCase().includes("row-level security")) {
    return "Voce nao tem permissao para acessar estas claims.";
  }
  return "Nao foi possivel carregar as claims agora.";
}
