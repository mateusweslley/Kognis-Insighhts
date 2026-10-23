import { beforeEach, describe, expect, it, vi } from "vitest";
const { clientMock } = vi.hoisted(() => ({ clientMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: clientMock }));
import { calculateSurveyInsight, getSurveyInsight } from "@/lib/metrics/dashboard-metrics";
import { calculateConsolidatedRatingMetrics } from "@/lib/metrics/consolidated-metrics";
import { calculateDashboardKpis } from "@/lib/metrics/dashboard-kpis";
import { extractResponseData } from "@/lib/metrics/extract";
import { getSurveySatisfactionConfig } from "@/lib/responses";
import { makeResponses, questions, ratingId, surveyId, surveyReadFixture } from "@/lib/testing/survey-read-fixture";
import type { SurveyResponse } from "@/types/response";
import type { SurveyQuestion } from "@/types/survey-question";

const legacy = (id: string, rating: unknown): SurveyResponse => ({
  id, survey_id: surveyId, created_at: "2026-10-20T00:00:00Z",
  answers: { name: "Fixture", rating } as SurveyResponse["answers"],
});
const dynamic = (id: string, value: unknown): SurveyResponse => ({
  ...legacy(id, 1), answers: { mode: "dynamic", answers: { [ratingId]: value } } as SurveyResponse["answers"],
});
function insight(responses: SurveyResponse[], overrides: {
  questions?: SurveyQuestion[]; primaryQuestionId?: string | null; error?: string | null;
} = {}) {
  return calculateSurveyInsight({ questions, responses, error: null, surveyId,
    primaryQuestionId: ratingId, ...overrides });
}

