import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedbackItem, FeedbackPageState } from "@/lib/feedback-feed";

const { state } = vi.hoisted(() => ({ state: { values: [] as unknown[], index: 0 } }));
// Exercise the existing rendered states without a browser dependency or network.
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => [state.index < state.values.length ? state.values[state.index++] : initial, vi.fn()],
    useEffect: vi.fn(),
    useCallback: (callback: unknown) => callback,
  };
});
import { FeedbacksPanel } from "@/components/responses/feedbacks-panel";

function renderState(pageState: FeedbackPageState | null, error: string | null, extra: {
  loading?: boolean; selected?: FeedbackItem; detailError?: string;
} = {}) {
  state.values = [[], null, pageState, extra.loading ?? false, false, error,
    extra.selected ?? null, null, false, extra.detailError ?? null];
  state.index = 0;
  return renderToStaticMarkup(React.createElement(FeedbacksPanel));
}
describe("feedback error presentation", () => {
  beforeAll(() => { vi.stubGlobal("React", React); });
  afterAll(() => { vi.unstubAllGlobals(); });
  beforeEach(() => { state.index = 0; });
  it.each(["no_responses", "no_text_feedback", "end"] as const)("suppresses stale %s when metadata loading fails", (pageState) => {
    const html = renderState(pageState, "INCOMPLETE_SURVEY_DATA: Metadados indisponíveis.");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Metadados indisponíveis.");
    expect(html).toContain("Tentar novamente");
    expect(html).not.toContain("Nenhuma resposta recebida ainda");
    expect(html).not.toContain("nenhuma contém feedback textual");
    expect(html).not.toContain("Fim confirmado");
  });
  it.each(["no_responses", "no_text_feedback"] as const)("preserves legitimate %s", (pageState) => {
    const html = renderState(pageState, null);
    expect(html).toContain(pageState === "no_responses" ? "Nenhuma resposta recebida ainda" : "nenhuma contém feedback textual");
    expect(html).not.toContain('role="alert"');
  });
  it("preserves the loading state", () => {
    const html = renderState(null, null, { loading: true });
    expect(html).toContain("Carregando feedbacks");
    expect(html).not.toContain("Nenhuma resposta recebida ainda");
  });
  it("shows a detail failure without presenting partial response fields", () => {
    const item: FeedbackItem = { id: "fixture", responseId: "response", surveyId: "survey", surveyTitle: "Pesquisa",
      feedbackKey: "question", questionId: "question", questionTitle: "Comentário", text: "Texto", createdAt: "2026-10-20T12:00:00Z" };
    const html = renderState(null, null, { selected: item, detailError: "Metadados incompletos" });
    expect(html).toContain("Metadados incompletos");
    expect(html).not.toContain("Enviada em");
  });
});
