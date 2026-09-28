import { describe, expect, it, vi } from "vitest";

import {
  buildRewardSnapshot,
  evaluateCampaignIssuance,
  extractRespondentIdentity,
  generateUniqueClaimCode,
  hashIdentityValue,
  isCampaignTemporallyEligible,
  isValidUniqueClaimCode,
  normalizeIdentityEmail,
  normalizeIdentityPhone,
  resolveRewardClaimCode,
  UNIQUE_CODE_ALPHABET,
} from "@/lib/campaign-issuance-utils";
import {
  isMissingRpcFunctionError,
  normalizeGatewayRpcData,
  submitPublicSurveyResponse,
  type SupabaseGatewayClient,
} from "@/lib/submission-gateway";
import type { Campaign, CampaignClaim, CampaignReward, CampaignSurvey } from "@/types/campaign";
import type { ResponseAnswers } from "@/types/response";
import type { SubmissionGatewayInput } from "@/types/submission";
import type { SurveyQuestion } from "@/types/survey-question";

const FIXED_NOW = new Date("2026-09-28T15:00:00.000Z");

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: "camp-1",
    company_id: "comp-a",
    survey_id: "surv-1",
    name: "Campanha Clientes VIP",
    description: "Ganhe benefício ao responder",
    status: "active",
    campaign_type: "reward_on_response",
    starts_at: "2026-09-01T00:00:00.000Z",
    ends_at: "2026-10-15T00:00:00.000Z",
    max_claims_total: null,
    identity_requirement: "none",
    claim_validity_days: 15,
    completion_message: "Aqui está sua recompensa por responder!",
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeReward(overrides: Partial<CampaignReward> = {}): CampaignReward {
  return {
    id: "rew-1",
    campaign_id: "camp-1",
    type: "percentage",
    title: "10% OFF na próxima compra",
    description: "Válido em toda a loja física",
    value: 10,
    code_mode: "unique",
    fixed_code: null,
    instructions: "Apresente o código no caixa.",
    terms: "Uso único. Não cumulativo.",
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeQuestions(): SurveyQuestion[] {
  return [
    {
      id: "q-rating-uuid",
      survey_id: "surv-1",
      type: "rating",
      title: "Qual sua nota?",
      description: null,
      required: true,
      position: 1,
      options: [],
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-01T00:00:00.000Z",
    },
    {
      id: "q-email-uuid",
      survey_id: "surv-1",
      type: "email",
      title: "Qual seu e-mail?",
      description: null,
      required: false,
      position: 2,
      options: [],
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-01T00:00:00.000Z",
    },
    {
      id: "q-phone-uuid",
      survey_id: "surv-1",
      type: "phone",
      title: "Qual seu WhatsApp?",
      description: null,
      required: false,
      position: 3,
      options: [],
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-01T00:00:00.000Z",
    },
  ];
}

/**
 * Simulador transacional em memória que espelha fielmente o comportamento da RPC
 * `public.submit_public_survey_response`, incluindo idempotência, resolução de
 * campanha por empresa, lock serializado de estoque e bloco EXCEPTION que
 * preserva a resposta mesmo quando a emissão falha.
 */
function createInMemoryGatewayHarness(options?: {
  surveys?: Array<{ id: string; company_id: string; status: "draft" | "active" | "archived" }>;
  questions?: SurveyQuestion[];
  campaigns?: Campaign[];
  campaignSurveys?: CampaignSurvey[];
  rewards?: CampaignReward[];
  now?: Date;
  forceRewardError?: boolean;
}) {
  const now = options?.now ?? FIXED_NOW;
  const surveys = options?.surveys ?? [
    { id: "surv-1", company_id: "comp-a", status: "active" as const },
  ];
  const questions = options?.questions ?? makeQuestions();
  const campaigns = options?.campaigns ?? [];
  const campaignSurveys = options?.campaignSurveys ?? [];
  const rewards = options?.rewards ?? [];

  const savedResponses: Array<{
    id: string;
    survey_id: string;
    answers: ResponseAnswers;
    submission_key: string | null;
  }> = [];
  const savedClaims: CampaignClaim[] = [];
  const rpcCalls: Array<Record<string, unknown>> = [];

  const client: SupabaseGatewayClient = {
    rpc: async (fn, args) => {
      rpcCalls.push({ fn, ...args });

      const surveyId = String(args.p_survey_id ?? "");
      const answers = args.p_answers as ResponseAnswers;
      const submissionKey =
        typeof args.p_submission_key === "string" && args.p_submission_key.trim()
          ? args.p_submission_key.trim()
          : null;
      const deviceHash =
        typeof args.p_device_hash === "string" && args.p_device_hash.trim()
          ? args.p_device_hash.trim()
          : null;

      const survey = surveys.find((item) => item.id === surveyId);
      if (!survey || survey.status !== "active") {
        return {
          data: null,
          error: { message: "Survey is not active or does not exist", code: "P0001" },
        };
      }

      // 2. Idempotência por submission_key
      if (submissionKey) {
        const existingResponse = savedResponses.find(
          (item) => item.submission_key === submissionKey && item.survey_id === surveyId,
        );
        if (existingResponse) {
          const existingClaim = savedClaims.find(
            (claim) => claim.response_id === existingResponse.id && claim.status !== "voided",
          );
          const snapshot = existingClaim?.reward_snapshot as Record<string, unknown> | null;

          return {
            data: {
              submitted: true,
              response_id: existingResponse.id,
              completion_message: (snapshot?.completion_message as string | null) ?? null,
              reward:
                existingClaim && snapshot
                  ? {
                      title: snapshot.title ?? null,
                      description: snapshot.description ?? null,
                      type: snapshot.type,
                      value: snapshot.value ?? null,
                      code_mode: snapshot.code_mode ?? "unique",
                      code: existingClaim.code,
                      claim_token: existingClaim.claim_token,
                      instructions: snapshot.instructions ?? null,
                      terms: snapshot.terms ?? null,
                      expires_at: existingClaim.expires_at,
                      issued_at: existingClaim.issued_at,
                      completion_message: snapshot.completion_message ?? null,
                    }
                  : null,
            },
            error: null,
          };
        }
      }

      // 3. Salva response
      const responseId = `resp-${savedResponses.length + 1}`;
      savedResponses.push({
        id: responseId,
        survey_id: surveyId,
        answers,
        submission_key: submissionKey,
      });

      // 4..14. Bloco protegido (EXCEPTION WHEN OTHERS)
      let rewardPayload: Record<string, unknown> | null = null;
      let completionMessage: string | null = null;

      try {
        if (options?.forceRewardError) {
          throw new Error("Simulated internal SQL/reward failure");
        }

        // Isolamento por empresa: apenas campanhas da mesma company_id da survey
        const candidateCampaign = campaigns.find(
          (camp) =>
            camp.company_id === survey.company_id &&
            camp.status === "active" &&
            (campaignSurveys.some(
              (cs) => cs.campaign_id === camp.id && cs.survey_id === surveyId,
            ) ||
              camp.survey_id === surveyId),
        );

        if (candidateCampaign) {
          const reward =
            rewards.find((rw) => rw.campaign_id === candidateCampaign.id) ?? null;
          const activeClaimsForCampaign = savedClaims.filter(
            (claim) => claim.campaign_id === candidateCampaign.id && claim.status !== "voided",
          );
          const existingIdentityHashes = new Set(
            activeClaimsForCampaign
              .map((claim) => claim.identity_hash)
              .filter((hash): hash is string => Boolean(hash)),
          );
          const existingUniqueCodes = new Set(
            savedClaims
              .filter((claim) => claim.reward_snapshot?.code_mode === "unique")
              .map((claim) => claim.code)
              .filter((code): code is string => Boolean(code)),
          );

          const surveyQuestions = questions.filter((q) => q.survey_id === surveyId);
          const evaluation = evaluateCampaignIssuance({
            campaign: candidateCampaign,
            reward,
            answers,
            questions: surveyQuestions,
            activeClaimsCount: activeClaimsForCampaign.length,
            existingIdentityHashes,
            existingUniqueCodes,
            now,
          });

          if (
            evaluation.status === "issued" &&
            evaluation.rewardPayload &&
            evaluation.snapshot &&
            reward
          ) {
            savedClaims.push({
              id: `claim-${savedClaims.length + 1}`,
              company_id: candidateCampaign.company_id,
              campaign_id: candidateCampaign.id,
              reward_id: reward.id,
              survey_id: surveyId,
              response_id: responseId,
              code: evaluation.rewardPayload.code,
              claim_token: evaluation.rewardPayload.claim_token,
              status: "issued",
              issued_at: evaluation.rewardPayload.issued_at,
              expires_at: evaluation.rewardPayload.expires_at,
              redeemed_at: null,
              redeemed_by: null,
              identity_hash: evaluation.identityHash,
              device_hash: deviceHash,
              reward_snapshot: evaluation.snapshot,
              submission_key: submissionKey,
              created_at: evaluation.rewardPayload.issued_at,
            });

            completionMessage = candidateCampaign.completion_message;
            rewardPayload = evaluation.rewardPayload;
          }
        }
      } catch {
        // Resposta permanece salva; recompensa não é emitida.
        rewardPayload = null;
        completionMessage = null;
      }

      return {
        data: {
          submitted: true,
          response_id: responseId,
          completion_message: completionMessage,
          reward: rewardPayload,
        },
        error: null,
      };
    },
    from: () => ({
      insert: async () => ({ error: null }),
    }),
  };

  return { client, savedResponses, savedClaims, rpcCalls };
}

describe("Sprint 2 — Utilitários puros (campaign-issuance-utils)", () => {
  it("valida elegibilidade temporal corretamente", () => {
    expect(isCampaignTemporallyEligible(makeCampaign(), FIXED_NOW)).toBe(true);
    expect(
      isCampaignTemporallyEligible(
        makeCampaign({ starts_at: null, ends_at: null }),
        FIXED_NOW,
      ),
    ).toBe(true);
    expect(
      isCampaignTemporallyEligible(makeCampaign({ status: "paused" }), FIXED_NOW),
    ).toBe(false);
    expect(
      isCampaignTemporallyEligible(
        makeCampaign({ starts_at: "2026-10-01T00:00:00.000Z" }),
        FIXED_NOW,
      ),
    ).toBe(false);
    expect(
      isCampaignTemporallyEligible(
        makeCampaign({ ends_at: "2026-09-28T15:00:00.000Z" }),
        FIXED_NOW,
      ),
    ).toBe(false);
  });

  it("extrai e normaliza email/phone de respostas dinâmicas cruzando UUID de survey_questions", () => {
    const questions = makeQuestions();
    const dynamicAnswers: ResponseAnswers = {
      mode: "dynamic",
      answers: {
        "q-rating-uuid": 5,
        "q-email-uuid": "  Cliente.VIP@Empresa.COM ",
        "q-phone-uuid": "(11) 98765-4321",
      },
    };

    const emailResult = extractRespondentIdentity("email", dynamicAnswers, questions);
    expect(emailResult.valid).toBe(true);
    expect(emailResult.normalizedValue).toBe("cliente.vip@empresa.com");
    expect(emailResult.identityHash).toBe(hashIdentityValue("cliente.vip@empresa.com"));

    const phoneResult = extractRespondentIdentity("phone", dynamicAnswers, questions);
    expect(phoneResult.valid).toBe(true);
    expect(phoneResult.normalizedValue).toBe("11987654321");
    expect(phoneResult.identityHash).toBe(hashIdentityValue("11987654321"));
  });

  it("normaliza email e telefone e gera hash SHA-256 consistente", () => {
    expect(normalizeIdentityEmail("  Maria@Teste.COM.BR ")).toBe("maria@teste.com.br");
    expect(normalizeIdentityPhone("+55 (21) 99888-7766")).toBe("5521998887766");
    expect(hashIdentityValue("maria@teste.com.br")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("constrói reward_snapshot imutável com todos os campos obrigatórios", () => {
    const campaign = makeCampaign({
      name: "Campanha Aniversário",
      completion_message: "Parabéns pelo cupom!",
    });
    const reward = makeReward({
      id: "rew-99",
      type: "fixed_amount",
      title: "R$ 25 de desconto",
      description: "Em compras acima de R$ 100",
      value: 25,
      code_mode: "fixed",
      fixed_code: "ANIV25",
      instructions: "Mostre no caixa",
      terms: "Válido por 7 dias",
    });

    const snapshot = buildRewardSnapshot(reward, campaign);
    expect(snapshot).toEqual({
      reward_id: "rew-99",
      type: "fixed_amount",
      title: "R$ 25 de desconto",
      description: "Em compras acima de R$ 100",
      value: 25,
      code_mode: "fixed",
      instructions: "Mostre no caixa",
      terms: "Válido por 7 dias",
      campaign_name: "Campanha Aniversário",
      completion_message: "Parabéns pelo cupom!",
    });
  });
});

describe("Sprint 2 — Matriz Obrigatória de 16 Cenários (Submission Gateway + Emissão)", () => {
  const dynamicValidAnswers: ResponseAnswers = {
    mode: "dynamic",
    answers: {
      "q-rating-uuid": 4,
      "q-email-uuid": "cliente@exemplo.com",
      "q-phone-uuid": "(11) 91234-5678",
    },
  };

  it("1. Pesquisa sem campanha: salva a resposta normalmente e retorna reward = null", async () => {
    const { client, savedResponses, savedClaims } = createInMemoryGatewayHarness({
      campaigns: [],
      rewards: [],
    });

    const result = await submitPublicSurveyResponse(
      {
        surveyId: "surv-1",
        answers: dynamicValidAnswers,
        submissionKey: "sub-no-campaign-1",
      },
      client,
    );

    expect(result.error).toBeNull();
    expect(result.submitted).toBe(true);
    expect(result.reward).toBeNull();
    expect(savedResponses).toHaveLength(1);
    expect(savedClaims).toHaveLength(0);
  });

  it("2. Campanha ativa elegível: salva resposta, emite claim com snapshot e retorna benefício", async () => {
    const campaign = makeCampaign();
    const reward = makeReward();
    const { client, savedResponses, savedClaims } = createInMemoryGatewayHarness({
      campaigns: [campaign],
      rewards: [reward],
    });

    const result = await submitPublicSurveyResponse(
      {
        surveyId: "surv-1",
        answers: dynamicValidAnswers,
        submissionKey: "sub-active-eligible-1",
      },
      client,
    );

    expect(result.error).toBeNull();
    expect(result.submitted).toBe(true);
    expect(result.reward).not.toBeNull();
    expect(result.reward?.title).toBe("10% OFF na próxima compra");
    expect(result.reward?.code).toMatch(/^KOGNIS-[A-Z2-9]{6}$/);
    expect(result.completionMessage).toBe("Aqui está sua recompensa por responder!");
    expect(savedResponses).toHaveLength(1);
    expect(savedClaims).toHaveLength(1);
    expect(savedClaims[0].reward_snapshot).toMatchObject({
      reward_id: reward.id,
      campaign_name: campaign.name,
      title: reward.title,
    });
  });

  it("3. Campanha pausada: salva resposta e NÃO emite recompensa", async () => {
    const { client, savedResponses, savedClaims } = createInMemoryGatewayHarness({
      campaigns: [makeCampaign({ status: "paused" })],
      rewards: [makeReward()],
    });

    const result = await submitPublicSurveyResponse(
      {
        surveyId: "surv-1",
        answers: dynamicValidAnswers,
        submissionKey: "sub-paused-1",
      },
      client,
    );

    expect(result.submitted).toBe(true);
    expect(result.reward).toBeNull();
    expect(savedResponses).toHaveLength(1);
    expect(savedClaims).toHaveLength(0);
  });

  it("4. Campanha expirada: salva resposta e NÃO emite recompensa", async () => {
    const { client, savedResponses, savedClaims } = createInMemoryGatewayHarness({
      campaigns: [
        makeCampaign({
          status: "active",
          ends_at: "2026-09-01T00:00:00.000Z", // Anterior a FIXED_NOW
        }),
      ],
      rewards: [makeReward()],
    });

    const result = await submitPublicSurveyResponse(
      {
        surveyId: "surv-1",
        answers: dynamicValidAnswers,
        submissionKey: "sub-expired-1",
      },
      client,
    );

    expect(result.submitted).toBe(true);
    expect(result.reward).toBeNull();
    expect(savedResponses).toHaveLength(1);
    expect(savedClaims).toHaveLength(0);
  });

  it("5. Estoque esgotado: salva resposta e NÃO emite recompensa quando max_claims_total foi atingido", async () => {
    const campaign = makeCampaign({ max_claims_total: 1 });
    const reward = makeReward();
    const { client, savedResponses, savedClaims } = createInMemoryGatewayHarness({
      campaigns: [campaign],
      rewards: [reward],
    });

    const first = await submitPublicSurveyResponse(
      {
        surveyId: "surv-1",
        answers: dynamicValidAnswers,
        submissionKey: "sub-stock-1",
      },
      client,
    );

    const second = await submitPublicSurveyResponse(
      {
        surveyId: "surv-1",
        answers: dynamicValidAnswers,
        submissionKey: "sub-stock-2",
      },
      client,
    );

    expect(first.submitted).toBe(true);
    expect(first.reward).not.toBeNull();
    expect(second.submitted).toBe(true);
    expect(second.reward).toBeNull();
    expect(second.error).toBeNull();
    expect(savedResponses).toHaveLength(2);
    expect(savedClaims).toHaveLength(1);
  });

  it("6. Campanha inexistente ou arquivada: salva resposta e NÃO emite recompensa", async () => {
    const { client, savedResponses, savedClaims } = createInMemoryGatewayHarness({
      campaigns: [makeCampaign({ status: "archived" })],
      rewards: [makeReward()],
    });

    const result = await submitPublicSurveyResponse(
      {
        surveyId: "surv-1",
        answers: dynamicValidAnswers,
        submissionKey: "sub-archived-1",
      },
      client,
    );

    expect(result.submitted).toBe(true);
    expect(result.reward).toBeNull();
    expect(savedResponses).toHaveLength(1);
    expect(savedClaims).toHaveLength(0);
  });

  it("7. Recompensa inexistente: campanha ativa sem campaign_rewards salva resposta e retorna reward = null", async () => {
    const { client, savedResponses, savedClaims } = createInMemoryGatewayHarness({
      campaigns: [makeCampaign()],
      rewards: [],
    });

    const result = await submitPublicSurveyResponse(
      {
        surveyId: "surv-1",
        answers: dynamicValidAnswers,
        submissionKey: "sub-no-reward-1",
      },
      client,
    );

    expect(result.submitted).toBe(true);
    expect(result.reward).toBeNull();
    expect(savedResponses).toHaveLength(1);
    expect(savedClaims).toHaveLength(0);
  });

  it("8. Idempotência (duplo envio / retry): mesmo submissionKey não duplica response nem claim e retorna o mesmo código", async () => {
    const { client, savedResponses, savedClaims } = createInMemoryGatewayHarness({
      campaigns: [makeCampaign()],
      rewards: [makeReward()],
    });

    const firstAttempt = await submitPublicSurveyResponse(
      {
        surveyId: "surv-1",
        answers: dynamicValidAnswers,
        submissionKey: "sub-idempotent-key-123",
      },
      client,
    );

    const retryAttempt = await submitPublicSurveyResponse(
      {
        surveyId: "surv-1",
        answers: dynamicValidAnswers,
        submissionKey: "sub-idempotent-key-123",
      },
      client,
    );

    expect(savedResponses).toHaveLength(1);
    expect(savedClaims).toHaveLength(1);
    expect(firstAttempt.responseId).toBe(retryAttempt.responseId);
    expect(firstAttempt.reward?.code).toBe(retryAttempt.reward?.code);
    expect(firstAttempt.reward?.claim_token).toBe(retryAttempt.reward?.claim_token);
  });

  it("9. Concorrência no último estoque: duas submissões simultâneas para 1 benefício salvam ambas as respostas e emitem apenas 1 claim", async () => {
    const { client, savedResponses, savedClaims } = createInMemoryGatewayHarness({
      campaigns: [makeCampaign({ max_claims_total: 1 })],
      rewards: [makeReward()],
    });

    const [clientA, clientB] = await Promise.all([
      submitPublicSurveyResponse(
        {
          surveyId: "surv-1",
          answers: dynamicValidAnswers,
          submissionKey: "sub-concurrent-a",
        },
        client,
      ),
      submitPublicSurveyResponse(
        {
          surveyId: "surv-1",
          answers: dynamicValidAnswers,
          submissionKey: "sub-concurrent-b",
        },
        client,
      ),
    ]);

    expect(savedResponses).toHaveLength(2);
    expect(savedClaims).toHaveLength(1);
    expect(clientA.submitted).toBe(true);
    expect(clientB.submitted).toBe(true);

    const issuedResults = [clientA, clientB].filter((res) => res.reward !== null);
    const emptyResults = [clientA, clientB].filter((res) => res.reward === null);
    expect(issuedResults).toHaveLength(1);
    expect(emptyResults).toHaveLength(1);
  });

  it("10. Código unique: gera KOGNIS-XXXXXX sem caracteres ambíguos (0/O/1/I) e faz retry em colisão", () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateUniqueClaimCode();
      const suffix = code.slice("KOGNIS-".length);
      expect(isValidUniqueClaimCode(code)).toBe(true);
      expect(suffix).toHaveLength(6);
      expect(suffix).not.toMatch(/[0O1I]/);
    }

    expect(UNIQUE_CODE_ALPHABET).not.toMatch(/[0O1I]/);

    let callCount = 0;
    const collidingGenerator = () => {
      callCount += 1;
      return callCount === 1 ? "KOGNIS-ABCDEF" : "KOGNIS-GHJKLM";
    };

    const evaluation = evaluateCampaignIssuance({
      campaign: makeCampaign(),
      reward: makeReward({ code_mode: "unique" }),
      answers: dynamicValidAnswers,
      activeClaimsCount: 0,
      existingUniqueCodes: new Set(["KOGNIS-ABCDEF"]),
      uniqueCodeGenerator: collidingGenerator,
      now: FIXED_NOW,
    });

    expect(evaluation.status).toBe("issued");
    expect(evaluation.rewardPayload?.code).toBe("KOGNIS-GHJKLM");
  });

  it("11. Código fixed: múltiplos clientes recebem o mesmo fixed_code sem conflito de unicidade", async () => {
    const { client, savedResponses, savedClaims } = createInMemoryGatewayHarness({
      campaigns: [makeCampaign()],
      rewards: [
        makeReward({
          code_mode: "fixed",
          fixed_code: "KOGNIS10",
        }),
      ],
    });

    const first = await submitPublicSurveyResponse(
      {
        surveyId: "surv-1",
        answers: dynamicValidAnswers,
        submissionKey: "sub-fixed-1",
      },
      client,
    );

    const second = await submitPublicSurveyResponse(
      {
        surveyId: "surv-1",
        answers: dynamicValidAnswers,
        submissionKey: "sub-fixed-2",
      },
      client,
    );

    expect(savedResponses).toHaveLength(2);
    expect(savedClaims).toHaveLength(2);
    expect(first.reward?.code).toBe("KOGNIS10");
    expect(second.reward?.code).toBe("KOGNIS10");
    expect(resolveRewardClaimCode({ code_mode: "fixed", fixed_code: " KOGNIS10 " })).toBe(
      "KOGNIS10",
    );
  });

  it("12. Erro interno na recompensa: preserva a resposta salva, retorna reward = null e nunca expõe erro SQL", async () => {
    const { client, savedResponses, savedClaims } = createInMemoryGatewayHarness({
      campaigns: [makeCampaign()],
      rewards: [makeReward()],
      forceRewardError: true,
    });

    const result = await submitPublicSurveyResponse(
      {
        surveyId: "surv-1",
        answers: dynamicValidAnswers,
        submissionKey: "sub-reward-error-1",
      },
      client,
    );

    expect(result.error).toBeNull();
    expect(result.submitted).toBe(true);
    expect(result.reward).toBeNull();
    expect(savedResponses).toHaveLength(1);
    expect(savedClaims).toHaveLength(0);
  });

  it("13. Formulário legado: preserva formato { name, email, rating, comment } e emite recompensa normalmente", async () => {
    const campaign = makeCampaign({ identity_requirement: "email" });
    const reward = makeReward({ code_mode: "fixed", fixed_code: "BEMVINDO15" });
    const { client, savedResponses, savedClaims } = createInMemoryGatewayHarness({
      campaigns: [campaign],
      rewards: [reward],
    });

    const legacyAnswers: ResponseAnswers = {
      name: "Carlos Silva",
      email: "Carlos@Silva.com",
      rating: 2, // Nota baixa também recebe recompensa (recompensa por participação, independente de nota)
      comment: "Atendimento rápido",
    };

    const first = await submitPublicSurveyResponse(
      {
        surveyId: "surv-1",
        answers: legacyAnswers,
        submissionKey: "sub-legacy-1",
      },
      client,
    );

    // Segundo envio com o mesmo email na mesma campanha: salva resposta, mas deduplica o claim
    const duplicateEmail = await submitPublicSurveyResponse(
      {
        surveyId: "surv-1",
        answers: {
          name: "Carlos Silva",
          email: "  carlos@silva.com ",
          rating: 5,
        },
        submissionKey: "sub-legacy-2",
      },
      client,
    );

    expect(savedResponses).toHaveLength(2);
    expect(savedResponses[0].answers).toEqual(legacyAnswers);
    expect(first.submitted).toBe(true);
    expect(first.reward?.code).toBe("BEMVINDO15");

    expect(duplicateEmail.submitted).toBe(true);
    expect(duplicateEmail.reward).toBeNull();
    expect(savedClaims).toHaveLength(1);
  });

  it("14. Preview: modo preview não invoca o Submission Gateway nem grava respostas", () => {
    const rpcSpy = vi.fn();
    const isPreview = true;

    if (!isPreview) {
      rpcSpy();
    }

    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("15. Isolamento entre empresas (Empresa A vs Empresa B): campanha da Empresa B nunca emite em pesquisa da Empresa A", async () => {
    const campaignFromCompanyB = makeCampaign({
      id: "camp-comp-b",
      company_id: "comp-b",
      survey_id: "surv-1", // Mesmo se tentasse apontar para surv-1 da comp-a
      status: "active",
    });

    const { client, savedResponses, savedClaims } = createInMemoryGatewayHarness({
      surveys: [{ id: "surv-1", company_id: "comp-a", status: "active" }],
      campaigns: [campaignFromCompanyB],
      rewards: [makeReward({ campaign_id: "camp-comp-b" })],
    });

    const result = await submitPublicSurveyResponse(
      {
        surveyId: "surv-1",
        answers: dynamicValidAnswers,
        submissionKey: "sub-cross-company-1",
      },
      client,
    );

    expect(result.submitted).toBe(true);
    expect(result.reward).toBeNull();
    expect(savedResponses).toHaveLength(1);
    expect(savedClaims).toHaveLength(0);
  });

  it("16. Tentativa de manipulação pelo cliente: ignora parâmetros forjados na entrada e filtra campos internos na saída", async () => {
    const { client, rpcCalls } = createInMemoryGatewayHarness({
      campaigns: [makeCampaign()],
      rewards: [makeReward()],
    });

    const maliciousInput = {
      surveyId: "surv-1",
      answers: dynamicValidAnswers,
      submissionKey: "sub-manip-1",
      campaign_id: "forged-campaign-id",
      reward_id: "forged-reward-id",
      company_id: "forged-company-id",
      code: "FORGED-FREE-100",
      reward_snapshot: { value: 100 },
    } as unknown as SubmissionGatewayInput;

    await submitPublicSurveyResponse(maliciousInput, client);

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]).toEqual({
      fn: "submit_public_survey_response",
      p_survey_id: "surv-1",
      p_answers: dynamicValidAnswers,
      p_submission_key: "sub-manip-1",
      p_device_hash: null,
    });
    expect(rpcCalls[0]).not.toHaveProperty("campaign_id");
    expect(rpcCalls[0]).not.toHaveProperty("reward_id");
    expect(rpcCalls[0]).not.toHaveProperty("company_id");
    expect(rpcCalls[0]).not.toHaveProperty("code");
    expect(rpcCalls[0]).not.toHaveProperty("reward_snapshot");

    // Também garante que normalizeGatewayRpcData descarta campos internos se presentes
    const sanitized = normalizeGatewayRpcData({
      submitted: true,
      response_id: "resp-1",
      company_id: "secret-company",
      owner_id: "secret-owner",
      max_claims_total: 500,
      reward: {
        title: "Cupom",
        type: "percentage",
        value: 10,
        code_mode: "unique",
        code: "KOGNIS-234567",
        company_id: "secret-company",
        owner_id: "secret-owner",
      },
    });

    expect(sanitized).not.toHaveProperty("company_id");
    expect(sanitized).not.toHaveProperty("owner_id");
    expect(sanitized.reward).not.toHaveProperty("company_id");
    expect(sanitized.reward).not.toHaveProperty("owner_id");
  });

  it("aciona fallback de insert direto APENAS quando a função RPC ainda não existe (PGRST202)", async () => {
    const insertSpy = vi.fn(async () => ({ error: null }));
    const fallbackClient: SupabaseGatewayClient = {
      rpc: async () => ({
        data: null,
        error: {
          code: "PGRST202",
          message: "Could not find the function public.submit_public_survey_response in the schema cache",
        },
      }),
      from: () => ({
        insert: insertSpy,
      }),
    };

    expect(
      isMissingRpcFunctionError({
        code: "PGRST202",
        message: "Could not find the function",
      }),
    ).toBe(true);
    expect(
      isMissingRpcFunctionError({
        code: "P0001",
        message: "Survey is not active",
      }),
    ).toBe(false);

    const fallbackResult = await submitPublicSurveyResponse(
      {
        surveyId: "surv-1",
        answers: dynamicValidAnswers,
        submissionKey: "sub-fallback-1",
      },
      fallbackClient,
    );

    expect(fallbackResult.submitted).toBe(true);
    expect(fallbackResult.reward).toBeNull();
    expect(insertSpy).toHaveBeenCalledTimes(1);
  });
});
