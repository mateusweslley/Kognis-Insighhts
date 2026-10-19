import { describe, expect, it } from "vitest";

import {
  calculateDashboardKpis,
  compareDashboardKpi,
  type DashboardKpisInput,
} from "@/lib/metrics/dashboard-kpis";
import { computeResponseVolumeOverTime } from "@/lib/metrics/metrics-engine";
import type { SurveyResponse } from "@/types/response";
import type { SurveyQuestion } from "@/types/survey-question";

const reference = "2026-02-01T00:00:00.000Z";
const surveyId = "survey-1";

function ratingQuestion(id = "question-1", type: SurveyQuestion["type"] = "rating"): SurveyQuestion {
  return {
    id,
    survey_id: surveyId,
    type,
    title: "Satisfação",
    description: null,
    required: false,
    position: 1,
    options: [],
    created_at: reference,
    updated_at: reference,
  };
}

function response(id: string, created_at: string, value: unknown = 5): SurveyResponse {
  return {
    id,
    survey_id: surveyId,
    created_at,
    answers: { mode: "dynamic", answers: { "question-1": value as string | number } },
  };
}

function input(overrides: Partial<DashboardKpisInput> = {}): DashboardKpisInput {
  return {
    periodDays: 7,
    asOf: reference,
    surveys: [{ id: surveyId, status: "active" }],
    primaryQuestionIdBySurvey: new Map([[surveyId, "question-1"]]),
    datasets: [{ surveyId, questions: [ratingQuestion()], responses: [] }],
    ...overrides,
  };
}

describe("calculateDashboardKpis period windows", () => {
  it.each([7, 30, 90] as const)(
    "builds contiguous semi-open current and previous %i-day windows",
    (periodDays) => {
      const durationMs = periodDays * 24 * 60 * 60 * 1000;
      const endMs = Date.parse(reference);
      const currentStart = new Date(endMs - durationMs).toISOString();
      const previousStart = new Date(endMs - 2 * durationMs).toISOString();
      const justBeforeEnd = new Date(endMs - 1).toISOString();
      const justBeforeCurrent = new Date(endMs - durationMs - 1).toISOString();
      const rows = [
        response("previous-start", previousStart, 1),
        response("previous-last", justBeforeCurrent, 2),
        response("current-start", currentStart, 4),
        response("current-last", justBeforeEnd, 5),
        response("current-end-excluded", reference, 5),
      ];

      const result = calculateDashboardKpis(input({ periodDays, datasets: [
        { surveyId, questions: [ratingQuestion()], responses: rows },
      ] }));

      expect(result.current.start).toBe(currentStart);
      expect(result.current.end).toBe(reference);
      expect(result.previous.start).toBe(previousStart);
      expect(result.previous.end).toBe(currentStart);
      expect(result.current.responsesReceived).toEqual({ status: "value", value: 2 });
      expect(result.previous.responsesReceived).toEqual({ status: "value", value: 2 });
      expect(result.current.averageRating).toEqual({ status: "value", value: 4.5 });
      expect(result.previous.averageRating).toEqual({ status: "value", value: 1.5 });
    },
  );

  it("includes the start, excludes the end, and groups input timestamps in UTC", () => {
    const result = calculateDashboardKpis(input({
      asOf: "2026-01-08T00:00:00.000Z",
      datasets: [{
        surveyId,
        questions: [ratingQuestion()],
        responses: [
          response("at-start", "2026-01-01T00:00:00.000Z", 4),
          response("one-ms-before-end", "2026-01-07T23:59:59.999Z", 5),
          response("at-end", "2026-01-08T00:00:00.000Z", 1),
        ],
      }],
    }));

    expect(result.current.responsesReceived).toEqual({ status: "value", value: 2 });
    expect(result.current.averageRating).toEqual({ status: "value", value: 4.5 });
  });

  it("keeps daily buckets on UTC date boundaries", () => {
    expect(computeResponseVolumeOverTime([
      "2026-01-08T00:30:00+02:00",
      "2026-01-07T23:30:00-02:00",
    ], "day")).toEqual([
      { period: "2026-01-07", value: 1 },
      { period: "2026-01-08", value: 1 },
    ]);
  });
});

