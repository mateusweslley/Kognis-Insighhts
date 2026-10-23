import { describe, expect, it } from "vitest";
import { auditResponseHistory } from "@/lib/response-history-audit";
import { extractResponseData } from "@/lib/metrics/extract";
import { calculateSurveyInsight } from "@/lib/metrics/dashboard-metrics";
import { normalizeResponses, exportNormalizedResponsesToCsv } from "@/lib/response-normalizer";
import { extractTextFeedback } from "@/lib/feedback-feed";
import { loadAllSurveyResponses } from "@/lib/survey-data-pages";
import { makeResponses, questions, ratingId, npsId, surveyId, surveyReadFixture } from "@/lib/testing/survey-read-fixture";
import type { SurveyResponse } from "@/types/response";
import type { SurveyQuestion } from "@/types/survey-question";

const choice: SurveyQuestion = { ...questions[0], type: "single_choice", title: "Escolha original", options: ["A", "B"] };
const row = (answers: unknown) => ({ id: "response-1", survey_id: surveyId, answers, created_at: "2026-10-20T00:00:00Z" });
const dynamic = (value: unknown): SurveyResponse => row({ mode: "dynamic", answers: { [ratingId]: value } }) as SurveyResponse;
const audit = (responses: ReturnType<typeof row>[]) => auditResponseHistory({ surveyId, responses, complete: true, sourceError: null });
function state(answers: unknown) {
  const result = audit([row(answers)]);
  expect(result.status).toBe("assessed");
  return result.entries[0]?.state;
}

describe("safe read-only assessment of available historical evidence (not a product resolver)", () => {
  it("recognizes only the fixed legacy contract when its values are available", () => {
    expect(state({ name: "Pessoa", rating: 4, comment: "Comentário" })).toBe("legacy_contract_only");
  });
  it.each(["A", 4, 9, 99, "Texto", "4"])("does not infer dynamic semantics or scale from raw value %s", (value) => {
    const response = dynamic(value);
    expect(audit([response]).entries[0]).toEqual({ responseId: response.id, state: "unknown_history", questionIds: [ratingId] });
  });
  it.each([{}, { mode: "dynamic", answers: {} }, { mode: "dynamic", answers: { [ratingId]: " " } }])(
    "distinguishes absent values from unknown history", (answers) => { expect(state(answers)).toBe("no_answer"); },
  );
  it.each([null, [], { mode: "future", answers: {} }, { mode: "dynamic" },
    { mode: "dynamic", answers: { q: true } }, { mode: "dynamic", answers: { q: null } },
    { mode: "dynamic", answers: { q: 4 }, snapshot: { title: "Untrusted client data" } },
    { name: "Pessoa", rating: 9 }, { name: "Pessoa", rating: "4" },
  ])("distinguishes structurally invalid payload from unverifiable dynamic interpretation", (answers) => {
    expect(state(answers)).toBe("invalid_payload");
  });
  it("does not treat a current scale mismatch as historically invalid", () => {
    expect(extractResponseData([dynamic(9)], [questions[0]]).valuesByQuestion.size).toBe(0);
    expect(audit([dynamic(9)]).entries[0].state).toBe("unknown_history");
  });
  it("reports every record, with no values or inferred historical metadata in the diagnostic", () => {
    const response = dynamic("PRIVATE_VALUE");
    const before = JSON.stringify(response);
    const result = audit([response]);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_VALUE");
    expect(JSON.stringify(response)).toBe(before);
    expect(result).toMatchObject({ counts: { unknown_history: 1, legacy_contract_only: 0, no_answer: 0, invalid_payload: 0 } });
  });
  it("does not interpret an empty successful dataset as a source failure", () => {
    expect(audit([])).toEqual({ status: "assessed", entries: [], counts: {
      unknown_history: 0, legacy_contract_only: 0, no_answer: 0, invalid_payload: 0,
    } });
  });
  it.each(["source-error", "incomplete", "duplicate", "foreign"])("fails without partial entries on %s", (scenario) => {
    const response = dynamic(5);
    expect(auditResponseHistory({ surveyId, responses: scenario === "duplicate" ? [response, response]
      : [{ ...response, survey_id: scenario === "foreign" ? "other-survey" : surveyId }],
      complete: scenario !== "incomplete", sourceError: scenario === "source-error" ? "READ_FAILED" : null,
    })).toMatchObject({ status: "error", entries: [] });
  });
});

