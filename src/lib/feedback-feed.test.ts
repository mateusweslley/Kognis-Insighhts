import { describe, expect, it, vi } from "vitest";

import {
  decodeFeedbackCursor,
  encodeFeedbackCursor,
  extractTextFeedback,
  readFeedbackPage,
  type FeedbackCursor,
  type FeedbackResponse,
  type FeedbackQuestion,
} from "@/lib/feedback-feed";

const response = (
  id: string,
  answers: FeedbackResponse["answers"],
  created_at = "2026-10-01T12:00:00.000Z",
): FeedbackResponse => ({ id, survey_id: "survey-1", answers, created_at });

const question = (id: string, type: FeedbackQuestion["type"], title = id): FeedbackQuestion => ({
  id,
  type,
  title,
});

describe("extractTextFeedback", () => {
  it("includes only a nonblank legacy comment, never identity fields", () => {
    const result = extractTextFeedback(
      response("r1", { name: "Ana", email: "ana@example.test", rating: 5, comment: "  Bom!  " }),
      [],
      "Pesquisa",
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "r1:legacy:comment",
      feedbackKey: "legacy:comment",
      questionTitle: "Comentário",
      text: "  Bom!  ",
    });
    expect(JSON.stringify(result)).not.toContain("Ana");
    expect(JSON.stringify(result)).not.toContain("ana@example.test");
  });

  it("includes multiple short and long text answers, excluding other and unknown question types", () => {
    const result = extractTextFeedback(
      response("r1", {
        mode: "dynamic",
        answers: { short: "Olá", long: "Linha 1\nLinha 2", rating: "5", choice: "Bom", missing: "???" },
      }),
      [
        question("short", "short_text", "Resumo"),
        question("long", "long_text", "Conte mais"),
        question("rating", "rating", "Nota"),
        question("choice", "single_choice", "Opção"),
      ],
      "Pesquisa",
    );

    expect(result.map((item) => [item.feedbackKey, item.questionTitle, item.text])).toEqual([
      ["short", "Resumo", "Olá"],
      ["long", "Conte mais", "Linha 1\nLinha 2"],
    ]);
  });

  it("ignores blank, whitespace-only, null and non-string dynamic values", () => {
    const result = extractTextFeedback(
      response("r1", {
        mode: "dynamic",
        answers: { a: "", b: "  \n", c: null as never, d: 0 as never },
      }),
      ["a", "b", "c", "d"].map((id) => question(id, "short_text")),
      "Pesquisa",
    );

    expect(result).toEqual([]);
  });

  it("excludes identification, rating, choice and other non-text question types", () => {
    const excluded = ["full_name", "email", "phone", "number", "rating", "rating_10", "single_choice", "name_text"];
    const result = extractTextFeedback(
      response("r1", {
        mode: "dynamic",
        answers: Object.fromEntries(excluded.map((id) => [id, "valor"])),
      }),
      excluded.map((type) => type === "name_text" ? question(type, "short_text", "Nome completo") : question(type, type)),
      "Pesquisa",
    );
    expect(result).toEqual([]);
  });
});

describe("feedback cursor", () => {
  it("round-trips a cursor positioned within one response", () => {
    const cursor: FeedbackCursor = {
      createdAt: "2026-10-01T12:00:00.000Z",
      responseId: "123e4567-e89b-42d3-a456-426614174000",
      feedbackKey: "question-a",
    };

    expect(decodeFeedbackCursor(encodeFeedbackCursor(cursor))).toEqual(cursor);
    expect(decodeFeedbackCursor("not-a-cursor")).toBeNull();
  });
});

describe("readFeedbackPage", () => {
  it("continues inside a response before moving to older responses without duplicates", async () => {
    const row = response("r1", {
      mode: "dynamic",
      answers: { a: "A", b: "B", c: "C" },
    });
    const fetchBatch = vi.fn(async (_after: FeedbackCursor | null, _limit: number) => []);
    const fetchById = vi.fn(async () => row);
    const input = {
      pageSize: 2,
      batchSize: 3,
      maxBatches: 2,
      cursor: null,
      questionsBySurvey: new Map([["survey-1", ["a", "b", "c"].map((id) => question(id, "short_text"))]]),
      surveyTitles: new Map([["survey-1", "Pesquisa"]]),
      fetchBatch: async (after: FeedbackCursor | null, limit: number) => {
        if (after === null) return [row];
        return fetchBatch(after, limit);
      },
      fetchById,
    };

    const first = await readFeedbackPage(input);
    expect(first.items.map((item) => item.feedbackKey)).toEqual(["c", "b"]);
    expect(first.nextCursor?.feedbackKey).toBe("b");

    const second = await readFeedbackPage({ ...input, cursor: first.nextCursor });
    expect(second.items.map((item) => item.feedbackKey)).toEqual(["a"]);
    expect(second.state).toBe("end");
    expect(fetchById).toHaveBeenCalledWith("r1");
  });

  it("returns an explicit continuation when the bounded scan finds only empty responses", async () => {
    const rows = ["r3", "r2"].map((id) => response(id, { mode: "dynamic", answers: {} }));
    const result = await readFeedbackPage({
      pageSize: 2,
      batchSize: 2,
      maxBatches: 1,
      cursor: null,
      questionsBySurvey: new Map(),
      surveyTitles: new Map([["survey-1", "Pesquisa"]]),
      fetchBatch: async () => rows,
      fetchById: async () => null,
    });

    expect(result.items).toEqual([]);
    expect(result.state).toBe("continue_search");
    expect(result.nextCursor).toMatchObject({ responseId: "r2", feedbackKey: null });
  });

  it("orders across responses by timestamp, response id, and feedback key descending", async () => {
    const questions = [question("a", "short_text"), question("z", "short_text")];
    const result = await readFeedbackPage({
      pageSize: 10,
      batchSize: 10,
      maxBatches: 1,
      cursor: null,
      questionsBySurvey: new Map([["survey-1", questions]]),
      surveyTitles: new Map([["survey-1", "Pesquisa"]]),
      fetchBatch: async () => [
        response("id-a", { mode: "dynamic", answers: { z: "Antigo id" } }, "2026-10-01T12:00:00.000Z"),
        response("id-z", { mode: "dynamic", answers: { a: "A", z: "Z" } }, "2026-10-01T12:00:00.000Z"),
        response("id-new", { mode: "dynamic", answers: { a: "Mais novo" } }, "2026-10-02T12:00:00.000Z"),
      ],
      fetchById: async () => null,
    });

    expect(result.items.map(({ responseId, feedbackKey }) => [responseId, feedbackKey])).toEqual([
      ["id-new", "a"],
      ["id-z", "z"],
      ["id-z", "a"],
      ["id-a", "z"],
    ]);
  });

  it("distinguishes no responses, responses without text, and exhausted history", async () => {
    const base = {
      pageSize: 2,
      batchSize: 2,
      maxBatches: 2,
      cursor: null,
      questionsBySurvey: new Map(),
      surveyTitles: new Map<string, string>(),
      fetchById: async () => null,
    };

    expect((await readFeedbackPage({ ...base, fetchBatch: async () => [] })).state).toBe("no_responses");
    expect(
      (await readFeedbackPage({ ...base, fetchBatch: async () => [response("r1", { mode: "dynamic", answers: {} })] })).state,
    ).toBe("no_text_feedback");
    expect(
      (await readFeedbackPage({ ...base, cursor: { createdAt: "2026-10-01T00:00:00Z", responseId: "r1", feedbackKey: null }, fetchBatch: async () => [] })).state,
    ).toBe("end");
  });
});
