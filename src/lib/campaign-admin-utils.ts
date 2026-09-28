import {
  deriveCampaignDisplayStatus,
  isValidCampaignCodeMode,
  isValidCampaignRewardType,
  isValidCampaignStatus,
  isValidCampaignType,
  isValidIdentityRequirement,
} from "@/lib/campaign-utils";
import type {
  Campaign,
  CampaignClaim,
  CampaignCodeMode,
  CampaignDisplayStatus,
  CampaignReward,
  CampaignRewardType,
  CampaignStatus,
  CampaignSurvey,
  CampaignType,
  CampaignWithSurvey,
  IdentityRequirement,
  SanitizedCampaignClaimView,
} from "@/types/campaign";
import type { IssuedRewardPayload } from "@/types/submission";
import type { Survey } from "@/types/survey";

export const DEFAULT_CAMPAIGN_COMPLETION_MESSAGE =
  "Sua participação foi registrada com sucesso.";

export const PREVIEW_UNIQUE_CODE_EXAMPLE = "KOGNIS-EXEMPLO";

export type CampaignRewardFormInput = {
  enabled: boolean;
  type: CampaignRewardType;
  codeMode: CampaignCodeMode;
  fixedCode?: string | null;
  title?: string | null;
  description?: string | null;
  value?: string | number | null;
  instructions?: string | null;
  terms?: string | null;
};

export type CampaignAdminFormInput = {
  name: string;
  description?: string | null;
  campaignType?: string;
  status: string;
  surveyId?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  maxClaimsTotal?: string | number | null;
  identityRequirement?: string;
  claimValidityDays?: string | number | null;
  completionMessage?: string | null;
  reward?: CampaignRewardFormInput | null;
};

export type ValidatedCampaignRewardPayload = {
  type: CampaignRewardType;
  code_mode: CampaignCodeMode;
  fixed_code: string | null;
  title: string | null;
  description: string | null;
  value: number | null;
  instructions: string | null;
  terms: string | null;
};

export type ValidatedCampaignAdminPayload = {
  name: string;
  description: string | null;
  campaign_type: CampaignType;
  status: CampaignStatus;
  survey_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  max_claims_total: number | null;
  identity_requirement: IdentityRequirement;
  claim_validity_days: number | null;
  completion_message: string | null;
  reward: ValidatedCampaignRewardPayload | null;
};

export type CampaignAdminValidationContext = {
  companyId?: string;
  editingCampaignId?: string | null;
  currentCampaignStatus?: CampaignStatus | null;
  availableSurveys?: Array<Pick<Survey, "id" | "company_id" | "title">>;
  existingCampaigns?: Array<
    Pick<CampaignWithSurvey, "id" | "company_id" | "name" | "status" | "survey_id" | "linked_survey_id">
  >;
};

export type CampaignAdminValidationResult =
  | {
      valid: true;
      data: ValidatedCampaignAdminPayload;
      error: null;
    }
  | {
      valid: false;
      data: null;
      error: string;
    };

export type CampaignLifecyclePermissions = {
  displayStatus: CampaignDisplayStatus;
  isExpired: boolean;
  isReadOnly: boolean;
  canEdit: boolean;
  canActivate: boolean;
  canPause: boolean;
  canReactivate: boolean;
  canArchive: boolean;
};

/**
 * Resolve o survey_id efetivo da campanha priorizando os vínculos N:N de
 * `campaign_surveys` e mantendo fallback compatível para `campaigns.survey_id`.
 */
export function resolveEffectiveCampaignSurveyId(
  campaign: Pick<Campaign, "id" | "survey_id">,
  campaignSurveys: Array<Pick<CampaignSurvey, "campaign_id" | "survey_id">> = [],
): string | null {
  const linked = campaignSurveys.find((item) => item.campaign_id === campaign.id);
  if (linked?.survey_id) {
    return linked.survey_id;
  }

  return campaign.survey_id ?? null;
}

/**
 * Determina as permissões e ações disponíveis de acordo com o ciclo de vida:
 * - Draft: editar, ativar, arquivar
 * - Active: editar, pausar, arquivar (exibe "Expirada" quando ends_at <= now())
 * - Paused: editar, reativar, arquivar
 * - Archived: somente leitura (sem edição)
 */
export function getCampaignLifecyclePermissions(
  campaign: Pick<Campaign, "status" | "ends_at">,
  now: Date = new Date(),
): CampaignLifecyclePermissions {
  const displayStatus = deriveCampaignDisplayStatus(campaign, now);
  const isArchived = campaign.status === "archived";

  return {
    displayStatus,
    isExpired: displayStatus === "expired",
    isReadOnly: isArchived,
    canEdit: !isArchived,
    canActivate: campaign.status === "draft",
    canPause: campaign.status === "active",
    canReactivate: campaign.status === "paused",
    canArchive: !isArchived,
  };
}

