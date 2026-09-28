"use client";

import { Check, Copy, Gift } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { IssuedRewardPayload } from "@/types/submission";

type SubmissionCompletionCardProps = {
  reward?: IssuedRewardPayload | null;
  completionMessage?: string | null;
};

export function SubmissionCompletionCard({
  reward = null,
  completionMessage = null,
}: SubmissionCompletionCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopyCode() {
    if (!reward?.code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(reward.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  if (!reward) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Obrigado pela resposta</CardTitle>
          <CardDescription>Sua participação foi registrada com sucesso.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const displayMessage =
    reward.completion_message ||
    completionMessage ||
    "Sua participação foi registrada com sucesso.";

  const rewardTitle = reward.title || formatFallbackRewardTitle(reward);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Obrigado pela resposta</CardTitle>
        <CardDescription>{displayMessage}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-brand/25 bg-brand-soft/40 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand">
              <Gift className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-text-primary">{rewardTitle}</p>
              {reward.description ? (
                <p className="mt-1 text-sm leading-6 text-text-secondary">{reward.description}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Seu código
              </p>
              <p className="mt-0.5 font-mono text-lg font-bold tracking-wider text-text-primary">
                {reward.code}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={handleCopyCode}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-success" />
                  Código copiado
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar código
                </>
              )}
            </Button>
          </div>

          {reward.instructions ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium text-text-primary">Como utilizar</p>
              <p className="leading-6 text-text-secondary">{reward.instructions}</p>
            </div>
          ) : null}

          {reward.expires_at ? (
            <p className="text-xs text-muted-foreground">
              Válido até {formatExpirationDate(reward.expires_at)}
            </p>
          ) : null}

          {reward.terms ? (
            <p className="border-t border-border pt-2 text-xs leading-5 text-muted-foreground">
              {reward.terms}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function formatFallbackRewardTitle(reward: IssuedRewardPayload): string {
  if (reward.type === "percentage" && typeof reward.value === "number") {
    return `${reward.value}% de desconto`;
  }

  if (reward.type === "fixed_amount" && typeof reward.value === "number") {
    return `R$ ${reward.value.toFixed(2).replace(".", ",")} de desconto`;
  }

  if (reward.type === "gift") {
    return "Brinde especial";
  }

  return "Benefício liberado";
}

function formatExpirationDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}
