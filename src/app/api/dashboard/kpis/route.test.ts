import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadSourceMock } = vi.hoisted(() => ({ loadSourceMock: vi.fn() }));
vi.mock("@/lib/dashboard-kpi-source.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dashboard-kpi-source.server")>();
  return { ...actual, loadCurrentDashboardKpiSourceData: loadSourceMock };
});

import { GET } from "@/app/api/dashboard/kpis/route";
import type { DashboardKpiSourceData } from "@/lib/dashboard-kpi-source.server";

const ratingQuestion = {
  id: "question-1",
  survey_id: "survey-1",
  type: "rating" as const,
  title: "Avalie",
  description: null,
  required: true,
  position: 1,
  options: [],
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
};

function source(primaryQuestionId: string | null): DashboardKpiSourceData {
  return {
    asOf: "2026-10-18T12:00:00.000Z",
    company: { status: "success", data: { id: "company-1" } },
    surveys: { status: "success", data: [{ id: "survey-1", status: "active" }] },
    questions: { status: "success", data: [ratingQuestion] },
    responses: {
      status: "success",
      data: [
        {
          id: "response-current",
          survey_id: "survey-1",
          created_at: "2026-10-17T12:00:00.000Z",
          answers: primaryQuestionId
            ? { mode: "dynamic", answers: { [primaryQuestionId]: 5 } }
            : { name: "Pessoa", rating: 5 },
        },
      ],
    },
    primaryQuestionConfiguration: { status: "success", data: new Map([["survey-1", primaryQuestionId]]) },
  };
}

describe("GET /api/dashboard/kpis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads source data once, returns all four aggregated KPIs for each period, and exposes no response rows", async () => {
    loadSourceMock.mockResolvedValue(source("question-1"));

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(loadSourceMock).toHaveBeenCalledTimes(1);
    expect(payload.periods[7].current.responsesReceived).toEqual({ status: "value", value: 1 });
    expect(payload.periods[7].current.averageRating).toEqual({ status: "value", value: 5 });
    expect(payload.periods[7].current.positivePercent).toEqual({ status: "value", value: 100 });
    expect(payload.periods[7].activeSurveys).toEqual({ status: "value", value: 1 });
    expect(payload.periods[7].comparisons.responsesReceived).toEqual({
      status: "value", deltaAbsolute: 1, deltaPercent: null,
    });
    expect(payload.periods[7].current.start).toBe("2026-10-11T12:00:00.000Z");
    expect(payload.periods[30].current.start).toBe("2026-09-18T12:00:00.000Z");
    expect(payload.periods[90].current.start).toBe("2026-07-20T12:00:00.000Z");
    expect(JSON.stringify(payload)).not.toContain("answers");
  });

  it("keeps response volume and active surveys when no primary question is configured", async () => {
    loadSourceMock.mockResolvedValue(source(null));

    const response = await GET();
    const payload = await response.json();

    expect(payload.periods[30].current.responsesReceived).toEqual({ status: "value", value: 1 });
    expect(payload.periods[30].current.averageRating).toEqual({
      status: "no_data", reason: "no_primary_question_configured",
    });
    expect(payload.periods[30].activeSurveys).toEqual({ status: "value", value: 1 });
  });

  it("marks configured-question failures explicitly without turning them into an absent setup", async () => {
    const configured = source("question-1");
    configured.primaryQuestionConfiguration = { status: "error", message: "Migration missing" };
    loadSourceMock.mockResolvedValue(configured);

    const response = await GET();
    const payload = await response.json();

    expect(payload.primaryQuestionConfigurationUnavailable).toBe(true);
    expect(payload.periods[7].current.averageRating).toEqual({ status: "error" });
    expect(payload.periods[7].current.responsesReceived).toEqual({ status: "value", value: 1 });
    expect(payload.periods[7].activeSurveys).toEqual({ status: "value", value: 1 });
  });

  it("keeps response-source failures as errors instead of reporting zero", async () => {
    const failed = source("question-1");
    failed.responses = { status: "error", message: "Responses unavailable" };
    loadSourceMock.mockResolvedValue(failed);

    const response = await GET();
    const payload = await response.json();

    expect(payload.periods[30].current.responsesReceived).toEqual({ status: "error" });
    expect(payload.periods[30].current.averageRating).toEqual({ status: "error" });
    expect(payload.periods[30].activeSurveys).toEqual({ status: "value", value: 1 });
  });
});