/**
 * Verifica se já existe outra campanha ativa vinculada à mesma pesquisa na empresa.
 */
export function findActiveCampaignConflict(
  surveyId: string | null | undefined,
  existingCampaigns: Array<
    Pick<
      CampaignWithSurvey,
      "id" | "company_id" | "name" | "status" | "survey_id" | "linked_survey_id"
    >
  >,
  options?: {
    companyId?: string;
    excludeCampaignId?: string | null;
  },
): Pick<CampaignWithSurvey, "id" | "name"> | null {
  const normalizedSurveyId = surveyId?.trim() || null;
  if (!normalizedSurveyId) {
    return null;
  }

  for (const existing of existingCampaigns) {
    if (options?.excludeCampaignId && existing.id === options.excludeCampaignId) {
      continue;
    }

    if (options?.companyId && existing.company_id !== options.companyId) {
      continue;
    }

    if (existing.status !== "active") {
      continue;
    }

    const effectiveSurveyId = existing.linked_survey_id ?? existing.survey_id ?? null;
    if (effectiveSurveyId === normalizedSurveyId) {
      return { id: existing.id, name: existing.name };
    }
  }

  return null;
}

/**
 * Validação pura e completa para criação e atualização administrativa de campanhas.
 */
export function validateCampaignAdminInput(
  input: CampaignAdminFormInput,
  context: CampaignAdminValidationContext = {},
): CampaignAdminValidationResult {
  if (context.currentCampaignStatus === "archived") {
    return {
      valid: false,
      data: null,
      error: "Campanhas arquivadas estão em modo somente leitura e não podem ser editadas.",
    };
  }

  const name = (input.name ?? "").trim();
  if (name.length < 3) {
    return {
      valid: false,
      data: null,
      error: "Informe um nome com pelo menos 3 caracteres.",
    };
  }

  const description = normalizeOptionalText(input.description);
  const campaignTypeRaw = input.campaignType ?? "reward_on_response";
  if (!isValidCampaignType(campaignTypeRaw)) {
    return {
      valid: false,
      data: null,
      error: "Escolha um tipo de campanha válido.",
    };
  }

  if (!isValidCampaignStatus(input.status)) {
    return {
      valid: false,
      data: null,
      error: "Escolha um status válido para a campanha.",
    };
  }

  const startsAtResult = parseOptionalIsoDate(input.startsAt);
  if (!startsAtResult.valid) {
    return {
      valid: false,
      data: null,
      error: "A data de início informada é inválida.",
    };
  }

  const endsAtResult = parseOptionalIsoDate(input.endsAt);
  if (!endsAtResult.valid) {
    return {
      valid: false,
      data: null,
      error: "A data de término informada é inválida.",
    };
  }

  if (
    startsAtResult.iso &&
    endsAtResult.iso &&
    new Date(startsAtResult.iso).getTime() > new Date(endsAtResult.iso).getTime()
  ) {
    return {
      valid: false,
      data: null,
      error: "A data de término deve ser igual ou posterior à data de início.",
    };
  }

  const maxClaimsResult = parseOptionalPositiveInteger(input.maxClaimsTotal);
  if (!maxClaimsResult.valid) {
    return {
      valid: false,
      data: null,
      error: "O limite total de recompensas deve ser um número inteiro maior que zero.",
    };
  }

  const validityDaysResult = parseOptionalPositiveInteger(input.claimValidityDays);
  if (!validityDaysResult.valid) {
    return {
      valid: false,
      data: null,
      error: "A validade da recompensa (em dias) deve ser um número inteiro maior que zero.",
    };
  }

  const identityRaw = input.identityRequirement ?? "none";
  if (!isValidIdentityRequirement(identityRaw)) {
    return {
      valid: false,
      data: null,
      error: "Escolha uma regra de identificação válida (Nenhuma, E-mail ou Telefone).",
    };
  }

  const surveyId = normalizeOptionalText(input.surveyId);
  if (surveyId && context.availableSurveys) {
    const matchedSurvey = context.availableSurveys.find((survey) => survey.id === surveyId);
    if (!matchedSurvey) {
      return {
        valid: false,
        data: null,
        error: "A pesquisa selecionada não foi encontrada para esta empresa.",
      };
    }

    if (context.companyId && matchedSurvey.company_id !== context.companyId) {
      return {
        valid: false,
        data: null,
        error: "A pesquisa vinculada deve pertencer à mesma empresa da campanha.",
      };
    }
  }

  if (input.status === "active" && surveyId && context.existingCampaigns) {
    const conflict = findActiveCampaignConflict(surveyId, context.existingCampaigns, {
      companyId: context.companyId,
      excludeCampaignId: context.editingCampaignId,
    });

    if (conflict) {
      return {
        valid: false,
        data: null,
        error: `Esta pesquisa já possui uma campanha ativa ("${conflict.name}"). Pause ou arquive a campanha atual antes de ativar outra para a mesma pesquisa.`,
      };
    }
  }

  let validatedReward: ValidatedCampaignRewardPayload | null = null;
  if (input.reward?.enabled) {
    const rewardValidation = validateCampaignRewardInput(input.reward);
    if (!rewardValidation.valid) {
      return {
        valid: false,
        data: null,
        error: rewardValidation.error,
      };
    }
    validatedReward = rewardValidation.data;
  }

  const completionMessage = normalizeOptionalText(input.completionMessage);

  return {
    valid: true,
    data: {
      name,
      description,
      campaign_type: campaignTypeRaw as CampaignType,
      status: input.status as CampaignStatus,
      survey_id: surveyId,
      starts_at: startsAtResult.iso,
      ends_at: endsAtResult.iso,
      max_claims_total: maxClaimsResult.value,
      identity_requirement: identityRaw as IdentityRequirement,
      claim_validity_days: validityDaysResult.value,
      completion_message: completionMessage,
      reward: validatedReward,
    },
    error: null,
  };
}