describe("calculateDashboardKpis response and rating rules", () => {
  it("counts valid distinct response IDs but does not deduplicate by content", () => {
    const valid = response("same-id", "2026-01-31T12:00:00.000Z", 4);
    const duplicateId = { ...valid };
    const sameContentDifferentId = response("different-id", valid.created_at, 4);
    const invalidOnly = response("invalid", valid.created_at, 8);

    const result = calculateDashboardKpis(input({ datasets: [{
      surveyId,
      questions: [ratingQuestion()],
      responses: [valid, duplicateId, sameContentDifferentId, invalidOnly],
    }] }));

    expect(result.current.responsesReceived).toEqual({ status: "value", value: 2 });
    expect(result.current.averageRating).toEqual({ status: "value", value: 4 });
  });

  it("combines only explicitly configured rating questions from eligible surveys", () => {
    const survey2 = "survey-2";
    const question2 = { ...ratingQuestion("question-2"), survey_id: survey2 };
    const result = calculateDashboardKpis(input({
      surveys: [
        { id: surveyId, status: "active" },
        { id: survey2, status: "draft" },
      ],
      primaryQuestionIdBySurvey: new Map([[surveyId, "question-1"], [survey2, "question-2"]]),
      datasets: [
        { surveyId, questions: [ratingQuestion(), { ...ratingQuestion("other-question", "rating_10") }], responses: [response("r1", "2026-01-31T12:00:00Z", 5)] },
        {
          surveyId: survey2,
          questions: [question2],
          responses: [{
            id: "r2",
            survey_id: survey2,
            created_at: "2026-01-31T12:00:00Z",
            answers: { mode: "dynamic", answers: { "question-2": 3 } },
          }],
        },
      ],
    }));

    expect(result.current.averageRating).toEqual({ status: "value", value: 4 });
    expect(result.current.positivePercent).toEqual({ status: "value", value: 50 });
    expect(result.activeSurveys).toEqual({ status: "value", value: 1 });
  });

  it("returns no compatible data when the primary question is absent or incompatible", () => {
    const absent = calculateDashboardKpis(input({ primaryQuestionIdBySurvey: new Map() }));
    const wrongScale = calculateDashboardKpis(input({
      primaryQuestionIdBySurvey: new Map([[surveyId, "question-1"]]),
      datasets: [{ surveyId, questions: [ratingQuestion("question-1", "rating_10")], responses: [] }],
    }));

    expect(absent.current.averageRating).toEqual({
      status: "no_data",
      reason: "no_primary_question_configured",
    });
    expect(wrongScale.current.positivePercent).toEqual({
      status: "no_data",
      reason: "no_compatible_primary_question",
    });
  });

  it("rejects a configured question that does not belong to the dataset survey", () => {
    const otherSurveyQuestion = { ...ratingQuestion("question-1"), survey_id: "other-survey" };
    const result = calculateDashboardKpis(input({
      datasets: [{
        surveyId,
        questions: [otherSurveyQuestion],
        responses: [response("r1", "2026-01-31T12:00:00Z", 5)],
      }],
    }));

    expect(result.current.responsesReceived).toEqual({ status: "value", value: 1 });
    expect(result.current.averageRating).toEqual({
      status: "no_data",
      reason: "no_compatible_primary_question",
    });
  });

  it("reflects a changed primary question by recalculating historical values", () => {
    const secondQuestion = { ...ratingQuestion("question-2"), position: 2 };
    const dataset = {
      surveyId,
      questions: [ratingQuestion(), secondQuestion],
      responses: [{
        id: "r1",
        survey_id: surveyId,
        created_at: "2026-01-31T12:00:00Z",
        answers: { mode: "dynamic" as const, answers: { "question-1": 5, "question-2": 2 } },
      }],
    };
    const firstSelection = calculateDashboardKpis(input({ datasets: [dataset] }));
    const changedSelection = calculateDashboardKpis(input({
      primaryQuestionIdBySurvey: new Map([[surveyId, "question-2"]]),
      datasets: [dataset],
    }));

    expect(firstSelection.current.averageRating).toEqual({ status: "value", value: 5 });
    expect(changedSelection.current.averageRating).toEqual({ status: "value", value: 2 });
  });

  it("does not treat a generic number field or legacy rating as a primary rating", () => {
    const numberQuestion = ratingQuestion("question-1", "number");
    const numberInput = input({ datasets: [{
      surveyId,
      questions: [numberQuestion],
      responses: [response("number", "2026-01-31T12:00:00Z", 5)],
    }] });
    const legacy = {
      id: "legacy",
      survey_id: surveyId,
      created_at: "2026-01-31T12:00:00Z",
      answers: { name: "Pessoa", rating: 5 },
    } as SurveyResponse;
    const legacyInput = input({ datasets: [{ surveyId, questions: [ratingQuestion()], responses: [legacy] }] });

    expect(calculateDashboardKpis(numberInput).current.averageRating.status).toBe("no_data");
    expect(calculateDashboardKpis(legacyInput).current.responsesReceived).toEqual({ status: "value", value: 1 });
    expect(calculateDashboardKpis(legacyInput).current.averageRating).toEqual({
      status: "no_data",
      reason: "no_valid_ratings",
    });
  });

  it("keeps KPI calculations available below 30 and marks health sample insufficient", () => {
    const responses = Array.from({ length: 29 }, (_, index) =>
      response(`r-${index}`, "2026-01-31T12:00:00Z", index % 2 === 0 ? 5 : 3),
    );
    const result = calculateDashboardKpis(input({ datasets: [{ surveyId, questions: [ratingQuestion()], responses }] }));

    expect(result.current.averageRating.status).toBe("value");
    expect(result.current.positivePercent.status).toBe("value");
    expect(result.current.validRatingCount).toBe(29);
    expect(result.current.health).toEqual({
      status: "insufficient_sample",
      label: "Aguardando mais respostas",
      sampleSize: 29,
    });
  });

  it("classifies health at 30 valid ratings", () => {
    const responses = Array.from({ length: 30 }, (_, index) =>
      response(`r-${index}`, "2026-01-31T12:00:00Z", 5),
    );
    const result = calculateDashboardKpis(input({ datasets: [{ surveyId, questions: [ratingQuestion()], responses }] }));

    expect(result.current.validRatingCount).toBe(30);
    expect(result.current.health).toEqual({ status: "classified", label: "Excelente", sampleSize: 30 });
  });
});

