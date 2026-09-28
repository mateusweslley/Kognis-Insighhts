"use client";

import {
  Archive,
  Calendar,
  CheckCircle2,
  Edit3,
  Eye,
  Gift,
  Pause,
  Play,
  Plus,
  Save,
  ShieldCheck,
  Ticket,
  X,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SubmissionCompletionCard } from "@/components/responses/submission-completion-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  buildCampaignPreviewPayload,
  DEFAULT_CAMPAIGN_COMPLETION_MESSAGE,
  findActiveCampaignConflict,
  getCampaignLifecyclePermissions,
  resolveCampaignCompletionMessage,
  sanitizeClaimsForAdminView,
  validateCampaignAdminInput,
  type CampaignAdminFormInput,
} from "@/lib/campaign-admin-utils";
import { isClaimExpired } from "@/lib/campaign-utils";
import { createClient } from "@/lib/supabase/client";
import type {
  CampaignClaim,
  CampaignCodeMode,
  CampaignDisplayStatus,
  CampaignReward,
  CampaignRewardType,
  CampaignStatus,
  CampaignType,
  CampaignWithSurvey,
  IdentityRequirement,
  SanitizedCampaignClaimView,
} from "@/types/campaign";
import {
  campaignClaimStatusLabels,
  campaignCodeModeLabels,
  campaignCodeModes,
  campaignDisplayStatusLabels,
  campaignRewardTypeLabels,
  campaignRewardTypes,
  campaignStatusLabels,
  campaignStatuses,
  campaignTypeLabels,
  campaignTypes,
  identityRequirementDescriptions,
  identityRequirementLabels,
  identityRequirements,
} from "@/types/campaign";
import type { Survey } from "@/types/survey";

type CampaignManagerProps = {
  companyId: string;
  initialCampaigns: CampaignWithSurvey[];
  surveys: Survey[];
  initialError?: string | null;
};

type CampaignFormState = {
  name: string;
  description: string;
  campaignType: CampaignType;
  surveyId: string;
  status: CampaignStatus;
  startsAt: string;
  endsAt: string;
  maxClaimsTotal: string;
  identityRequirement: IdentityRequirement;
  claimValidityDays: string;
  completionMessage: string;
  rewardEnabled: boolean;
  rewardType: CampaignRewardType;
  rewardCodeMode: CampaignCodeMode;
  rewardFixedCode: string;
  rewardTitle: string;
  rewardDescription: string;
  rewardValue: string;
  rewardInstructions: string;
  rewardTerms: string;
};

const defaultForm: CampaignFormState = {
  name: "",
  description: "",
  campaignType: "reward_on_response",
  surveyId: "",
  status: "draft",
  startsAt: "",
  endsAt: "",
  maxClaimsTotal: "",
  identityRequirement: "none",
  claimValidityDays: "",
  completionMessage: "",
  rewardEnabled: true,
  rewardType: "percentage",
  rewardCodeMode: "unique",
  rewardFixedCode: "",
  rewardTitle: "",
  rewardDescription: "",
  rewardValue: "10",
  rewardInstructions: "",
  rewardTerms: "",
};