export function validateCampaignRewardInput(
  reward: CampaignRewardFormInput,
):
  | { valid: true; data: ValidatedCampaignRewardPayload; error: null }
  | { valid: false; data: null; error: string } {
  if (!isValidCampaignRewardType(reward.type)) {
    return {
      valid: false,
      data: null,
      error: "Escolha um tipo de recompensa válido.",
    };
  }

  if (!isValidCampaignCodeMode(reward.codeMode)) {
    return {
      valid: false,
      data: null,
      error: "Escolha um modo de código válido (Único ou Fixo).",
    };
  }

  let fixedCode: string | null = null;
  if (reward.codeMode === "fixed") {
    const trimmedCode = normalizeOptionalText(reward.fixedCode)?.toUpperCase() ?? null;
    if (!trimmedCode || trimmedCode.length < 2) {
      return {
        valid: false,
        data: null,
        error: "Informe um código fixo (mínimo de 2 caracteres) para recompensas com código compartilhado.",
      };
    }
    fixedCode = trimmedCode;
  }

  const parsedValue = parseOptionalNumber(reward.value);
  if (!parsedValue.valid) {
    return {
      valid: false,
      data: null,
      error: "Informe um valor numérico válido para a recompensa.",
    };
  }

  if (reward.type === "percentage") {
    if (parsedValue.value === null || parsedValue.value <= 0 || parsedValue.value > 100) {
      return {
        valid: false,
        data: null,
        error: "Para desconto percentual, informe um valor entre 1 e 100%.",
      };
    }
  } else if (reward.type === "fixed_amount") {
    if (parsedValue.value === null || parsedValue.value <= 0) {
      return {
        valid: false,
        data: null,
        error: "Para valor fixo, informe um valor maior que zero.",
      };
    }
  } else if (parsedValue.value !== null && parsedValue.value < 0) {
    return {
      valid: false,
      data: null,
      error: "O valor da recompensa não pode ser negativo.",
    };
  }

  const title = normalizeOptionalText(reward.title);
  if ((reward.type === "gift" || reward.type === "custom") && !title) {
    return {
      valid: false,
      data: null,
      error: "Informe um título para identificar o brinde ou benefício personalizado.",
    };
  }

  return {
    valid: true,
    data: {
      type: reward.type,
      code_mode: reward.codeMode,
      // Quando codeMode === "unique", nunca persiste fixed_code
      fixed_code: reward.codeMode === "fixed" ? fixedCode : null,
      title,
      description: normalizeOptionalText(reward.description),
      value: parsedValue.value,
      instructions: normalizeOptionalText(reward.instructions),
      terms: normalizeOptionalText(reward.terms),
    },
    error: null,
  };
}

export function resolveCampaignCompletionMessage(
  completionMessage: string | null | undefined,
): string {
  const trimmed = normalizeOptionalText(completionMessage);
  return trimmed ?? DEFAULT_CAMPAIGN_COMPLETION_MESSAGE;
}

/**
 * Constrói o payload de preview administrativo reutilizando o contrato de
 * `SubmissionCompletionCard` sem executar o Submission Gateway nem gravar no banco.
 */
