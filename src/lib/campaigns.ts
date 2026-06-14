import { createClient } from "@/lib/supabase/server";
import type { Campaign, CampaignWithSurvey } from "@/types/campaign";

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

  return {
    campaigns: ((data ?? []) as Array<Campaign & { surveys?: { title: string } | null }>).map(
      (campaign) => ({
        ...campaign,
        survey_title: campaign.surveys?.title ?? null,
      }),
    ),
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
}) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("campaigns")
    .update({
      survey_id: campaign.surveyId,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
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

  if (code === "23514") {
    return "Revise nome e status antes de salvar a campanha.";
  }

  if (normalizedMessage.includes("permission") || normalizedMessage.includes("row-level security")) {
    return "Voce nao tem permissao para acessar estas campanhas.";
  }

  return "Nao foi possivel carregar as campanhas agora. Confira o Supabase e tente novamente.";
}
