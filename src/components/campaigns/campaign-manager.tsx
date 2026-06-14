"use client";

import { Archive, Edit3, Plus, Save, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { isValidCampaignStatus } from "@/lib/campaign-utils";
import type { CampaignStatus, CampaignWithSurvey } from "@/types/campaign";
import { campaignStatusLabels, campaignStatuses } from "@/types/campaign";
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
  surveyId: string;
  status: CampaignStatus;
};

const defaultForm: CampaignFormState = {
  name: "",
  description: "",
  surveyId: "",
  status: "draft",
};

export function CampaignManager({
  companyId,
  initialCampaigns,
  surveys,
  initialError,
}: CampaignManagerProps) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [isCreating, setIsCreating] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [form, setForm] = useState<CampaignFormState>(defaultForm);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const editingCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === editingCampaignId),
    [campaigns, editingCampaignId],
  );

  function startCreate() {
    if (initialError) {
      setError(initialError);
      return;
    }

    setForm(defaultForm);
    setEditingCampaignId(null);
    setIsCreating(true);
    setMessage(null);
    setError(null);
  }

  function startEdit(campaign: CampaignWithSurvey) {
    setForm({
      name: campaign.name,
      description: campaign.description ?? "",
      surveyId: campaign.survey_id ?? "",
      status: campaign.status,
    });
    setEditingCampaignId(campaign.id);
    setIsCreating(false);
    setMessage(null);
    setError(null);
  }

  function cancelForm() {
    setForm(defaultForm);
    setIsCreating(false);
    setEditingCampaignId(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);
    setError(null);

    const name = form.name.trim();
    const description = form.description.trim() || null;
    const surveyId = form.surveyId || null;

    if (name.length < 3) {
      setError("Informe um nome com pelo menos 3 caracteres.");
      setIsLoading(false);
      return;
    }

    if (!isValidCampaignStatus(form.status)) {
      setError("Escolha um status valido para a campanha.");
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    const request = editingCampaign
      ? supabase
          .from("campaigns")
          .update({
            name,
            description,
            survey_id: surveyId,
            status: form.status,
          })
          .eq("id", editingCampaign.id)
          .select("*, surveys(title)")
          .single()
      : supabase
          .from("campaigns")
          .insert({
            company_id: companyId,
            name,
            description,
            survey_id: surveyId,
            status: form.status,
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

    const savedCampaign = normalizeCampaign(data as CampaignWithSurvey & { surveys?: { title: string } | null });
    setCampaigns((current) =>
      editingCampaign
        ? current.map((campaign) => (campaign.id === savedCampaign.id ? savedCampaign : campaign))
        : [savedCampaign, ...current],
    );
    setMessage(editingCampaign ? "Campanha atualizada com sucesso." : "Campanha criada com sucesso.");
    setForm(defaultForm);
    setIsCreating(false);
    setEditingCampaignId(null);
    setIsLoading(false);
  }

  async function archiveCampaign(campaign: CampaignWithSurvey) {
    setIsLoading(true);
    setMessage(null);
    setError(null);

    const supabase = createClient();
    const { data, error: archiveError } = await supabase
      .from("campaigns")
      .update({ status: "archived" })
      .eq("id", campaign.id)
      .select("*, surveys(title)")
      .single();

    if (archiveError) {
      console.error("Erro ao arquivar campanha:", archiveError);
      setError(getFriendlyCampaignError(archiveError.message, archiveError.code));
      setIsLoading(false);
      return;
    }

    const archivedCampaign = normalizeCampaign(data as CampaignWithSurvey & { surveys?: { title: string } | null });
    setCampaigns((current) =>
      current.map((item) => (item.id === archivedCampaign.id ? archivedCampaign : item)),
    );
    setMessage("Campanha arquivada.");
    setIsLoading(false);
  }

  const shouldShowForm = isCreating || editingCampaign;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold text-white">Campanhas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Organize contextos de coleta e vincule campanhas a pesquisas existentes.
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={startCreate} disabled={isLoading}>
          <Plus className="h-4 w-4" />
          Criar Campanha
        </Button>
      </div>

      {message ? (
        <p className="rounded-md border border-kognis-teal/30 bg-kognis-teal/10 px-3 py-2 text-sm text-white">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      {shouldShowForm ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingCampaign ? "Editar campanha" : "Nova campanha"}</CardTitle>
            <CardDescription>
              Defina nome, descricao e a pesquisa vinculada a esta coleta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Nome</Label>
                <Input
                  id="campaign-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Nome da campanha"
                  minLength={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-description">Descricao</Label>
                <textarea
                  id="campaign-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Contexto da campanha"
                  className="min-h-28 w-full rounded-md border border-white/10 bg-white/[0.055] px-3 py-2 text-base text-white outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="campaign-survey">Pesquisa vinculada</Label>
                  <select
                    id="campaign-survey"
                    value={form.surveyId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, surveyId: event.target.value }))
                    }
                    className="flex h-11 w-full rounded-md border border-white/10 bg-white/[0.055] px-3 py-2 text-base text-white outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"
                  >
                    <option value="" className="bg-kognis-cyber text-white">
                      Sem pesquisa vinculada
                    </option>
                    {surveys.map((survey) => (
                      <option key={survey.id} value={survey.id} className="bg-kognis-cyber text-white">
                        {survey.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign-status">Status</Label>
                  <select
                    id="campaign-status"
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value as CampaignStatus,
                      }))
                    }
                    className="flex h-11 w-full rounded-md border border-white/10 bg-white/[0.055] px-3 py-2 text-base text-white outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"
                  >
                    {campaignStatuses.map((status) => (
                      <option key={status} value={status} className="bg-kognis-cyber text-white">
                        {campaignStatusLabels[status]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button className="w-full sm:w-auto" type="submit" disabled={isLoading}>
                  <Save className="h-4 w-4" />
                  {isLoading ? "Salvando..." : editingCampaign ? "Salvar alteracoes" : "Criar campanha"}
                </Button>
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

      {campaigns.length === 0 && !shouldShowForm ? (
        <EmptyState
          title="Você ainda não criou nenhuma campanha."
          description="Crie uma campanha para organizar o contexto de coleta das suas pesquisas."
          actionLabel="Criar Campanha"
          onAction={startCreate}
        />
      ) : null}

      {campaigns.length > 0 ? (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-semibold text-white">{campaign.name}</h2>
                    <span className="rounded-md border border-white/10 bg-white/[0.055] px-2 py-1 text-xs font-medium text-muted-foreground">
                      {campaignStatusLabels[campaign.status]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Pesquisa: {campaign.survey_title ?? "Sem pesquisa vinculada"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Criada em {formatDate(campaign.created_at)}
                  </p>
                  {campaign.description ? (
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                      {campaign.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="w-full sm:w-auto"
                    variant="secondary"
                    onClick={() => startEdit(campaign)}
                    disabled={isLoading}
                  >
                    <Edit3 className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    variant="secondary"
                    onClick={() => archiveCampaign(campaign)}
                    disabled={isLoading || campaign.status === "archived"}
                  >
                    <Archive className="h-4 w-4" />
                    Arquivar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function normalizeCampaign(campaign: CampaignWithSurvey & { surveys?: { title: string } | null }) {
  return {
    ...campaign,
    survey_title: campaign.surveys?.title ?? campaign.survey_title ?? null,
  };
}

function getFriendlyCampaignError(message: string, code?: string) {
  const normalizedMessage = message.toLowerCase();

  if (code === "23514") {
    return "Revise nome e status antes de salvar a campanha.";
  }

  if (normalizedMessage.includes("permission") || normalizedMessage.includes("row-level security")) {
    return "Voce nao tem permissao para alterar esta campanha.";
  }

  if (normalizedMessage.includes("failed to fetch") || normalizedMessage.includes("network")) {
    return "Nao foi possivel conectar ao Supabase. Verifique sua conexao e tente novamente.";
  }

  return "Nao foi possivel salvar a campanha agora. Tente novamente.";
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}
