import { resolveEffectiveCampaignSurveyId } from "@/lib/campaign-admin-utils";
import { createClient } from "@/lib/supabase/server";
import type {
  Campaign,
  CampaignReward,
  CampaignSurvey,
  CampaignWithSurvey,
} from "@/types/campaign";

type CampaignsResult = {
  campaigns: CampaignWithSurvey[];
  error: string | null;
};

type CampaignResult = {
  campaign: CampaignWithSurvey | null;
  error: string | null;
};

export async function getCampaignsByCompany(companyId: string): Promise<CampaignsResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select("*, surveys(title)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar campanhas:", error);
    return {
      campaigns: [],
      error: getFriendlyCampaignError(error.message, error.code),
    };
  }

  const rawCampaigns = (data ?? []) as Array<Campaign & { surveys?: { title: string } | null }>;
  if (rawCampaigns.length === 0) {
    return {
      campaigns: [],
      error: null,
    };
  }

  const campaignIds = rawCampaigns.map((campaign) => campaign.id);

  // Carrega dados complementares (vínculos N:N, recompensas, contagem de claims e títulos de pesquisas)
  // de forma resiliente para preservar compatibilidade caso alguma migration complementar ainda não exista.
  const [surveysRes, linksRes, rewardsRes, claimsRes] = await Promise.all([
    supabase.from("surveys").select("id, title").eq("company_id", companyId),
    supabase
      .from("campaign_surveys")
      .select("campaign_id, survey_id, created_at")
      .in("campaign_id", campaignIds)
      .order("created_at", { ascending: true }),
    supabase.from("campaign_rewards").select("*").in("campaign_id", campaignIds),
    supabase
      .from("campaign_claims")
      .select("campaign_id, status")
      .in("campaign_id", campaignIds)
      .neq("status", "voided"),
  ]);

  const surveyTitleMap = new Map<string, string>();
  ((surveysRes.data ?? []) as Array<{ id: string; title: string }>).forEach((survey) => {
    surveyTitleMap.set(survey.id, survey.title);
  });

  const campaignSurveysList = (linksRes.error ? [] : (linksRes.data ?? [])) as CampaignSurvey[];

  const rewardsByCampaignId = new Map<string, CampaignReward>();
  if (!rewardsRes.error && rewardsRes.data) {
    (rewardsRes.data as CampaignReward[]).forEach((reward) => {
      rewardsByCampaignId.set(reward.campaign_id, reward);
    });
  }

  const claimsCountByCampaignId = new Map<string, number>();
  if (!claimsRes.error && claimsRes.data) {
    (claimsRes.data as Array<{ campaign_id: string; status: string }>).forEach((claim) => {
      claimsCountByCampaignId.set(
        claim.campaign_id,
        (claimsCountByCampaignId.get(claim.campaign_id) ?? 0) + 1,
      );
    });
  }

  return {
    campaigns: rawCampaigns.map((campaign) => {
      const effectiveSurveyId = resolveEffectiveCampaignSurveyId(campaign, campaignSurveysList);
      const resolvedTitle =
        (effectiveSurveyId ? surveyTitleMap.get(effectiveSurveyId) : null) ??
        campaign.surveys?.title ??
        null;

      return {
        ...campaign,
        survey_id: effectiveSurveyId ?? campaign.survey_id ?? null,
        linked_survey_id: effectiveSurveyId,
        survey_title: resolvedTitle,
        reward: rewardsByCampaignId.get(campaign.id) ?? null,
        claims_count: claimsCountByCampaignId.get(campaign.id) ?? 0,
      };
    }),
    error: null,
  };
}

export async function getCampaignById(campaignId: string): Promise<CampaignResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select("*, surveys(title)")
    .eq("id", campaignId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar campanha:", error);
    return {
      campaign: null,
      error: getFriendlyCampaignError(error.message, error.code),
    };
  }

  if (!data) {
    return {
      campaign: null,
      error: null,
    };
  }

  const campaign = data as Campaign & { surveys?: { title: string } | null };

  return {
    campaign: {
      ...campaign,
      survey_title: campaign.surveys?.title ?? null,
    },
    error: null,
  };
}

