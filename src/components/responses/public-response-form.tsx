"use client";

import { useState, type FormEvent } from "react";

import { SubmissionCompletionCard } from "@/components/responses/submission-completion-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitPublicSurveyResponse } from "@/lib/submission-gateway";
import type { ResponseAnswers } from "@/types/response";
import type { IssuedRewardPayload } from "@/types/submission";

type PublicResponseFormProps = {
  surveyId: string;
  isPreview?: boolean;
};

export function PublicResponseForm({ surveyId, isPreview = false }: PublicResponseFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
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

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const parsedRating = Number(rating);
    const trimmedComment = comment.trim();

    if (!trimmedName) {
      setError("Informe seu nome para enviar a resposta.");
      setIsLoading(false);
      return;
    }

    if (!parsedRating || parsedRating < 1 || parsedRating > 5) {
      setError("Escolha uma nota de satisfação de 1 a 5.");
      setIsLoading(false);
      return;
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Informe um e-mail valido ou deixe o campo em branco.");
      setIsLoading(false);
      return;
    }

    const answers: ResponseAnswers = {
      name: trimmedName,
      email: trimmedEmail || undefined,
      rating: parsedRating,
      comment: trimmedComment || undefined,
    };

    const result = await submitPublicSurveyResponse({
      surveyId,
      answers,
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
            : "Leva menos de um minuto. Seus dados ajudam a empresa a melhorar a experiencia."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="response-name">Nome</Label>
            <Input
              id="response-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Seu nome"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="response-email">E-mail</Label>
            <Input
              id="response-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="contato@empresa.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="response-rating">Nota de satisfação</Label>
            <select
              id="response-rating"
              value={rating}
              onChange={(event) => setRating(event.target.value)}
              className="flex h-11 w-full rounded-md border border-input bg-surface px-3 py-2 text-base text-text-primary outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"
              required
            >
              <option value="" className="bg-surface text-text-primary">
                Escolha uma nota
              </option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value} className="bg-surface text-text-primary">
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="response-comment">Comentário</Label>
            <textarea
              id="response-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Conte sua experiencia"
              className="min-h-28 w-full rounded-md border border-input bg-surface px-3 py-2 text-base text-text-primary outline-none transition-colors placeholder:text-text-muted focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"
            />
          </div>
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

function createSubmissionKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}
