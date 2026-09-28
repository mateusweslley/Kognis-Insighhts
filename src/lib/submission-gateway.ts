import { isValidCampaignCodeMode, isValidCampaignRewardType } from "@/lib/campaign-utils";
import { isDynamicResponseAnswers } from "@/lib/response-utils";
import { createClient } from "@/lib/supabase/client";
import type { CampaignCodeMode, CampaignRewardType } from "@/types/campaign";
import type { ResponseAnswers } from "@/types/response";
import type {
  IssuedRewardPayload,
  SubmissionGatewayInput,
  SubmissionGatewayResult,
} from "@/types/submission";

type RpcErrorLike = {
  message: string;
  code?: string;
};

export type SupabaseGatewayClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: RpcErrorLike | null }>;
  from: (table: string) => {
    insert: (
      values: Record<string, unknown>,
    ) => PromiseLike<{ error: RpcErrorLike | null }>;
  };
};

/**
 * Porta única de submissão pública de respostas de pesquisa.
 *
 * - Encaminha a resposta para a RPC `public.submit_public_survey_response` (SECURITY DEFINER).
 * - Ignora qualquer parâmetro extra que tente injetar `campaign_id`, `reward_id`,
 *   `company_id`, `code` ou `reward_snapshot`.
 * - Garante que falhas internas de campanha nunca exponham detalhes SQL ou impeçam
 *   o retorno seguro para a UI.
 */
export async function submitPublicSurveyResponse(
  input: SubmissionGatewayInput,
  client?: SupabaseGatewayClient,
): Promise<SubmissionGatewayResult> {
  const surveyId = typeof input?.surveyId === "string" ? input.surveyId.trim() : "";
  const submissionKey =
    typeof input?.submissionKey === "string" ? input.submissionKey.trim() : "";
  const deviceHash =
    typeof input?.deviceHash === "string" && input.deviceHash.trim().length > 0
      ? input.deviceHash.trim()
      : null;

  if (!surveyId) {
    return {
      submitted: false,
      responseId: null,
      completionMessage: null,
      reward: null,
      error: "Esta pesquisa não está aceitando respostas no momento.",
    };
  }

  if (!submissionKey) {
    return {
      submitted: false,
      responseId: null,
      completionMessage: null,
      reward: null,
      error: "Não foi possível enviar sua resposta agora. Tente novamente.",
    };
  }

  if (!isValidAnswersPayload(input?.answers)) {
    return {
      submitted: false,
      responseId: null,
      completionMessage: null,
      reward: null,
      error: "Preencha as respostas da pesquisa antes de enviar.",
    };
  }

  const supabase = client ?? (createClient() as unknown as SupabaseGatewayClient);

  // Contrato estrito: somente os 4 parâmetros permitidos são enviados à RPC.
  const { data, error } = await supabase.rpc("submit_public_survey_response", {
    p_survey_id: surveyId,
    p_answers: input.answers,
    p_submission_key: submissionKey,
    p_device_hash: deviceHash,
  });

  if (error) {
    // FALLBACK TEMPORÁRIO DE TRANSIÇÃO DE DEPLOYMENT:
    // Ativado EXCLUSIVAMENTE quando a migration `supabase/2026_submission_gateway.sql`
    // ainda não foi aplicada no banco remoto (PGRST202 / 42883).
    // Nunca é usado para mascarar erros normais de negócio, validação ou permissão.
    if (isMissingRpcFunctionError(error)) {
      const { error: insertError } = await supabase.from("responses").insert({
        survey_id: surveyId,
        answers: input.answers,
      });

      if (insertError) {
        return {
          submitted: false,
          responseId: null,
          completionMessage: null,
          reward: null,
          error: getFriendlySubmissionError(insertError.message, insertError.code),
        };
      }

      return {
        submitted: true,
        responseId: null,
        completionMessage: null,
        reward: null,
        error: null,
      };
    }

    return {
      submitted: false,
      responseId: null,
      completionMessage: null,
      reward: null,
      error: getFriendlySubmissionError(error.message, error.code),
    };
  }

  return normalizeGatewayRpcData(data);
}

