import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireCurrentCompanyMock, createClientMock } = vi.hoisted(() => ({
  requireCurrentCompanyMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/company", () => ({ requireCurrentCompany: requireCurrentCompanyMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import {
  loadCurrentDashboardKpiSourceData,
  toDashboardKpisInput,
} from "@/lib/dashboard-kpi-source.server";
import { calculateDashboardKpis } from "@/lib/metrics/dashboard-kpis";
import type { Survey } from "@/types/survey";

const asOf = new Date("2026-10-18T12:00:00.000Z");
const survey = {
  id: "survey-owned",
  company_id: "company-owned",
  title: "Pesquisa própria",
  description: null,
  status: "active",
  primary_question_id: "question-owned",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
} as Survey;

function question(id: string, surveyId = survey.id, type = "rating") {
  return {
    id,
    survey_id: surveyId,
    type,
    title: "Avalie",
    description: null,
    required: true,
    position: 1,
    options: [],
    created_at: asOf.toISOString(),
    updated_at: asOf.toISOString(),
  };
}

function response(id: string, createdAt: string, answers: unknown = {
  mode: "dynamic",
  answers: { "question-owned": 5 },
}) {
  return { id, survey_id: survey.id, answers, created_at: createdAt };
}

function makeSurveys(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-0000-0000-${index.toString(16).padStart(12, "0")}`,
    status: "active",
    primary_question_id: null,
  }));
}

function makeQuestions(count: number) {
  return Array.from({ length: count }, (_, index) => question(
    `00000000-0000-0000-0000-${index.toString(16).padStart(12, "0")}`,
  ));
}

type PageCursor = string | { created_at: string; id: string } | null;
type PageReader = (cursor: PageCursor, pageSize: number, selectedColumns?: string) => {
  data: unknown[] | null;
  error: { message: string; code?: string } | null;
  count: number | null;
};

type MockQuery = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

function queryResult(rows: unknown[], options: {
  error?: { message: string } | null;
  count?: number | null;
  onPage?: PageReader;
} = {}) {
  let cursor: PageCursor = null;
  let selectedColumns: string | undefined;
  const query = {} as MockQuery;
  Object.assign(query, {
    select: vi.fn((columns: string) => { selectedColumns = columns; return query; }),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    gt: vi.fn((_column: string, value: string) => { cursor = value; return query; }),
    or: vi.fn((filter: string) => {
      const createdAt = filter.match(/created_at\.gt\.([^,]+)/)?.[1];
      const id = filter.match(/id\.gt\.([a-z0-9-]+)/i)?.[1];
      if (createdAt && id) cursor = { created_at: createdAt, id };
      return query;
    }),
    limit: vi.fn((pageSize: number) => {
      if (options.onPage) return Promise.resolve(options.onPage(cursor, pageSize, selectedColumns));
      const remainingRows = rows.filter((row) => {
        if (cursor === null) return true;
        const item = row as { id: string; created_at?: string };
        if (typeof cursor === "string") return item.id > cursor;
        return item.created_at! > cursor.created_at
          || (item.created_at === cursor.created_at && item.id > cursor.id);
      });
      return Promise.resolve({
        data: remainingRows.slice(0, pageSize),
        error: options.error ?? null,
        count: options.count ?? remainingRows.length,
      });
    }),
  });
  return query;
}

function setup(questionRows: unknown[], responseRows: unknown[], options: {
  surveyPage?: PageReader;
  questionPage?: PageReader;
  responsePage?: PageReader;
} = {}, surveyRows: unknown[] = [survey]) {
  const surveysQuery = queryResult(surveyRows, { onPage: options.surveyPage });
  const questionQuery = queryResult(questionRows, { onPage: options.questionPage });
  const responseQuery = queryResult(responseRows, { onPage: options.responsePage });
  const from = vi.fn((table: string) => table === "surveys"
    ? surveysQuery
    : table === "survey_questions" ? questionQuery : responseQuery);
  createClientMock.mockReturnValue({ from });
  requireCurrentCompanyMock.mockResolvedValue({ id: "company-owned" });
  return { from, surveysQuery, questionQuery, responseQuery };
}

describe("server dashboard KPI source", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns successful empty sources distinctly from query errors", async () => {
    setup([], []);
    const empty = await loadCurrentDashboardKpiSourceData(asOf);
    expect(empty.questions).toEqual({ status: "success", data: [] });
    expect(empty.responses).toEqual({ status: "success", data: [] });

    setup([question("q1")], [], {
      responsePage: () => ({ data: null, error: { message: "response read failed" }, count: null }),
    });
    const failed = await loadCurrentDashboardKpiSourceData(asOf);
    expect(failed.responses).toMatchObject({ status: "error", message: expect.stringContaining("response read failed") });
  });

  it("does not query questions or responses when the authenticated company has no surveys", async () => {
    const { from, surveysQuery } = setup([], [], {}, []);
    const result = await loadCurrentDashboardKpiSourceData(asOf);

    expect(result.surveys).toEqual({ status: "success", data: [] });
    expect(result.questions).toEqual({ status: "success", data: [] });
    expect(result.responses).toEqual({ status: "success", data: [] });
    expect(from).toHaveBeenCalledTimes(1);
    expect(surveysQuery.limit).toHaveBeenCalledTimes(1);
    expect(result.primaryQuestionConfiguration.status).toBe("success");
  });

  it("reads a short survey result as one complete page", async () => {
    const surveyRows = makeSurveys(3);
    const { surveysQuery } = setup([], [], {}, surveyRows);
    const result = await loadCurrentDashboardKpiSourceData(asOf);

    expect(surveysQuery.select).toHaveBeenCalledWith("id,status,primary_question_id", { count: "exact" });
    expect(surveysQuery.eq).toHaveBeenCalledWith("company_id", "company-owned");
    expect(surveysQuery.order).toHaveBeenCalledWith("id", { ascending: true });
    expect(surveysQuery.limit).toHaveBeenCalledTimes(1);
    expect(result.surveys).toMatchObject({ status: "success", data: surveyRows });
  });

  it("reads zero questions as a successful empty result", async () => {
    const { questionQuery } = setup([], []);
    const result = await loadCurrentDashboardKpiSourceData(asOf);

    expect(questionQuery.limit).toHaveBeenCalledTimes(1);
    expect(result.questions).toEqual({ status: "success", data: [] });
  });

  it("reads fewer than one question page without requesting another page", async () => {
    const questionRows = makeQuestions(3);
    const { questionQuery } = setup(questionRows, []);
    const result = await loadCurrentDashboardKpiSourceData(asOf);

    expect(questionQuery.order).toHaveBeenCalledWith("id", { ascending: true });
    expect(questionQuery.limit).toHaveBeenCalledTimes(1);
    expect(questionQuery.gt).not.toHaveBeenCalled();
    expect(result.questions.status).toBe("success");
    if (result.questions.status === "success") {
      expect(result.questions.data.map(({ id }) => id)).toEqual(questionRows.map(({ id }) => id));
    }
  });

  it("accepts exactly one complete question page without an extra request", async () => {
    const questionRows = makeQuestions(500);
    const { questionQuery } = setup(questionRows, []);
    const result = await loadCurrentDashboardKpiSourceData(asOf);

    expect(questionQuery.limit).toHaveBeenCalledTimes(1);
    expect(questionQuery.gt).not.toHaveBeenCalled();
    expect(result.questions.status).toBe("success");
    if (result.questions.status === "success") expect(result.questions.data).toHaveLength(500);
  });

  it("uses the last question ID as cursor and fetches a partial final page without omissions or duplicates", async () => {
    const questionRows = makeQuestions(501);
    const { questionQuery } = setup(questionRows, []);
    const result = await loadCurrentDashboardKpiSourceData(asOf);

    expect(questionQuery.limit).toHaveBeenCalledTimes(2);
    expect(questionQuery.gt).toHaveBeenCalledWith("id", questionRows[499].id);
    expect(result.questions.status).toBe("success");
    if (result.questions.status === "success") {
      const ids = result.questions.data.map(({ id }) => id);
      expect(ids).toEqual(questionRows.map(({ id }) => id));
      expect(new Set(ids).size).toBe(questionRows.length);
    }
  });

  it("stops after the last question page when the exact count is a page multiple", async () => {
    const questionRows = makeQuestions(1000);
    const { questionQuery } = setup(questionRows, []);
    const result = await loadCurrentDashboardKpiSourceData(asOf);

    expect(questionQuery.limit).toHaveBeenCalledTimes(2);
    expect(questionQuery.gt).toHaveBeenCalledTimes(1);
    expect(questionQuery.gt).toHaveBeenCalledWith("id", questionRows[499].id);
    expect(result.questions.status).toBe("success");
    if (result.questions.status === "success") {
      const ids = result.questions.data.map(({ id }) => id);
      expect(ids).toEqual(questionRows.map(({ id }) => id));
      expect(new Set(ids).size).toBe(1000);
    }
  });

  it("rejects an intermediate question-page failure without exposing partial questions or valid KPIs", async () => {
    const questionRows = makeQuestions(501);
    const { questionQuery } = setup(questionRows, [response("r1", "2026-10-17T12:00:00.000Z")], {
      questionPage: (cursor, pageSize) => cursor === null
        ? { data: questionRows.slice(0, pageSize), error: null, count: questionRows.length }
        : { data: null, error: { message: "question page two failed" }, count: null },
    });
    const result = await loadCurrentDashboardKpiSourceData(asOf);

    expect(questionQuery.limit).toHaveBeenCalledTimes(2);
    expect(result.questions).toMatchObject({ status: "error", message: expect.stringContaining("question page two failed") });
    const kpis = calculateDashboardKpis(toDashboardKpisInput(result, 30));
    expect(kpis.current.responsesReceived).toEqual({ status: "error" });
    expect(kpis.current.averageRating).toEqual({ status: "error" });
  });

  it("rejects a changed exact question count between pages", async () => {
    const questionRows = makeQuestions(501);
    const { questionQuery } = setup(questionRows, [], {
      questionPage: (cursor, pageSize) => cursor === null
        ? { data: questionRows.slice(0, pageSize), error: null, count: questionRows.length }
        : { data: questionRows.slice(500), error: null, count: 2 },
    });
    const result = await loadCurrentDashboardKpiSourceData(asOf);

    expect(questionQuery.limit).toHaveBeenCalledTimes(2);
    expect(result.questions).toMatchObject({ status: "error", message: expect.stringContaining("mudou") });
  });

  it("accepts exactly one full survey page without making an extra request", async () => {
    const surveyRows = makeSurveys(500);
    const { surveysQuery } = setup([], [], {}, surveyRows);
    const result = await loadCurrentDashboardKpiSourceData(asOf);

    expect(surveysQuery.limit).toHaveBeenCalledTimes(1);
    expect(surveysQuery.gt).not.toHaveBeenCalled();
    expect(result.surveys.status).toBe("success");
    if (result.surveys.status === "success") expect(result.surveys.data).toHaveLength(500);
  });

  it("fetches a partial last survey page with no omissions or duplicate IDs", async () => {
    const surveyRows = makeSurveys(501);
    const { surveysQuery } = setup([], [], {}, surveyRows);
    const result = await loadCurrentDashboardKpiSourceData(asOf);

    if (result.surveys.status === "error") throw new Error(result.surveys.message);
    expect(surveysQuery.limit).toHaveBeenCalledTimes(2);
    expect(surveysQuery.gt).toHaveBeenCalledWith("id", surveyRows[499].id);
    expect(result.surveys.status).toBe("success");
    if (result.surveys.status === "success") {
      expect(result.surveys.data.map(({ id }) => id)).toEqual(surveyRows.map(({ id }) => id));
      expect(new Set(result.surveys.data.map(({ id }) => id)).size).toBe(501);
    }
  });

  it("stops after the final page when the survey count is an exact page multiple", async () => {
    const surveyRows = makeSurveys(1000);
    const { surveysQuery } = setup([], [], {}, surveyRows);
    const result = await loadCurrentDashboardKpiSourceData(asOf);

    if (result.surveys.status === "error") throw new Error(result.surveys.message);
    expect(surveysQuery.limit).toHaveBeenCalledTimes(2);
    expect(surveysQuery.gt).toHaveBeenCalledWith("id", surveyRows[499].id);
    expect(surveysQuery.gt).toHaveBeenCalledTimes(1);
    expect(result.surveys.status).toBe("success");
    if (result.surveys.status === "success") {
      expect(result.surveys.data).toHaveLength(1000);
      expect(new Set(result.surveys.data.map(({ id }) => id)).size).toBe(1000);
    }
  });

  it("rejects an intermediate survey-page failure and never calculates KPIs from partial surveys", async () => {
    const surveyRows = makeSurveys(501);
    const { from, surveysQuery } = setup([], [], {
      surveyPage: (cursor, pageSize) => cursor === null
        ? { data: surveyRows.slice(0, pageSize), error: null, count: 501 }
        : { data: null, error: { message: "survey page two failed" }, count: null },
    }, surveyRows);
    const result = await loadCurrentDashboardKpiSourceData(asOf);

    expect(surveysQuery.limit).toHaveBeenCalledTimes(2);
    expect(result.surveys).toMatchObject({ status: "error", message: expect.stringContaining("survey page two failed") });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["surveys", "surveys"]);
    const kpis = calculateDashboardKpis(toDashboardKpisInput(result, 30));
    expect(kpis.current.responsesReceived).toEqual({ status: "error" });
    expect(kpis.activeSurveys).toEqual({ status: "error" });
  });

  it("rejects a changed exact count between survey pages", async () => {
    const surveyRows = makeSurveys(501);
    const { surveysQuery } = setup([], [], {
      surveyPage: (cursor, pageSize) => cursor === null
        ? { data: surveyRows.slice(0, pageSize), error: null, count: 501 }
        : { data: surveyRows.slice(500), error: null, count: 2 },
    }, surveyRows);
    const result = await loadCurrentDashboardKpiSourceData(asOf);

    expect(result.surveys).toMatchObject({ status: "error", message: expect.stringContaining("mudou") });
    expect(surveysQuery.limit).toHaveBeenCalledTimes(2);
  });

  it("scopes reads to the authenticated company's surveys and the exact 180-day half-open window", async () => {
    const { from, surveysQuery, questionQuery, responseQuery } = setup([question("question-owned")], []);
    const result = await loadCurrentDashboardKpiSourceData(asOf);

    expect(surveysQuery.eq).toHaveBeenCalledWith("company_id", "company-owned");
    expect(questionQuery.in).toHaveBeenCalledWith("survey_id", [survey.id]);
    expect(from).toHaveBeenCalledWith("survey_questions");
    expect(from).toHaveBeenCalledWith("responses");
    expect(responseQuery.in).toHaveBeenCalledWith("survey_id", [survey.id]);
    expect(responseQuery.gte).toHaveBeenCalledWith("created_at", "2026-04-21T12:00:00.000Z");
    expect(responseQuery.lt).toHaveBeenCalledWith("created_at", asOf.toISOString());
    expect(result.asOf).toBe(asOf.toISOString());
  });

  it("reads every page and orders equal timestamps by unique ID", async () => {
    const responseRows = Array.from({ length: 501 }, (_, index) =>
      response(`response-${String(index).padStart(3, "0")}`, "2026-10-17T12:00:00.000Z"));
    const { responseQuery } = setup([question("question-owned")], responseRows);
    const result = await loadCurrentDashboardKpiSourceData(asOf);

    expect(responseQuery.order).toHaveBeenNthCalledWith(1, "created_at", { ascending: true });
    expect(responseQuery.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
    expect(responseQuery.limit).toHaveBeenNthCalledWith(1, 500);
    expect(responseQuery.limit).toHaveBeenNthCalledWith(2, 500);
    expect(responseQuery.or).toHaveBeenCalledWith(
      "created_at.gt.2026-10-17T12:00:00.000Z,and(created_at.eq.2026-10-17T12:00:00.000Z,id.gt.response-499)",
    );
    expect(result.responses).toMatchObject({ status: "success", data: expect.arrayContaining([expect.objectContaining({ id: "response-500" })]) });
    if (result.responses.status === "success") expect(result.responses.data).toHaveLength(501);
  });

  it("rejects a mid-pagination error instead of returning partial rows", async () => {
    const responseRows = Array.from({ length: 501 }, (_, index) => response(`r-${index}`, "2026-10-17T12:00:00.000Z"));
    const { responseQuery } = setup([question("question-owned")], responseRows, {
      responsePage: (cursor) => cursor === null
        ? { data: responseRows.slice(0, 500), error: null, count: 501 }
        : { data: null, error: { message: "page two failed" }, count: 501 },
    });
    const result = await loadCurrentDashboardKpiSourceData(asOf);

    expect(responseQuery.limit).toHaveBeenCalledTimes(2);
    expect(result.responses).toMatchObject({ status: "error", message: expect.stringContaining("page two failed") });
  });

  it("reports question read failures separately from a successful response read", async () => {
    const { questionQuery } = setup([], [response("r1", "2026-10-17T12:00:00.000Z")], {
      questionPage: () => ({ data: null, error: { message: "question page failed" }, count: null }),
    });
    const result = await loadCurrentDashboardKpiSourceData(asOf);

    expect(questionQuery.limit).toHaveBeenCalledTimes(1);
    expect(result.questions).toMatchObject({ status: "error", message: expect.stringContaining("question page failed") });
    expect(result.responses).toMatchObject({ status: "success" });
    expect(toDashboardKpisInput(result, 30).questionsError).toBe(true);
  });

  it("rejects count changes and duplicate IDs between pages", async () => {
    const { responseQuery } = setup([], [], {
      responsePage: (cursor) => cursor === null
        ? { data: Array.from({ length: 500 }, (_, i) => response(`r-${i}`, "2026-10-17T12:00:00.000Z")), error: null, count: 501 }
        : { data: [response("r-499", "2026-10-17T12:00:00.000Z")], error: null, count: 1 },
    });
    const duplicate = await loadCurrentDashboardKpiSourceData(asOf);
    expect(duplicate.responses).toMatchObject({ status: "error", message: expect.stringContaining("duplicados") });

    responseQuery.limit.mockImplementationOnce(() => Promise.resolve({
      data: [response("r-1", "2026-10-17T12:00:00.000Z")], error: null, count: 2,
    })).mockImplementationOnce(() => Promise.resolve({
      data: [], error: null, count: 3,
    }));
    const changed = await loadCurrentDashboardKpiSourceData(asOf);
    expect(changed.responses).toMatchObject({ status: "error", message: expect.stringContaining("mudou") });
  });

  it("keeps no primary selection distinct and reports missing migration or incompatible references", async () => {
    const { surveysQuery: unconfiguredQuery } = setup([question("question-owned")], [], {
      surveyPage: () => ({ data: [{ ...survey, primary_question_id: null }], error: null, count: 1 }),
    });
    const unconfigured = await loadCurrentDashboardKpiSourceData(asOf);
    expect(unconfigured.primaryQuestionConfiguration).toMatchObject({ status: "success" });
    if (unconfigured.primaryQuestionConfiguration.status === "success") {
      expect(unconfigured.primaryQuestionConfiguration.data.get(survey.id)).toBeNull();
    }

    const fallbackRows = makeSurveys(501);
    const { surveysQuery: missingColumnQuery } = setup([], [], {
      surveyPage: (_cursor, _pageSize, columns) => columns?.includes("primary_question_id")
        ? { data: null, error: { code: "42703", message: "column primary_question_id does not exist" }, count: null }
        : _cursor === null
          ? { data: fallbackRows.slice(0, 500), error: null, count: 501 }
          : { data: fallbackRows.slice(500), error: null, count: 1 },
    }, fallbackRows);
    const missingColumn = await loadCurrentDashboardKpiSourceData(asOf);
    expect(missingColumn.primaryQuestionConfiguration)
      .toMatchObject({ status: "error", message: expect.stringContaining("014") });
    expect(missingColumn.surveys.status).toBe("success");
    if (missingColumn.surveys.status === "success") expect(missingColumn.surveys.data).toHaveLength(501);
    expect(missingColumnQuery.limit).toHaveBeenCalledTimes(3);

    setup([question("question-owned", survey.id, "rating_10")], []);
    expect((await loadCurrentDashboardKpiSourceData(asOf)).primaryQuestionConfiguration)
      .toMatchObject({ status: "error", message: expect.stringContaining("incompatível") });

    setup([], []);
    expect((await loadCurrentDashboardKpiSourceData(asOf)).primaryQuestionConfiguration)
      .toMatchObject({ status: "error", message: expect.stringContaining("ausente") });
  });

  it("preserves source failures in the engine input and uses extract.ts validity rules", async () => {
    setup([question("question-owned")], [
      response("valid", "2026-10-17T12:00:00.000Z", { mode: "dynamic", answers: { "question-owned": 5 } }),
      response("invalid", "2026-10-17T12:00:00.000Z", { mode: "dynamic", answers: { "question-owned": 11 } }),
      response("same-content-different-id", "2026-10-17T12:00:00.000Z", { mode: "dynamic", answers: { "question-owned": 5 } }),
    ]);
    const source = await loadCurrentDashboardKpiSourceData(asOf);
    const input = toDashboardKpisInput(source, 7);
    const kpis = calculateDashboardKpis(input);
    expect(kpis.current.responsesReceived).toEqual({ status: "value", value: 2 });
    expect(kpis.current.averageRating).toEqual({ status: "value", value: 5 });
    expect(kpis.current.validRatingCount).toBe(2);

    const erroredSource = {
      ...source,
      questions: { status: "error" as const, message: "question read failed" },
    };
    expect(toDashboardKpisInput(erroredSource, 7).questionsError).toBe(true);
    expect(calculateDashboardKpis(toDashboardKpisInput(erroredSource, 7)).current.responsesReceived.status).toBe("error");
  });

  it("returns explicit states for company and survey loading failures without querying child rows", async () => {
    requireCurrentCompanyMock.mockRejectedValueOnce(new Error("Nao foi possivel carregar os dados da empresa."));
    const companyFailure = await loadCurrentDashboardKpiSourceData(asOf);
    expect(companyFailure.company.status).toBe("error");
    expect(createClientMock).not.toHaveBeenCalled();

    requireCurrentCompanyMock.mockResolvedValueOnce({ id: "company-owned" });
    const { surveysQuery } = setup([], [], {
      surveyPage: () => ({ data: null, error: { message: "survey query failed" }, count: null }),
    });
    const surveyFailure = await loadCurrentDashboardKpiSourceData(asOf);
    expect(surveyFailure.surveys).toMatchObject({ status: "error", message: expect.stringContaining("survey query failed") });
  });
});
