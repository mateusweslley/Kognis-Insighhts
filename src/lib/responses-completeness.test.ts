import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const { createClientMock, companyMock, surveysMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(), companyMock: vi.fn(), surveysMock: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/company", () => ({ requireCurrentCompany: companyMock }));
vi.mock("@/lib/surveys", () => ({ getCompanySurveys: surveysMock }));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/layout/page-container", () => ({ PageContainer: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import { getResponsesBySurveyId, getSurveyQuestionsForResponses } from "@/lib/responses";
import { calculateSurveyInsight, getSurveyInsight, getSurveyMetrics } from "@/lib/metrics/dashboard-metrics";
import { computeNps } from "@/lib/metrics/metrics-engine";
import { exportNormalizedResponsesToCsv, normalizeResponses } from "@/lib/response-normalizer";
import SurveyResponsesPage from "@/app/respostas/[surveyId]/page";
import { makeResponses, npsId, questions, ratingId, surveyId, surveyReadFixture } from "@/lib/testing/survey-read-fixture";

describe("complete individual survey dataset", () => {
  beforeAll(() => { vi.stubGlobal("React", React); });
  afterAll(() => { vi.unstubAllGlobals(); });
  beforeEach(() => {
    vi.clearAllMocks();
    companyMock.mockResolvedValue({ id: "company-owned" });
    surveysMock.mockResolvedValue({ surveys: [{ id: surveyId, title: "Fixture", status: "active", primary_question_id: null }], error: null });
  });
  it.each([0, 1, 499, 500, 501, 999, 1000, 1001, 1201, 2501])("returns all %i rows, in stable descending order", async (count) => {
    const rows = makeResponses(count);
    const fixture = surveyReadFixture(rows);
    createClientMock.mockReturnValue(fixture.client);
    const loaded = await getResponsesBySurveyId(surveyId);
    expect(loaded.error).toBeNull();
    expect(loaded.responses.map((row) => row.id)).toEqual(rows.map((row) => row.id).reverse());
    expect(new Set(loaded.responses.map((row) => row.id)).size).toBe(count);
    expect(fixture.requests[0].searchParams.get("order")).toBe("created_at.desc,id.desc");
    expect(fixture.requests.every((url) => url.searchParams.get("survey_id") === `eq.${surveyId}`)).toBe(true);
  });
  it("uses all 1201 dynamic answers for the insight, NPS and rating statistics", async () => {
    const rows = makeResponses(1201);
    createClientMock.mockReturnValue(surveyReadFixture(rows).client);
    const insight = await getSurveyInsight(surveyId);
    expect(insight.error).toBeNull();
    expect(insight.totalResponses).toBe(1201);
    expect(insight.nps.stats).toEqual(computeNps(rows.map((_, i) => i < 1000 ? 10 : 0)));
    expect(insight.nps.stats).toMatchObject({ count: 1201, score: 67, promoters: 1000, detractors: 201 });
    expect(insight.avgRating).toBeNull(); // No explicitly configured primary question: do not infer satisfaction.
    createClientMock.mockReturnValue(surveyReadFixture(rows).client);
    const metrics = await getSurveyMetrics(surveyId);
    expect(metrics.rating.count).toBe(1201);
    expect(metrics.rating.average).toBeCloseTo(5201 / 1201, 12);
  });
  it("keeps descending timestamp/ID order across different timestamp groups and short server pages", async () => {
    const rows = makeResponses(1201).map((row, i) => ({ ...row,
      created_at: new Date(Date.parse(row.created_at) + Math.floor(i / 300) * 1000).toISOString(),
    }));
    createClientMock.mockReturnValue(surveyReadFixture([...rows].reverse(), { cap: 173 }).client);
    const loaded = await getResponsesBySurveyId(surveyId);
    expect(loaded.error).toBeNull();
    expect(loaded.responses.map((row) => row.id)).toEqual(rows.map((row) => row.id).reverse());
  });
  it("preserves legacy satisfaction while including the last page", async () => {
    const rows = makeResponses(1201).map((row, i) => ({ ...row, answers: { name: `Fixture ${i}`, rating: i < 1000 ? 5 : 1 } }));
    createClientMock.mockReturnValue(surveyReadFixture(rows).client);
    const insight = await getSurveyInsight(surveyId);
    expect(insight.totalResponses).toBe(1201);
    expect(insight.avgRating).toBeCloseTo(5201 / 1201, 12);
  });
  it("exports exactly every loaded response, including the final page", async () => {
    const rows = makeResponses(1201).map((row, i) => ({ ...row,
      answers: { mode: "dynamic" as const, answers: { [ratingId]: i < 1000 ? 5 : 1, [npsId]: 10, marker: `ROW_${String(i).padStart(4, "0")}` } },
    }));
    createClientMock.mockReturnValue(surveyReadFixture(rows).client);
    const loaded = await getResponsesBySurveyId(surveyId);
    const csv = exportNormalizedResponsesToCsv(normalizeResponses(loaded.responses, questions));
    expect(csv.split("\n")).toHaveLength(1202);
    for (let i = 0; i < 1201; i++) expect(csv.match(new RegExp(`ROW_${String(i).padStart(4, "0")}`, "g"))).toHaveLength(1);
  });
  it.each(["failure", "changed-count", "missing-count", "duplicate", "empty", "foreign"])("fails explicitly on intermediate %s", async (scenario) => {
    const options = { transform: (table: string, page: number, result: import("@/lib/testing/survey-read-fixture").FixturePage) => {
      if (table !== "responses" || page !== 2) return result;
      if (scenario === "failure") return { ...result, status: 500 };
      if (scenario === "changed-count") return { ...result, count: 2 };
      if (scenario === "missing-count") return { ...result, count: null };
      if (scenario === "empty") return { ...result, rows: [] };
      return { ...result, rows: [{ ...makeResponses(501)[scenario === "duplicate" ? 500 : 0], ...(scenario === "foreign" ? { survey_id: "other" } : {}) }] };
    } };
    createClientMock.mockReturnValue(surveyReadFixture(makeResponses(501), options).client);
    const result = await getResponsesBySurveyId(surveyId);
    expect(result.responses).toEqual([]);
    expect(result.error).toContain("INCOMPLETE_SURVEY_DATA");
    createClientMock.mockReturnValue(surveyReadFixture(makeResponses(501), options).client);
    const insight = await getSurveyInsight(surveyId);
    expect(insight.error).toContain("INCOMPLETE_SURVEY_DATA");
    expect(insight.nps.stats.score).toBeNull();
  });
  it("scopes every page to the requested survey and preserves the client's authorization context", async () => {
    const owned = makeResponses(501);
    const foreign = makeResponses(20).map((row) => ({ ...row, survey_id: "other" }));
    const fixture = surveyReadFixture([...owned, ...foreign]);
    createClientMock.mockReturnValue(fixture.client);
    expect((await getResponsesBySurveyId(surveyId)).responses).toHaveLength(501);
    expect(fixture.requests.every((url) => url.searchParams.get("survey_id") === `eq.${surveyId}`)).toBe(true);
    expect(createClientMock).toHaveBeenCalledTimes(1);
  });
  it("reads complete questions and propagates metadata failures to the insight", async () => {
    const many = Array.from({ length: 501 }, (_, i) => ({ ...questions[0], id: `q-${String(i).padStart(4, "0")}`, position: i }));
    createClientMock.mockReturnValue(surveyReadFixture([], { questions: many }).client);
    expect((await getSurveyQuestionsForResponses(surveyId)).questions).toHaveLength(501);
    createClientMock.mockReturnValue(surveyReadFixture(makeResponses(1), { questions: many, transform: (table, page, result) => table === "survey_questions" && page === 2 ? { ...result, status: 500 } : result }).client);
    expect((await getSurveyInsight(surveyId)).error).toContain("INCOMPLETE_SURVEY_DATA");
  });
  it("shares one complete read across the page list, insight and CSV source", async () => {
    const fixture = surveyReadFixture(makeResponses(1201));
    createClientMock.mockReturnValue(fixture.client);
    const html = renderToStaticMarkup(await SurveyResponsesPage({ params: { surveyId } }));
    expect(html).toContain("1201 respostas");
    expect(fixture.requests.filter((url) => url.pathname.endsWith("/responses"))).toHaveLength(3);
    expect(fixture.requests.filter((url) => url.pathname.endsWith("/survey_questions"))).toHaveLength(1);
    expect(companyMock).toHaveBeenCalledOnce();
    expect(surveysMock).toHaveBeenCalledWith("company-owned");
  });
  it.each(["responses", "survey_questions"])("disables CSV and hides numeric insight after an intermediate %s failure", async (failedTable) => {
    const many = Array.from({ length: 501 }, (_, i) => ({ ...questions[0], id: `q-${String(i).padStart(4, "0")}` }));
    createClientMock.mockReturnValue(surveyReadFixture(makeResponses(501), {
      questions: failedTable === "survey_questions" ? many : questions,
      transform: (table, page, result) => table === failedTable && page === 2 ? { ...result, status: 500 } : result,
    }).client);
    const html = renderToStaticMarkup(await SurveyResponsesPage({ params: { surveyId } }));
    expect(html).toContain("INCOMPLETE_SURVEY_DATA");
    expect(html).not.toContain("Um resumo interpretável");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Exportar CSV/);
  });
  it("does not load a survey outside the authorized page scope", async () => {
    surveysMock.mockResolvedValue({ surveys: [], error: null });
    await expect(SurveyResponsesPage({ params: { surveyId } })).rejects.toThrow("NOT_FOUND");
    expect(createClientMock).not.toHaveBeenCalled();
  });
  it("renders configured satisfaction from the same complete response and CSV source", async () => {
    surveysMock.mockResolvedValue({ surveys: [{ id: surveyId, title: "Fixture", status: "active", primary_question_id: ratingId }], error: null });
    const fixture = surveyReadFixture(makeResponses(1201));
    createClientMock.mockReturnValue(fixture.client);
    const html = renderToStaticMarkup(await SurveyResponsesPage({ params: { surveyId } }));
    expect(html).toContain("4,3 / 5");
    expect(html).toContain("1201 respostas");
    expect(fixture.requests.filter((url) => url.pathname.endsWith("/responses"))).toHaveLength(3);
    expect(fixture.requests.some((url) => url.pathname.endsWith("/surveys"))).toBe(false);
    expect(surveysMock).toHaveBeenCalledWith("company-owned");
  });
  it.each(["missing-config", "survey-error", "invalid-config"])("does not display a satisfaction average on %s", async (kind) => {
    surveysMock.mockResolvedValue({ surveys: [{ id: surveyId, title: "Fixture", status: "active",
      ...(kind === "missing-config" ? {} : { primary_question_id: kind === "invalid-config" ? npsId : ratingId }),
    }], error: kind === "survey-error" ? "SURVEY_SOURCE_FAILURE" : null });
    createClientMock.mockReturnValue(surveyReadFixture(makeResponses(1)).client);
    const html = renderToStaticMarkup(await SurveyResponsesPage({ params: { surveyId } }));
    expect(html).not.toContain("Um resumo interpretável");
    expect(html).not.toContain("5,0 / 5");
    expect(html).toContain(kind === "missing-config" ? "Configuração de satisfação indisponível."
      : kind === "survey-error" ? "SURVEY_SOURCE_FAILURE" : "Não foi possível interpretar");
  });
  it("does not calculate a plausible insight when passed a source error", () => {
    expect(calculateSurveyInsight({ questions, responses: makeResponses(3), error: "incomplete" })).toMatchObject({ error: "incomplete", nps: { stats: { score: null } } });
  });
});
