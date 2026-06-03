"use client";

import { Archive, Edit3, Plus, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { isValidSurveyStatus } from "@/lib/survey-utils";
import type { Survey, SurveyStatus } from "@/types/survey";
import { surveyStatusLabels, surveyStatuses } from "@/types/survey";

type SurveyManagerProps = {
  companyId: string;
  initialSurveys: Survey[];
};

type SurveyFormState = {
  title: string;
  description: string;
  status: SurveyStatus;
};

const defaultForm: SurveyFormState = {
  title: "",
  description: "",
  status: "draft",
};

export function SurveyManager({ companyId, initialSurveys }: SurveyManagerProps) {
  const router = useRouter();
  const [surveys, setSurveys] = useState(initialSurveys);
  const [isCreating, setIsCreating] = useState(false);
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null);
  const [form, setForm] = useState<SurveyFormState>(defaultForm);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editingSurvey = useMemo(
    () => surveys.find((survey) => survey.id === editingSurveyId),
    [editingSurveyId, surveys],
  );

  function startCreate() {
    setForm(defaultForm);
    setEditingSurveyId(null);
    setIsCreating(true);
    setError(null);
    setMessage(null);
  }

  function startEdit(survey: Survey) {
    setForm({
      title: survey.title,
      description: survey.description ?? "",
      status: survey.status,
    });
    setEditingSurveyId(survey.id);
    setIsCreating(false);
    setError(null);
    setMessage(null);
  }

  function cancelForm() {
    setForm(defaultForm);
    setEditingSurveyId(null);
    setIsCreating(false);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    const title = form.title.trim();
    const description = form.description.trim() || null;

    if (title.length < 3) {
      setError("Informe um titulo com pelo menos 3 caracteres.");
      setIsLoading(false);
      return;
    }

    if (!isValidSurveyStatus(form.status)) {
      setError("Escolha um status valido para a pesquisa.");
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    const request = editingSurvey
      ? supabase
          .from("surveys")
          .update({
            title,
            description,
            status: form.status,
          })
          .eq("id", editingSurvey.id)
          .select("*")
          .single()
      : supabase
          .from("surveys")
          .insert({
            company_id: companyId,
            title,
            description,
            status: form.status,
          })
          .select("*")
          .single();

    const { data, error: saveError } = await request;

    if (saveError) {
      console.error("Erro ao salvar pesquisa:", saveError);
      setError(getFriendlySurveyError(saveError.message, saveError.code));
      setIsLoading(false);
      return;
    }

    const savedSurvey = data as Survey;
    setSurveys((current) =>
      editingSurvey
        ? current.map((survey) => (survey.id === savedSurvey.id ? savedSurvey : survey))
        : [savedSurvey, ...current],
    );
    setMessage(editingSurvey ? "Pesquisa atualizada com sucesso." : "Pesquisa criada com sucesso.");
    setForm(defaultForm);
    setEditingSurveyId(null);
    setIsCreating(false);
    setIsLoading(false);
    router.refresh();
  }

  async function archiveSurvey(survey: Survey) {
    setIsLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { data, error: archiveError } = await supabase
      .from("surveys")
      .update({ status: "archived" })
      .eq("id", survey.id)
      .select("*")
      .single();

    if (archiveError) {
      console.error("Erro ao arquivar pesquisa:", archiveError);
      setError(getFriendlySurveyError(archiveError.message, archiveError.code));
      setIsLoading(false);
      return;
    }

    const archivedSurvey = data as Survey;
    setSurveys((current) =>
      current.map((item) => (item.id === archivedSurvey.id ? archivedSurvey : item)),
    );
    setMessage("Pesquisa arquivada.");
    setIsLoading(false);
    router.refresh();
  }

  const shouldShowForm = isCreating || editingSurvey;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold text-white">Pesquisas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Crie e gerencie pesquisas de consumidor da sua empresa.
          </p>
        </div>
        <Button onClick={startCreate} disabled={isLoading}>
          <Plus className="h-4 w-4" />
          Nova pesquisa
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
            <CardTitle>{editingSurvey ? "Editar pesquisa" : "Nova pesquisa"}</CardTitle>
            <CardDescription>
              Defina as informacoes basicas da pesquisa. Campanhas e QR Codes entram em outra sprint.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="survey-title">Titulo</Label>
                <Input
                  id="survey-title"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Pesquisa de satisfacao"
                  minLength={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="survey-description">Descricao</Label>
                <textarea
                  id="survey-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Conte rapidamente o objetivo da pesquisa"
                  className="min-h-28 w-full rounded-md border border-white/10 bg-white/[0.055] px-3 py-2 text-base text-white outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="survey-status">Status</Label>
                <select
                  id="survey-status"
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as SurveyStatus,
                    }))
                  }
                  className="flex h-11 w-full rounded-md border border-white/10 bg-white/[0.055] px-3 py-2 text-base text-white outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"
                >
                  {surveyStatuses.map((status) => (
                    <option key={status} value={status} className="bg-kognis-cyber text-white">
                      {surveyStatusLabels[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="submit" disabled={isLoading}>
                  <Save className="h-4 w-4" />
                  {isLoading ? "Salvando..." : editingSurvey ? "Salvar alteracoes" : "Criar pesquisa"}
                </Button>
                <Button type="button" variant="secondary" onClick={cancelForm} disabled={isLoading}>
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {surveys.length === 0 && !shouldShowForm ? (
        <EmptyState
          title="Nenhuma pesquisa criada ainda."
          description="Comece criando uma pesquisa simples para coletar perfil, compra, satisfacao e comentarios."
          actionLabel="Nova pesquisa"
          onAction={startCreate}
        />
      ) : null}

      {surveys.length > 0 ? (
        <div className="grid gap-4">
          {surveys.map((survey) => (
            <Card key={survey.id}>
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-semibold text-white">{survey.title}</h2>
                    <span className="rounded-md border border-white/10 bg-white/[0.055] px-2 py-1 text-xs font-medium text-muted-foreground">
                      {surveyStatusLabels[survey.status]}
                    </span>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {survey.description || "Sem descricao."}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="secondary" onClick={() => startEdit(survey)} disabled={isLoading}>
                    <Edit3 className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => archiveSurvey(survey)}
                    disabled={isLoading || survey.status === "archived"}
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

function getFriendlySurveyError(message: string, code?: string) {
  const normalizedMessage = message.toLowerCase();

  if (code === "23514") {
    return "Revise titulo e status antes de salvar a pesquisa.";
  }

  if (normalizedMessage.includes("permission") || normalizedMessage.includes("row-level security")) {
    return "Voce nao tem permissao para alterar esta pesquisa.";
  }

  if (normalizedMessage.includes("failed to fetch") || normalizedMessage.includes("network")) {
    return "Nao foi possivel conectar ao Supabase. Verifique sua conexao e tente novamente.";
  }

  return "Nao foi possivel salvar a pesquisa agora. Tente novamente.";
}
