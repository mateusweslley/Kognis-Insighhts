import { describe, expect, it } from "vitest";
import { exportNormalizedResponsesToCsv, type NormalizedResponse } from "@/lib/response-normalizer";
import { exportResponsesToCsv } from "@/lib/response-utils";
import type { SurveyResponseWithSurvey } from "@/types/response";

describe("CSV exports", () => {
  it.each(["=1+1", "+1+1", "-cmd", "@SUM(A1)", "  =1+1", "\t=1+1", "\u0001=1+1"])(
    "neutralizes formula-like text %j in the legacy/dynamic export",
    (comment) => {
      expect(exportResponsesToCsv([legacyResponse(comment)])).toContain(`"'${comment}"`);
    },
  );

  it("neutralizes legacy comments, dynamic answers and dynamic question titles", () => {
    const legacy = exportResponsesToCsv([legacyResponse("=legacy")]);
    expect(legacy).toContain("'=legacy");
    const dynamic = exportResponsesToCsv([dynamicResponse("=answer", "@Question")]);
    expect(dynamic).toContain("'@Question (question-1)");
    expect(dynamic).toContain("'=answer");
  });

  it("escapes quotes, commas and newlines in both serializers", () => {
    const text = 'line, one\nline "two"';
    expect(exportResponsesToCsv([legacyResponse(text)])).toContain('"line, one\nline ""two"""');
    expect(exportNormalizedResponsesToCsv([normalized(text)])).toContain('"line, one\nline ""two"""');
  });

  it("preserves numeric values including negatives, zero, ratings and quantities", () => {
    const legacyCsv = exportResponsesToCsv([legacyResponse("safe", -3)]);
    expect(legacyCsv).toContain('"-3"');
    const normalizedCsv = exportNormalizedResponsesToCsv([normalized(0), normalized(5), normalized(-2)]);
    expect(normalizedCsv).toContain('"0"');
    expect(normalizedCsv).toContain('"5"');
    expect(normalizedCsv).toContain('"-2"');
  });

  it("keeps numeric-looking text and neutralizes formula-like text in normalized fields", () => {
    expect(exportNormalizedResponsesToCsv([normalized("4")])).toContain('"4"');
    expect(exportNormalizedResponsesToCsv([normalized("=4")])).toContain('"\'=4"');
  });
});

function legacyResponse(comment: string, rating = 4): SurveyResponseWithSurvey {
  return {
    id: "response-1", survey_id: "survey-1", survey_title: "Survey", created_at: "2026-01-01T12:00:00Z",
    answers: { name: "Respondent", rating, comment },
  };
}

function dynamicResponse(answer: string, title: string): SurveyResponseWithSurvey {
  return {
    id: "response-2", survey_id: "survey-1", survey_title: "Survey", created_at: "2026-01-01T12:00:00Z",
    answers: { mode: "dynamic", answers: { "question-1": answer } }, question_titles: { "question-1": title },
  };
}

function normalized(value: string | number): NormalizedResponse {
  return {
    id: "response-1", surveyId: "survey-1", createdAt: "2026-01-01T12:00:00Z", respondentLabel: "R1", summary: "",
    fields: [{ label: "=Header", value, type: typeof value === "number" ? "number" : "short_text", position: 1 }],
  };
}