export function buildCampaignPreviewPayload(params: {
  completionMessage?: string | null;
  claimValidityDays?: number | null;
  reward?: ValidatedCampaignRewardPayload | CampaignReward | null;
  now?: Date;
}): {
  completionMessage: string;
  reward: IssuedRewardPayload | null;
} {
  const now = params.now ?? new Date();
  const completionMessage = resolveCampaignCompletionMessage(params.completionMessage);
  const reward = params.reward ?? null;

  if (!reward) {
    return {
      completionMessage,
      reward: null,
    };
  }

  const exampleCode =
    reward.code_mode === "fixed"
      ? normalizeOptionalText(reward.fixed_code)?.toUpperCase() ?? "CODIGOFIXO"
      : PREVIEW_UNIQUE_CODE_EXAMPLE;

  const expiresAt =
    typeof params.claimValidityDays === "number" && params.claimValidityDays > 0
      ? new Date(now.getTime() + params.claimValidityDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

  return {
    completionMessage,
    reward: {
      title: reward.title ?? null,
      description: reward.description ?? null,
      type: reward.type,
      value: reward.value ?? null,
      code_mode: reward.code_mode,
      code: exampleCode,
      claim_token: null,
      instructions: reward.instructions ?? null,
      terms: reward.terms ?? null,
      expires_at: expiresAt,
      issued_at: now.toISOString(),
      completion_message: completionMessage,
    },
  };
}

/**
 * Sanitiza um registro de `CampaignClaim` para exibição administrativa.
 * NUNCA expõe `identity_hash`, `device_hash`, `claim_token` ou `submission_key`.
 */
export function sanitizeClaimForAdminView(
  claim: CampaignClaim,
  options?: {
    identityRequirement?: IdentityRequirement;
    surveyTitleById?: ReadonlyMap<string, string> | Record<string, string>;
  },
): SanitizedCampaignClaimView {
  const hasIdentity = Boolean(claim.identity_hash && claim.identity_hash.trim().length > 0);
  let identityLabel = "Participação sem identificação";

  if (hasIdentity) {
    if (options?.identityRequirement === "email") {
      identityLabel = "E-mail verificado";
    } else if (options?.identityRequirement === "phone") {
      identityLabel = "Telefone verificado";
    } else {
      identityLabel = "Identidade verificada";
    }
  }

  let surveyTitle: string | null = null;
  if (claim.survey_id && options?.surveyTitleById) {
    const titleLookup = options.surveyTitleById;
    if ("get" in titleLookup && typeof titleLookup.get === "function") {
      surveyTitle = titleLookup.get(claim.survey_id) ?? null;
    } else {
      surveyTitle = (titleLookup as Record<string, string>)[claim.survey_id] ?? null;
    }
  }

  const snapshot = claim.reward_snapshot;
  const rewardTitle =
    snapshot && typeof snapshot.title === "string" && snapshot.title.trim()
      ? snapshot.title.trim()
      : null;

  return {
    id: claim.id,
    campaign_id: claim.campaign_id,
    survey_id: claim.survey_id ?? null,
    survey_title: surveyTitle,
    code: claim.code ?? null,
    status: claim.status,
    issued_at: claim.issued_at,
    expires_at: claim.expires_at ?? null,
    redeemed_at: claim.redeemed_at ?? null,
    identity_label: identityLabel,
    reward_title: rewardTitle,
  };
}

export function sanitizeClaimsForAdminView(
  claims: CampaignClaim[],
  options?: {
    identityRequirement?: IdentityRequirement;
    surveyTitleById?: ReadonlyMap<string, string> | Record<string, string>;
  },
): SanitizedCampaignClaimView[] {
  return claims.map((claim) => sanitizeClaimForAdminView(claim, options));
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalIsoDate(value: string | null | undefined): {
  valid: boolean;
  iso: string | null;
} {
  const trimmed = normalizeOptionalText(value);
  if (!trimmed) {
    return { valid: true, iso: null };
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return { valid: false, iso: null };
  }

  return { valid: true, iso: parsed.toISOString() };
}

function parseOptionalPositiveInteger(value: string | number | null | undefined): {
  valid: boolean;
  value: number | null;
} {
  if (value === null || value === undefined || value === "") {
    return { valid: true, value: null };
  }

  if (typeof value === "string" && value.trim() === "") {
    return { valid: true, value: null };
  }

  const num = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(num) || num <= 0) {
    return { valid: false, value: null };
  }

  return { valid: true, value: num };
}

function parseOptionalNumber(value: string | number | null | undefined): {
  valid: boolean;
  value: number | null;
} {
  if (value === null || value === undefined || value === "") {
    return { valid: true, value: null };
  }

  if (typeof value === "string") {
    const cleaned = value.trim().replace(",", ".");
    if (!cleaned) {
      return { valid: true, value: null };
    }
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) {
      return { valid: false, value: null };
    }
    return { valid: true, value: parsed };
  }

  if (!Number.isFinite(value)) {
    return { valid: false, value: null };
  }

  return { valid: true, value };
}
