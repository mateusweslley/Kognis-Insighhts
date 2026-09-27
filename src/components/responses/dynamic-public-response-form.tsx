"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import type { DynamicResponseValue } from "@/types/response";
import type { SurveyQuestion } from "@/types/survey-question";

type DynamicPublicResponseFormProps = {
  surveyId: string;
  questions: SurveyQuestion[];
  isPreview?: boolean;
};

type FormValues = Record<string, string>;

export function DynamicPublicResponseForm({
  surveyId,
  questions,
  isPreview = false,
}: DynamicPublicResponseFormProps) {
  const [values, setValues] = useState<FormValues>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPreview) {
      return;
    }

    setError(null);
    setIsLoading(true);

    const validation = validateAnswers(questions, values);

    if (validation.error) {
      setError(validation.error);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: saveError } = await supabase.from("responses").insert({
      survey_id: surveyId,
      answers: {
        mode: "dynamic",
        answers: validation.answers,
      },
    });

    if (saveError) {
      console.error("Erro ao salvar resposta dinamica:", saveError);
      setError(getFriendlyDynamicResponseError(saveError.message));
      setIsLoading(false);
      return;
    }

    setIsSubmitted(true);
    setIsLoading(false);
  }

  function updateValue(questionId: string, value: string) {
    setValues((current) => ({
      ...current,
      [questionId]: value,
    }));
  }

  if (isSubmitted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Obrigado pela resposta</CardTitle>
          <CardDescription>Sua participacao foi registrada com sucesso.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isPreview ? "Preview da pesquisa" : "Responder pesquisa"}</CardTitle>
        <CardDescription>
          {isPreview
            ? "Visualização administrativa. Nenhuma resposta será salva."
            : "Responda as perguntas abaixo. Campos obrigatorios precisam ser preenchidos."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {questions.map((question) => (
            <div key={question.id} className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor={`question-${question.id}`}>
                  {question.title}
                  {question.required ? <span className="text-brand"> *</span> : null}
                </Label>
                {question.description ? (
                  <p className="text-sm leading-6 text-muted-foreground">{question.description}</p>
                ) : null}
              </div>
              <QuestionField
                question={question}
                value={values[question.id] ?? ""}
                onChange={(value) => updateValue(question.id, value)}
              />
            </div>
          ))}

          {error ? (
            <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {error}
            </p>
          ) : null}

          {isPreview ? (
            <p className="rounded-md border border-success/20 bg-success-soft px-3 py-2 text-sm text-success">
              Preview administrativo: o envio de respostas está desativado.
            </p>
          ) : (
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? "Enviando..." : "Enviar resposta"}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  if (question.type === "long_text") {
    return (
      <textarea
        id={`question-${question.id}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-28 w-full rounded-md border border-input bg-surface px-3 py-2 text-base text-text-primary outline-none transition-colors placeholder:text-text-muted focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"
      />
    );
  }

  if (question.type === "single_choice") {
    return (
      <div id={`question-${question.id}`} className="grid gap-2">
        {question.options.map((option) => (
          <label
            key={option}
            className="flex items-center gap-3 rounded-md border border-border bg-surface-muted px-3 py-3 text-sm text-text-primary"
          >
            <input
              type="radio"
              name={`question-${question.id}`}
              value={option}
              checked={value === option}
              onChange={(event) => onChange(event.target.value)}
              className="h-4 w-4 accent-kognis-teal"
            />
            {option}
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "rating") {
    return (
      <div id={`question-${question.id}`} className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((rating) => {
          const ratingValue = String(rating);

          return (
            <label
              key={rating}
              className={`flex h-11 items-center justify-center rounded-md border text-sm font-semibold transition-colors ${
                value === ratingValue
                  ? "border-brand bg-brand-soft text-text-primary"
                  : "border-border bg-surface-muted text-text-secondary"
              }`}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                value={ratingValue}
                checked={value === ratingValue}
                onChange={(event) => onChange(event.target.value)}
                className="sr-only"
              />
              {rating}
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <Input
      id={`question-${question.id}`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function validateAnswers(questions: SurveyQuestion[], values: FormValues) {
  const answers: Record<string, DynamicResponseValue> = {};

  for (const question of questions) {
    const rawValue = values[question.id] ?? "";
    const value = rawValue.trim();

    if (question.required && !value) {
      return {
        answers,
        error: `Responda a pergunta obrigatória: ${question.title}.`,
      };
    }

    if (!value) {
      continue;
    }

    if (question.type === "single_choice") {
      if (!question.options.includes(value)) {
        return {
          answers,
          error: `Escolha uma opção válida para: ${question.title}.`,
        };
      }

      answers[question.id] = value;
      continue;
    }

    if (question.type === "rating") {
      const rating = Number(value);

      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return {
          answers,
          error: `Escolha uma nota de 1 a 5 para: ${question.title}.`,
        };
      }

      answers[question.id] = rating;
      continue;
    }

    answers[question.id] = value;
  }

  return {
    answers,
    error: null,
  };
}

function getFriendlyDynamicResponseError(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("row-level security") || normalizedMessage.includes("permission")) {
    return "Esta pesquisa não está aceitando respostas no momento.";
  }

  return "Não foi possível enviar sua resposta agora. Tente novamente.";
}
