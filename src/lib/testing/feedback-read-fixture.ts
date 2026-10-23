import { createClient } from "@supabase/supabase-js";
import { vi } from "vitest";
import type { FeedbackResponse } from "@/lib/feedback-feed";
import type { SurveyQuestion } from "@/types/survey-question";

export const uuid = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
export const feedbackSurvey = (index: number, companyId = "company-a") => ({
  id: uuid(index), company_id: companyId, title: `Pesquisa ${index}`,
});
export function feedbackQuestion(index: number, surveyId: string, type: SurveyQuestion["type"] = "short_text"): SurveyQuestion {
  return { id: uuid(index), survey_id: surveyId, type, title: `Comentário ${index}`,
    description: null, required: false, position: index, options: [], topic: null,
    created_at: "2026-10-20T12:00:00.000Z", updated_at: "2026-10-20T12:00:00.000Z" };
}
export const feedbackResponse = (index: number, surveyId: string, answers: unknown): FeedbackResponse => ({
  id: uuid(index), survey_id: surveyId, answers, created_at: "2026-10-20T12:00:00.000Z",
});
export type SimulatedFeedbackPage = { rows: unknown[]; count: number | null; status: number };

export function feedbackReadFixture(input: {
  surveys: ReturnType<typeof feedbackSurvey>[];
  questions: SurveyQuestion[];
  responses: FeedbackResponse[];
}, options: {
  metadataCap?: number;
  responseCap?: number;
  transform?: (table: string, page: number, result: SimulatedFeedbackPage, url: URL) => SimulatedFeedbackPage;
} = {}) {
  const requests: URL[] = [];
  const pageNumbers = new Map<string, number>();
  type Row = { id: string; [key: string]: unknown };
  const fetch = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(request));
    if (url.hostname !== "feedback-fixture.invalid" || init?.method !== "GET") throw new Error("Only simulated reads allowed");
    requests.push(url);
    const table = url.pathname.split("/").pop()!;
    const source = table === "surveys" ? input.surveys : table === "survey_questions" ? input.questions : input.responses;
    let rows = source as unknown as Row[];
    const joined = table === "responses" && url.searchParams.get("select")?.includes("surveys!inner");
    if (joined) rows = rows.flatMap((row) => {
      const survey = input.surveys.find((survey) => survey.id === row.survey_id);
      return survey ? [{ ...row, surveys: survey }] : [];
    });
    for (const [key, value] of url.searchParams) {
      if (["select", "order", "limit", "or"].includes(key)) continue;
      const dot = value.indexOf("."), op = value.slice(0, dot), filter = value.slice(dot + 1);
      rows = rows.filter((row) => {
        const actual = key === "surveys.company_id" ? (row.surveys as { company_id: string })?.company_id : row[key];
        if (op === "eq") return actual === filter;
        if (op === "gt") return String(actual) > filter;
        if (op === "lt") return String(actual) < filter;
        if (op === "in") return filter.slice(1, -1).split(",").includes(String(actual));
        throw new Error("Unsupported simulated filter");
      });
    }
    const or = url.searchParams.get("or");
    if (or) {
      const cursor = or.match(/created_at\.lt\.([^,]+),and\(created_at\.eq\.[^,]+,id\.lt\.([^)]*)/);
      if (!cursor) throw new Error("Unexpected public cursor");
      rows = rows.filter((row) => String(row.created_at) < cursor[1]
        || (row.created_at === cursor[1] && row.id < cursor[2]));
    }
    const order = (url.searchParams.get("order") ?? "").split(",").filter(Boolean);
    rows = [...rows].sort((a, b) => {
      for (const item of order) {
        const [key, direction] = item.split(".");
        if (a[key] !== b[key]) return (String(a[key]) < String(b[key]) ? -1 : 1) * (direction === "desc" ? -1 : 1);
      }
      return 0;
    });
    const count = rows.length;
    const cap = table === "responses" ? options.responseCap ?? 1000 : options.metadataCap ?? 1000;
    const page = (pageNumbers.get(table) ?? 0) + 1;
    pageNumbers.set(table, page);
    let result: SimulatedFeedbackPage = { rows: rows.slice(0, Math.min(cap, Number(url.searchParams.get("limit") ?? cap))), count, status: 200 };
    result = options.transform?.(table, page, result, url) ?? result;
    const requestedCount = new Headers(init.headers).get("Prefer")?.includes("count=exact");
    return new Response(JSON.stringify(result.status >= 400 ? { message: "Simulated failure", code: "XX000" } : result.rows), {
      status: result.status,
      headers: { "Content-Type": "application/json", "Content-Range": `0-${Math.max(0, result.rows.length - 1)}/${requestedCount ? result.count ?? "*" : "*"}` },
    });
  });
  const client = createClient("https://feedback-fixture.invalid", "public-test-placeholder", {
    db: { retry: false }, global: { fetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { client, requests, fetch };
}
