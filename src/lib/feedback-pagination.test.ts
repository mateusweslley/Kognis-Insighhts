import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { clientMock, companyMock } = vi.hoisted(() => ({ clientMock: vi.fn(), companyMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: clientMock }));
vi.mock("@/lib/company", () => ({ requireCurrentCompany: companyMock }));
import { readFeedbackPage, type FeedbackCursor } from "@/lib/feedback-feed";
import { createFeedbackResponseSource } from "@/lib/feedback-response-source";
import { getCompanyFeedbackPage } from "@/lib/responses";
import { GET } from "@/app/api/respostas/feedbacks/route";
import { feedbackQuestion, feedbackReadFixture, feedbackResponse, feedbackSurvey } from "@/lib/testing/feedback-read-fixture";

const survey = feedbackSurvey(1), question = feedbackQuestion(100, survey.id);
const makeRows = (count: number, text = true) => Array.from({ length: count }, (_, i) => feedbackResponse(i + 1000, survey.id, {
  mode: "dynamic", answers: text ? { [question.id]: `Feedback ${i}` } : {},
}));
function setup(rows: ReturnType<typeof makeRows>, options: Parameters<typeof feedbackReadFixture>[1] = {}) {
  const mock = feedbackReadFixture({ surveys: [survey], questions: [question], responses: rows }, options);
  clientMock.mockReturnValue(mock.client);
  const source = createFeedbackResponseSource(mock.client, [survey.id]);
  const read = (overrides: Partial<Parameters<typeof readFeedbackPage>[0]> = {}) => readFeedbackPage({
    pageSize: 2000, batchSize: 500, maxBatches: 30, cursor: null,
    questionsBySurvey: new Map([[survey.id, [question]]]), surveyTitles: new Map([[survey.id, survey.title]]),
    ...source, ...overrides,
  });
  return { ...mock, source, read };
}
describe("verified feed response pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    companyMock.mockResolvedValue({ id: "company-a" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => { vi.restoreAllMocks(); });
  it("requests 500, receives at most 73, and recovers exactly 1201 equal-timestamp responses", async () => {
    const rows = makeRows(1201);
    const mock = setup(rows, { responseCap: 73 });
    const result = await mock.read();
    expect(result.items.map((item) => item.responseId)).toEqual(rows.map((row) => row.id).reverse());
    expect(new Set(result.items.map((item) => item.responseId)).size).toBe(1201);
    expect(result).toMatchObject({ hasMore: false, nextCursor: null, state: "results" });
    expect(mock.requests).toHaveLength(17);
    expect(mock.requests.every((url) => url.searchParams.get("limit") === "500"
      && url.searchParams.get("order") === "created_at.desc,id.desc")).toBe(true);
  });
  it.each([0, 1, 72, 73, 74, 146, 147, 499, 500, 501, 999, 1000, 1001])("confirms the final batch for %i responses", async (count) => {
    const rows = makeRows(count);
    const mock = setup(rows, { responseCap: 73 });
    const page = await mock.read();
    expect(page.items.map((item) => item.responseId)).toEqual(rows.map((row) => row.id).reverse());
    expect(page.hasMore).toBe(false);
    expect(mock.requests).toHaveLength(Math.max(1, Math.ceil(count / 73)));
  });
  it("preserves bounded public pages while recovering all 1201 responses under a cap of 7", async () => {
    const rows = makeRows(1201);
    setup(rows, { responseCap: 7 });
    const ids: string[] = [];
    let cursor: FeedbackCursor | null = null;
    for (let page = 0; page < 100; page++) {
      const result = await getCompanyFeedbackPage("company-a", cursor);
      expect(result.error).toBeNull();
      expect(result.page!.items.length).toBeLessThanOrEqual(20);
      ids.push(...result.page!.items.map((item) => item.responseId));
      cursor = result.page!.nextCursor;
      if (!cursor) {
        expect(result.page!.hasMore).toBe(false);
        break;
      }
    }
    expect(cursor).toBeNull();
    expect(ids).toEqual(rows.map((row) => row.id).reverse());
    expect(new Set(ids).size).toBe(1201);
  });
  it("returns continuation instead of false absence when short batches contain no text", async () => {
    const rows = makeRows(11, false);
    rows[0] = { ...rows[0], answers: { mode: "dynamic", answers: { [question.id]: "Feedback mais antigo" } } };
    setup(rows, { responseCap: 2 });
    const first = await getCompanyFeedbackPage("company-a", null);
    expect(first.page).toMatchObject({ items: [], state: "continue_search", hasMore: true, nextCursor: expect.any(Object) });
    const second = await getCompanyFeedbackPage("company-a", first.page!.nextCursor);
    expect(second.error).toBeNull();
    expect(second.page).toMatchObject({ items: [{ responseId: rows[0].id }], hasMore: false, nextCursor: null, state: "end" });
  });
  it.each(["failure", "missing-count", "changed-count", "empty", "repeated-page", "duplicate-id", "no-progress", "wrong-order", "invalid-time", "foreign", "excess", "throw"])("rejects %s instead of returning partial success", async (scenario) => {
    const rows = makeRows(1201);
    const mock = setup(rows, { responseCap: 73, transform: (table, page, result) => {
      if (table !== "responses" || page !== 2) return result;
      if (scenario === "failure") return { ...result, status: 500 };
      if (scenario === "missing-count") return { ...result, count: null };
      if (scenario === "changed-count") return { ...result, count: result.count! + 1 };
      if (scenario === "empty") return { ...result, rows: [] };
      if (scenario === "throw") throw new Error("Simulated transport failure");
      if (scenario === "repeated-page") return { ...result, rows: rows.slice(-73).reverse() };
      if (scenario === "duplicate-id") return { ...result, rows: [result.rows[0], result.rows[0]] };
      if (scenario === "no-progress") return { ...result, rows: [{ ...rows[1200], id: "zzzz-new-id" }] };
      if (scenario === "wrong-order") return { ...result, rows: [...result.rows].reverse() };
      if (scenario === "invalid-time") return { ...result, rows: [{ ...rows[0], created_at: "invalid" }] };
      if (scenario === "foreign") return { ...result, rows: [{ ...rows[0], survey_id: "foreign" }] };
      return { ...result, rows: Array.from({ length: 501 }, (_, i) => rows[i]) };
    } });
    await expect(mock.read()).rejects.toThrow("INCOMPLETE_SURVEY_DATA");
    expect(mock.requests).toHaveLength(2);
  });
  it("does not turn an intermediate failure into a public empty page", async () => {
    setup(makeRows(501, false), { responseCap: 7, transform: (table, page, result) => table === "responses" && page === 2 ? { ...result, status: 500 } : result });
    const result = await GET(new NextRequest("http://localhost/api/respostas/feedbacks"));
    expect(result.status).toBe(500);
    expect(await result.json()).toEqual({ error: expect.any(String) });
  });
  it("rejects an unavailable count even on the first batch", async () => {
    const mock = setup(makeRows(1), { transform: (table, _page, result) => table === "responses" ? { ...result, count: null } : result });
    await expect(mock.read()).rejects.toThrow("Contagem exata");
    expect(mock.requests).toHaveLength(1);
  });
  it("retains compound-cursor precision below a JavaScript millisecond", async () => {
    const rows = makeRows(4).map((row, i) => ({ ...row, created_at: `2026-10-20T12:00:00.00000${3 - i}Z` }));
    const mock = setup(rows, { responseCap: 1 });
    const result = await mock.read();
    expect(result.items.map((item) => item.responseId)).toEqual(rows.map((row) => row.id));
    expect(mock.requests).toHaveLength(4);
  });
  it("preserves cursor continuation within a response when internal batches are short", async () => {
    const rows = makeRows(4).map((row) => ({ ...row, answers: { mode: "dynamic", answers: { a: "A", b: "B", c: "C" } } }));
    const mock = setup(rows, { responseCap: 1 });
    const questionsBySurvey = new Map([[survey.id, ["a", "b", "c"].map((id) => ({ id, title: id, type: "short_text" }))]]);
    const ids: string[] = [];
    let cursor: FeedbackCursor | null = null;
    for (let page = 0; page < 10; page++) {
      const result = await mock.read({ pageSize: 2, batchSize: 500, maxBatches: 4, cursor, questionsBySurvey });
      ids.push(...result.items.map((item) => item.id));
      cursor = result.nextCursor;
      if (!cursor) break;
    }
    expect(cursor).toBeNull();
    expect(ids).toEqual([...rows].reverse().flatMap((row) => ["c", "b", "a"].map((key) => `${row.id}:${key}`)));
  });
  it("keeps both tenants isolated while continuing capped pages", async () => {
    const otherSurvey = feedbackSurvey(2, "company-b"), otherQuestion = feedbackQuestion(101, otherSurvey.id);
    const own = makeRows(51), foreign = makeRows(17).map((row) => ({ ...row, id: `${row.id.slice(0, -5)}99999`, survey_id: otherSurvey.id,
      answers: { mode: "dynamic", answers: { [otherQuestion.id]: "Outro tenant" } } }));
    const mock = feedbackReadFixture({ surveys: [survey, otherSurvey], questions: [question, otherQuestion], responses: [...own, ...foreign] }, { responseCap: 3 });
    clientMock.mockReturnValue(mock.client);
    const ids: string[] = [];
    let cursor: FeedbackCursor | null = null;
    for (let page = 0; page < 10; page++) {
      const result = await getCompanyFeedbackPage("company-a", cursor);
      expect(result.error).toBeNull();
      ids.push(...result.page!.items.map((item) => item.responseId));
      cursor = result.page!.nextCursor;
      if (!cursor) break;
    }
    expect(ids).toEqual(own.map((row) => row.id).reverse());
    expect(mock.requests.filter((url) => url.pathname.endsWith("/responses"))
      .every((url) => url.searchParams.get("survey_id") === `in.(${survey.id})`)).toBe(true);
  });
});
