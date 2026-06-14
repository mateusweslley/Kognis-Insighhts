export const campaignStatuses = ["draft", "active", "archived"] as const;

export type CampaignStatus = (typeof campaignStatuses)[number];

export type Campaign = {
  id: string;
  company_id: string;
  survey_id: string | null;
  name: string;
  description: string | null;
  status: CampaignStatus;
  created_at: string;
  updated_at: string;
};

export type CampaignWithSurvey = Campaign & {
  survey_title: string | null;
};

export const campaignStatusLabels: Record<CampaignStatus, string> = {
  draft: "Rascunho",
  active: "Ativa",
  archived: "Arquivada",
};
