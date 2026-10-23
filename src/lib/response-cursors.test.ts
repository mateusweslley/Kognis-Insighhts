import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { clientMock, companyMock } = vi.hoisted(() => ({ clientMock: vi.fn(), companyMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: clientMock }));
vi.mock("@/lib/company", () => ({ requireCurrentCompany: companyMock }));
import { loadAllSurveyResponses } from "@/lib/survey-data-pages";
import { decodeFeedbackCursor, encodeFeedbackCursor, readFeedbackPage, type FeedbackCursor } from "@/lib/feedback-feed";
import { GET } from "@/app/api/respostas/feedbacks/route";
import { makeResponses, surveyId, surveyReadFixture } from "@/lib/testing/survey-read-fixture";
import { feedbackQuestion, feedbackReadFixture, feedbackResponse, feedbackSurvey } from "@/lib/testing/feedback-read-fixture";

const validCursor: FeedbackCursor = {
  createdAt: "2026-10-20T12:00:00.123456Z", responseId: "123e4567-e89b-42d3-a456-426614174abc", feedbackKey: null,
};
const invalidTimes = [
  "2026-99-20T12:00:00Z", "2026-02-30T12:00:00Z", "2025-02-29T12:00:00Z",
  "2026-10-20T24:00:00Z", "2026-10-20T12:60:00Z", "2026-10-20T12:00:60Z",
  "0000-01-01T00:00:00Z", "2026-10-20T12:00:00+24:00",
];
describe("response cursor contracts", () => {
  beforeEach(() => { vi.clearAllMocks(); companyMock.mockResolvedValue({ id: "company-a" }); });
  afterEach(() => { vi.restoreAllMocks(); });
  it.each(invalidTimes)("rejects invalid calendar timestamp %s before querying", async (createdAt) => {
    const raw = encodeFeedbackCursor({ ...validCursor, createdAt });
    expect(decodeFeedbackCursor(raw)).toBeNull();
    const result = await GET(new NextRequest(`http://localhost/api/respostas/feedbacks?cursor=${encodeURIComponent(raw)}`));
    expect(result.status).toBe(400);
    expect(clientMock).not.toHaveBeenCalled();
    expect(companyMock).not.toHaveBeenCalled();
  });
  it.each([
    { createdAt: validCursor.createdAt, feedbackKey: null },
    { responseId: validCursor.responseId, feedbackKey: null },
    { ...validCursor, responseId: "" }, { ...validCursor, responseId: "invalid" },
    { ...validCursor, responseId: 1 }, { ...validCursor, createdAt: "" },
    { ...validCursor, createdAt: null }, { ...validCursor, feedbackKey: 1 },
    { createdAt: validCursor.createdAt, responseId: validCursor.responseId },
  ])("rejects absent or malformed cursor fields: %j", async (payload) => {
    const raw = encodeURIComponent(JSON.stringify(payload));
    expect(decodeFeedbackCursor(raw)).toBeNull();
    expect((await GET(new NextRequest(`http://localhost/api/respostas/feedbacks?cursor=${encodeURIComponent(raw)}`))).status).toBe(400);
    expect(clientMock).not.toHaveBeenCalled();
  });
  it.each(["2024-02-29T23:59:59.123456Z", "2026-10-20T09:00:00-03:00", "2026-10-20T12:00:00+00:00"])("keeps valid timestamp representation %s unchanged", (createdAt) => {
    const cursor = { ...validCursor, createdAt, responseId: validCursor.responseId.toUpperCase(), feedbackKey: "question" };
    expect(decodeFeedbackCursor(encodeFeedbackCursor(cursor))).toEqual(cursor);
  });
  it("accepts case-insensitive UUID identity when resuming inside a response", async () => {
    const row = { id: validCursor.responseId, survey_id: surveyId, created_at: validCursor.createdAt,
      answers: { mode: "dynamic", answers: { a: "A", b: "B" } } };
    const cursor = { ...validCursor, responseId: validCursor.responseId.toUpperCase(), feedbackKey: "b" };
    const result = await readFeedbackPage({
      pageSize: 20, batchSize: 50, maxBatches: 4, cursor,
      questionsBySurvey: new Map([[surveyId, ["a", "b"].map((id) => ({ id, type: "short_text", title: id }))]]),
      surveyTitles: new Map([[surveyId, "Fixture"]]), fetchById: async () => row,
      fetchBatch: async () => ({ rows: [], count: 0 }),
    });
    expect(result.items.map((item) => item.feedbackKey)).toEqual(["a"]);
    expect(result).toMatchObject({ nextCursor: null, hasMore: false, state: "end" });
  });
  it.each([true, false])("continues exactly after each equal-timestamp page, ascending=%s", async (ascending) => {
    const rows = makeResponses(1201);
    const mock = surveyReadFixture(rows, { cap: 73 });
    const result = await loadAllSurveyResponses(mock.client, surveyId, ascending);
    expect(result.error).toBeNull();
    const ordered = ascending ? rows : [...rows].reverse();
    expect(result.rows.map((row) => row.id)).toEqual(ordered.map((row) => row.id));
    expect(new Set(result.rows.map((row) => row.id)).size).toBe(1201);
    expect(mock.requests).toHaveLength(17);
    const comparison = ascending ? "gt" : "lt";
    for (let page = 1; page < mock.requests.length; page++) {
      const tail = ordered[page * 73 - 1];
      expect(mock.requests[page].searchParams.get("or")).toBe(
        `(created_at.${comparison}.${tail.created_at},and(created_at.eq.${tail.created_at},id.${comparison}.${tail.id}))`,
      );
      expect(mock.requests[page].searchParams.get("survey_id")).toBe(`eq.${surveyId}`);
    }
  });
  it.each([true, false])("preserves empty reads in both directions, ascending=%s", async (ascending) => {
    const mock = surveyReadFixture([]);
    expect(await loadAllSurveyResponses(mock.client, surveyId, ascending)).toEqual({ rows: [], error: null });
    expect(mock.requests).toHaveLength(1);
  });
  it.each([true, false])("rejects a repeated response page without looping, ascending=%s", async (ascending) => {
    const rows = makeResponses(501);
    const mock = surveyReadFixture(rows, { transform: (table, page, result) => table === "responses" && page === 2
      ? { ...result, rows: [rows[ascending ? 0 : 500]] } : result });
    const result = await loadAllSurveyResponses(mock.client, surveyId, ascending);
    expect(result.rows).toEqual([]);
    expect(result.error).toContain("INCOMPLETE_SURVEY_DATA");
    expect(mock.requests).toHaveLength(2);
  });
  it.each(["missing-id", "empty-id", "missing-time", "invalid-time"])("rejects response cursor source %s", async (scenario) => {
    const row = makeResponses(1)[0];
    const mock = surveyReadFixture([row], { transform: (_table, _page, result) => ({ ...result,
      rows: [{ ...row, ...(scenario === "missing-id" ? { id: undefined } : scenario === "empty-id" ? { id: "" }
        : scenario === "missing-time" ? { created_at: undefined } : { created_at: "invalid" }) }],
    }) });
    const result = await loadAllSurveyResponses(mock.client, surveyId);
    expect(result.rows).toEqual([]);
    expect(result.error).toContain("INCOMPLETE_SURVEY_DATA");
  });
  it("preserves the raw compound cursor across public page boundaries and tenant filters", async () => {
    const survey = feedbackSurvey(1), question = feedbackQuestion(100, survey.id);
    const own = Array.from({ length: 51 }, (_, i) => feedbackResponse(i + 1000, survey.id, { mode: "dynamic", answers: { [question.id]: `${i}` } }));
    const other = feedbackSurvey(2, "company-b");
    const mock = feedbackReadFixture({ surveys: [survey, other], questions: [question],
      responses: [...own, feedbackResponse(9000, other.id, { comment: "Outro tenant" })] }, { responseCap: 7 });
    clientMock.mockReturnValue(mock.client);
    const ids: string[] = [];
    let cursor: FeedbackCursor | null = null;
    for (let page = 0; page < 10; page++) {
      const query = cursor ? `?cursor=${encodeURIComponent(JSON.stringify(cursor))}` : "";
      const response = await GET(new NextRequest(`http://localhost/api/respostas/feedbacks${query}`));
      expect(response.status).toBe(200);
      const payload = await response.json();
      ids.push(...payload.items.map((item: { responseId: string }) => item.responseId));
      cursor = payload.nextCursor;
      if (!cursor) break;
      expect(Object.keys(cursor).sort()).toEqual(["createdAt", "feedbackKey", "responseId"]);
      expect(cursor.responseId).toBe(ids[ids.length - 1]);
    }
    expect(cursor).toBeNull();
    expect(ids).toEqual(own.map((row) => row.id).reverse());
    expect(new Set(ids).size).toBe(51);
    expect(mock.requests.filter((url) => url.pathname.endsWith("/responses"))
      .every((url) => url.searchParams.get("survey_id") === `in.(${survey.id})`)).toBe(true);
  });
  it.each(["response-id", "timestamp"])("rejects a resumed response whose %s changed", async (changed) => {
    await expect(readFeedbackPage({ pageSize: 20, batchSize: 50, maxBatches: 4,
      cursor: { ...validCursor, feedbackKey: "b" }, questionsBySurvey: new Map(), surveyTitles: new Map(),
      fetchById: async () => ({ id: changed === "response-id" ? "other" : validCursor.responseId,
        survey_id: surveyId, created_at: changed === "timestamp" ? "2026-10-19T12:00:00Z" : validCursor.createdAt, answers: {} }),
      fetchBatch: async () => ({ rows: [], count: 0 }),
    })).rejects.toThrow("INCOMPLETE_SURVEY_DATA");
  });
});