export async function createCampaign(campaign: {
  companyId: string;
  surveyId: string | null;
  name: string;
  description: string | null;
  status: Campaign["status"];
  campaignType?: Campaign["campaign_type"];
  startsAt?: string | null;
  endsAt?: string | null;
  maxClaimsTotal?: number | null;
  identityRequirement?: Campaign["identity_requirement"];
  claimValidityDays?: number | null;
  completionMessage?: string | null;
}) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      company_id: campaign.companyId,
      survey_id: campaign.surveyId,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      ...(campaign.campaignType ? { campaign_type: campaign.campaignType } : {}),
      ...(campaign.startsAt !== undefined ? { starts_at: campaign.startsAt } : {}),
      ...(campaign.endsAt !== undefined ? { ends_at: campaign.endsAt } : {}),
      ...(campaign.maxClaimsTotal !== undefined
        ? { max_claims_total: campaign.maxClaimsTotal }
        : {}),
      ...(campaign.identityRequirement
        ? { identity_requirement: campaign.identityRequirement }
        : {}),
      ...(campaign.claimValidityDays !== undefined
        ? { claim_validity_days: campaign.claimValidityDays }
        : {}),
      ...(campaign.completionMessage !== undefined
        ? { completion_message: campaign.completionMessage }
        : {}),
    })
    .select("*, surveys(title)")
    .single();

  if (error) {
    console.error("Erro ao criar campanha:", error);
    return {
      campaign: null,
      error: getFriendlyCampaignError(error.message, error.code),
    };
  }

  const createdCampaign = data as Campaign & { surveys?: { title: string } | null };

  return {
    campaign: {
      ...createdCampaign,
      survey_title: createdCampaign.surveys?.title ?? null,
    },
    error: null,
  };
}

export async function updateCampaign(campaign: {
  id: string;
  surveyId: string | null;
  name: string;
  description: string | null;
  status: Campaign["status"];
  campaignType?: Campaign["campaign_type"];
  startsAt?: string | null;
  endsAt?: string | null;
  maxClaimsTotal?: number | null;
  identityRequirement?: Campaign["identity_requirement"];
  claimValidityDays?: number | null;
  completionMessage?: string | null;
}) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("campaigns")
    .update({
      survey_id: campaign.surveyId,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      ...(campaign.campaignType ? { campaign_type: campaign.campaignType } : {}),
      ...(campaign.startsAt !== undefined ? { starts_at: campaign.startsAt } : {}),
      ...(campaign.endsAt !== undefined ? { ends_at: campaign.endsAt } : {}),
      ...(campaign.maxClaimsTotal !== undefined
        ? { max_claims_total: campaign.maxClaimsTotal }
        : {}),
      ...(campaign.identityRequirement
        ? { identity_requirement: campaign.identityRequirement }
        : {}),
      ...(campaign.claimValidityDays !== undefined
        ? { claim_validity_days: campaign.claimValidityDays }
        : {}),
      ...(campaign.completionMessage !== undefined
        ? { completion_message: campaign.completionMessage }
        : {}),
    })
    .eq("id", campaign.id)
    .select("*, surveys(title)")
    .single();

  if (error) {
    console.error("Erro ao atualizar campanha:", error);
    return {
      campaign: null,
      error: getFriendlyCampaignError(error.message, error.code),
    };
  }

  const updatedCampaign = data as Campaign & { surveys?: { title: string } | null };

  return {
    campaign: {
      ...updatedCampaign,
      survey_title: updatedCampaign.surveys?.title ?? null,
    },
    error: null,
  };
}

export async function archiveCampaign(campaignId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("campaigns")
    .update({ status: "archived" })
    .eq("id", campaignId)
    .select("*, surveys(title)")
    .single();

  if (error) {
    console.error("Erro ao arquivar campanha:", error);
    return {
      campaign: null,
      error: getFriendlyCampaignError(error.message, error.code),
    };
  }

  const archivedCampaign = data as Campaign & { surveys?: { title: string } | null };

  return {
    campaign: {
      ...archivedCampaign,
      survey_title: archivedCampaign.surveys?.title ?? null,
    },
    error: null,
  };
}

export async function getCampaignStats(companyId: string) {
  const { campaigns, error } = await getCampaignsByCompany(companyId);

  return {
    totalCampaigns: campaigns.length,
    error,
  };
}

function getFriendlyCampaignError(message: string, code?: string) {
  const normalizedMessage = message.toLowerCase();

  if (code === "42P01" || normalizedMessage.includes("does not exist")) {
    return "A tabela de campanhas ainda nao foi criada no Supabase. Aplique o SQL de supabase/campaigns.sql.";
  }

  if (normalizedMessage.includes("survey already has an active campaign")) {
    return "Esta pesquisa já possui uma campanha ativa. Pause ou arquive a campanha atual antes de ativar outra.";
  }

  if (code === "23514") {
    return "Revise os dados e regras informados antes de salvar a campanha.";
  }

  if (normalizedMessage.includes("permission") || normalizedMessage.includes("row-level security")) {
    return "Voce nao tem permissao para acessar estas campanhas.";
  }

  return "Nao foi possivel carregar as campanhas agora. Confira o Supabase e tente novamente.";
}
