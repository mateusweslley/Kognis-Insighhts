import { createHash, randomBytes } from "crypto";

import { isDynamicResponseAnswers } from "@/lib/response-utils";
import type {
  Campaign,
  CampaignCodeMode,
  CampaignReward,
  IdentityRequirement,
} from "@/types/campaign";
import type { ResponseAnswers } from "@/types/response";
import type {
  IssuedRewardPayload,
  RewardSnapshot,
  SubmissionEligibilityStatus,
} from "@/types/submission";
import type { SurveyQuestion } from "@/types/survey-question";

/**
 * Alfabeto sem caracteres ambíguos (0, O, 1, I) com 32 símbolos exatos.
 */
export const UNIQUE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const UNIQUE_CODE_PREFIX = "KOGNIS-";
export const UNIQUE_CODE_SUFFIX_LENGTH = 6;

const UNIQUE_CODE_REGEX = /^KOGNIS-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type TemporalEligibilityCandidate = Pick<
  Campaign,
  "status" | "starts_at" | "ends_at"
>;

export type QuestionIdentityMeta = Pick<SurveyQuestion, "id" | "type" | "position">;

export type ExtractedIdentityResult = {
  requirement: IdentityRequirement;
  required: boolean;
  rawValue: string | null;
  normalizedValue: string | null;
  identityHash: string | null;
  valid: boolean;
};

/**
 * 1. Elegibilidade temporal:
 * - campaign.status === "active"
 * - starts_at ausente ou <= now
 * - ends_at ausente ou > now
 */
export function isCampaignTemporallyEligible(
  campaign: TemporalEligibilityCandidate | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!campaign || campaign.status !== "active") {
    return false;
  }

  const nowMs = now.getTime();
  if (Number.isNaN(nowMs)) {
    return false;
  }

  if (campaign.starts_at) {
    const startsAtMs = new Date(campaign.starts_at).getTime();
    if (Number.isNaN(startsAtMs) || startsAtMs > nowMs) {
      return false;
    }
  }

  if (campaign.ends_at) {
    const endsAtMs = new Date(campaign.ends_at).getTime();
    if (Number.isNaN(endsAtMs) || endsAtMs <= nowMs) {
      return false;
    }
  }

  return true;
}

/**
 * 2 & 3. Normalização de e-mail e telefone:
 * - Email: lower(trim(value))
 * - Phone: somente dígitos
 */
export function normalizeIdentityEmail(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}

export function normalizeIdentityPhone(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\D/g, "");
}

export function isValidNormalizedEmail(normalizedEmail: string): boolean {
  if (!normalizedEmail || normalizedEmail.length > 254) {
    return false;
  }
  return BASIC_EMAIL_REGEX.test(normalizedEmail);
}

export function isValidNormalizedPhone(normalizedPhone: string): boolean {
  return normalizedPhone.length >= 10 && normalizedPhone.length <= 11;
}

/**
 * 4. Hash SHA-256 hexadecimal (lowercase) da identidade normalizada.
 */
export function hashIdentityValue(normalizedIdentity: string): string {
  const clean = normalizedIdentity.trim();
  if (!clean) {
    throw new Error("Cannot hash an empty identity value.");
  }
  return createHash("sha256").update(clean, "utf8").digest("hex");
}

/**
 * Extrai, normaliza e gera o hash SHA-256 da identidade do respondente
 * conforme identity_requirement ("none" | "email" | "phone").
 *
 * - Para respostas dinâmicas (answers.mode === "dynamic"), cruza as chaves
 *   (UUIDs) de answers.answers com survey_questions (id + type), respeitando
 *   a ordem de position.
 * - Para respostas legadas, extrai answers.email quando requirement === "email".
 *   O formulário legado não possui telefone.
 */
