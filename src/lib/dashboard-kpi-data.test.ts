import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: createClientMock }));

import { loadDashboardKpiSourceData } from "@/lib/dashboard-kpi-data";
import type { Survey } from "@/types/survey";

const asOf = new Date("2026-10-18T12:00:00.000Z");
const survey: Survey = {
  id: "survey-owned",
  company_id: "company-owned",
  title: "Pesquisa própria",
  description: null,
  status: "active",
  primary_question_id: "question-owned",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function makeQuery(result: {
  data: unknown[] | null;
  error: { message: string } | null;
  count: number | null;
}) {
  return {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(result),
  };
}

function question(id: string, surveyId = survey.id) {
  return {
    id,
    survey_id: surveyId,
    type: "rating",
    title: "Avalie",
    description: null,
    required: true,
    position: 1,
    options: [],
    created_at: asOf.toISOString(),
    updated_at: asOf.toISOString(),
  };
}

function response(id: string, surveyId = survey.id) {
  return {
    id,
    survey_id: surveyId,
    answers: { mode: "dynamic", answers: { "question-owned": 5 } },
    created_at: "2026-10-17T12:00:00.000Z",
  };
}

function setup(questionQuery: ReturnType<typeof makeQuery>, responseQuery: ReturnType<typeof makeQuery>) {
  const from = vi.fn((table: string) => table === "survey_questions" ? questionQuery : responseQuery);
  createClientMock.mockReturnValue({ from });
  return { from, questionQuery, responseQuery };
}

describe("loadDashboardKpiSourceData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads only the supplied company's survey IDs and limits responses to the maximum KPI window", async () => {
    const q = makeQuery({ data: [question("question-owned"), question("question-other", "survey-other")], error: null, count: 2 });
    const r = makeQuery({ data: [response("response-owned"), response("response-other", "survey-other")], error: null, count: 2 });
    const { from, questionQuery, responseQuery } = setup(q, r);

    const result = await loadDashboardKpiSourceData([survey], asOf);

    expect(from).toHaveBeenCalledWith("survey_questions");
    expect(from).toHaveBeenCalledWith("responses");
    expect(questionQuery.in).toHaveBeenCalledWith("survey_id", [survey.id]);
    expect(responseQuery.in).toHaveBeenCalledWith("survey_id", [survey.id]);
    expect(responseQuery.gte).toHaveBeenCalledWith("created_at", "2026-04-21T12:00:00.000Z");
    expect(responseQuery.lt).toHaveBeenCalledWith("created_at", asOf.toISOString());
    expect(result.datasets).toHaveLength(1);
    expect(result.datasets[0].questions.map(({ id }) => id)).toEqual(["question-owned"]);
    expect(result.datasets[0].responses.map(({ id }) => id)).toEqual(["response-owned"]);
    expect(result.primaryQuestionIdBySurvey.get(survey.id)).toBe("question-owned");
    expect(result.primaryQuestionConfigError).toBe(false);
  });

  it("continues paging until exact counts confirm that all rows were read", async () => {
    const questionQuery = makeQuery({ data: [question("question-owned")], error: null, count: 1 });
    const responseRows = Array.from({ length: 600 }, (_, index) => response(`response-${index}`));
    const responseQuery = makeQuery({ data: responseRows.slice(0, 500), error: null, count: 600 });
    responseQuery.range
      .mockResolvedValueOnce({ data: responseRows.slice(0, 500), error: null, count: 600 })
      .mockResolvedValueOnce({ data: responseRows.slice(500), error: null, count: 600 });
    setup(questionQuery, responseQuery);

    const result = await loadDashboardKpiSourceData([survey], asOf);

    expect(responseQuery.range).toHaveBeenNthCalledWith(1, 0, 499);
    expect(responseQuery.range).toHaveBeenNthCalledWith(2, 500, 999);
    expect(result.datasets[0].responses).toHaveLength(600);
    expect(result.responsesError).toBe(false);
  });

  it("reports configuration, question, and response source failures separately", async () => {
    const missingColumnSurvey = { ...survey } as Survey;
    delete (missingColumnSurvey as Partial<Survey>).primary_question_id;
    const q = makeQuery({ data: null, error: { message: "questions unavailable" }, count: null });
    const r = makeQuery({ data: null, error: { message: "responses unavailable" }, count: null });
    setup(q, r);

    const result = await loadDashboardKpiSourceData([missingColumnSurvey], asOf);

    expect(result.primaryQuestionConfigError).toBe(true);
    expect(result.questionsError).toBe(true);
    expect(result.responsesError).toBe(true);
  });

  it("does not query Supabase when there are no surveys", async () => {
    const result = await loadDashboardKpiSourceData([], asOf);

    expect(createClientMock).not.toHaveBeenCalled();
    expect(result.datasets).toEqual([]);
    expect(result.responsesError).toBe(false);
    expect(result.questionsError).toBe(false);
  });
});
