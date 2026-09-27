"use client";

import {
  Archive,
  CheckCircle2,
  Edit3,
  ExternalLink,
  ListChecks,
  MoreVertical,
  Plus,
  QrCode,
  Save,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { QuestionBuilder } from "@/components/surveys/question-builder";
import { SurveyQrCode } from "@/components/surveys/survey-qr-code";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { createQuestion } from "@/lib/survey-questions";
import {
  createQuestionsFromTemplate,
  surveyQuestionTemplates,
  type SurveyQuestionTemplateId,
} from "@/lib/survey-question-templates";
import { isValidSurveyStatus } from "@/lib/survey-utils";
import type { Survey, SurveyStatus } from "@/types/survey";
import { surveyStatusLabels, surveyStatuses } from "@/types/survey";

type SurveyManagerProps = {
  companyId: string;
  initialSurveys: Survey[];
  initialError?: string | null;
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

export function SurveyManager({ companyId, initialSurveys, initialError }: SurveyManagerProps) {
  const router = useRouter();
  const [surveys, setSurveys] = useState(initialSurveys);
  const [isCreating, setIsCreating] = useState(false);
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null);
  const [form, setForm] = useState<SurveyFormState>(defaultForm);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [qrSurveyId, setQrSurveyId] = useState<string | null>(null);
  const [questionSurveyId, setQuestionSurveyId] = useState<string | null>(null);
  const [nextStepSurveyId, setNextStepSurveyId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] =
    useState<SurveyQuestionTemplateId>("customer_profile");

  const editingSurvey = useMemo(
    () => surveys.find((survey) => survey.id === editingSurveyId),
    [editingSurveyId, surveys],
  );
  const qrSurvey = useMemo(
    () => surveys.find((survey) => survey.id === qrSurveyId),
    [qrSurveyId, surveys],
  );
  const questionSurvey = useMemo(
    () => surveys.find((survey) => survey.id === questionSurveyId),
    [questionSurveyId, surveys],
  );
  const nextStepSurvey = useMemo(
    () => surveys.find((survey) => survey.id === nextStepSurveyId),
    [nextStepSurveyId, surveys],
  );

  function startCreate() {
    if (initialError) {
      setError(initialError);
      return;
    }

    setForm(defaultForm);
    setEditingSurveyId(null);
    setSelectedTemplateId("customer_profile");
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
    setSelectedTemplateId("customer_profile");
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
      setError("Informe um título com pelo menos 3 caracteres.");
      setIsLoading(false);
      return;
    }

    if (!isValidSurveyStatus(form.status)) {
      setError("Escolha um status válido para a pesquisa.");
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
    if (!editingSurvey) {
      const templateQuestions = createQuestionsFromTemplate(selectedTemplateId, savedSurvey.id);
      const questionResults = await Promise.all(
        templateQuestions.map((question) => createQuestion(question)),
      );
      const failedQuestion = questionResults.find((result) => result.error);

      if (failedQuestion?.error) {
        setError(failedQuestion.error);
        setIsLoading(false);
        return;
      }
    }

    setSurveys((current) =>
      editingSurvey
        ? current.map((survey) => (survey.id === savedSurvey.id ? savedSurvey : survey))
        : [savedSurvey, ...current],
    );
    setMessage(
      editingSurvey
        ? "Pesquisa atualizada com sucesso."
        : "Pesquisa criada com sucesso. Revise as perguntas antes de publicar.",
    );
    setNextStepSurveyId(savedSurvey.id);
    setForm(defaultForm);
    setEditingSurveyId(null);
    setIsCreating(false);
    setQuestionSurveyId(editingSurvey ? questionSurveyId : savedSurvey.id);
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
    setMessage("Pesquisa encerrada.");
    setIsLoading(false);
    router.refresh();
  }

  const shouldShowForm = isCreating || editingSurvey;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pesquisas"
        description="Crie, organize e compartilhe pesquisas com seus clientes."
        actions={
          <Button className="w-full sm:w-auto" onClick={startCreate} disabled={isLoading}>
            <Plus className="h-4 w-4" />
            Nova pesquisa
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

      {shouldShowForm ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingSurvey ? "Editar pesquisa" : "Nova pesquisa"}</CardTitle>
            <CardDescription>
              Defina as informações básicas da pesquisa e escolha quando ela poderá receber respostas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {!editingSurvey ? (
                <div className="space-y-3">
                  <div>
                    <Label>O que você deseja descobrir?</Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Escolha um ponto de partida. Você poderá editar as perguntas depois.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {surveyQuestionTemplates.map((template) => {
                      const isSelected = selectedTemplateId === template.id;

                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => setSelectedTemplateId(template.id)}
                          className={`rounded-md border p-4 text-left transition-colors ${
                            isSelected
                              ? "border-brand bg-brand-soft text-text-primary"
                              : "border-border bg-surface-muted text-text-secondary hover:border-border-strong hover:text-text-primary"
                          }`}
                        >
                          <span className="block text-sm font-semibold text-text-primary">{template.title}</span>
                          <span className="mt-1 block text-sm leading-5">{template.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="survey-title">Título</Label>
                <Input
                  id="survey-title"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Título da pesquisa"
                  minLength={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="survey-description">Descrição</Label>
                <Textarea
                  id="survey-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Conte rapidamente o objetivo da pesquisa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="survey-status">Status</Label>
                <Select
                  id="survey-status"
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as SurveyStatus,
                    }))
                  }
                >
                  {surveyStatuses.map((status) => (
                    <option key={status} value={status}>
                      {surveyStatusLabels[status]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button className="w-full sm:w-auto" type="submit" disabled={isLoading}>
                  <Save className="h-4 w-4" />
                  {isLoading ? "Salvando..." : editingSurvey ? "Salvar alterações" : "Criar pesquisa"}
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

      {qrSurvey ? (
        <SurveyQrCode
          surveyId={qrSurvey.id}
          surveyTitle={qrSurvey.title}
          surveyStatus={qrSurvey.status}
          onClose={() => setQrSurveyId(null)}
        />
      ) : null}

      {questionSurvey ? (
        <QuestionBuilder
          surveyId={questionSurvey.id}
          surveyTitle={questionSurvey.title}
          onClose={() => setQuestionSurveyId(null)}
        />
      ) : null}

      {nextStepSurvey && !shouldShowForm ? (
        <NextStepsPanel
          survey={nextStepSurvey}
          onOpenQuestions={() => setQuestionSurveyId(nextStepSurvey.id)}
          onOpenQr={() => setQrSurveyId(nextStepSurvey.id)}
          onDismiss={() => setNextStepSurveyId(null)}
        />
      ) : null}

      {surveys.length === 0 && !shouldShowForm ? (
        <EmptyState
          title="Nenhuma pesquisa criada ainda."
          description="Comece criando uma pesquisa simples para coletar perfil, compra, satisfação e comentários."
          actionLabel="Nova pesquisa"
          onAction={startCreate}
        />
      ) : null}

      {surveys.length > 0 ? (
        <div className="grid gap-4">
          {surveys.map((survey) => (
            <Card key={survey.id}>
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold text-text-primary md:text-lg">{survey.title}</h2>
                    <span className={`rounded-md border px-2 py-1 text-xs font-medium ${getSurveyStatusStyle(survey.status)}`}>
                      {surveyStatusLabels[survey.status]}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {survey.description || "Sem descrição."}
                  </p>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2 md:flex md:items-center md:justify-end">
                  <Button
                    className="w-full md:w-auto"
                    size="sm"
                    onClick={() => setQuestionSurveyId(survey.id)}
                    disabled={isLoading}
                  >
                    <ListChecks className="h-4 w-4" />
                    <span className="sm:hidden">Gerenciar</span>
                    <span className="hidden sm:inline">Gerenciar pesquisa</span>
                  </Button>
                  <details className="relative">
                    <summary className="inline-flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-surface text-text-primary shadow-subtle transition-colors hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Mais ações</span>
                    </summary>
                    <div className="absolute right-0 z-20 mt-2 grid w-56 gap-2 rounded-md border border-border bg-surface p-2 shadow-floating">
                      <Button
                        className="justify-start"
                        variant="ghost"
                        onClick={() => setQuestionSurveyId(survey.id)}
                        disabled={isLoading}
                      >
                        <ListChecks className="h-4 w-4" />
                        Perguntas
                      </Button>
                      <Button
                        className="justify-start"
                        variant="ghost"
                        onClick={() => setQrSurveyId(survey.id)}
                        disabled={isLoading}
                      >
                        <QrCode className="h-4 w-4" />
                        QR Code
                      </Button>
                      <Button className="justify-start" variant="ghost" asChild>
                        <Link href={`/participar/${survey.id}`} target="_blank">
                          <ExternalLink className="h-4 w-4" />
                          Link público
                        </Link>
                      </Button>
                      <Button
                        className="justify-start"
                        variant="ghost"
                        onClick={() => startEdit(survey)}
                        disabled={isLoading}
                      >
                        <Edit3 className="h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        className="justify-start"
                        variant="ghost"
                        onClick={() => archiveSurvey(survey)}
                        disabled={isLoading || survey.status === "archived"}
                      >
                        <Archive className="h-4 w-4" />
                        Encerrar
                      </Button>
                    </div>
                  </details>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NextStepsPanel({
  survey,
  onOpenQuestions,
  onOpenQr,
  onDismiss,
}: {
  survey: Survey;
  onOpenQuestions: () => void;
  onOpenQr: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" />
              Pesquisa pronta para avançar
            </div>
            <h2 className="mt-2 text-xl font-semibold text-text-primary">{survey.title}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Próximos passos: revise as perguntas, veja como o cliente enxergará a pesquisa e gere o QR Code quando estiver tudo pronto.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onDismiss}>
            <X className="h-4 w-4" />
            <span className="sr-only">Ocultar próximos passos</span>
          </Button>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          <Button className="w-full" variant="secondary" onClick={onOpenQuestions}>
            <ListChecks className="h-4 w-4" />
            Configurar perguntas
          </Button>
          <Button className="w-full" variant="secondary" asChild>
            <Link href={`/pesquisas/${survey.id}/preview`} target="_blank">
              <ExternalLink className="h-4 w-4" />
              Visualizar pesquisa
            </Link>
          </Button>
          <Button className="w-full" variant="secondary" onClick={onOpenQr}>
            <QrCode className="h-4 w-4" />
            Gerar QR Code
          </Button>
          <Button className="w-full" variant="secondary" asChild>
            <Link href={`/participar/${survey.id}`} target="_blank">
              <ExternalLink className="h-4 w-4" />
              Compartilhar pesquisa
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function getFriendlySurveyError(message: string, code?: string) {
  const normalizedMessage = message.toLowerCase();

  if (code === "23514") {
    return "Revise título e status antes de salvar a pesquisa.";
  }

  if (normalizedMessage.includes("permission") || normalizedMessage.includes("row-level security")) {
    return "Você não tem permissão para alterar esta pesquisa.";
  }

  if (normalizedMessage.includes("failed to fetch") || normalizedMessage.includes("network")) {
    return "Não foi possível conectar ao Supabase. Verifique sua conexão e tente novamente.";
  }

  return "Não foi possível salvar a pesquisa agora. Tente novamente.";
}

function getSurveyStatusStyle(status: SurveyStatus) {
  if (status === "active") {
    return "border-success/20 bg-success-soft text-success";
  }

  if (status === "archived") {
    return "border-danger/20 bg-danger-soft text-danger";
  }

  return "border-warning/25 bg-warning-soft text-warning";
}