describe("dashboard KPI comparisons and source states", () => {
  it("returns delta without percentage when the previous value is zero", () => {
    expect(compareDashboardKpi({ status: "value", value: 8 }, { status: "value", value: 0 })).toEqual({
      status: "value",
      deltaAbsolute: 8,
      deltaPercent: null,
    });
    expect(compareDashboardKpi({ status: "value", value: 0 }, { status: "value", value: 0 })).toEqual({
      status: "value",
      deltaAbsolute: 0,
      deltaPercent: null,
    });
  });

  it("computes percent as percent points and does not compare unavailable values", () => {
    expect(compareDashboardKpi({ status: "value", value: 8 }, { status: "value", value: 5 })).toEqual({
      status: "value",
      deltaAbsolute: 3,
      deltaPercent: 60,
    });
    expect(compareDashboardKpi(
      { status: "no_data", reason: "no_valid_ratings" },
      { status: "value", value: 5 },
    )).toEqual({ status: "no_data" });
  });

  it("keeps source errors distinct from real zero and still reports active surveys independently", () => {
    const result = calculateDashboardKpis(input({ responsesError: true }));
    const questionsError = calculateDashboardKpis(input({ questionsError: true }));
    const surveysError = calculateDashboardKpis(input({ surveysError: true }));
    const empty = calculateDashboardKpis(input());

    expect(result.current.responsesReceived).toEqual({ status: "error" });
    expect(result.comparisons.responsesReceived).toEqual({ status: "error" });
    expect(result.activeSurveys).toEqual({ status: "value", value: 1 });
    expect(questionsError.current.averageRating).toEqual({ status: "error" });
    expect(surveysError.activeSurveys).toEqual({ status: "error" });
    expect(surveysError.current.responsesReceived).toEqual({ status: "error" });
    expect(empty.current.responsesReceived).toEqual({ status: "value", value: 0 });
  });

  it("keeps response volume while primary question configuration fails to load", () => {
    const result = calculateDashboardKpis(input({
      datasets: [{ surveyId, questions: [ratingQuestion()], responses: [response("r1", "2026-01-31T12:00:00Z")] }],
      primaryQuestionConfigError: true,
    }));

    expect(result.current.responsesReceived).toEqual({ status: "value", value: 1 });
    expect(result.current.averageRating).toEqual({ status: "error" });
    expect(result.current.positivePercent).toEqual({ status: "error" });
    expect(result.activeSurveys).toEqual({ status: "value", value: 1 });
  });
});