describe("individual satisfaction uses explicit primary 1–5 evaluation", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("preserves the valid legacy mean without primary configuration", () => {
    expect(insight([legacy("a", 5), legacy("b", 2)], { primaryQuestionId: null }).avgRating).toBe(3.5);
  });
  it("includes configured dynamic evaluations", () => {
    expect(insight([dynamic("a", 5), dynamic("b", "3")]).avgRating).toBe(4);
  });
  it("combines one legacy and one dynamic evaluation per response", () => {
    const hybrid = { ...dynamic("b", 1), answers: { ...dynamic("b", 1).answers, rating: 5 } } as SurveyResponse;
    expect(insight([legacy("a", 5), hybrid]).avgRating).toBe(3);
  });
  it("does not infer satisfaction from unconfigured dynamic questions", () => {
    expect(insight([dynamic("a", 5)], { primaryQuestionId: null })).toMatchObject({ avgRating: null, error: null });
  });
  it("does not pool other evaluations, NPS, generic numbers or labels", () => {
    const extra: SurveyQuestion[] = [
      { ...questions[0], id: "interest", title: "Interesse" },
      { ...questions[0], id: "effort", type: "number" },
      questions[1], { ...questions[0], id: "choice", type: "single_choice", options: ["5"] },
    ];
    const row: SurveyResponse = { ...dynamic("a", 2), answers: { mode: "dynamic", answers: {
      [ratingId]: 2, interest: 5, effort: 5, [questions[1].id]: 10, choice: "5",
    } } };
    expect(insight([row], { questions: [questions[0], ...extra] }).avgRating).toBe(2);
  });
  it.each([null, undefined, "", " ", "garbage", "0x5", "5e0", 0, 6, 10, 2.5, Infinity])(
    "excludes invalid dynamic value %s without manufacturing zero", (value) => {
      expect(insight([dynamic("a", value)])).toMatchObject({ avgRating: null, error: null });
      expect(insight([dynamic("a", value), legacy("b", 4)]).avgRating).toBe(4);
    });
  it("keeps an empty survey distinct from a source failure", () => {
    expect(insight([])).toMatchObject({ avgRating: null, error: null });
    expect(insight([dynamic("a", 5)], { error: "source failed" })).toMatchObject({ avgRating: null, error: "source failed" });
  });
  it.each(["rating_10", "number"] as const)("rejects incompatible configured scale %s explicitly", (type) => {
    expect(insight([dynamic("a", 5)], { questions: [{ ...questions[0], type }] })).toMatchObject({ avgRating: null, error: expect.any(String) });
  });
  it("rejects missing configured metadata instead of falling back to a partial legacy mean", () => {
    expect(insight([legacy("a", 5)], { questions: [] })).toMatchObject({ avgRating: null, error: expect.any(String) });
  });
  it.each(["question", "response"])("rejects foreign %s data", (kind) => {
    expect(insight([kind === "response" ? { ...dynamic("a", 5), survey_id: "foreign" } : dynamic("a", 5)], {
      questions: kind === "question" ? [{ ...questions[0], survey_id: "foreign" }] : questions,
    })).toMatchObject({ avgRating: null, error: expect.stringContaining("INCOMPLETE_SURVEY_DATA") });
  });
  it("matches consolidated domain calculation for the same configured dynamic sample", () => {
    const rows = [dynamic("a", 5), dynamic("b", 2), dynamic("c", 0)];
    const extracted = extractResponseData(rows, questions);
    expect(insight(rows).avgRating).toBe(calculateConsolidatedRatingMetrics({ primaryQuestionId: ratingId,
      questions, valuesByQuestion: extracted.valuesByQuestion, responsesReceived: rows.length }).average);
    expect(calculateDashboardKpis({ periodDays: 7, asOf: "2026-10-21T00:00:00Z",
      surveys: [{ id: surveyId, status: "active" }], primaryQuestionIdBySurvey: new Map([[surveyId, ratingId]]),
      datasets: [{ surveyId, questions, responses: rows }],
    }).current.averageRating).toEqual({ status: "value", value: insight(rows).avgRating });
  });
  it("loads primary metadata and values in later pages using the existing complete readers", async () => {
    const many = Array.from({ length: 501 }, (_, i) => ({ ...questions[0],
      id: i === 500 ? ratingId : `00000000-0000-4000-7000-${String(i).padStart(12, "0")}`,
      position: i,
    })).sort((a, b) => a.id.localeCompare(b.id));
    // Place the configured question after 500 other IDs, independently of its visible position.
    const primaryId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    many.find((q) => q.id === ratingId)!.id = primaryId;
    const rows = makeResponses(1201).map((row, i) => ({ ...row,
      answers: { mode: "dynamic" as const, answers: { [primaryId]: i < 1000 ? 5 : 1 } },
    }));
    const fixture = surveyReadFixture(rows, { questions: many, primaryQuestionId: primaryId });
    clientMock.mockReturnValue(fixture.client);
    const result = await getSurveyInsight(surveyId);
    expect(result.error).toBeNull();
    expect(result.avgRating).toBeCloseTo(5201 / 1201, 12);
    expect(fixture.requests.filter((u) => u.pathname.endsWith("/responses"))).toHaveLength(3);
    expect(fixture.requests.filter((u) => u.pathname.endsWith("/survey_questions"))).toHaveLength(2);
    expect(fixture.requests.find((u) => u.pathname.endsWith("/surveys"))?.searchParams.get("id")).toBe(`eq.${surveyId}`);
  });
  it.each(["responses", "survey_questions"])("fails closed on intermediate %s failure", async (table) => {
    const many = Array.from({ length: 501 }, (_, i) => ({ ...questions[0], id: `q-${i.toString().padStart(4, "0")}` }));
    const fixture = surveyReadFixture(makeResponses(1201), { primaryQuestionId: ratingId,
      questions: table === "survey_questions" ? many : questions,
      transform: (name, page, result) => name === table && page === 2 ? { ...result, status: 500 } : result,
    });
    clientMock.mockReturnValue(fixture.client);
    expect(await getSurveyInsight(surveyId)).toMatchObject({ avgRating: null, error: expect.stringContaining("INCOMPLETE_SURVEY_DATA") });
  });
  it("propagates configuration read failure through the insight service", async () => {
    const fixture = surveyReadFixture([legacy("a", 5)]);
    clientMock.mockReturnValue({ from: (table: string) => table !== "surveys" ? fixture.client.from(table)
      : { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: "failed" } }) }) }) } });
    expect(await getSurveyInsight(surveyId)).toMatchObject({ avgRating: null, error: expect.any(String) });
  });
  it.each(["query", "missing", "foreign", "malformed", "empty"])("does not turn %s configuration failure into empty data", async (kind) => {
    clientMock.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
      data: kind === "missing" ? null : { id: kind === "foreign" ? "foreign" : surveyId,
        primary_question_id: kind === "malformed" ? undefined : kind === "empty" ? "" : ratingId },
      error: kind === "query" ? { message: "unavailable" } : null,
    }) }) }) }) });
    expect(await getSurveySatisfactionConfig(surveyId)).toMatchObject({ primaryQuestionId: null, error: expect.any(String) });
  });
});
