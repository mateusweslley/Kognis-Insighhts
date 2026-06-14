"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import type { ResponseAnswers } from "@/types/response";

type PublicResponseFormProps = {
  surveyId: string;
  isPreview?: boolean;
};

export function PublicResponseForm({ surveyId, isPreview = false }: PublicResponseFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
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
      setError("Escolha uma nota de satisfacao de 1 a 5.");
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

    const supabase = createClient();
    const { error: saveError } = await supabase.from("responses").insert({
      survey_id: surveyId,
      answers,
    });

    if (saveError) {
      console.error("Erro ao salvar resposta publica:", saveError);
      setError(getFriendlyPublicResponseError(saveError.message));
      setIsLoading(false);
      return;
    }

    setIsSubmitted(true);
    setIsLoading(false);
  }

  if (isSubmitted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Obrigado pela resposta</CardTitle>
          <CardDescription>
            Sua participacao foi registrada com sucesso.
          </CardDescription>
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
            ? "Visualizacao administrativa. Nenhuma resposta sera salva."
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
              placeholder="voce@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="response-rating">Nota de satisfacao</Label>
            <select
              id="response-rating"
              value={rating}
              onChange={(event) => setRating(event.target.value)}
              className="flex h-11 w-full rounded-md border border-white/10 bg-white/[0.055] px-3 py-2 text-base text-white outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"
              required
            >
              <option value="" className="bg-kognis-cyber text-white">
                Escolha uma nota
              </option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value} className="bg-kognis-cyber text-white">
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="response-comment">Comentario</Label>
            <textarea
              id="response-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Conte sua experiencia"
              className="min-h-28 w-full rounded-md border border-white/10 bg-white/[0.055] px-3 py-2 text-base text-white outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"
            />
          </div>
          {error ? (
            <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {error}
            </p>
          ) : null}
          {isPreview ? (
            <p className="rounded-md border border-kognis-teal/30 bg-kognis-teal/10 px-3 py-2 text-sm text-white">
              Preview administrativo: o envio de respostas esta desativado.
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

function getFriendlyPublicResponseError(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("row-level security") || normalizedMessage.includes("permission")) {
    return "Esta pesquisa nao esta aceitando respostas no momento.";
  }

  return "Nao foi possivel enviar sua resposta agora. Tente novamente.";
}
