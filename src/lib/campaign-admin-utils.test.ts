import { describe, expect, it } from "vitest";

import {
  buildCampaignPreviewPayload,
  DEFAULT_CAMPAIGN_COMPLETION_MESSAGE,
  findActiveCampaignConflict,
  getCampaignLifecyclePermissions,
  PREVIEW_UNIQUE_CODE_EXAMPLE,
  resolveCampaignCompletionMessage,
  resolveEffectiveCampaignSurveyId,
  sanitizeClaimForAdminView,
  sanitizeClaimsForAdminView,
  validateCampaignAdminInput,
  type CampaignAdminFormInput,
} from "@/lib/campaign-admin-utils";
import type { CampaignClaim, CampaignWithSurvey } from "@/types/campaign";
import type { Survey } from "@/types/survey";

const FIXED_NOW = new Date("2026-09-28T15:00:00.000Z");

const COMPANY_A_SURVEYS: Survey[] = [
  {
    id: "surv-a1",
    company_id: "comp-a",
    title: "Pesquisa de Satisfação Loja Centro",
    description: "Avalie sua experiência",
    status: "active",
    objective: "satisfaction",
    objective_note: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "surv-a2",
    company_id: "comp-a",
    title: "Pesquisa Pós-Venda",
    description: null,
    status: "active",
    objective: "customer_experience",
    objective_note: null,
    created_at: "2026-09-02T00:00:00.000Z",
    updated_at: "2026-09-02T00:00:00.000Z",
  },
];

function makeBaseAdminInput(overrides: Partial<CampaignAdminFormInput> = {}): CampaignAdminFormInput {
  return {
    name: "Campanha Clientes Outubro",
    description: "Cupom para quem responder à pesquisa",
    campaignType: "reward_on_response",
    status: "draft",
    surveyId: "surv-a1",
    startsAt: "2026-09-01T00:00:00.000Z",
    endsAt: "2026-10-31T23:59:59.999Z",
    maxClaimsTotal: 100,
    identityRequirement: "email",
    claimValidityDays: 15,
    completionMessage: "Obrigado! Apresente seu código no caixa.",
    reward: {
      enabled: true,
      type: "percentage",
      codeMode: "unique",
      fixedCode: null,
      title: "10% OFF",
      description: "Em toda a loja",
      value: 10,
      instructions: "Mostre no caixa",
      terms: "Uso único",
    },
    ...overrides,
  };
}