// Characterization: these tests demonstrate existing risks. They do NOT assert
// that current metadata reconstructs history or that A8 has been fixed in the UI.
describe("evidence of current unversioned interpretation", () => {
  it("a known original fixture illustrates what the persisted response does not retain", () => {
    const original = extractResponseData([dynamic("A")], [choice]);
    expect(original.valuesByQuestion.get(ratingId)).toEqual(["A"]);
    expect(dynamic("A").answers).toEqual({ mode: "dynamic", answers: { [ratingId]: "A" } });
    expect(audit([dynamic("A")]).entries[0].state).toBe("unknown_history");
  });
  it("editing a title relabels old rows and CSV using today's title", () => {
    const original = normalizeResponses([dynamic("A")], [choice]);
    const current = normalizeResponses([dynamic("A")], [{ ...choice, title: "Outro significado" }]);
    expect(original[0].fields[0].label).toBe("Escolha original");
    expect(current[0].fields[0]).toMatchObject({ label: "Outro significado", value: "A" });
    expect(exportNormalizedResponsesToCsv(current)).toContain("Outro significado");
    expect(audit([dynamic("A")]).entries[0].state).toBe("unknown_history");
  });
  it.each([["Renomeada", "B"], ["B"]])("renaming/removing selected option %j drops it from current extraction, not from raw CSV", (...options) => {
    const current = { ...choice, options };
    expect(extractResponseData([dynamic("A")], [current]).totalResponses).toBe(0);
    const normalized = normalizeResponses([dynamic("A")], [current]);
    expect(normalized[0].fields[0].value).toBe("A");
    expect(exportNormalizedResponsesToCsv(normalized)).toContain("A");
    expect(audit([dynamic("A")]).entries[0].state).toBe("unknown_history");
  });
  it.each([["A", "B", "C"], ["B", "A"]])("addition/reordering %j does not change the stored option string or prove the original list", (...options) => {
    expect(extractResponseData([dynamic("A")], [{ ...choice, options }]).valuesByQuestion.get(ratingId)).toEqual(["A"]);
    expect(audit([dynamic("A")]).entries[0].state).toBe("unknown_history");
  });
  it("a type change can reinterpret the same value as a rating", () => {
    expect(extractResponseData([dynamic(5)], [choice]).valuesByQuestion.size).toBe(0);
    expect(extractResponseData([dynamic(5)], [questions[0]]).valuesByQuestion.get(ratingId)).toEqual([5]);
    expect(audit([dynamic(5)]).entries[0].state).toBe("unknown_history");
  });
  it("a scale change can remove a historical value", () => {
    expect(extractResponseData([dynamic(9)], [{ ...questions[0], type: "rating_10" }]).totalResponses).toBe(1);
    expect(extractResponseData([dynamic(9)], [questions[0]]).totalResponses).toBe(0);
    expect(audit([dynamic(9)]).entries[0].state).toBe("unknown_history");
  });
  it("changing the primary question changes an old sample's current satisfaction", () => {
    const rows: SurveyResponse[] = [{ ...dynamic(5), answers: { mode: "dynamic", answers: { [ratingId]: 5, [npsId]: 1 } } }];
    const config = { surveyId, questions: [questions[0], { ...questions[1], type: "rating" as const }], responses: rows, error: null };
    expect(calculateSurveyInsight({ ...config, primaryQuestionId: ratingId }).avgRating).toBe(5);
    expect(calculateSurveyInsight({ ...config, primaryQuestionId: npsId }).avgRating).toBe(1);
    expect(audit(rows).entries[0].state).toBe("unknown_history");
  });
  it("deleted metadata leaves raw data available but extraction and feed omit its interpretation", () => {
    const response = dynamic("Comentário antigo");
    expect(extractResponseData([response], []).totalResponses).toBe(0);
    expect(extractTextFeedback(response, [], "Pesquisa")).toEqual([]);
    expect(normalizeResponses([response], [])[0].fields[0]).toMatchObject({ label: ratingId, value: "Comentário antigo" });
    expect(audit([response]).entries[0].state).toBe("unknown_history");
  });
  it("the feed can reclassify an old text after a current type or identity-title change", () => {
    const response = dynamic("Excelente");
    const text = { ...choice, type: "long_text", title: "Comentário" };
    expect(extractTextFeedback(response, [text], "Pesquisa")).toHaveLength(1);
    expect(extractTextFeedback(response, [{ ...text, title: "E-mail" }], "Pesquisa")).toEqual([]);
    expect(extractTextFeedback(response, [choice], "Pesquisa")).toEqual([]);
    expect(audit([response]).entries[0].state).toBe("unknown_history");
  });
  it("unchanged-looking timestamps and matching metadata are not a historical version reference", () => {
    const current = { ...choice, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
    expect(extractResponseData([dynamic("A")], [current]).totalResponses).toBe(1);
    expect(audit([dynamic("A")]).entries[0].state).toBe("unknown_history");
  });
  it("assesses all 1201 records across short pages without duplicates and excludes other surveys", async () => {
    const owned = makeResponses(1201);
    const fixture = surveyReadFixture([...owned, ...makeResponses(8).map((r) => ({ ...r, survey_id: "foreign" }))], { cap: 73 });
    const loaded = await loadAllSurveyResponses(fixture.client, surveyId);
    const result = auditResponseHistory({ surveyId, responses: loaded.rows, complete: !loaded.error, sourceError: loaded.error });
    expect(result.status).toBe("assessed");
    expect(result.entries).toHaveLength(1201);
    expect(new Set(result.entries.map((entry) => entry.responseId)).size).toBe(1201);
    expect(result).toMatchObject({ counts: { unknown_history: 1201 } });
    expect(fixture.requests).toHaveLength(17);
    expect(fixture.requests.every((u) => u.searchParams.get("survey_id") === `eq.${surveyId}`)).toBe(true);
  });
  it("does not return assessments for a failed intermediate page", async () => {
    const fixture = surveyReadFixture(makeResponses(501), { transform: (_, page, result) => page === 2 ? { ...result, status: 500 } : result });
    const loaded = await loadAllSurveyResponses(fixture.client, surveyId);
    expect(auditResponseHistory({ surveyId, responses: loaded.rows, complete: !loaded.error, sourceError: loaded.error }))
      .toMatchObject({ status: "error", entries: [] });
  });
});
