"use client";

import { useState, type FormEvent } from "react";

import { SubmissionCompletionCard } from "@/components/responses/submission-completion-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitPublicSurveyResponse } from "@/lib/submission-gateway";
import type { DynamicResponseValue } from "@/types/response";
import type { IssuedRewardPayload } from "@/types/submission";
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
  const [submissionKey] = useState(() => createSubmissionKey());
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [issuedReward, setIssuedReward] = useState<IssuedRewardPayload | null>(null);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
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

    const result = await submitPublicSurveyResponse({
      surveyId,
      answers: {
        mode: "dynamic",
        answers: validation.answers,
      },
      submissionKey,
    });

    if (result.error || !result.submitted) {
      setError(result.error ?? "Não foi possível enviar sua resposta agora. Tente novamente.");
      setIsLoading(false);
      return;
    }

    setIssuedReward(result.reward);
    setCompletionMessage(result.completionMessage);
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
      <SubmissionCompletionCard
        reward={issuedReward}
        completionMessage={completionMessage}
      />
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
      <RatingField
        questionId={question.id}
        options={[1, 2, 3, 4, 5]}
        columns={5}
        value={value}
        onChange={onChange}
      />
    );
  }

  if (question.type === "rating_10") {
    return (
      <RatingField
        questionId={question.id}
        options={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
        columns={6}
        value={value}
        onChange={onChange}
      />
    );
  }

  if (question.type === "email") {
    return (
      <Input
        id={`question-${question.id}`}
        type="email"
        inputMode="email"
        autoComplete="email"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="voce@exemplo.com"
      />
    );
  }

  if (question.type === "phone") {
    return (
      <Input
        id={`question-${question.id}`}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={value}
        onChange={(event) => onChange(formatPhone(event.target.value))}
        placeholder="(11) 91234-5678"
      />
    );
  }

  if (question.type === "number") {
    return (
      <Input
        id={`question-${question.id}`}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(sanitizeNumberInput(event.target.value))}
        placeholder="0"
      />
    );
  }

  if (question.type === "full_name") {
    return (
      <Input
        id={`question-${question.id}`}
        type="text"
        autoComplete="name"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Seu nome completo"
      />
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

function RatingField({
  questionId,
  options,
  columns,
  value,
  onChange,
}: {
  questionId: string;
  options: number[];
  columns: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      id={`question-${questionId}`}
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const optionValue = String(option);

        return (
          <label
            key={option}
            className={`flex h-11 items-center justify-center rounded-md border text-sm font-semibold transition-colors ${
              value === optionValue
                ? "border-brand bg-brand-soft text-text-primary"
                : "border-border bg-surface-muted text-text-secondary"
            }`}
          >
            <input
              type="radio"
              name={`question-${questionId}`}
              value={optionValue}
              checked={value === optionValue}
              onChange={(event) => onChange(event.target.value)}
              className="sr-only"
            />
            {option}
          </label>
        );
      })}
    </div>
  );
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length === 0) {
    return "";
  }

  if (digits.length <= 2) {
    return `(${digits}`;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function sanitizeNumberInput(value: string): string {
  // Aceita apenas dígitos e um único separador decimal (ponto ou vírgula).
  const cleaned = value.replace(/[^\d.,]/g, "").replace(/,/g, ".");

  if (cleaned === "") {
    return "";
  }

  const [integerPart, ...decimalParts] = cleaned.split(".");

  if (decimalParts.length === 0) {
    return integerPart;
  }

  return `${integerPart}.${decimalParts.join("")}`;
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

    if (question.type === "rating_10") {
      const rating = Number(value);

      if (!Number.isInteger(rating) || rating < 0 || rating > 10) {
        return {
          answers,
          error: `Escolha uma nota de 0 a 10 para: ${question.title}.`,
        };
      }

      answers[question.id] = rating;
      continue;
    }

    if (question.type === "email") {
      if (!isValidEmail(value)) {
        return {
          answers,
          error: `Informe um e-mail válido para: ${question.title}.`,
        };
      }

      answers[question.id] = value;
      continue;
    }

    if (question.type === "phone") {
      const digits = value.replace(/\D/g, "");

      if (digits.length < 10 || digits.length > 11) {
        return {
          answers,
          error: `Informe um telefone válido com DDD para: ${question.title}.`,
        };
      }

      answers[question.id] = digits;
      continue;
    }

    if (question.type === "number") {
      const number = Number(value);

      if (!Number.isFinite(number)) {
        return {
          answers,
          error: `Informe um número válido para: ${question.title}.`,
        };
      }

      answers[question.id] = number;
      continue;
    }

    answers[question.id] = value;
  }

  return {
    answers,
    error: null,
  };
}

function isValidEmail(value: string): boolean {
  const email = value.trim();

  if (email.length > 254) {
    return false;
  }

  // Validação de formato básico e seguro, sem verificar existência do domínio.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createSubmissionKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