function isValidAnswersPayload(answers: ResponseAnswers | unknown): answers is ResponseAnswers {
  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) {
    return false;
  }

  if (isDynamicResponseAnswers(answers as ResponseAnswers)) {
    const dynamic = answers as Extract<ResponseAnswers, { mode: "dynamic" }>;
    return (
      typeof dynamic.answers === "object" &&
      dynamic.answers !== null &&
      !Array.isArray(dynamic.answers)
    );
  }

  const legacy = answers as Record<string, unknown>;
  return (
    typeof legacy.name === "string" &&
    legacy.name.trim().length > 0 &&
    typeof legacy.rating === "number" &&
    Number.isInteger(legacy.rating) &&
    legacy.rating >= 1 &&
    legacy.rating <= 5
  );
}

/**
 * Detecta exclusivamente o erro de função RPC ausente no schema cache do PostgREST
 * ou no catálogo do PostgreSQL (transição de migration).
 */
export function isMissingRpcFunctionError(error: RpcErrorLike): boolean {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();

  if (code === "PGRST202" || code === "42883") {
    return true;
  }

  return (
    message.includes("could not find the function") &&
    message.includes("submit_public_survey_response")
  );
}

export function normalizeGatewayRpcData(raw: unknown): SubmissionGatewayResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      submitted: true,
      responseId: null,
      completionMessage: null,
      reward: null,
      error: null,
    };
  }

  const record = raw as Record<string, unknown>;
  const responseId = typeof record.response_id === "string" ? record.response_id : null;
  const completionMessage =
    typeof record.completion_message === "string" && record.completion_message.trim().length > 0
      ? record.completion_message.trim()
      : null;

  const reward = normalizeIssuedRewardPayload(record.reward, completionMessage);

  return {
    submitted: record.submitted !== false,
    responseId,
    completionMessage: reward?.completion_message ?? completionMessage,
    reward,
    error: null,
  };
}

function normalizeIssuedRewardPayload(
  rawReward: unknown,
  fallbackCompletionMessage: string | null,
): IssuedRewardPayload | null {
  if (typeof rawReward !== "object" || rawReward === null || Array.isArray(rawReward)) {
    return null;
  }

  const record = rawReward as Record<string, unknown>;
  const code = typeof record.code === "string" ? record.code.trim() : "";
  const type = typeof record.type === "string" ? record.type : "";
  const codeMode = typeof record.code_mode === "string" ? record.code_mode : "unique";

  if (!code || !isValidCampaignRewardType(type) || !isValidCampaignCodeMode(codeMode)) {
    return null;
  }

  const numericValue =
    typeof record.value === "number" && Number.isFinite(record.value)
      ? record.value
      : typeof record.value === "string" && record.value.trim() !== "" && Number.isFinite(Number(record.value))
        ? Number(record.value)
        : null;

  return {
    title: typeof record.title === "string" && record.title.trim() ? record.title.trim() : null,
    description:
      typeof record.description === "string" && record.description.trim()
        ? record.description.trim()
        : null,
    type: type as CampaignRewardType,
    value: numericValue,
    code_mode: codeMode as CampaignCodeMode,
    code,
    claim_token:
      typeof record.claim_token === "string" && record.claim_token.trim()
        ? record.claim_token.trim()
        : null,
    instructions:
      typeof record.instructions === "string" && record.instructions.trim()
        ? record.instructions.trim()
        : null,
    terms:
      typeof record.terms === "string" && record.terms.trim() ? record.terms.trim() : null,
    expires_at:
      typeof record.expires_at === "string" && record.expires_at.trim()
        ? record.expires_at.trim()
        : null,
    issued_at:
      typeof record.issued_at === "string" && record.issued_at.trim()
        ? record.issued_at.trim()
        : new Date().toISOString(),
    completion_message:
      typeof record.completion_message === "string" && record.completion_message.trim()
        ? record.completion_message.trim()
        : fallbackCompletionMessage,
  };
}

export function getFriendlySubmissionError(message: string, code?: string): string {
  const normalizedMessage = (message ?? "").toLowerCase();

  if (
    code === "P0001" ||
    normalizedMessage.includes("survey is not active") ||
    normalizedMessage.includes("does not exist") ||
    normalizedMessage.includes("row-level security") ||
    normalizedMessage.includes("permission")
  ) {
    return "Esta pesquisa não está aceitando respostas no momento.";
  }

  return "Não foi possível enviar sua resposta agora. Tente novamente.";
}