function makeExistingCampaign(overrides: Partial<CampaignWithSurvey> = {}): CampaignWithSurvey {
  return {
    id: "camp-existing-1",
    company_id: "comp-a",
    survey_id: "surv-a1",
    linked_survey_id: "surv-a1",
    survey_title: "Pesquisa de Satisfação Loja Centro",
    name: "Campanha Já Ativa",
    description: null,
    status: "active",
    campaign_type: "reward_on_response",
    starts_at: null,
    ends_at: null,
    max_claims_total: null,
    identity_requirement: "none",
    claim_validity_days: null,
    completion_message: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Sprint 3 — Administração de Campanhas e Recompensas (campaign-admin-utils)", () => {
  it("1. Criação de campanha: valida e normaliza todos os campos básicos, período, regras e recompensa", () => {
    const validation = validateCampaignAdminInput(makeBaseAdminInput(), {
      companyId: "comp-a",
      availableSurveys: COMPANY_A_SURVEYS,
      existingCampaigns: [],
    });

    expect(validation.valid).toBe(true);
    if (!validation.valid) return;

    expect(validation.data).toMatchObject({
      name: "Campanha Clientes Outubro",
      description: "Cupom para quem responder à pesquisa",
      campaign_type: "reward_on_response",
      status: "draft",
      survey_id: "surv-a1",
      max_claims_total: 100,
      identity_requirement: "email",
      claim_validity_days: 15,
      completion_message: "Obrigado! Apresente seu código no caixa.",
    });
    expect(validation.data.reward).toMatchObject({
      type: "percentage",
      code_mode: "unique",
      fixed_code: null,
      title: "10% OFF",
      value: 10,
    });
  });

  it("2. Atualização de campanha: permite editar a própria campanha ativa sem acusar falso conflito consigo mesma", () => {
    const existing = makeExistingCampaign({ id: "camp-1", survey_id: "surv-a1" });

    const validation = validateCampaignAdminInput(
      makeBaseAdminInput({
        name: "Campanha Atualizada",
        status: "active",
        surveyId: "surv-a1",
      }),
      {
        companyId: "comp-a",
        editingCampaignId: "camp-1",
        currentCampaignStatus: "active",
        availableSurveys: COMPANY_A_SURVEYS,
        existingCampaigns: [existing],
      },
    );

    expect(validation.valid).toBe(true);
    if (!validation.valid) return;
    expect(validation.data.name).toBe("Campanha Atualizada");
    expect(validation.data.status).toBe("active");
  });

  it("3. Recompensa fixed: exige fixed_code válido e normaliza para maiúsculas", () => {
    const missingCode = validateCampaignAdminInput(
      makeBaseAdminInput({
        reward: {
          enabled: true,
          type: "percentage",
          codeMode: "fixed",
          fixedCode: " ",
          value: 15,
        },
      }),
    );

    expect(missingCode.valid).toBe(false);
    expect(missingCode.error).toContain("código fixo");

    const validFixed = validateCampaignAdminInput(
      makeBaseAdminInput({
        reward: {
          enabled: true,
          type: "percentage",
          codeMode: "fixed",
          fixedCode: " kognis15 ",
          value: 15,
        },
      }),
    );

    expect(validFixed.valid).toBe(true);
    if (!validFixed.valid) return;
    expect(validFixed.data.reward?.code_mode).toBe("fixed");
    expect(validFixed.data.reward?.fixed_code).toBe("KOGNIS15");
  });

  it("4. Recompensa unique: não exige fixed_code e garante fixed_code = null mesmo se enviado", () => {
    const uniqueReward = validateCampaignAdminInput(
      makeBaseAdminInput({
        reward: {
          enabled: true,
          type: "fixed_amount",
          codeMode: "unique",
          fixedCode: "SOBRA-IGNORADA",
          value: 25,
        },
      }),
    );

    expect(uniqueReward.valid).toBe(true);
    if (!uniqueReward.valid) return;
    expect(uniqueReward.data.reward?.code_mode).toBe("unique");
    expect(uniqueReward.data.reward?.fixed_code).toBeNull();
    expect(uniqueReward.data.reward?.value).toBe(25);
  });

  it("5. Campanha sem recompensa: permite salvar campanha com reward = null quando desabilitada", () => {
    const noReward = validateCampaignAdminInput(
      makeBaseAdminInput({
        reward: {
          enabled: false,
          type: "percentage",
          codeMode: "unique",
        },
      }),
    );

    expect(noReward.valid).toBe(true);
    if (!noReward.valid) return;
    expect(noReward.data.reward).toBeNull();
  });

  it("6. Limite inválido: rejeita max_claims_total zero, negativo ou decimal", () => {
    expect(
      validateCampaignAdminInput(makeBaseAdminInput({ maxClaimsTotal: 0 })).valid,
    ).toBe(false);
    expect(
      validateCampaignAdminInput(makeBaseAdminInput({ maxClaimsTotal: -10 })).valid,
    ).toBe(false);
    expect(
      validateCampaignAdminInput(makeBaseAdminInput({ maxClaimsTotal: "12.5" })).valid,
    ).toBe(false);
    expect(
      validateCampaignAdminInput(makeBaseAdminInput({ maxClaimsTotal: "" })).valid,
    ).toBe(true);
  });

  it("7. Validade inválida: rejeita claim_validity_days zero, negativo ou inválido e datas invertidas", () => {
    expect(
      validateCampaignAdminInput(makeBaseAdminInput({ claimValidityDays: 0 })).valid,
    ).toBe(false);
    expect(
      validateCampaignAdminInput(makeBaseAdminInput({ claimValidityDays: -5 })).valid,
    ).toBe(false);
    expect(
      validateCampaignAdminInput(
        makeBaseAdminInput({
          startsAt: "2026-10-15T00:00:00.000Z",
          endsAt: "2026-10-01T00:00:00.000Z",
        }),
      ).valid,
    ).toBe(false);
  });

  it("8. Identidade inválida: rejeita valores fora de none | email | phone", () => {
    const invalidIdentity = validateCampaignAdminInput(
      makeBaseAdminInput({ identityRequirement: "cpf" }),
    );

    expect(invalidIdentity.valid).toBe(false);
    expect(invalidIdentity.error).toContain("identificação");
  });

  it("9. Campanha expirada derivada: exibe status 'expired' quando ativa e ends_at <= now, sem permitir persistir 'expired' no banco", () => {
    const permissions = getCampaignLifecyclePermissions(
      {
        status: "active",
        ends_at: "2026-09-01T00:00:00.000Z",
      },
      FIXED_NOW,
    );

    expect(permissions.displayStatus).toBe("expired");
    expect(permissions.isExpired).toBe(true);
    expect(permissions.canEdit).toBe(true);
    expect(permissions.canPause).toBe(true);
    expect(permissions.canArchive).toBe(true);

    // Tentativa de salvar status = "expired" diretamente no banco deve ser rejeitada
    const attemptPersistExpired = validateCampaignAdminInput(
      makeBaseAdminInput({ status: "expired" }),
    );
    expect(attemptPersistExpired.valid).toBe(false);
  });

  it("10. Campanha pausada: permite editar, reativar e arquivar", () => {
    const permissions = getCampaignLifecyclePermissions(
      {
        status: "paused",
        ends_at: "2026-10-30T00:00:00.000Z",
      },
      FIXED_NOW,
    );

    expect(permissions.displayStatus).toBe("paused");
    expect(permissions.canEdit).toBe(true);
    expect(permissions.canReactivate).toBe(true);
    expect(permissions.canArchive).toBe(true);
    expect(permissions.canPause).toBe(false);
  });

  it("11. Campanha arquivada: fica em modo somente leitura e bloqueia edição", () => {
    const permissions = getCampaignLifecyclePermissions(
      {
        status: "archived",
        ends_at: null,
      },
      FIXED_NOW,
    );

    expect(permissions.displayStatus).toBe("archived");
    expect(permissions.isReadOnly).toBe(true);
    expect(permissions.canEdit).toBe(false);
    expect(permissions.canActivate).toBe(false);
    expect(permissions.canPause).toBe(false);
    expect(permissions.canReactivate).toBe(false);
    expect(permissions.canArchive).toBe(false);

    const editArchivedAttempt = validateCampaignAdminInput(makeBaseAdminInput(), {
      currentCampaignStatus: "archived",
    });
    expect(editArchivedAttempt.valid).toBe(false);
    expect(editArchivedAttempt.error).toContain("somente leitura");
  });

  it("12. Isolamento entre empresas: impede vincular pesquisa pertencente a outra empresa", () => {
    const companyBSurvey: Survey = {
      ...COMPANY_A_SURVEYS[0],
      id: "surv-b1",
      company_id: "comp-b",
      title: "Pesquisa Empresa B",
    };

    const crossCompanyAttempt = validateCampaignAdminInput(
      makeBaseAdminInput({ surveyId: "surv-b1" }),
      {
        companyId: "comp-a",
        availableSurveys: [...COMPANY_A_SURVEYS, companyBSurvey],
      },
    );

    expect(crossCompanyAttempt.valid).toBe(false);
    expect(crossCompanyAttempt.error).toContain("mesma empresa");
  });

  it("13. Campanha vinculada à pesquisa correta: prioriza campaign_surveys N:N e mantém fallback para campaigns.survey_id legado", () => {
    const resolvedFromJoinTable = resolveEffectiveCampaignSurveyId(
      { id: "camp-1", survey_id: "surv-legacy" },
      [{ campaign_id: "camp-1", survey_id: "surv-nn" }],
    );
    expect(resolvedFromJoinTable).toBe("surv-nn");

    const resolvedFromLegacyColumn = resolveEffectiveCampaignSurveyId(
      { id: "camp-2", survey_id: "surv-legacy-only" },
      [],
    );
    expect(resolvedFromLegacyColumn).toBe("surv-legacy-only");
  });

  it("14. Impossibilidade de criar/ativar campanha ativa conflitante para a mesma pesquisa", () => {
    const existingActive = makeExistingCampaign({
      id: "camp-active-1",
      name: "Campanha Principal",
      status: "active",
      survey_id: "surv-a1",
      linked_survey_id: "surv-a1",
    });

    const conflict = findActiveCampaignConflict("surv-a1", [existingActive], {
      companyId: "comp-a",
    });
    expect(conflict).toEqual({ id: "camp-active-1", name: "Campanha Principal" });

    const validation = validateCampaignAdminInput(
      makeBaseAdminInput({
        status: "active",
        surveyId: "surv-a1",
      }),
      {
        companyId: "comp-a",
        availableSurveys: COMPANY_A_SURVEYS,
        existingCampaigns: [existingActive],
      },
    );

    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("já possui uma campanha ativa");
  });

  it("15. Claims administrativos: nunca expõem identity_hash ou device_hash brutos e exibem rótulos seguros", () => {
    const rawClaims: CampaignClaim[] = [
      {
        id: "claim-1",
        company_id: "comp-a",
        campaign_id: "camp-1",
        reward_id: "rew-1",
        survey_id: "surv-a1",
        response_id: "resp-1",
        code: "KOGNIS-ABCDEF",
        claim_token: "secret-claim-token-1",
        status: "issued",
        issued_at: "2026-09-28T12:00:00.000Z",
        expires_at: "2026-10-13T12:00:00.000Z",
        redeemed_at: null,
        redeemed_by: null,
        identity_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        device_hash: "device-sha256-secret-hash",
        reward_snapshot: { title: "10% OFF" },
        submission_key: "sub-secret-1",
        created_at: "2026-09-28T12:00:00.000Z",
      },
      {
        id: "claim-2",
        company_id: "comp-a",
        campaign_id: "camp-1",
        reward_id: "rew-1",
        survey_id: "surv-a1",
        response_id: "resp-2",
        code: "KOGNIS-GHJKLM",
        claim_token: "secret-claim-token-2",
        status: "issued",
        issued_at: "2026-09-28T13:00:00.000Z",
        expires_at: null,
        redeemed_at: null,
        redeemed_by: null,
        identity_hash: null,
        device_hash: null,
        reward_snapshot: { title: "10% OFF" },
        submission_key: "sub-secret-2",
        created_at: "2026-09-28T13:00:00.000Z",
      },
    ];

    const sanitized = sanitizeClaimsForAdminView(rawClaims, {
      identityRequirement: "email",
      surveyTitleById: { "surv-a1": "Pesquisa de Satisfação Loja Centro" },
    });

    expect(sanitized).toHaveLength(2);
    expect(sanitized[0].identity_label).toBe("E-mail verificado");
    expect(sanitized[0].survey_title).toBe("Pesquisa de Satisfação Loja Centro");
    expect(sanitized[0]).not.toHaveProperty("identity_hash");
    expect(sanitized[0]).not.toHaveProperty("device_hash");
    expect(sanitized[0]).not.toHaveProperty("claim_token");
    expect(sanitized[0]).not.toHaveProperty("submission_key");
    expect(JSON.stringify(sanitized)).not.toContain("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(JSON.stringify(sanitized)).not.toContain("device-sha256-secret-hash");

    expect(sanitized[1].identity_label).toBe("Participação sem identificação");

    const phoneSanitized = sanitizeClaimForAdminView(rawClaims[0], {
      identityRequirement: "phone",
    });
    expect(phoneSanitized.identity_label).toBe("Telefone verificado");
  });

  it("gera payload de Preview Administrativo com KOGNIS-EXEMPLO para unique, fixed_code para fixed e mensagem padrão de fallback", () => {
    const uniquePreview = buildCampaignPreviewPayload({
      completionMessage: "",
      claimValidityDays: 10,
      reward: {
        type: "percentage",
        code_mode: "unique",
        fixed_code: null,
        title: "10% OFF",
        description: null,
        value: 10,
        instructions: "Apresente no caixa",
        terms: null,
      },
      now: FIXED_NOW,
    });

    expect(uniquePreview.completionMessage).toBe(DEFAULT_CAMPAIGN_COMPLETION_MESSAGE);
    expect(uniquePreview.reward?.code).toBe(PREVIEW_UNIQUE_CODE_EXAMPLE);
    expect(uniquePreview.reward?.expires_at).toBe("2026-10-08T15:00:00.000Z");

    const fixedPreview = buildCampaignPreviewPayload({
      completionMessage: "Seu cupom chegou!",
      reward: {
        type: "fixed_amount",
        code_mode: "fixed",
        fixed_code: "PROMO20",
        title: "R$ 20 OFF",
        description: null,
        value: 20,
        instructions: null,
        terms: null,
      },
      now: FIXED_NOW,
    });

    expect(fixedPreview.completionMessage).toBe("Seu cupom chegou!");
    expect(fixedPreview.reward?.code).toBe("PROMO20");
    expect(resolveCampaignCompletionMessage("   ")).toBe(DEFAULT_CAMPAIGN_COMPLETION_MESSAGE);
  });
});
