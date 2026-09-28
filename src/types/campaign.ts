export const campaignStatuses = ["draft", "active", "paused", "archived"] as const;

export type CampaignStatus = (typeof campaignStatuses)[number];

export const campaignTypes = ["reward_on_response"] as const;

export type CampaignType = (typeof campaignTypes)[number];

export const identityRequirements = ["none", "email", "phone"] as const;

export type IdentityRequirement = (typeof identityRequirements)[number];

export const campaignRewardTypes = ["percentage", "fixed_amount", "gift", "custom"] as const;

export type CampaignRewardType = (typeof campaignRewardTypes)[number];

export const campaignCodeModes = ["unique", "fixed"] as const;

export type CampaignCodeMode = (typeof campaignCodeModes)[number];

export const campaignClaimStatuses = ["issued", "redeemed", "voided"] as const;

export type CampaignClaimStatus = (typeof campaignClaimStatuses)[number];

export type Campaign = {
  id: string;
  company_id: string;
  survey_id: string | null;
  name: string;
  description: string | null;
  status: CampaignStatus;
  campaign_type: CampaignType;
  starts_at: string | null;
  ends_at: string | null;
  max_claims_total: number | null;
  identity_requirement: IdentityRequirement;
  claim_validity_days: number | null;
  completion_message: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignWithSurvey = Campaign & {
  survey_title: string | null;
};

export type CampaignSurvey = {
  campaign_id: string;
  survey_id: string;
  created_at: string;
};

export type CampaignReward = {
  id: string;
  campaign_id: string;
  type: CampaignRewardType;
  title: string | null;
  description: string | null;
  value: number | null;
  code_mode: CampaignCodeMode;
  fixed_code: string | null;
  instructions: string | null;
  terms: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignClaim = {
  id: string;
  company_id: string;
  campaign_id: string;
  reward_id: string | null;
  survey_id: string | null;
  response_id: string | null;
  code: string | null;
  claim_token: string | null;
  status: CampaignClaimStatus;
  issued_at: string;
  expires_at: string | null;
  redeemed_at: string | null;
  redeemed_by: string | null;
  identity_hash: string | null;
  device_hash: string | null;
  reward_snapshot: Record<string, unknown> | null;
  submission_key: string | null;
  created_at: string;
};

export const campaignStatusLabels: Record<CampaignStatus, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  archived: "Arquivada",
};

export const campaignTypeLabels: Record<CampaignType, string> = {
  reward_on_response: "Recompensa por resposta",
};

export const identityRequirementLabels: Record<IdentityRequirement, string> = {
  none: "Nenhuma",
  email: "E-mail",
  phone: "Telefone",
};

export const campaignRewardTypeLabels: Record<CampaignRewardType, string> = {
  percentage: "Percentual",
  fixed_amount: "Valor fixo",
  gift: "Brinde",
  custom: "Personalizado",
};

export const campaignCodeModeLabels: Record<CampaignCodeMode, string> = {
  unique: "Único",
  fixed: "Fixo",
};

export const campaignClaimStatusLabels: Record<CampaignClaimStatus, string> = {
  issued: "Emitida",
  redeemed: "Resgatada",
  voided: "Anulada",
};
