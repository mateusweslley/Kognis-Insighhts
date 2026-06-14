"use client";

import { ArrowDown, ArrowUp, Edit3, ExternalLink, Plus, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      setError("Adicione pelo menos duas opcoes para escolha unica.");
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
    setMessage("Pergunta excluida.");
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
            Organize o que voce deseja descobrir em {surveyTitle}.
          </CardDescription>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="w-full sm:w-auto" variant="secondary" asChild>
            <Link href={`/pesquisas/${surveyId}/preview`} target="_blank">
              <ExternalLink className="h-4 w-4" />
              Ver como o cliente vera
            </Link>
          </Button>
          <Button className="w-full sm:w-auto" onClick={startCreate} disabled={isLoading}>
            <Plus className="h-4 w-4" />
            Adicionar pergunta
          </Button>
          <Button className="w-full sm:w-auto" variant="secondary" onClick={onClose} disabled={isLoading}>
            <X className="h-4 w-4" />
            Fechar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {isFormOpen ? (
          <form className="space-y-4 rounded-md border border-white/10 p-4" onSubmit={handleSubmit}>
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
              <Label htmlFor="question-description">Descricao</Label>
              <textarea
                id="question-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Ajude o cliente a entender a pergunta, se precisar"
                className="min-h-24 w-full rounded-md border border-white/10 bg-white/[0.055] px-3 py-2 text-base text-white outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="question-type">Como a pessoa responde?</Label>
                <select
                  id="question-type"
                  value={form.type}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      type: event.target.value as SurveyQuestionType,
                    }))
                  }
                  className="flex h-11 w-full rounded-md border border-white/10 bg-white/[0.055] px-3 py-2 text-base text-white outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"
                >
                  {surveyQuestionTypes.map((type) => (
                    <option key={type} value={type} className="bg-kognis-cyber text-white">
                      {surveyQuestionTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-3 rounded-md border border-white/10 px-3 py-3 text-sm text-white md:mt-8">
                <input
                  type="checkbox"
                  checked={form.required}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, required: event.target.checked }))
                  }
                  className="h-4 w-4 accent-kognis-teal"
                />
                Resposta obrigatoria
              </label>
            </div>
            {form.type === "single_choice" ? (
              <div className="space-y-2">
                <Label htmlFor="question-options">Opcoes</Label>
                <textarea
                  id="question-options"
                  value={form.optionsText}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, optionsText: event.target.value }))
                  }
                  placeholder={"Uma opcao por linha\nSim\nNao\nTalvez"}
                  className="min-h-28 w-full rounded-md border border-white/10 bg-white/[0.055] px-3 py-2 text-base text-white outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"
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
          <div className="rounded-md border border-dashed border-white/15 p-5 text-sm text-muted-foreground">
            Esta pesquisa ainda nao tem perguntas personalizadas.
          </div>
        ) : null}

        <div className="space-y-3">
          {questions.map((question, index) => (
            <div
              key={question.id}
              className="flex flex-col gap-4 rounded-md border border-white/10 bg-white/[0.035] p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{index + 1}</span>
                  <h3 className="text-base font-semibold text-white">{question.title}</h3>
                  {question.required ? (
                    <span className="rounded-md border border-kognis-teal/30 bg-kognis-teal/10 px-2 py-1 text-xs text-kognis-teal">
                      Obrigatoria
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {surveyQuestionTypeLabels[question.type]}
                  {question.options.length > 0 ? ` - ${question.options.join(", ")}` : ""}
                </p>
                {question.description ? (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{question.description}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <Button
                  className="w-full sm:w-auto"
                  variant="secondary"
                  onClick={() => moveQuestion(index, "up")}
                  disabled={isLoading || index === 0}
                >
                  <ArrowUp className="h-4 w-4" />
                  Subir
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  variant="secondary"
                  onClick={() => moveQuestion(index, "down")}
                  disabled={isLoading || index === questions.length - 1}
                >
                  <ArrowDown className="h-4 w-4" />
                  Descer
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  variant="secondary"
                  onClick={() => startEdit(question)}
                  disabled={isLoading}
                >
                  <Edit3 className="h-4 w-4" />
                  Editar
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  variant="secondary"
                  onClick={() => removeQuestion(question)}
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function normalizeOptions(optionsText: string) {
  return optionsText
    .split("\n")
    .map((option) => option.trim())
    .filter((option) => option.length > 0);
}