export function extractRespondentIdentity(
  requirement: IdentityRequirement,
  answers: ResponseAnswers,
  questions: QuestionIdentityMeta[] = [],
): ExtractedIdentityResult {
  if (requirement === "none") {
    return {
      requirement: "none",
      required: false,
      rawValue: null,
      normalizedValue: null,
      identityHash: null,
      valid: true,
    };
  }

  if (requirement === "email") {
    let rawEmail: string | null = null;

    if (isDynamicResponseAnswers(answers)) {
      const emailQuestion = [...questions]
        .filter((question) => question.type === "email")
        .sort((a, b) => a.position - b.position)[0];

      if (emailQuestion) {
        const candidate = answers.answers[emailQuestion.id];
        if (typeof candidate === "string") {
          rawEmail = candidate;
        } else if (typeof candidate === "number") {
          rawEmail = String(candidate);
        }
      }
    } else if (typeof answers.email === "string") {
      rawEmail = answers.email;
    }

    const normalizedEmail = normalizeIdentityEmail(rawEmail);
    const valid = isValidNormalizedEmail(normalizedEmail);

    return {
      requirement: "email",
      required: true,
      rawValue: rawEmail,
      normalizedValue: valid ? normalizedEmail : null,
      identityHash: valid ? hashIdentityValue(normalizedEmail) : null,
      valid,
    };
  }

  if (requirement === "phone") {
    let rawPhone: string | null = null;

    if (isDynamicResponseAnswers(answers)) {
      const phoneQuestion = [...questions]
        .filter((question) => question.type === "phone")
        .sort((a, b) => a.position - b.position)[0];

      if (phoneQuestion) {
        const candidate = answers.answers[phoneQuestion.id];
        if (typeof candidate === "string") {
          rawPhone = candidate;
        } else if (typeof candidate === "number") {
          rawPhone = String(candidate);
        }
      }
    }
    // Respostas legadas não possuem campo phone.

    const normalizedPhone = normalizeIdentityPhone(rawPhone);
    const valid = isValidNormalizedPhone(normalizedPhone);

    return {
      requirement: "phone",
      required: true,
      rawValue: rawPhone,
      normalizedValue: valid ? normalizedPhone : null,
      identityHash: valid ? hashIdentityValue(normalizedPhone) : null,
      valid,
    };
  }

  return {
    requirement,
    required: true,
    rawValue: null,
    normalizedValue: null,
    identityHash: null,
    valid: false,
  };
}

/**
 * 5. Construção do reward_snapshot imutável.
 */
export function buildRewardSnapshot(
  reward: Pick<
    CampaignReward,
    "id" | "type" | "title" | "description" | "value" | "code_mode" | "instructions" | "terms"
  >,
  campaign: Pick<Campaign, "name" | "completion_message">,
): RewardSnapshot {
  return {
    reward_id: reward.id,
    type: reward.type,
    title: reward.title ?? null,
    description: reward.description ?? null,
    value: reward.value ?? null,
    code_mode: reward.code_mode,
    instructions: reward.instructions ?? null,
    terms: reward.terms ?? null,
    campaign_name: campaign.name,
    completion_message: campaign.completion_message ?? null,
  };
}

/**
 * 6. Geração e validação de código de recompensa.
 * Formato unique: KOGNIS-XXXXXX (alfabeto sem 0/O/1/I).
 * Formato fixed: usa fixed_code da recompensa.
 */
export function generateUniqueClaimCode(entropyBytes?: Uint8Array): string {
  const bytes =
    entropyBytes && entropyBytes.length >= UNIQUE_CODE_SUFFIX_LENGTH
      ? entropyBytes
      : randomBytes(UNIQUE_CODE_SUFFIX_LENGTH);

  let suffix = "";
  for (let index = 0; index < UNIQUE_CODE_SUFFIX_LENGTH; index += 1) {
    const alphabetIndex = bytes[index] % UNIQUE_CODE_ALPHABET.length;
    suffix += UNIQUE_CODE_ALPHABET[alphabetIndex];
  }

  return `${UNIQUE_CODE_PREFIX}${suffix}`;
}

export function isValidUniqueClaimCode(code: string): boolean {
  return UNIQUE_CODE_REGEX.test(code);
}

export function resolveRewardClaimCode(
  reward: Pick<CampaignReward, "code_mode" | "fixed_code">,
  uniqueCodeGenerator: () => string = () => generateUniqueClaimCode(),
): string | null {
  if (reward.code_mode === "fixed") {
    const trimmed = reward.fixed_code?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : null;
  }

  if (reward.code_mode === "unique") {
    const generated = uniqueCodeGenerator().trim();
    return isValidUniqueClaimCode(generated) ? generated : null;
  }

  return null;
}

export function computeClaimExpirationDate(
  issuedAt: Date,
  claimValidityDays: number | null | undefined,
): string | null {
  if (
    typeof claimValidityDays !== "number" ||
    !Number.isInteger(claimValidityDays) ||
    claimValidityDays <= 0
  ) {
    return null;
  }

  const expiresAt = new Date(issuedAt.getTime() + claimValidityDays * 24 * 60 * 60 * 1000);
  return expiresAt.toISOString();
}

