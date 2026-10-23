import { createClient } from "@supabase/supabase-js";
import { vi } from "vitest";
import type { SurveyResponse } from "@/types/response";
import type { SurveyQuestion } from "@/types/survey-question";

export const surveyId = "00000000-0000-4000-8000-000000000001";
export const ratingId = "00000000-0000-4000-8000-000000000002";
export const npsId = "00000000-0000-4000-8000-000000000003";
export const questions: SurveyQuestion[] = [
  { id: ratingId, survey_id: surveyId, type: "rating", title: "Nota", required: true,
    position: 1, options: [], description: null, topic: null, created_at: "", updated_at: "" },
  { id: npsId, survey_id: surveyId, type: "rating_10", title: "NPS", required: false,
    position: 2, options: [], description: null, topic: null, created_at: "", updated_at: "" },
];
export function makeResponses(count: number): SurveyResponse[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 10).padStart(12, "0")}`,
    survey_id: surveyId,
    // Equal timestamps deliberately span page boundaries.
    created_at: "2026-10-20T00:00:00.000Z",
    answers: { mode: "dynamic", answers: { [ratingId]: i < 1000 ? 5 : 1, [npsId]: i < 1000 ? 10 : 0 } },
  }));
}
type Row = { id: string; survey_id: string; created_at: string; [key: string]: unknown };
export type FixturePage = { rows: unknown[]; count: number | null; status: number };
export function surveyReadFixture(responses: SurveyResponse[], options: {
  cap?: number;
  primaryQuestionId?: string | null;
  questions?: SurveyQuestion[];
  transform?: (table: string, page: number, result: FixturePage) => FixturePage;
} = {}) {
  const requests: URL[] = [];
  const pageNumbers = new Map<string, number>();
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname !== "survey-fixture.invalid" || init?.method !== "GET") throw new Error("Only simulated reads are allowed");
    requests.push(url);
    const table = url.pathname.split("/").pop()!;
    if (table === "surveys") {
      return new Response(JSON.stringify(url.searchParams.get("id") === `eq.${surveyId}`
        ? { id: surveyId, primary_question_id: options.primaryQuestionId ?? null } : null),
      { headers: { "Content-Type": "application/json" } });
    }
    let rows = (table === "responses" ? responses : options.questions ?? questions) as unknown as Row[];
    rows = rows.filter((row) => url.searchParams.get("survey_id") === `eq.${row.survey_id}`);
    const idFilter = url.searchParams.get("id");
    if (idFilter?.startsWith("gt.")) rows = rows.filter((row) => row.id > idFilter.slice(3));
    const or = url.searchParams.get("or");
    if (or) {
      const cursor = or.match(/created_at\.(gt|lt)\.([^,]+),and\(created_at\.eq\.[^,]+,id\.(gt|lt)\.([^)]*)/);
      if (!cursor || cursor[1] !== cursor[3]) throw new Error("Invalid compound cursor");
      rows = rows.filter((row) => cursor[1] === "gt"
        ? row.created_at > cursor[2] || (row.created_at === cursor[2] && row.id > cursor[4])
        : row.created_at < cursor[2] || (row.created_at === cursor[2] && row.id < cursor[4]));
    }
    const order = (url.searchParams.get("order") ?? "").split(",");
    rows = [...rows].sort((a, b) => {
      for (const entry of order) {
        const [key, direction] = entry.split(".");
        if (a[key] !== b[key]) return (String(a[key]) < String(b[key]) ? -1 : 1) * (direction === "desc" ? -1 : 1);
      }
      return 0;
    });
    const count = rows.length;
    const page = (pageNumbers.get(table) ?? 0) + 1;
    pageNumbers.set(table, page);
    let result: FixturePage = { rows: rows.slice(0, Math.min(Number(url.searchParams.get("limit") ?? 1000), options.cap ?? 1000)), count, status: 200 };
    result = options.transform?.(table, page, result) ?? result;
    const body = result.status >= 400 ? { message: "Simulated page failure", code: "XX000" } : result.rows;
    return new Response(JSON.stringify(body), {
      status: result.status,
      headers: { "Content-Type": "application/json", "Content-Range": `0-${Math.max(0, result.rows.length - 1)}/${result.count ?? "*"}` },
    });
  });
  const client = createClient("https://survey-fixture.invalid", "public-test-placeholder", {
    db: { retry: false },
    global: { fetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { client, requests, fetch };
}
