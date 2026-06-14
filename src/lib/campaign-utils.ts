import { campaignStatuses } from "@/types/campaign";

export function isValidCampaignStatus(status: string) {
  return campaignStatuses.includes(status as (typeof campaignStatuses)[number]);
}
