"use client";

import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Edit3,
  ExternalLink,
  MoreVertical,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createQuestion,
  deleteQuestion,
  getSurveyQuestions,
  reorderQuestions,
  updateQuestion,
} from "@/lib/survey-questions";
import type { SurveyQuestion, SurveyQuestionType } from "@/types/survey-question";
import { surveyQuestionTypeLabels, surveyQuestionTypes } from "@/types/survey-question";

type QuestionBuilderProps = {
  surveyId: string;
  surveyTitle: string;
  onClose: () => void;
};

type QuestionFormState = {
  title: string;
  description: string;
  type: SurveyQuestionType;
  required: boolean;
  optionsText: string;
};

const defaultForm: QuestionFormState = {
  title: "",
  description: "",
  type: "short_text",
  required: false,
  optionsText: "",
};

export function QuestionBuilder({ surveyId, surveyTitle, onClose }: QuestionBuilderProps) {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [form, setForm] = useState<QuestionFormState>(defaultForm);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editingQuestion = useMemo(
    () => questions.find((question) => question.id === editingQuestionId),
    [editingQuestionId, questions],
  );

  useEffect(() => {
    let shouldUpdate = true;

    async function loadQuestions() {
      setIsLoading(true);
      setError(null);
      const result = await getSurveyQuestions(surveyId);

      if (!shouldUpdate) {
        return;
      }

      setQuestions(result.questions);
      setError(result.error);
      setIsLoading(false);
    }

    loadQuestions();

    return () => {
      shouldUpdate = false;
    };
  }, [surveyId]);

  function startCreate() {
    setForm(defaultForm);
    setEditingQuestionId(null);
    setIsFormOpen(true);
    setError(null);
    setMessage(null);
  }

  function startEdit(question: SurveyQuestion) {
    setForm({
      title: question.title,
      description: question.description ?? "",
      type: question.type,
      required: question.required,
      optionsText: question.options.join("\n"),
    });
    setEditingQuestionId(question.id);
    setIsFormOpen(true);
    setError(null);
    setMessage(null);
  }

  function cancelForm() {
    setForm(defaultForm);
    setEditingQuestionId(null);
    setIsFormOpen(false);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    const title = form.title.trim();
    const description = form.description.trim() || null;
    const options = normalizeOptions(form.optionsText);

    if (title.length < 2) {
      setError("Escreva uma pergunta com pelo menos 2 caracteres.");
      setIsLoading(false);
      return;
    }

    if (form.type === "single_choice" && options.length < 2) {
      setError("Adicione pelo menos duas opções para escolha única.");
      setIsLoading(false);
      return;
    }

    const result = editingQuestion
      ? await updateQuestion(editingQuestion.id, {
          title,
          description,
          type: form.type,
          required: form.required,
          options: form.type === "single_choice" ? options : [],
        })
      : await createQuestion({
          survey_id: surveyId,
          title,
          description,
          type: form.type,
          required: form.required,
          position: questions.length + 1,
          options: form.type === "single_choice" ? options : [],
        });

    if (result.error || !result.question) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    const savedQuestion = result.question;

    setQuestions((current) =>
      editingQuestion
        ? current.map((question) => (question.id === savedQuestion.id ? savedQuestion : question))
        : [...current, savedQuestion],
    );
    setMessage(editingQuestion ? "Pergunta atualizada." : "Pergunta adicionada.");
    setForm(defaultForm);
    setEditingQuestionId(null);
    setIsFormOpen(false);
    setIsLoading(false);
  }

  async function removeQuestion(question: SurveyQuestion) {
    const shouldRemove = window.confirm("Tem certeza que deseja excluir esta pergunta?");

    if (!shouldRemove) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);

    const result = await deleteQuestion(question.id);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    const remainingQuestions = questions
      .filter((item) => item.id !== question.id)
      .map((item, index) => ({ ...item, position: index + 1 }));

    setQuestions(remainingQuestions);
    await reorderQuestions(remainingQuestions);
    setMessage("Pergunta excluída.");
    setIsLoading(false);
  }

  async function moveQuestion(questionIndex: number, direction: "up" | "down") {
    const nextIndex = direction === "up" ? questionIndex - 1 : questionIndex + 1;

    if (nextIndex < 0 || nextIndex >= questions.length) {
      return;
    }

    const nextQuestions = [...questions];
    const currentQuestion = nextQuestions[questionIndex];
    nextQuestions[questionIndex] = nextQuestions[nextIndex];
    nextQuestions[nextIndex] = currentQuestion;

    const orderedQuestions = nextQuestions.map((question, index) => ({
      ...question,
      position: index + 1,
    }));

    setQuestions(orderedQuestions);
    setIsLoading(true);
    setError(null);
    setMessage(null);

    const result = await reorderQuestions(orderedQuestions);

    if (result.error) {
      setError(result.error);
    } else {
      setMessage("Ordem das perguntas atualizada.");
    }

    setIsLoading(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>Perguntas da pesquisa</CardTitle>
          <CardDescription>
            Organize o que você deseja descobrir em {surveyTitle}.
          </CardDescription>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row">
          <Button className="w-full sm:w-auto" variant="secondary" asChild>
            <Link href={`/pesquisas/${surveyId}/preview`} target="_blank">
              <ExternalLink className="h-4 w-4" />
              Preview
            </Link>
          </Button>
          <Button className="w-full sm:w-auto" onClick={startCreate} disabled={isLoading}>
            <Plus className="h-4 w-4" />
            Nova pergunta
          </Button>
          <Button
            className="col-span-2 w-full sm:w-auto"
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
          >
            <X className="h-4 w-4" />
            Fechar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {isFormOpen ? (
          <form className="space-y-4 rounded-md border border-border p-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="question-title">Pergunta</Label>
              <Input
                id="question-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ex: O que podemos melhorar?"
                minLength={2}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="question-description">Descrição</Label>
              <Textarea
                id="question-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Ajude o cliente a entender a pergunta, se precisar"
                className="min-h-24"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="question-type">Como a pessoa responde?</Label>
                <Select
                  id="question-type"
                  value={form.type}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      type: event.target.value as SurveyQuestionType,
                    }))
                  }
                >
                  {surveyQuestionTypes.map((type) => (
                    <option key={type} value={type}>
                      {surveyQuestionTypeLabels[type]}
                    </option>
                  ))}
                </Select>
              </div>
              <label className="flex items-center gap-3 rounded-md border border-border px-3 py-3 text-sm text-text-primary md:mt-8">
                <input
                  type="checkbox"
                  checked={form.required}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, required: event.target.checked }))
                  }
                  className="h-4 w-4 accent-brand"
                />
                Resposta obrigatória
              </label>
            </div>
            {form.type === "single_choice" ? (
              <div className="space-y-2">
                <Label htmlFor="question-options">Opções</Label>
                <Textarea
                  id="question-options"
                  value={form.optionsText}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, optionsText: event.target.value }))
                  }
                  placeholder={"Uma opção por linha\nSim\nNão\nTalvez"}
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="w-full sm:w-auto" type="submit" disabled={isLoading}>
                <Save className="h-4 w-4" />
                {isLoading ? "Salvando..." : editingQuestion ? "Salvar pergunta" : "Adicionar pergunta"}
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
        ) : null}

        {questions.length === 0 && !isLoading ? (
          <div className="rounded-md border border-dashed border-border p-5 text-sm text-text-muted">
            Esta pesquisa ainda não tem perguntas personalizadas.
          </div>
        ) : null}

        <div className="space-y-3">
          {questions.map((question, index) => (
            <QuestionItem
              key={question.id}
              question={question}
              index={index}
              totalQuestions={questions.length}
              isLoading={isLoading}
              onEdit={() => startEdit(question)}
              onMoveUp={() => moveQuestion(index, "up")}
              onMoveDown={() => moveQuestion(index, "down")}
              onRemove={() => removeQuestion(question)}
            />
          ))}
        </div>

        <div className="rounded-md border border-border bg-surface-muted p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-success">
                <CheckCircle2 className="h-4 w-4" />
                Configuração da pesquisa
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Quando terminar as perguntas, visualize a experiência do cliente ou volte para gerar QR Code e link público.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row">
              <Button className="w-full sm:w-auto" variant="secondary" asChild>
                <Link href={`/pesquisas/${surveyId}/preview`} target="_blank">
                  <ExternalLink className="h-4 w-4" />
                  Preview
                </Link>
              </Button>
              <Button className="w-full sm:w-auto" variant="secondary" onClick={onClose} disabled={isLoading}>
                <X className="h-4 w-4" />
                Concluir
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuestionItem({
  question,
  index,
  totalQuestions,
  isLoading,
  onEdit,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  question: SurveyQuestion;
  index: number;
  totalQuestions: number;
  isLoading: boolean;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-3 md:p-4">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-xs font-medium text-muted-foreground">{index + 1}</span>
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-base font-semibold leading-6 text-text-primary">
                {question.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {surveyQuestionTypeLabels[question.type]}
                {question.options.length > 0 ? ` - ${question.options.join(", ")}` : ""}
              </p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {question.required ? (
              <span className="rounded-md border border-brand/20 bg-brand-soft px-2 py-1 text-xs text-brand">
                Obrigatória
              </span>
            ) : null}
            {question.description ? (
              <span className="text-xs text-muted-foreground">Com descrição</span>
            ) : null}
          </div>
          {question.description ? (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
              {question.description}
            </p>
          ) : null}
        </div>

        <div className="flex items-start gap-2">
          <Button size="sm" variant="secondary" onClick={onEdit} disabled={isLoading}>
            <Edit3 className="h-4 w-4" />
            Editar
          </Button>
          <details className="relative">
            <summary className="inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-surface text-text-primary shadow-subtle transition-colors hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Mais ações da pergunta</span>
            </summary>
            <div className="absolute right-0 z-20 mt-2 grid w-56 gap-2 rounded-md border border-border bg-surface p-2 shadow-floating">
              <Button
                className="justify-start"
                variant="ghost"
                onClick={onMoveUp}
                disabled={isLoading || index === 0}
              >
                <ArrowUp className="h-4 w-4" />
                Mover para cima
              </Button>
              <Button
                className="justify-start"
                variant="ghost"
                onClick={onMoveDown}
                disabled={isLoading || index === totalQuestions - 1}
              >
                <ArrowDown className="h-4 w-4" />
                Mover para baixo
              </Button>
              <Button className="justify-start" variant="ghost" onClick={onRemove} disabled={isLoading}>
                <Trash2 className="h-4 w-4" />
                Excluir
              </Button>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function normalizeOptions(optionsText: string) {
  return optionsText
    .split("\n")
    .map((option) => option.trim())
    .filter((option) => option.length > 0);
}
