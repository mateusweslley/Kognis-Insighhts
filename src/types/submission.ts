import type { CampaignCodeMode, CampaignRewardType } from "@/types/campaign";
import type { ResponseAnswers } from "@/types/response";

export const submissionEligibilityStatuses = [
  "not_applicable",
  "issued",
  "already_claimed",
  "out_of_stock",
  "missing_identity",
  "skipped_error",
] as const;

export type SubmissionEligibilityStatus = (typeof submissionEligibilityStatuses)[number];

/**
 * Snapshot imutável persistido em campaign_claims.reward_snapshot no momento
 * da emissão, garantindo auditoria histórica mesmo se a recompensa ou campanha
 * forem editadas posteriormente pela empresa.
 */
export type RewardSnapshot = {
  reward_id: string;
  type: CampaignRewardType;
  title: string | null;
  description: string | null;
  value: number | null;
  code_mode: CampaignCodeMode;
  instructions: string | null;
  terms: string | null;
  campaign_name: string;
  completion_message: string | null;
};

/**
 * Contrato mínimo e seguro retornado ao respondente público quando um
 * benefício é efetivamente emitido. Nunca inclui company_id, owner_id,
 * contagens de estoque ou dados administrativos internos.
 */
export type IssuedRewardPayload = {
  title: string | null;
  description: string | null;
  type: CampaignRewardType;
  value: number | null;
  code_mode: CampaignCodeMode;
  code: string;
  claim_token: string | null;
  instructions: string | null;
  terms: string | null;
  expires_at: string | null;
  issued_at: string;
  completion_message: string | null;
};

export type SubmissionGatewayInput = {
  surveyId: string;
  answers: ResponseAnswers;
  submissionKey: string;
  deviceHash?: string | null;
};

export type SubmissionGatewayResult = {
  submitted: boolean;
  responseId: string | null;
  completionMessage: string | null;
  reward: IssuedRewardPayload | null;
  error: string | null;
};
