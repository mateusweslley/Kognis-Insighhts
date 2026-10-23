import { beforeEach, describe, expect, it, vi } from "vitest";
const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: createClientMock }));
import { loadMetricData } from "@/lib/dashboard-metric-loader";
import { resolveMetric } from "@/lib/dashboard-metric-resolver";
import { extractResponseData } from "@/lib/metrics/extract";
import type { DashboardWidget } from "@/types/dashboard";
import { makeResponses, questions, ratingId, surveyId, surveyReadFixture } from "@/lib/testing/survey-read-fixture";

const widget = (metric: DashboardWidget["metric"]) => ({ metric, question_id: ratingId, title: "Fixture" } as DashboardWidget);
describe("complete widget data", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it.each([0, 1, 499, 500, 501, 999, 1000, 1001, 1201, 2501])("loads all %i responses including tied timestamps", async (count) => {
    const rows = makeResponses(count);
    const fixture = surveyReadFixture(rows);
    createClientMock.mockReturnValue(fixture.client);
    const loaded = await loadMetricData(surveyId);
    expect(loaded.error).toBeNull();
    expect(loaded.data.totalResponses).toBe(count);
    expect(loaded.data.valuesByQuestion.get(ratingId) ?? []).toHaveLength(count);
    const reference = extractResponseData(rows, questions);
    for (const metric of ["response_count", "average", "distribution", "trend"] as const) {
      expect(resolveMetric(widget(metric), loaded.data, loaded.questions)).toEqual(resolveMetric(widget(metric), reference, questions));
    }
    const requests = fixture.requests.filter((url) => url.pathname.endsWith("/responses"));
    expect(requests).toHaveLength(Math.max(1, Math.ceil(count / 500)));
    expect(requests.every((url) => url.searchParams.get("survey_id") === `eq.${surveyId}`)).toBe(true);
    expect(requests[0].searchParams.get("order")).toBe("created_at.asc,id.asc");
    if (count === 1201) expect(resolveMetric(widget("average"), loaded.data, loaded.questions)).toMatchObject({ value: 5201 / 1201 });
  });
  it("continues short pages when the server cap is below 500", async () => {
    const fixture = surveyReadFixture(makeResponses(501), { cap: 73 });
    createClientMock.mockReturnValue(fixture.client);
    expect((await loadMetricData(surveyId)).data.totalResponses).toBe(501);
    expect(fixture.requests.filter((url) => url.pathname.endsWith("/responses"))).toHaveLength(7);
  });
  it("keeps answers in timestamp/ID order across different timestamp groups", async () => {
    const rows = makeResponses(1201).map((row, i) => ({ ...row,
      created_at: new Date(Date.parse(row.created_at) + Math.floor(i / 300) * 1000).toISOString(),
    })).reverse();
    createClientMock.mockReturnValue(surveyReadFixture(rows).client);
    const loaded = await loadMetricData(surveyId);
    expect(loaded.error).toBeNull();
    expect(loaded.data.valuesByQuestion.get(ratingId)).toEqual([
      ...Array(1000).fill(5), ...Array(201).fill(1),
    ]);
  });
  it.each(["failure", "changed-count", "missing-count", "duplicate", "empty", "foreign", "invalid-date", "throw"])("rejects %s without partial metrics", async (scenario) => {
    const fixture = surveyReadFixture(makeResponses(501), { transform: (table, page, result) => {
      if (table !== "responses" || page < 2) return result;
      if (scenario === "throw") throw new Error("Transport failed");
      if (scenario === "failure") return { ...result, status: 500 };
      if (scenario === "changed-count") return { ...result, count: 2 };
      if (scenario === "missing-count") return { ...result, count: null };
      if (scenario === "empty") return { ...result, rows: [] };
      const row = makeResponses(501)[scenario === "duplicate" ? 0 : 500];
      return { ...result, rows: [{ ...row, ...(scenario === "foreign" ? { survey_id: "other" } : {}), ...(scenario === "invalid-date" ? { created_at: "invalid" } : {}) }] };
    } });
    createClientMock.mockReturnValue(fixture.client);
    const loaded = await loadMetricData(surveyId);
    expect(loaded.error).toContain("INCOMPLETE_SURVEY_DATA");
    expect(loaded.data.totalResponses).toBe(0);
    expect(loaded.data.valuesByQuestion.size).toBe(0);
  });
  it("loads all question metadata and rejects an intermediate metadata failure", async () => {
    const many = Array.from({ length: 501 }, (_, i) => ({ ...questions[0], id: `q-${String(i).padStart(4, "0")}`, position: 501 - i }));
    const fixture = surveyReadFixture([], { questions: many });
    createClientMock.mockReturnValue(fixture.client);
    const loaded = await loadMetricData(surveyId);
    expect(loaded.questions).toHaveLength(501);
    expect(loaded.questions[0].position).toBe(1);
    const failed = surveyReadFixture(makeResponses(1), { questions: many, transform: (table, page, result) => table === "survey_questions" && page === 2 ? { ...result, status: 500 } : result });
    createClientMock.mockReturnValue(failed.client);
    const result = await loadMetricData(surveyId);
    expect(result.error).toContain("INCOMPLETE_SURVEY_DATA");
    expect(result.data.totalResponses).toBe(0);
  });
});
