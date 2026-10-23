import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { clientMock, companyMock } = vi.hoisted(() => ({ clientMock: vi.fn(), companyMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: clientMock }));
vi.mock("@/lib/company", () => ({ requireCurrentCompany: companyMock }));
import { getCompanyFeedbackPage, getCompanyFeedbackResponse } from "@/lib/responses";
import { GET as getFeed } from "@/app/api/respostas/feedbacks/route";
import { GET as getDetail } from "@/app/api/respostas/feedbacks/[responseId]/route";
import { feedbackQuestion, feedbackReadFixture, feedbackResponse, feedbackSurvey, uuid } from "@/lib/testing/feedback-read-fixture";
import type { FeedbackCursor } from "@/lib/feedback-feed";

const company = "company-a";
const surveys = [feedbackSurvey(1)];
const questions = [feedbackQuestion(100, surveys[0].id)];
const response = feedbackResponse(200, surveys[0].id, { mode: "dynamic", answers: { [questions[0].id]: "Feedback sintético" } });
describe("complete feedback metadata", () => {
  beforeEach(() => { vi.clearAllMocks(); companyMock.mockResolvedValue({ id: company }); });
  it.each([3, 501, 1201])("finds feedback in the last of %i surveys", async (count) => {
    const many = Array.from({ length: count }, (_, i) => feedbackSurvey(i + 1));
    const last = many[count - 1];
    const question = feedbackQuestion(2000, last.id);
    const row = feedbackResponse(3000, last.id, { mode: "dynamic", answers: { [question.id]: "Última pesquisa" } });
    const mock = feedbackReadFixture({ surveys: many, questions: [question], responses: [row] }, { metadataCap: 73 });
    clientMock.mockReturnValue(mock.client);
    const result = await getCompanyFeedbackPage(company, null);
    expect(result.error).toBeNull();
    expect(result.page?.items).toMatchObject([{ surveyId: last.id, surveyTitle: last.title, text: "Última pesquisa" }]);
    expect(mock.requests.filter((url) => url.pathname.endsWith("/surveys"))).toHaveLength(Math.ceil(count / 73));
    expect(mock.requests.filter((url) => url.pathname.endsWith("/surveys")).every((url) =>
      url.searchParams.get("company_id") === `eq.${company}` && url.searchParams.get("order") === "id.asc")).toBe(true);
  });
  it("finds a text answer on the final question page", async () => {
    const many = Array.from({ length: 1201 }, (_, i) => feedbackQuestion(i + 1000, surveys[0].id));
    const last = many[many.length - 1];
    const row = feedbackResponse(4000, surveys[0].id, { mode: "dynamic", answers: { [last.id]: "Última pergunta" } });
    const mock = feedbackReadFixture({ surveys, questions: many, responses: [row] }, { metadataCap: 73 });
    clientMock.mockReturnValue(mock.client);
    const result = await getCompanyFeedbackPage(company, null);
    expect(result.error).toBeNull();
    expect(result.page?.items).toMatchObject([{ questionId: last.id, questionTitle: last.title, text: "Última pergunta" }]);
    expect(mock.requests.filter((url) => url.pathname.endsWith("/survey_questions"))).toHaveLength(17);
    expect(mock.requests.filter((url) => url.pathname.endsWith("/survey_questions")).every((url) =>
      url.searchParams.get("type") === "in.(short_text,long_text)")).toBe(true);
  });
  it.each(["no_surveys", "no_responses", "no_text_feedback"])("preserves legitimate %s", async (scenario) => {
    const mock = feedbackReadFixture({ surveys: scenario === "no_surveys" ? [] : surveys, questions,
      responses: scenario === "no_text_feedback" ? [{ ...response, answers: { mode: "dynamic", answers: {} } }] : [] });
    clientMock.mockReturnValue(mock.client);
    const result = await getCompanyFeedbackPage(company, null);
    expect(result.error).toBeNull();
    expect(result.page).toMatchObject({ items: [], state: scenario === "no_surveys" ? "no_responses" : scenario, hasMore: false, nextCursor: null });
  });
  for (const table of ["surveys", "survey_questions"] as const) {
    it.each(["failure", "count", "missing-count", "duplicate", "foreign", "empty", "throw"])(`rejects ${table} %s without scanning or reporting empty data`, async (scenario) => {
      const manySurveys = table === "surveys" ? Array.from({ length: 501 }, (_, i) => feedbackSurvey(i + 1)) : surveys;
      const manyQuestions = table === "survey_questions" ? Array.from({ length: 501 }, (_, i) => feedbackQuestion(i + 1000, surveys[0].id)) : questions;
      const source = table === "surveys" ? manySurveys : manyQuestions;
      const mock = feedbackReadFixture({ surveys: manySurveys, questions: manyQuestions, responses: [response] }, {
        transform: (current, page, result) => {
          if (current !== table || page !== 2) return result;
          if (scenario === "throw") throw new Error("Simulated network failure");
          if (scenario === "failure") return { ...result, status: 500 };
          if (scenario === "count") return { ...result, count: 2 };
          if (scenario === "missing-count") return { ...result, count: null };
          if (scenario === "empty") return { ...result, rows: [] };
          const row = source[scenario === "duplicate" ? 0 : 500];
          return { ...result, rows: [{ ...row, ...(scenario === "foreign" ? table === "surveys" ? { company_id: "company-b" } : { survey_id: uuid(9999) } : {}) }] };
        },
      });
      clientMock.mockReturnValue(mock.client);
      const result = await getCompanyFeedbackPage(company, null);
      expect(result.page).toBeNull();
      expect(result.error).toContain("INCOMPLETE_SURVEY_DATA");
      expect(mock.requests.some((url) => url.pathname.endsWith("/responses"))).toBe(false);
    });
  }
  it("rejects duplicate question IDs across metadata batches", async () => {
    const many = Array.from({ length: 101 }, (_, i) => feedbackSurvey(i + 1));
    const first = feedbackQuestion(2000, many[0].id), last = feedbackQuestion(2001, many[100].id);
    const mock = feedbackReadFixture({ surveys: many, questions: [first, last], responses: [] }, {
      transform: (table, _page, result, url) => table === "survey_questions" && url.searchParams.get("survey_id") === `in.(${many[100].id})`
        ? { ...result, rows: [{ ...last, id: first.id }] } : result,
    });
    clientMock.mockReturnValue(mock.client);
    expect(await getCompanyFeedbackPage(company, null)).toMatchObject({ page: null, error: expect.stringContaining("duplicada entre lotes") });
  });
  it("preserves public pagination, equal timestamps and continuation within one response", async () => {
    const manyQuestions = Array.from({ length: 25 }, (_, i) => feedbackQuestion(i + 100, surveys[0].id));
    const manyResponses = [201, 202].map((id) => feedbackResponse(id, surveys[0].id, {
      mode: "dynamic", answers: Object.fromEntries(manyQuestions.map((question) => [question.id, `Texto ${id} ${question.id}`])),
    }));
    const mock = feedbackReadFixture({ surveys, questions: manyQuestions, responses: manyResponses }, { metadataCap: 7 });
    clientMock.mockReturnValue(mock.client);
    const items: string[] = [];
    let cursor: FeedbackCursor | null = null;
    for (let i = 0; i < 4; i++) {
      const result = await getCompanyFeedbackPage(company, cursor);
      expect(result.error).toBeNull();
      expect(Object.keys(result.page!).sort()).toEqual(["hasMore", "items", "nextCursor", "state"]);
      items.push(...result.page!.items.map((item) => item.id));
      cursor = result.page!.nextCursor;
      if (!cursor) break;
    }
    const expected = [...manyResponses].reverse().flatMap((row) => [...manyQuestions].reverse().map((question) => `${row.id}:${question.id}`));
    expect(items).toEqual(expected);
    expect(new Set(items).size).toBe(50);
    expect(cursor).toBeNull();
    expect(mock.requests.filter((url) => url.pathname.endsWith("/responses") && !url.searchParams.has("id"))
      .every((url) => url.searchParams.get("order") === "created_at.desc,id.desc" && url.searchParams.get("limit") === "50")).toBe(true);
  });
  it.each(["company-a", "company-b"])("isolates feed and detail metadata for %s", async (companyId) => {
    const other = feedbackSurvey(2, "company-b"), otherQuestion = feedbackQuestion(101, other.id);
    const otherResponse = feedbackResponse(201, other.id, { mode: "dynamic", answers: { [otherQuestion.id]: "Outro tenant" } });
    const mock = feedbackReadFixture({ surveys: [...surveys, other], questions: [...questions, otherQuestion], responses: [response, otherResponse] }, { metadataCap: 1 });
    clientMock.mockReturnValue(mock.client);
    const own = companyId === company ? response : otherResponse;
    const foreign = companyId === company ? otherResponse : response;
    const page = await getCompanyFeedbackPage(companyId, null);
    expect(page.error).toBeNull();
    expect(page.page?.items.map((item) => item.responseId)).toEqual([own.id]);
    expect((await getCompanyFeedbackResponse(companyId, own.id)).response?.id).toBe(own.id);
    expect(await getCompanyFeedbackResponse(companyId, foreign.id)).toEqual({ response: null, error: null });
  });
  it("resolves detail directly beyond the metadata limit and reads every question page", async () => {
    const many = Array.from({ length: 1201 }, (_, i) => feedbackSurvey(i + 1)), last = many[1200];
    const manyQuestions = Array.from({ length: 501 }, (_, i) => feedbackQuestion(i + 2000, last.id));
    const lastQuestion = manyQuestions[500];
    const row = feedbackResponse(4000, last.id, { mode: "dynamic", answers: { [lastQuestion.id]: "Detalhe final" } });
    const mock = feedbackReadFixture({ surveys: many, questions: manyQuestions, responses: [row] }, { metadataCap: 73 });
    clientMock.mockReturnValue(mock.client);
    const result = await getCompanyFeedbackResponse(company, row.id);
    expect(result.error).toBeNull();
    expect(result.response).toMatchObject({ id: row.id, surveyId: last.id, surveyTitle: last.title,
      fields: expect.arrayContaining([expect.objectContaining({ questionId: lastQuestion.id, label: lastQuestion.title, value: "Detalhe final" })]) });
    expect(mock.requests.filter((url) => url.pathname.endsWith("/surveys"))).toHaveLength(0);
    expect(mock.requests.filter((url) => url.pathname.endsWith("/responses"))).toHaveLength(1);
    expect(mock.requests[0].searchParams.get("select")).toContain("surveys!inner");
    expect(mock.requests[0].searchParams.get("surveys.company_id")).toBe(`eq.${company}`);
    expect(mock.requests.filter((url) => url.pathname.endsWith("/survey_questions"))).toHaveLength(7);
  });
  it("does not resume a cursor inside a response owned by another company", async () => {
    const other = feedbackSurvey(2, "company-b"), question = feedbackQuestion(101, other.id);
    const foreign = feedbackResponse(201, other.id, { mode: "dynamic", answers: { [question.id]: "Texto de outro tenant" } });
    clientMock.mockReturnValue(feedbackReadFixture({ surveys: [...surveys, other], questions: [...questions, question], responses: [foreign] }).client);
    const result = await getCompanyFeedbackPage(company, {
      createdAt: foreign.created_at, responseId: foreign.id, feedbackKey: uuid(999),
    });
    expect(result.error).toBeNull();
    expect(result.page?.items).toEqual([]);
  });
  it.each(["response-failure", "question-failure", "invalid-association"])("returns explicit detail error for %s", async (scenario) => {
    const many = Array.from({ length: 501 }, (_, i) => feedbackQuestion(i + 1000, surveys[0].id));
    const mock = feedbackReadFixture({ surveys, questions: many, responses: [response] }, {
      transform: (table, page, result) => {
        if (scenario === "response-failure" && table === "responses") return { ...result, status: 500 };
        if (scenario === "question-failure" && table === "survey_questions" && page === 2) return { ...result, status: 500 };
        if (scenario === "invalid-association" && table === "responses") return { ...result, rows: [{ ...response, surveys: { ...surveys[0], company_id: "company-b" } }] };
        return result;
      },
    });
    clientMock.mockReturnValue(mock.client);
    const result = await getCompanyFeedbackResponse(company, response.id);
    expect(result.response).toBeNull();
    expect(result.error).toBeTruthy();
  });
  it("keeps genuine missing detail separate from a query failure", async () => {
    clientMock.mockReturnValue(feedbackReadFixture({ surveys, questions, responses: [] }).client);
    expect(await getCompanyFeedbackResponse(company, uuid(9999))).toEqual({ response: null, error: null });
  });
  it("returns API 500 for incomplete metadata instead of a public empty state", async () => {
    clientMock.mockReturnValue(feedbackReadFixture({ surveys, questions, responses: [response] }, {
      transform: (table, _page, result) => table === "survey_questions" ? { ...result, count: null } : result,
    }).client);
    const result = await getFeed(new NextRequest("http://localhost/api/respostas/feedbacks"));
    expect(result.status).toBe(500);
    expect(await result.json()).toEqual({ error: expect.stringContaining("INCOMPLETE_SURVEY_DATA") });
  });
  it("preserves successful feed API shape and invalid cursor rejection", async () => {
    const mock = feedbackReadFixture({ surveys, questions, responses: [response] });
    clientMock.mockReturnValue(mock.client);
    const invalid = await getFeed(new NextRequest("http://localhost/api/respostas/feedbacks?cursor=invalid"));
    expect(invalid.status).toBe(400);
    expect(mock.requests).toHaveLength(0);
    const result = await getFeed(new NextRequest("http://localhost/api/respostas/feedbacks"));
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ state: "results", items: [{ responseId: response.id }], nextCursor: null, hasMore: false });
    expect(companyMock).toHaveBeenCalledWith();
  });
  it.each(["found", "missing", "failure", "foreign"])("keeps detail API semantics for %s", async (scenario) => {
    clientMock.mockReturnValue(feedbackReadFixture({ surveys, questions, responses: scenario === "missing" ? [] : [response] }, {
      transform: (table, _page, result) => scenario === "failure" && table === "responses" ? { ...result, status: 500 } : result,
    }).client);
    if (scenario === "foreign") companyMock.mockResolvedValue({ id: "company-b" });
    const result = await getDetail(new NextRequest(`http://localhost/api/respostas/feedbacks/${response.id}`), { params: { responseId: response.id } });
    expect(result.status).toBe(scenario === "found" ? 200 : scenario === "failure" ? 500 : 404);
    const body = await result.json();
    if (scenario === "found") expect(body).toMatchObject({ id: response.id, surveyTitle: surveys[0].title });
    else expect(body).toEqual({ error: expect.any(String) });
  });
});