export function buildIssuedRewardPayload(params: {
  snapshot: RewardSnapshot;
  code: string;
  claimToken: string | null;
  issuedAt: string;
  expiresAt: string | null;
}): IssuedRewardPayload {
  const { snapshot, code, claimToken, issuedAt, expiresAt } = params;

  return {
    title: snapshot.title,
    description: snapshot.description,
    type: snapshot.type,
    value: snapshot.value,
    code_mode: snapshot.code_mode as CampaignCodeMode,
    code,
    claim_token: claimToken,
    instructions: snapshot.instructions,
    terms: snapshot.terms,
    expires_at: expiresAt,
    issued_at: issuedAt,
    completion_message: snapshot.completion_message,
  };
}

export type IssuanceEvaluationInput = {
  campaign: Campaign | null;
  reward: CampaignReward | null;
  answers: ResponseAnswers;
  questions?: QuestionIdentityMeta[];
  activeClaimsCount: number;
  existingIdentityHashes?: ReadonlySet<string> | string[];
  existingUniqueCodes?: ReadonlySet<string> | string[];
  now?: Date;
  uniqueCodeGenerator?: () => string;
  claimTokenGenerator?: () => string;
};

export type IssuanceEvaluationResult = {
  status: SubmissionEligibilityStatus;
  identityHash: string | null;
  snapshot: RewardSnapshot | null;
  rewardPayload: IssuedRewardPayload | null;
};

/**
 * Avaliador puro de elegibilidade e emissão (sem banco/Supabase).
 * Espelha as regras da RPC para testes unitários determinísticos de todos os
 * estados internos (not_applicable, issued, already_claimed, out_of_stock,
 * missing_identity, skipped_error).
 */
export function evaluateCampaignIssuance(
  input: IssuanceEvaluationInput,
): IssuanceEvaluationResult {
  const now = input.now ?? new Date();

  try {
    const { campaign, reward, answers, questions = [], activeClaimsCount } = input;

    if (!isCampaignTemporallyEligible(campaign, now) || !campaign) {
      return {
        status: "not_applicable",
        identityHash: null,
        snapshot: null,
        rewardPayload: null,
      };
    }

    if (!reward || reward.campaign_id !== campaign.id) {
      return {
        status: "not_applicable",
        identityHash: null,
        snapshot: null,
        rewardPayload: null,
      };
    }

    if (
      typeof campaign.max_claims_total === "number" &&
      activeClaimsCount >= campaign.max_claims_total
    ) {
      return {
        status: "out_of_stock",
        identityHash: null,
        snapshot: null,
        rewardPayload: null,
      };
    }

    const identity = extractRespondentIdentity(
      campaign.identity_requirement,
      answers,
      questions,
    );

    if (identity.required && (!identity.valid || !identity.identityHash)) {
      return {
        status: "missing_identity",
        identityHash: null,
        snapshot: null,
        rewardPayload: null,
      };
    }

    const identitySet =
      input.existingIdentityHashes instanceof Set
        ? input.existingIdentityHashes
        : new Set(input.existingIdentityHashes ?? []);

    if (identity.identityHash && identitySet.has(identity.identityHash)) {
      return {
        status: "already_claimed",
        identityHash: identity.identityHash,
        snapshot: null,
        rewardPayload: null,
      };
    }

    const uniqueCodeSet =
      input.existingUniqueCodes instanceof Set
        ? input.existingUniqueCodes
        : new Set(input.existingUniqueCodes ?? []);

    let resolvedCode: string | null = null;
    if (reward.code_mode === "fixed") {
      resolvedCode = resolveRewardClaimCode(reward);
    } else if (reward.code_mode === "unique") {
      const generator = input.uniqueCodeGenerator ?? (() => generateUniqueClaimCode());
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = resolveRewardClaimCode(reward, generator);
        if (candidate && !uniqueCodeSet.has(candidate)) {
          resolvedCode = candidate;
          break;
        }
      }
    }

    if (!resolvedCode) {
      return {
        status: "skipped_error",
        identityHash: identity.identityHash,
        snapshot: null,
        rewardPayload: null,
      };
    }

    const snapshot = buildRewardSnapshot(reward, campaign);
    const issuedAt = now.toISOString();
    const expiresAt = computeClaimExpirationDate(now, campaign.claim_validity_days);
    const claimToken = input.claimTokenGenerator
      ? input.claimTokenGenerator()
      : randomBytes(16).toString("hex");

    const rewardPayload = buildIssuedRewardPayload({
      snapshot,
      code: resolvedCode,
      claimToken,
      issuedAt,
      expiresAt,
    });

    return {
      status: "issued",
      identityHash: identity.identityHash,
      snapshot,
      rewardPayload,
    };
  } catch {
    return {
      status: "skipped_error",
      identityHash: null,
      snapshot: null,
      rewardPayload: null,
    };
  }
}