export function CampaignManager({
  companyId,
  initialCampaigns,
  surveys,
  initialError,
}: CampaignManagerProps) {
  const [campaigns, setCampaigns] = useState<CampaignWithSurvey[]>(initialCampaigns);
  const [isCreating, setIsCreating] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [selectedDetailsCampaignId, setSelectedDetailsCampaignId] = useState<string | null>(null);
  const [previewCampaignId, setPreviewCampaignId] = useState<string | null>(null);
  const [showFormPreview, setShowFormPreview] = useState(false);
  const [form, setForm] = useState<CampaignFormState>(defaultForm);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);

  // Estado sob demanda de claims para a campanha aberta em Detalhes
  const [claimsByCampaignId, setClaimsByCampaignId] = useState<
    Record<string, SanitizedCampaignClaimView[]>
  >({});
  const [isLoadingClaims, setIsLoadingClaims] = useState(false);
  const [claimsError, setClaimsError] = useState<string | null>(null);

  const surveyTitleById = useMemo(() => {
    const map = new Map<string, string>();
    surveys.forEach((survey) => map.set(survey.id, survey.title));
    return map;
  }, [surveys]);

  const editingCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === editingCampaignId) ?? null,
    [campaigns, editingCampaignId],
  );

  const selectedDetailsCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedDetailsCampaignId) ?? null,
    [campaigns, selectedDetailsCampaignId],
  );

  const previewCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === previewCampaignId) ?? null,
    [campaigns, previewCampaignId],
  );

  function startCreate() {
    if (initialError) {
      setError(initialError);
      return;
    }

    setForm(defaultForm);
    setEditingCampaignId(null);
    setSelectedDetailsCampaignId(null);
    setPreviewCampaignId(null);
    setShowFormPreview(false);
    setIsCreating(true);
    setMessage(null);
    setError(null);
  }

  function startEdit(campaign: CampaignWithSurvey) {
    const permissions = getCampaignLifecyclePermissions(campaign);
    if (!permissions.canEdit) {
      setError("Campanhas arquivadas estão em modo somente leitura e não podem ser editadas.");
      return;
    }

    const reward = campaign.reward ?? null;
    const effectiveSurveyId = campaign.linked_survey_id ?? campaign.survey_id ?? "";

    setForm({
      name: campaign.name,
      description: campaign.description ?? "",
      campaignType: campaign.campaign_type ?? "reward_on_response",
      surveyId: effectiveSurveyId,
      status: campaign.status,
      startsAt: formatIsoForDateInput(campaign.starts_at),
      endsAt: formatIsoForDateInput(campaign.ends_at),
      maxClaimsTotal:
        typeof campaign.max_claims_total === "number" ? String(campaign.max_claims_total) : "",
      identityRequirement: campaign.identity_requirement ?? "none",
      claimValidityDays:
        typeof campaign.claim_validity_days === "number"
          ? String(campaign.claim_validity_days)
          : "",
      completionMessage: campaign.completion_message ?? "",
      rewardEnabled: Boolean(reward),
      rewardType: reward?.type ?? "percentage",
      rewardCodeMode: reward?.code_mode ?? "unique",
      rewardFixedCode: reward?.fixed_code ?? "",
      rewardTitle: reward?.title ?? "",
      rewardDescription: reward?.description ?? "",
      rewardValue: typeof reward?.value === "number" ? String(reward.value) : "",
      rewardInstructions: reward?.instructions ?? "",
      rewardTerms: reward?.terms ?? "",
    });
    setEditingCampaignId(campaign.id);
    setIsCreating(false);
    setSelectedDetailsCampaignId(null);
    setPreviewCampaignId(null);
    setShowFormPreview(false);
    setMessage(null);
    setError(null);
  }

  function cancelForm() {
    setForm(defaultForm);
    setIsCreating(false);
    setEditingCampaignId(null);
    setShowFormPreview(false);
    setError(null);
  }

  async function openDetails(campaign: CampaignWithSurvey) {
    setSelectedDetailsCampaignId(campaign.id);
    setPreviewCampaignId(null);
    setIsCreating(false);
    setEditingCampaignId(null);
    setClaimsError(null);
    await loadCampaignClaims(campaign);
  }

  async function loadCampaignClaims(campaign: CampaignWithSurvey) {
    setIsLoadingClaims(true);
    setClaimsError(null);

    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("campaign_claims")
      .select("*")
      .eq("campaign_id", campaign.id)
      .order("issued_at", { ascending: false });

    if (fetchError) {
      console.error("Erro ao carregar claims da campanha:", fetchError);
      setClaimsError(
        "Não foi possível carregar os benefícios emitidos desta campanha agora.",
      );
      setIsLoadingClaims(false);
      return;
    }

    const rawClaims = (data ?? []) as CampaignClaim[];
    const sanitized = sanitizeClaimsForAdminView(rawClaims, {
      identityRequirement: campaign.identity_requirement,
      surveyTitleById,
    });

    setClaimsByCampaignId((current) => ({
      ...current,
      [campaign.id]: sanitized,
    }));

    const activeCount = rawClaims.filter((item) => item.status !== "voided").length;
    setCampaigns((current) =>
      current.map((item) =>
        item.id === campaign.id ? { ...item, claims_count: activeCount } : item,
      ),
    );
    setIsLoadingClaims(false);
  }

  function buildAdminFormInput(state: CampaignFormState): CampaignAdminFormInput {
    return {
      name: state.name,
      description: state.description,
      campaignType: state.campaignType,
      status: state.status,
      surveyId: state.surveyId,
      startsAt: state.startsAt ? toStartOfDayIso(state.startsAt) : null,
      endsAt: state.endsAt ? toEndOfDayIso(state.endsAt) : null,
      maxClaimsTotal: state.maxClaimsTotal,
      identityRequirement: state.identityRequirement,
      claimValidityDays: state.claimValidityDays,
      completionMessage: state.completionMessage,
      reward: {
        enabled: state.rewardEnabled,
        type: state.rewardType,
        codeMode: state.rewardCodeMode,
        fixedCode: state.rewardFixedCode,
        title: state.rewardTitle,
        description: state.rewardDescription,
        value: state.rewardValue,
        instructions: state.rewardInstructions,
        terms: state.rewardTerms,
      },
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);
    setError(null);

    const validation = validateCampaignAdminInput(buildAdminFormInput(form), {
      companyId,
      editingCampaignId: editingCampaign?.id ?? null,
      currentCampaignStatus: editingCampaign?.status ?? null,
      availableSurveys: surveys,
      existingCampaigns: campaigns,
    });

    if (!validation.valid) {
      setError(validation.error);
      setIsLoading(false);
      return;
    }

    const payload = validation.data;
    const supabase = createClient();

    const campaignColumns = {
      name: payload.name,
      description: payload.description,
      campaign_type: payload.campaign_type,
      survey_id: payload.survey_id,
      status: payload.status,
      starts_at: payload.starts_at,
      ends_at: payload.ends_at,
      max_claims_total: payload.max_claims_total,
      identity_requirement: payload.identity_requirement,
      claim_validity_days: payload.claim_validity_days,
      completion_message: payload.completion_message,
    };

    const request = editingCampaign
      ? supabase
          .from("campaigns")
          .update(campaignColumns)
          .eq("id", editingCampaign.id)
          .select("*, surveys(title)")
          .single()
      : supabase
          .from("campaigns")
          .insert({
            company_id: companyId,
            ...campaignColumns,
          })
          .select("*, surveys(title)")
          .single();

    const { data, error: saveError } = await request;

    if (saveError) {
      console.error("Erro ao salvar campanha:", saveError);
      setError(getFriendlyCampaignError(saveError.message, saveError.code));
      setIsLoading(false);
      return;
    }

    const savedCampaignRow = data as CampaignWithSurvey & {
      surveys?: { title: string } | null;
    };

    // S3.3 — Sincronizar campaign_surveys (fonte prioritária) com campaigns.survey_id (legado)
    await supabase.from("campaign_surveys").delete().eq("campaign_id", savedCampaignRow.id);

    if (payload.survey_id) {
      const { error: linkError } = await supabase.from("campaign_surveys").insert({
        campaign_id: savedCampaignRow.id,
        survey_id: payload.survey_id,
      });

      if (linkError) {
        console.error("Erro ao sincronizar pesquisa da campanha:", linkError);
        setError(getFriendlyCampaignError(linkError.message, linkError.code));
        setIsLoading(false);
        return;
      }
    }

    // S3.4 — Sincronizar campaign_rewards (1:1 por campaign_id)
    let savedReward: CampaignReward | null = null;
    if (payload.reward) {
      const { data: rewardData, error: rewardError } = await supabase
        .from("campaign_rewards")
        .upsert(
          {
            campaign_id: savedCampaignRow.id,
            type: payload.reward.type,
            code_mode: payload.reward.code_mode,
            fixed_code: payload.reward.fixed_code,
            title: payload.reward.title,
            description: payload.reward.description,
            value: payload.reward.value,
            instructions: payload.reward.instructions,
            terms: payload.reward.terms,
          },
          { onConflict: "campaign_id" },
        )
        .select("*")
        .single();

      if (rewardError) {
        console.error("Erro ao salvar recompensa da campanha:", rewardError);
        setError(getFriendlyCampaignError(rewardError.message, rewardError.code));
        setIsLoading(false);
        return;
      }

      savedReward = rewardData as CampaignReward;
    } else if (editingCampaign?.reward) {
      await supabase.from("campaign_rewards").delete().eq("campaign_id", savedCampaignRow.id);
    }

    const resolvedSurveyTitle =
      (payload.survey_id ? surveyTitleById.get(payload.survey_id) : null) ??
      savedCampaignRow.surveys?.title ??
      null;

    const savedCampaign: CampaignWithSurvey = {
      ...savedCampaignRow,
      survey_id: payload.survey_id,
      linked_survey_id: payload.survey_id,
      survey_title: resolvedSurveyTitle,
      reward: savedReward,
      claims_count: editingCampaign?.claims_count ?? 0,
    };

    setCampaigns((current) =>
      editingCampaign
        ? current.map((campaign) => (campaign.id === savedCampaign.id ? savedCampaign : campaign))
        : [savedCampaign, ...current],
    );
    setMessage(
      editingCampaign
        ? "Campanha atualizada com sucesso."
        : "Campanha criada com sucesso.",
    );
    setForm(defaultForm);
    setIsCreating(false);
    setEditingCampaignId(null);
    setShowFormPreview(false);
    setIsLoading(false);
  }

  async function transitionCampaignStatus(
    campaign: CampaignWithSurvey,
    nextStatus: CampaignStatus,
    successFeedback: string,
  ) {
    setIsLoading(true);
    setMessage(null);
    setError(null);

    const effectiveSurveyId = campaign.linked_survey_id ?? campaign.survey_id ?? null;

    if (nextStatus === "active" && effectiveSurveyId) {
      const conflict = findActiveCampaignConflict(effectiveSurveyId, campaigns, {
        companyId,
        excludeCampaignId: campaign.id,
      });

      if (conflict) {
        setError(
          `Esta pesquisa já possui uma campanha ativa ("${conflict.name}"). Pause ou arquive a campanha atual antes de ativar outra para a mesma pesquisa.`,
        );
        setIsLoading(false);
        return;
      }
    }

    const supabase = createClient();
    const { data, error: statusError } = await supabase
      .from("campaigns")
      .update({ status: nextStatus })
      .eq("id", campaign.id)
      .select("*, surveys(title)")
      .single();

    if (statusError) {
      console.error("Erro ao atualizar status da campanha:", statusError);
      setError(getFriendlyCampaignError(statusError.message, statusError.code));
      setIsLoading(false);
      return;
    }

    const updatedRow = data as CampaignWithSurvey & { surveys?: { title: string } | null };
    const updatedCampaign: CampaignWithSurvey = {
      ...campaign,
      ...updatedRow,
      survey_id: effectiveSurveyId,
      linked_survey_id: effectiveSurveyId,
      survey_title:
        (effectiveSurveyId ? surveyTitleById.get(effectiveSurveyId) : null) ??
        updatedRow.surveys?.title ??
        campaign.survey_title ??
        null,
      reward: campaign.reward ?? null,
      claims_count: campaign.claims_count ?? 0,
    };

    setCampaigns((current) =>
      current.map((item) => (item.id === updatedCampaign.id ? updatedCampaign : item)),
    );
    setMessage(successFeedback);
    setIsLoading(false);
  }

  const shouldShowForm = isCreating || Boolean(editingCampaign);

  const liveFormPreview = useMemo(() => {
    const validityNum = Number(form.claimValidityDays);
    return buildCampaignPreviewPayload({
      completionMessage: form.completionMessage,
      claimValidityDays:
        Number.isInteger(validityNum) && validityNum > 0 ? validityNum : null,
      reward: form.rewardEnabled
        ? {
            type: form.rewardType,
            code_mode: form.rewardCodeMode,
            fixed_code: form.rewardCodeMode === "fixed" ? form.rewardFixedCode || "CODIGOFIXO" : null,
            title: form.rewardTitle.trim() || null,
            description: form.rewardDescription.trim() || null,
            value: form.rewardValue.trim() ? Number(form.rewardValue.replace(",", ".")) : null,
            instructions: form.rewardInstructions.trim() || null,
            terms: form.rewardTerms.trim() || null,
          }
        : null,
    });
  }, [
    form.claimValidityDays,
    form.completionMessage,
    form.rewardCodeMode,
    form.rewardDescription,
    form.rewardEnabled,
    form.rewardFixedCode,
    form.rewardInstructions,
    form.rewardTerms,
    form.rewardTitle,
    form.rewardType,
    form.rewardValue,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campanhas"
        description="Configure campanhas de incentivo, vincule pesquisas e acompanhe as recompensas emitidas."
        actions={
          <Button className="w-full sm:w-auto" onClick={startCreate} disabled={isLoading}>
            <Plus className="h-4 w-4" />
            Criar campanha
          </Button>
        }
      />

      {message ? (
        <p className="rounded-md border border-success/20 bg-success-soft px-3 py-2 text-sm text-success">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {/* S3.2 a S3.7 — Formulário Administrativo Completo */}
      {shouldShowForm ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingCampaign ? "Editar campanha" : "Nova campanha"}</CardTitle>
            <CardDescription>
              Configure pesquisa vinculada, recompensa, regras de emissão e mensagem de conclusão.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* 1. Informações Básicas & Período */}
              <div className="space-y-4 rounded-lg border border-border bg-surface-muted/50 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                  1. Informações básicas e período
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="campaign-name">Nome da campanha *</Label>
                    <Input
                      id="campaign-name"
                      value={form.name}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Ex.: Cupom de feedback no caixa"
                      minLength={3}
                      required
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="campaign-type">Tipo</Label>
                      <Select
                        id="campaign-type"
                        value={form.campaignType}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            campaignType: event.target.value as CampaignType,
                          }))
                        }
                      >
                        {campaignTypes.map((type) => (
                          <option key={type} value={type}>
                            {campaignTypeLabels[type]}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="campaign-status">Status</Label>
                      <Select
                        id="campaign-status"
                        value={form.status}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            status: event.target.value as CampaignStatus,
                          }))
                        }
                      >
                        {campaignStatuses.map((status) => (
                          <option key={status} value={status}>
                            {campaignStatusLabels[status]}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="campaign-description">Descrição (opcional)</Label>
                  <Textarea
                    id="campaign-description"
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, description: event.target.value }))
                    }
                    placeholder="Objetivo e contexto operacional desta campanha"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="campaign-starts-at">Data de início (opcional)</Label>
                    <Input
                      id="campaign-starts-at"
                      type="date"
                      value={form.startsAt}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, startsAt: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="campaign-ends-at">Data de término (opcional)</Label>
                    <Input
                      id="campaign-ends-at"
                      type="date"
                      value={form.endsAt}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, endsAt: event.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* 2. Pesquisa Vinculada */}
              <div className="space-y-3 rounded-lg border border-border bg-surface-muted/50 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                  2. Pesquisa vinculada
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="campaign-survey">Pesquisa que acionará esta campanha</Label>
                  <Select
                    id="campaign-survey"
                    value={form.surveyId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, surveyId: event.target.value }))
                    }
                  >
                    <option value="">Sem pesquisa vinculada</option>
                    {surveys.map((survey) => (
                      <option key={survey.id} value={survey.id}>
                        {survey.title}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Cada pesquisa pode ter no máximo uma campanha ativa por vez. Clientes que
                    responderem à pesquisa ativa vinculada receberão o benefício configurado abaixo.
                  </p>
                </div>
              </div>

              {/* 3. Configuração da Recompensa */}
              <div className="space-y-4 rounded-lg border border-border bg-surface-muted/50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                      3. Recompensa da campanha
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Defina o benefício concedido ao cliente após responder à pesquisa.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-text-primary">
                    <input
                      type="checkbox"
                      checked={form.rewardEnabled}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          rewardEnabled: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-brand"
                    />
                    Emitir recompensa nesta campanha
                  </label>
                </div>

                {form.rewardEnabled ? (
                  <div className="space-y-4 pt-2">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="reward-type">Tipo de recompensa</Label>
                        <Select
                          id="reward-type"
                          value={form.rewardType}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              rewardType: event.target.value as CampaignRewardType,
                            }))
                          }
                        >
                          {campaignRewardTypes.map((type) => (
                            <option key={type} value={type}>
                              {campaignRewardTypeLabels[type]}
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reward-value">
                          {form.rewardType === "percentage"
                            ? "Percentual de desconto (%) *"
                            : form.rewardType === "fixed_amount"
                              ? "Valor do desconto (R$) *"
                              : "Valor estimado (opcional)"}
                        </Label>
                        <Input
                          id="reward-value"
                          type="number"
                          step="any"
                          min={form.rewardType === "percentage" || form.rewardType === "fixed_amount" ? "1" : "0"}
                          max={form.rewardType === "percentage" ? "100" : undefined}
                          value={form.rewardValue}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, rewardValue: event.target.value }))
                          }
                          placeholder={form.rewardType === "percentage" ? "10" : "25"}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reward-code-mode">Modo do código</Label>
                        <Select
                          id="reward-code-mode"
                          value={form.rewardCodeMode}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              rewardCodeMode: event.target.value as CampaignCodeMode,
                            }))
                          }
                        >
                          {campaignCodeModes.map((mode) => (
                            <option key={mode} value={mode}>
                              {campaignCodeModeLabels[mode]}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    {form.rewardCodeMode === "fixed" ? (
                      <div className="space-y-2">
                        <Label htmlFor="reward-fixed-code">Código fixo compartilhado *</Label>
                        <Input
                          id="reward-fixed-code"
                          value={form.rewardFixedCode}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              rewardFixedCode: event.target.value.toUpperCase(),
                            }))
                          }
                          placeholder="Ex.: KOGNIS10"
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Todos os clientes elegíveis receberão este mesmo código ao concluir a pesquisa.
                        </p>
                      </div>
                    ) : (
                      <p className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
                        Modo <strong>Código único</strong>: o Kognis gera automaticamente um código
                        exclusivo (formato <code className="font-mono">KOGNIS-XXXXXX</code>) para
                        cada resposta elegível.
                      </p>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="reward-title">
                          Título do benefício{" "}
                          {form.rewardType === "gift" || form.rewardType === "custom" ? "*" : "(opcional)"}
                        </Label>
                        <Input
                          id="reward-title"
                          value={form.rewardTitle}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, rewardTitle: event.target.value }))
                          }
                          placeholder="Ex.: 10% OFF na próxima compra"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reward-description">Descrição do benefício (opcional)</Label>
                        <Input
                          id="reward-description"
                          value={form.rewardDescription}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              rewardDescription: event.target.value,
                            }))
                          }
                          placeholder="Ex.: Válido em compras presenciais"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="reward-instructions">Instruções de uso (opcional)</Label>
                        <Textarea
                          id="reward-instructions"
                          value={form.rewardInstructions}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              rewardInstructions: event.target.value,
                            }))
                          }
                          placeholder="Ex.: Apresente este código ao caixa antes de fechar o pedido."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reward-terms">Termos e condições (opcional)</Label>
                        <Textarea
                          id="reward-terms"
                          value={form.rewardTerms}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, rewardTerms: event.target.value }))
                          }
                          placeholder="Ex.: Uso único por CPF. Não cumulativo com outras promoções."
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Esta campanha será salva sem emissão de recompensa até que você ative esta opção.
                  </p>
                )}
              </div>

              {/* 4. Regras Básicas da Campanha */}
              <div className="space-y-4 rounded-lg border border-border bg-surface-muted/50 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                  4. Regras básicas de emissão
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="campaign-max-claims">Limite total de recompensas (opcional)</Label>
                    <Input
                      id="campaign-max-claims"
                      type="number"
                      min="1"
                      step="1"
                      value={form.maxClaimsTotal}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          maxClaimsTotal: event.target.value,
                        }))
                      }
                      placeholder="Sem limite"
                    />
                    <p className="text-xs text-muted-foreground">
                      Quantidade máxima total de recompensas emitidas por esta campanha.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="campaign-validity-days">Validade da recompensa em dias (opcional)</Label>
                    <Input
                      id="campaign-validity-days"
                      type="number"
                      min="1"
                      step="1"
                      value={form.claimValidityDays}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          claimValidityDays: event.target.value,
                        }))
                      }
                      placeholder="Ex.: 15"
                    />
                    <p className="text-xs text-muted-foreground">
                      Prazo em dias para o cliente utilizar o benefício após a emissão.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="campaign-identity">Identificação exigida</Label>
                    <Select
                      id="campaign-identity"
                      value={form.identityRequirement}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          identityRequirement: event.target.value as IdentityRequirement,
                        }))
                      }
                    >
                      {identityRequirements.map((req) => (
                        <option key={req} value={req}>
                          {identityRequirementLabels[req]}
                        </option>
                      ))}
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {identityRequirementDescriptions[form.identityRequirement]}
                    </p>
                  </div>
                </div>
              </div>

              {/* 5. Mensagem de Conclusão */}
              <div className="space-y-3 rounded-lg border border-border bg-surface-muted/50 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                  5. Mensagem de conclusão
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="campaign-completion-message">
                    Mensagem exibida ao cliente após responder (opcional)
                  </Label>
                  <Textarea
                    id="campaign-completion-message"
                    value={form.completionMessage}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        completionMessage: event.target.value,
                      }))
                    }
                    placeholder={DEFAULT_CAMPAIGN_COMPLETION_MESSAGE}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se deixada em branco, será exibida a mensagem padrão: &ldquo;
                    {DEFAULT_CAMPAIGN_COMPLETION_MESSAGE}&rdquo;.
                  </p>
                </div>
              </div>

              {/* S3.7 — Preview dentro do formulário */}
              {showFormPreview ? (
                <div className="space-y-3 rounded-lg border border-brand/30 bg-brand-soft/20 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand">
                      Prévia administrativa — nenhuma resposta ou recompensa é gerada
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowFormPreview(false)}
                    >
                      Ocultar prévia
                    </Button>
                  </div>
                  <SubmissionCompletionCard
                    reward={liveFormPreview.reward}
                    completionMessage={liveFormPreview.completionMessage}
                  />
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button className="w-full sm:w-auto" type="submit" disabled={isLoading}>
                    <Save className="h-4 w-4" />
                    {isLoading
                      ? "Salvando..."
                      : editingCampaign
                        ? "Salvar alterações"
                        : "Criar campanha"}
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    type="button"
                    variant="secondary"
                    onClick={() => setShowFormPreview((current) => !current)}
                    disabled={isLoading}
                  >
                    <Eye className="h-4 w-4" />
                    {showFormPreview ? "Ocultar preview" : "Visualizar preview"}
                  </Button>
                </div>
                <Button
                  className="w-full sm:w-auto"
                  type="button"
                  variant="secondary"
                  onClick={cancelForm}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {/* S3.7 — Painel de Preview Administrativo de uma Campanha Salva */}
      {previewCampaign ? (
        <CampaignPreviewModal
          campaign={previewCampaign}
          onClose={() => setPreviewCampaignId(null)}
        />
      ) : null}

      {/* S3.8 & S3.9 — Painel de Detalhes Operacionais + Claims */}
      {selectedDetailsCampaign ? (
        <CampaignDetailsPanel
          campaign={selectedDetailsCampaign}
          claims={claimsByCampaignId[selectedDetailsCampaign.id] ?? []}
          isLoadingClaims={isLoadingClaims}
          claimsError={claimsError}
          onRefreshClaims={() => loadCampaignClaims(selectedDetailsCampaign)}
          onClose={() => setSelectedDetailsCampaignId(null)}
        />
      ) : null}

      {campaigns.length === 0 && !shouldShowForm ? (
        <EmptyState
          title="Você ainda não criou nenhuma campanha."
          description="Crie uma campanha para oferecer recompensas aos clientes que responderem às suas pesquisas."
          actionLabel="Criar campanha"
          onAction={startCreate}
        />
      ) : null}

      {campaigns.length > 0 ? (
        <div className="grid gap-4">
          {campaigns.map((campaign) => {
            const lifecycle = getCampaignLifecyclePermissions(campaign);
            const reward = campaign.reward ?? null;
            const claimsCount = campaign.claims_count ?? 0;

            return (
              <Card key={campaign.id}>
                <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold text-text-primary">
                        {campaign.name}
                      </h2>
                      <CampaignStatusPill status={lifecycle.displayStatus} />
                      {lifecycle.isReadOnly ? (
                        <Badge variant="default">Somente leitura</Badge>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                      <span>
                        Pesquisa:{" "}
                        <strong className="font-medium text-text-primary">
                          {campaign.survey_title ?? "Sem pesquisa vinculada"}
                        </strong>
                      </span>
                      <span>
                        Recompensa:{" "}
                        <strong className="font-medium text-text-primary">
                          {reward
                            ? reward.title || campaignRewardTypeLabels[reward.type]
                            : "Não configurada"}
                        </strong>
                      </span>
                      <span>
                        Emitidas:{" "}
                        <strong className="font-medium text-text-primary">
                          {typeof campaign.max_claims_total === "number"
                            ? `${claimsCount} / ${campaign.max_claims_total}`
                            : claimsCount}
                        </strong>
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {formatCampaignPeriod(campaign.starts_at, campaign.ends_at)} · Identidade:{" "}
                      {identityRequirementLabels[campaign.identity_requirement ?? "none"]}
                    </p>

                    {campaign.description ? (
                      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                        {campaign.description}
                      </p>
                    ) : null}
                  </div>

                  {/* S3.10 — Controles de Ciclo de Vida por Estado */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      className="w-full sm:w-auto"
                      variant="secondary"
                      onClick={() => openDetails(campaign)}
                      disabled={isLoading}
                    >
                      <Ticket className="h-4 w-4" />
                      Detalhes
                    </Button>

                    <Button
                      className="w-full sm:w-auto"
                      variant="secondary"
                      onClick={() => setPreviewCampaignId(campaign.id)}
                      disabled={isLoading}
                    >
                      <Eye className="h-4 w-4" />
                      Preview
                    </Button>

                    {lifecycle.canEdit ? (
                      <Button
                        className="w-full sm:w-auto"
                        variant="secondary"
                        onClick={() => startEdit(campaign)}
                        disabled={isLoading}
                      >
                        <Edit3 className="h-4 w-4" />
                        Editar
                      </Button>
                    ) : null}

                    {lifecycle.canActivate ? (
                      <Button
                        className="w-full sm:w-auto"
                        onClick={() =>
                          transitionCampaignStatus(
                            campaign,
                            "active",
                            "Campanha ativada com sucesso.",
                          )
                        }
                        disabled={isLoading}
                      >
                        <Play className="h-4 w-4" />
                        Ativar
                      </Button>
                    ) : null}

                    {lifecycle.canPause ? (
                      <Button
                        className="w-full sm:w-auto"
                        variant="secondary"
                        onClick={() =>
                          transitionCampaignStatus(
                            campaign,
                            "paused",
                            "Campanha pausada.",
                          )
                        }
                        disabled={isLoading}
                      >
                        <Pause className="h-4 w-4" />
                        Pausar
                      </Button>
                    ) : null}

                    {lifecycle.canReactivate ? (
                      <Button
                        className="w-full sm:w-auto"
                        onClick={() =>
                          transitionCampaignStatus(
                            campaign,
                            "active",
                            "Campanha reativada com sucesso.",
                          )
                        }
                        disabled={isLoading}
                      >
                        <Play className="h-4 w-4" />
                        Reativar
                      </Button>
                    ) : null}

                    {lifecycle.canArchive ? (
                      <Button
                        className="w-full sm:w-auto"
                        variant="secondary"
                        onClick={() =>
                          transitionCampaignStatus(
                            campaign,
                            "archived",
                            "Campanha arquivada.",
                          )
                        }
                        disabled={isLoading}
                      >
                        <Archive className="h-4 w-4" />
                        Arquivar
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function CampaignStatusPill({ status }: { status: CampaignDisplayStatus }) {
  const variantMap: Record<
    CampaignDisplayStatus,
    "default" | "brand" | "success" | "warning" | "danger" | "info"
  > = {
    draft: "warning",
    active: "success",
    paused: "info",
    archived: "default",
    expired: "danger",
  };

  return <Badge variant={variantMap[status]}>{campaignDisplayStatusLabels[status]}</Badge>;
}

function CampaignPreviewModal({
  campaign,
  onClose,
}: {
  campaign: CampaignWithSurvey;
  onClose: () => void;
}) {
  const preview = buildCampaignPreviewPayload({
    completionMessage: campaign.completion_message,
    claimValidityDays: campaign.claim_validity_days,
    reward: campaign.reward ?? null,
  });

  return (
    <Card className="border-brand/30">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">
            Preview Administrativo da Campanha
          </p>
          <CardTitle className="mt-1">{campaign.name}</CardTitle>
          <CardDescription>
            Simulação visual da tela final apresentada ao cliente. Nenhuma resposta ou claim é
            emitido neste preview.
          </CardDescription>
        </div>
        <Button type="button" variant="secondary" onClick={onClose}>
          <X className="h-4 w-4" />
          Fechar preview
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-md border border-border bg-surface-muted p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Pesquisa vinculada</p>
            <p className="mt-0.5 font-medium text-text-primary">
              {campaign.survey_title ?? "Sem pesquisa vinculada"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Regra de identificação</p>
            <p className="mt-0.5 font-medium text-text-primary">
              {identityRequirementLabels[campaign.identity_requirement ?? "none"]}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Modo do código</p>
            <p className="mt-0.5 font-medium text-text-primary">
              {campaign.reward
                ? campaignCodeModeLabels[campaign.reward.code_mode]
                : "Sem recompensa"}
            </p>
          </div>
        </div>

        <SubmissionCompletionCard
          reward={preview.reward}
          completionMessage={preview.completionMessage}
        />
      </CardContent>
    </Card>
  );
}

function CampaignDetailsPanel({
  campaign,
  claims,
  isLoadingClaims,
  claimsError,
  onRefreshClaims,
  onClose,
}: {
  campaign: CampaignWithSurvey;
  claims: SanitizedCampaignClaimView[];
  isLoadingClaims: boolean;
  claimsError: string | null;
  onRefreshClaims: () => void;
  onClose: () => void;
}) {
  const lifecycle = getCampaignLifecyclePermissions(campaign);
  const reward = campaign.reward ?? null;
  const claimsCount = campaign.claims_count ?? claims.filter((c) => c.status !== "voided").length;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{campaign.name}</CardTitle>
            <CampaignStatusPill status={lifecycle.displayStatus} />
          </div>
          <CardDescription className="mt-1">
            {campaign.description || "Visão operacional, regras e benefícios emitidos pela campanha."}
          </CardDescription>
        </div>
        <Button type="button" variant="secondary" onClick={onClose}>
          <X className="h-4 w-4" />
          Fechar detalhes
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* S3.8 — Resumo, Recompensa, Regras e Operação */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface-muted p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Calendar className="h-4 w-4 text-brand" />
              Resumo
            </div>
            <p className="text-sm text-text-primary">
              <span className="text-muted-foreground">Tipo:</span>{" "}
              {campaignTypeLabels[campaign.campaign_type ?? "reward_on_response"]}
            </p>
            <p className="text-sm text-text-primary">
              <span className="text-muted-foreground">Pesquisa:</span>{" "}
              {campaign.survey_title ?? "Sem pesquisa vinculada"}
            </p>
            <p className="text-sm text-text-primary">
              <span className="text-muted-foreground">Período:</span>{" "}
              {formatCampaignPeriod(campaign.starts_at, campaign.ends_at)}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface-muted p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Gift className="h-4 w-4 text-brand" />
              Recompensa
            </div>
            {reward ? (
              <>
                <p className="text-sm font-medium text-text-primary">
                  {reward.title || campaignRewardTypeLabels[reward.type]}
                </p>
                <p className="text-sm text-text-secondary">
                  Tipo: {campaignRewardTypeLabels[reward.type]}
                  {typeof reward.value === "number" ? ` (${reward.value})` : ""}
                </p>
                <p className="text-sm text-text-secondary">
                  Código: {campaignCodeModeLabels[reward.code_mode]}
                  {reward.code_mode === "fixed" && reward.fixed_code
                    ? ` (${reward.fixed_code})`
                    : ""}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma recompensa configurada.</p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-surface-muted p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-brand" />
              Regras
            </div>
            <p className="text-sm text-text-primary">
              <span className="text-muted-foreground">Identidade:</span>{" "}
              {identityRequirementLabels[campaign.identity_requirement ?? "none"]}
            </p>
            <p className="text-sm text-text-primary">
              <span className="text-muted-foreground">Validade do cupom:</span>{" "}
              {typeof campaign.claim_validity_days === "number"
                ? `${campaign.claim_validity_days} dias`
                : "Sem expiração"}
            </p>
            <p className="text-sm text-text-primary">
              <span className="text-muted-foreground">Mensagem:</span>{" "}
              {resolveCampaignCompletionMessage(campaign.completion_message)}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface-muted p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-brand" />
              Operação
            </div>
            <p className="text-2xl font-semibold text-text-primary">
              {typeof campaign.max_claims_total === "number"
                ? `${claimsCount} / ${campaign.max_claims_total}`
                : claimsCount}
            </p>
            <p className="text-xs text-muted-foreground">
              {typeof campaign.max_claims_total === "number"
                ? "recompensas emitidas do limite total"
                : "recompensas emitidas (sem limite máximo)"}
            </p>
            <p className="text-xs font-medium text-text-secondary">
              Situação: {campaignDisplayStatusLabels[lifecycle.displayStatus]}
            </p>
          </div>
        </div>

        {/* S3.9 — Lista Administrativa Segura de Claims */}
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-text-primary">
                Benefícios emitidos (Claims)
              </h3>
              <p className="text-xs text-muted-foreground">
                Histórico de códigos gerados para respondentes desta campanha. Dados de
                identificação permanecem protegidos.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={onRefreshClaims}
              disabled={isLoadingClaims}
            >
              {isLoadingClaims ? "Atualizando..." : "Atualizar lista"}
            </Button>
          </div>

          {claimsError ? (
            <p className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
              {claimsError}
            </p>
          ) : null}

          {!isLoadingClaims && claims.length === 0 ? (
            <p className="rounded-md border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
              Nenhuma recompensa emitida para esta campanha até o momento.
            </p>
          ) : null}

          {claims.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-surface-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Emissão</th>
                    <th className="px-4 py-3">Validade</th>
                    <th className="px-4 py-3">Pesquisa</th>
                    <th className="px-4 py-3">Identificação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface">
                  {claims.map((claim) => {
                    const expired = isClaimExpired({
                      status: claim.status,
                      expires_at: claim.expires_at,
                    });

                    return (
                      <tr key={claim.id}>
                        <td className="px-4 py-3 font-mono font-semibold text-text-primary">
                          {claim.code ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              expired
                                ? "danger"
                                : claim.status === "issued"
                                  ? "success"
                                  : claim.status === "redeemed"
                                    ? "info"
                                    : "default"
                            }
                          >
                            {expired ? "Expirada" : campaignClaimStatusLabels[claim.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {formatDate(claim.issued_at)}
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {claim.expires_at ? formatDate(claim.expires_at) : "Sem validade"}
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {claim.survey_title ?? campaign.survey_title ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-text-secondary">{claim.identity_label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function getFriendlyCampaignError(message: string, code?: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("survey already has an active campaign")) {
    return "Esta pesquisa já possui uma campanha ativa. Pause ou arquive a campanha atual antes de ativar outra.";
  }

  if (code === "23514") {
    return "Revise os dados, datas e limites informados antes de salvar a campanha.";
  }

  if (normalizedMessage.includes("permission") || normalizedMessage.includes("row-level security")) {
    return "Você não tem permissão para alterar esta campanha.";
  }

  if (normalizedMessage.includes("failed to fetch") || normalizedMessage.includes("network")) {
    return "Não foi possível conectar ao Supabase. Verifique sua conexão e tente novamente.";
  }

  return "Não foi possível salvar a campanha agora. Tente novamente.";
}

function formatDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function formatCampaignPeriod(startsAt: string | null, endsAt: string | null): string {
  if (startsAt && endsAt) {
    return `De ${formatDate(startsAt)} até ${formatDate(endsAt)}`;
  }

  if (startsAt) {
    return `A partir de ${formatDate(startsAt)}`;
  }

  if (endsAt) {
    return `Até ${formatDate(endsAt)}`;
  }

  return "Período contínuo";
}

function formatIsoForDateInput(iso: string | null | undefined): string {
  if (!iso) {
    return "";
  }

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
}

function toStartOfDayIso(dateInput: string): string {
  return `${dateInput.trim()}T00:00:00.000Z`;
}

function toEndOfDayIso(dateInput: string): string {
  return `${dateInput.trim()}T23:59:59.999Z`;
}
