import {
  campaignCodeModes,
  campaignRewardTypes,
  campaignClaimStatuses,
  campaignStatuses,
  campaignTypes,
  identityRequirements,
} from "@/types/campaign";

export function isValidCampaignStatus(status: string) {
  return campaignStatuses.includes(status as (typeof campaignStatuses)[number]);
}

export function isValidCampaignType(type: string) {
  return campaignTypes.includes(type as (typeof campaignTypes)[number]);
}

export function isValidIdentityRequirement(requirement: string) {
  return identityRequirements.includes(
    requirement as (typeof identityRequirements)[number],
  );
}

export function isValidCampaignRewardType(type: string) {
  return campaignRewardTypes.includes(type as (typeof campaignRewardTypes)[number]);
}

export function isValidCampaignCodeMode(mode: string) {
  return campaignCodeModes.includes(mode as (typeof campaignCodeModes)[number]);
}

export function isValidCampaignClaimStatus(status: string) {
  return campaignClaimStatuses.includes(status as (typeof campaignClaimStatuses)[number]);
}

/**
 * A expiração de uma campanha é derivada de ends_at (nunca persistida como
 * status "expired"). Retorna true quando a data de término já passou.
 */
export function isCampaignExpired(
  campaign: { status: string; ends_at: string | null },
  now: Date = new Date(),
): boolean {
  if (campaign.status === "archived") {
    return false;
  }

  if (!campaign.ends_at) {
    return false;
  }

  const endsAt = new Date(campaign.ends_at);
  if (Number.isNaN(endsAt.getTime())) {
    return false;
  }

  return endsAt.getTime() <= now.getTime();
}

/**
 * Deriva o status efetivo de uma campanha para exibição: quando ela está
 * ativa/pausada mas terminou, exibe "Expirada". Não altera o valor persistido.
 */
export function deriveCampaignDisplayStatus(
  campaign: { status: string; ends_at: string | null },
  now: Date = new Date(),
): "draft" | "active" | "paused" | "archived" | "expired" {
  if (isCampaignExpired(campaign, now) && campaign.status !== "draft") {
    return "expired";
  }
  return campaign.status as "draft" | "active" | "paused" | "archived";
}

/**
 * Determina se uma claim emitida já expirou, com base em expires_at.
 */
export function isClaimExpired(
  claim: { status: string; expires_at: string | null },
  now: Date = new Date(),
): boolean {
  if (claim.status !== "issued" || !claim.expires_at) {
    return false;
  }

  const expiresAt = new Date(claim.expires_at);
  if (Number.isNaN(expiresAt.getTime())) {
    return false;
  }

  return expiresAt.getTime() <= now.getTime();
}
