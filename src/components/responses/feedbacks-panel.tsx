"use client";

import { ArrowLeft, Eye, LoaderCircle, MessageSquareText, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { FeedbackCursor, FeedbackItem, FeedbackPageState } from "@/lib/feedback-feed";
import type { NormalizedResponse } from "@/lib/response-normalizer";

type PagePayload = {
  items: FeedbackItem[];
  nextCursor: FeedbackCursor | null;
  state: FeedbackPageState;
  hasMore: boolean;
};

type FullResponse = NormalizedResponse & { surveyTitle: string };

export function FeedbacksPanel() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [cursor, setCursor] = useState<FeedbackCursor | null>(null);
  const [pageState, setPageState] = useState<FeedbackPageState | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [fullResponse, setFullResponse] = useState<FullResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadPage = useCallback(async (next: FeedbackCursor | null, append: boolean) => {
    setError(null);
    if (append) setLoadingMore(true);
    else setInitialLoading(true);
    try {
      const query = next ? `?cursor=${encodeURIComponent(JSON.stringify(next))}` : "";
      const response = await fetch(`/api/respostas/feedbacks${query}`, { cache: "no-store" });
      const payload = (await response.json()) as PagePayload | { error: string };
      if (!response.ok || "error" in payload) throw new Error("error" in payload ? payload.error : "Erro ao carregar feedbacks.");
      setItems((current) => {
        const combined = append ? [...current, ...payload.items] : payload.items;
        return Array.from(new Map(combined.map((item) => [item.id, item])).values());
      });
      setCursor(payload.nextCursor);
      setPageState(payload.state);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel carregar os feedbacks.");
    } finally {
      setInitialLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(null, false);
  }, [loadPage]);

  async function openResponse(item: FeedbackItem) {
    setSelectedItem(item);
    setFullResponse(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/respostas/feedbacks/${encodeURIComponent(item.responseId)}`, { cache: "no-store" });
      const payload = (await response.json()) as FullResponse | { error: string };
      if (!response.ok || "error" in payload) throw new Error("error" in payload ? payload.error : "Erro ao carregar a resposta.");
      setFullResponse(payload);
    } catch (cause) {
      setDetailError(cause instanceof Error ? cause.message : "Nao foi possivel carregar a resposta.");
    } finally {
      setDetailLoading(false);
    }
  }

  const canContinue = cursor !== null && (pageState === "continue_search" || pageState === "results");

  return (
    <div className="space-y-7">
      <PageHeader
        title="Feedbacks textuais"
        description="Comentários e respostas de texto recebidos pelas suas pesquisas."
        eyebrow="Respostas"
        actions={
          <Button variant="secondary" asChild>
            <Link href="/respostas">
              <ArrowLeft className="h-4 w-4" />
              Voltar às pesquisas
            </Link>
          </Button>
        }
      />

      {initialLoading ? (
        <p role="status" className="flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-3 text-sm text-text-secondary">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando feedbacks…
        </p>
      ) : null}
      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
          <p>{error}</p>
          <Button className="mt-3" variant="secondary" onClick={() => void loadPage(cursor, items.length > 0)}>Tentar novamente</Button>
        </div>
      ) : null}
      {!initialLoading && !error && pageState === "no_responses" ? (
        <p className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-text-secondary">Nenhuma resposta recebida ainda.</p>
      ) : null}
      {!initialLoading && !error && pageState === "no_text_feedback" ? (
        <p className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-text-secondary">Existem respostas, mas nenhuma contém feedback textual.</p>
      ) : null}

      {items.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 p-4 sm:p-5">
            {items.map((item) => (
              <article key={item.id} className="rounded-md border border-border bg-surface-muted p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">{item.surveyTitle}</p>
                    <h2 className="mt-1 text-sm font-semibold text-text-primary">{item.questionTitle}</h2>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground" dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">{item.text}</p>
                <div className="mt-3 flex justify-end">
                  <Button variant="secondary" onClick={() => void openResponse(item)}>
                    <Eye className="h-4 w-4" /> Ver resposta completa
                  </Button>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!initialLoading && !error && items.length > 0 && pageState === "end" ? (
        <p className="text-center text-sm text-muted-foreground">Fim confirmado do histórico de feedbacks.</p>
      ) : null}
      {!initialLoading && !error && pageState === "continue_search" ? (
        <p className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-text-secondary">
          A busca atingiu o limite deste lote. Continue para verificar respostas mais antigas.
        </p>
      ) : null}
      {!initialLoading && !error && canContinue ? (
        <div className="flex justify-center">
          <Button variant="secondary" disabled={loadingMore} onClick={() => void loadPage(cursor, true)}>
            {loadingMore ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
            {pageState === "continue_search" ? "Continuar buscando" : "Carregar mais feedbacks"}
          </Button>
        </div>
      ) : null}

      {selectedItem ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-6 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedItem(null); }}>
          <section className="w-full max-w-2xl rounded-lg border border-border bg-surface p-5 shadow-floating" role="dialog" aria-modal="true" aria-labelledby="feedback-response-title">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="feedback-response-title" className="text-xl font-semibold text-text-primary">Resposta completa</h2>
                <p className="mt-1 text-sm text-muted-foreground">{selectedItem.surveyTitle} · Feedback: {selectedItem.questionTitle}</p>
              </div>
              <Button variant="secondary" aria-label="Fechar detalhes" onClick={() => setSelectedItem(null)}><X className="h-4 w-4" /> Fechar</Button>
            </div>
            {detailLoading ? <p className="py-8 text-sm text-muted-foreground" role="status">Carregando resposta…</p> : null}
            {detailError ? <p className="mt-4 rounded-md bg-danger-soft p-3 text-sm text-danger" role="alert">{detailError}</p> : null}
            {fullResponse ? (
              <>
                <p className="mt-4 text-sm text-muted-foreground">Enviada em {formatDate(fullResponse.createdAt)}</p>
                <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                  {fullResponse.fields.map((field, index) => (
                    <div key={`${field.questionId ?? field.label}-${index}`} className={`rounded-md border p-4 ${field.questionId === selectedItem.questionId || (!selectedItem.questionId && field.label === "Comentário") ? "border-primary/40 bg-primary/5" : "border-border bg-surface-muted"}`}>
                      <p className="text-sm font-medium text-muted-foreground">{field.label}</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-base text-text-primary">{formatValue(field.value)}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatValue(value: string | number | boolean | null) {
  if (value === null || value === "") return "Não respondido";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}
