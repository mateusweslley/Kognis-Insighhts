import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient } from "@supabase/supabase-js";
import type { Survey } from "@/types/survey";
const { clientMock, companyMock } = vi.hoisted(() => ({ clientMock: vi.fn(), companyMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: clientMock }));
vi.mock("@/lib/company", () => ({ requireCurrentCompany: companyMock }));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/layout/page-container", () => ({ PageContainer: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/responses/feedbacks-panel", () => ({ FeedbacksPanel: () => "FEEDBACK_VIEW" }));
import { getResponseCountsByCompany } from "@/lib/responses";
import { ResponsesPanel } from "@/components/responses/responses-panel";
import RespostasPage from "@/app/respostas/page";

const companyA = "company-a";
const companyB = "company-b";
const survey = (id: string, company = companyA): Survey => ({
  id, company_id: company, title: `Pesquisa ${id}`, description: null,
  status: "active", created_at: "2026-10-20T00:00:00Z", updated_at: "2026-10-20T00:00:00Z",
} as Survey);
type ResponseRow = { id: string; survey_id: string };
const responses = (surveyId: string, count: number): ResponseRow[] => Array.from({ length: count }, (_, i) => ({
  id: `${surveyId}-response-${String(i).padStart(6, "0")}`, survey_id: surveyId,
}));
type Page = { rows: unknown[]; count: number | null; status: number };
function fixture(surveys: Survey[], rows: ResponseRow[], options: {
  cap?: number;
  transform?: (table: string, page: number, result: Page, url: URL) => Page;
} = {}) {
  const requests: URL[] = [];
  const pages = new Map<string, number>();
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname !== "company-counts.invalid" || init?.method !== "GET") throw new Error("Only simulated reads allowed");
    requests.push(url);
    const table = url.pathname.split("/").pop()!;
    let selected: Array<Survey | ResponseRow>;
    if (table === "surveys") {
      selected = surveys.filter((row) => url.searchParams.get("company_id") === `eq.${row.company_id}`);
    } else {
      const filter = url.searchParams.get("survey_id")!;
      const allowed = filter.slice(4, -1).split(",");
      selected = rows.filter((row) => allowed.includes(row.survey_id));
      expect(url.searchParams.get("select")).toBe("id,survey_id");
      expect(allowed.length).toBeLessThanOrEqual(100);
    }
    const cursor = url.searchParams.get("id");
    if (cursor) selected = selected.filter((row) => row.id > cursor.slice(3));
    selected = [...selected].sort((a, b) => a.id.localeCompare(b.id));
    const count = selected.length;
    const page = (pages.get(table) ?? 0) + 1;
    pages.set(table, page);
    expect(new Headers(init.headers).get("Prefer")).toContain("count=exact");
    expect(url.searchParams.get("order")).toBe("id.asc");
    let result: Page = { rows: selected.slice(0, Math.min(Number(url.searchParams.get("limit")), options.cap ?? 1000)), count, status: 200 };
    result = options.transform?.(table, page, result, url) ?? result;
    return new Response(JSON.stringify(result.status >= 400 ? { message: "Simulated failure", code: "XX000" } : result.rows), {
      status: result.status,
      headers: { "Content-Type": "application/json", "Content-Range": `0-${Math.max(0, result.rows.length - 1)}/${result.count ?? "*"}` },
    });
  });
  const client = createClient("https://company-counts.invalid", "public-test-placeholder", {
    db: { retry: false }, global: { fetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  clientMock.mockReturnValue(client);
  return { requests, fetch };
}
function reference(surveys: Survey[], rows: ResponseRow[], companyId = companyA) {
  return new Map(surveys.filter((item) => item.company_id === companyId)
    .map((item) => [item.id, rows.filter((row) => row.survey_id === item.id).length]));
}

describe("company response counts", () => {
  beforeAll(() => { vi.stubGlobal("React", React); });
  afterAll(() => { vi.unstubAllGlobals(); });
  beforeEach(() => { vi.clearAllMocks(); companyMock.mockResolvedValue({ id: companyA }); });
  it.each([0, 3, 499, 500, 501, 999, 1000, 1001, 1201])("counts all %i stored responses", async (count) => {
    const surveys = [survey("s1")], rows = responses("s1", count);
    fixture(surveys, rows);
    const result = await getResponseCountsByCompany(companyA);
    expect(result.error).toBeNull();
    expect(result.counts).toEqual(reference(surveys, rows));
    expect([...result.counts.values()].reduce((a, b) => a + b, 0)).toBe(count);
  });
  it("counts multiple surveys above the combined limit, including a real zero", async () => {
    const surveys = [survey("s1"), survey("s2"), survey("s3"), survey("s4")];
    surveys[1].status = "archived";
    surveys[2].status = "draft";
    const rows = [...responses("s1", 999), ...responses("s2", 1001), ...responses("s3", 1201)];
    const mock = fixture(surveys, rows);
    const result = await getResponseCountsByCompany(companyA);
    expect(result.error).toBeNull();
    expect(result.counts).toEqual(reference(surveys, rows));
    expect(result.counts.get("s4")).toBe(0);
    expect([...result.counts.values()].reduce((a, b) => a + b, 0)).toBe(3201);
    expect(mock.requests.filter((url) => url.pathname.endsWith("/responses"))).toHaveLength(7);
  });
  it("loads 1201 surveys across short metadata pages, with bounded IN batches", async () => {
    const surveys = Array.from({ length: 1201 }, (_, i) => survey(`s${String(i).padStart(5, "0")}`));
    const rows = [...responses(surveys[0].id, 3), ...responses(surveys[1200].id, 5)];
    const mock = fixture(surveys, rows, { cap: 73 });
    const result = await getResponseCountsByCompany(companyA);
    expect(result.error).toBeNull();
    expect(result.surveys).toHaveLength(1201);
    expect(result.counts).toEqual(reference(surveys, rows));
    expect([...result.counts.values()].reduce((a, b) => a + b, 0)).toBe(8);
    expect(mock.requests.filter((url) => url.pathname.endsWith("/surveys"))).toHaveLength(17);
    expect(mock.requests.filter((url) => url.pathname.endsWith("/responses"))).toHaveLength(13);
  });
  it("continues response pages smaller than requested until exact counts agree", async () => {
    const mock = fixture([survey("s1")], responses("s1", 1201), { cap: 73 });
    const result = await getResponseCountsByCompany(companyA);
    expect(result.error).toBeNull();
    expect(result.counts.get("s1")).toBe(1201);
    expect(mock.requests.filter((url) => url.pathname.endsWith("/responses"))).toHaveLength(17);
  });
  it("returns a genuine empty company without querying responses", async () => {
    const mock = fixture([], []);
    expect(await getResponseCountsByCompany(companyA)).toEqual({ surveys: [], counts: new Map(), error: null });
    expect(mock.requests).toHaveLength(1);
  });
  it.each([companyA, companyB])("keeps %s isolated in every page", async (companyId) => {
    const surveys = [survey("a", companyA), survey("b", companyB)];
    const rows = [...responses("a", 1201), ...responses("b", 1001)];
    const mock = fixture(surveys, rows, { cap: 173 });
    const result = await getResponseCountsByCompany(companyId);
    expect(result.error).toBeNull();
    expect(result.counts).toEqual(reference(surveys, rows, companyId));
    expect(result.surveys.every((item) => item.company_id === companyId)).toBe(true);
    const allowed = companyId === companyA ? "a" : "b";
    expect(mock.requests.filter((url) => url.pathname.endsWith("/responses"))
      .every((url) => url.searchParams.get("survey_id") === `in.(${allowed})`)).toBe(true);
  });
  it.each(["surveys", "responses"])("rejects intermediate %s failure without partial counts", async (failedTable) => {
    const surveys = Array.from({ length: 501 }, (_, i) => survey(`s${String(i).padStart(4, "0")}`));
    fixture(surveys, responses(surveys[0].id, 1201), { transform: (table, page, result) =>
      table === failedTable && page === 2 ? { ...result, status: 500 } : result });
    const result = await getResponseCountsByCompany(companyA);
    expect(result.error).toContain("INCOMPLETE_SURVEY_DATA");
    expect(result.counts.size).toBe(0);
  });
  it.each(["changed", "missing", "duplicate", "foreign", "empty", "failure-first", "throw"])("rejects response %s instead of returning zero or a partial total", async (scenario) => {
    const rows = responses("s1", 501);
    fixture([survey("s1")], rows, { transform: (table, page, result) => {
      if (table !== "responses" || page !== (scenario === "failure-first" ? 1 : 2)) return result;
      if (scenario === "throw") throw new Error("Simulated network failure");
      if (scenario === "failure-first") return { ...result, status: 500 };
      if (scenario === "changed") return { ...result, count: 2 };
      if (scenario === "missing") return { ...result, count: null };
      if (scenario === "empty") return { ...result, rows: [] };
      return { ...result, rows: [{ ...rows[scenario === "duplicate" ? 0 : 500], ...(scenario === "foreign" ? { survey_id: "foreign" } : {}) }] };
    } });
    const result = await getResponseCountsByCompany(companyA);
    expect(result.error).toContain("INCOMPLETE_SURVEY_DATA");
    expect(result.counts.size).toBe(0);
  });
  it.each(["changed", "missing", "duplicate", "foreign", "failure-first"])("rejects metadata %s before exposing counters", async (scenario) => {
    const surveys = Array.from({ length: 501 }, (_, i) => survey(`s${String(i).padStart(4, "0")}`));
    const mock = fixture(surveys, [], { transform: (table, page, result) => {
      if (table !== "surveys" || page !== (scenario === "failure-first" ? 1 : 2)) return result;
      if (scenario === "failure-first") return { ...result, status: 500 };
      if (scenario === "changed") return { ...result, count: 2 };
      if (scenario === "missing") return { ...result, count: null };
      return { ...result, rows: [{ ...surveys[scenario === "duplicate" ? 0 : 500], ...(scenario === "foreign" ? { company_id: companyB } : {}) }] };
    } });
    const result = await getResponseCountsByCompany(companyA);
    expect(result.error).toContain("INCOMPLETE_SURVEY_DATA");
    expect(result.counts.size).toBe(0);
    expect(mock.requests.every((url) => url.pathname.endsWith("/surveys"))).toBe(true);
  });
  it("discards successful earlier batches if a later batch fails", async () => {
    const surveys = Array.from({ length: 101 }, (_, i) => survey(`s${String(i).padStart(4, "0")}`));
    fixture(surveys, responses(surveys[0].id, 3), { transform: (table, _page, result, url) =>
      table === "responses" && url.searchParams.get("survey_id") === `in.(${surveys[100].id})` ? { ...result, status: 500 } : result });
    const result = await getResponseCountsByCompany(companyA);
    expect(result.error).toContain("INCOMPLETE_SURVEY_DATA");
    expect(result.counts.size).toBe(0);
  });
  it("rejects an ID repeated across survey batches", async () => {
    const surveys = Array.from({ length: 101 }, (_, i) => survey(`s${String(i).padStart(4, "0")}`));
    const rows = [...responses(surveys[0].id, 1), ...responses(surveys[100].id, 1)];
    fixture(surveys, rows, { transform: (table, _page, result, url) =>
      table === "responses" && url.searchParams.get("survey_id") === `in.(${surveys[100].id})`
        ? { ...result, rows: [{ id: rows[0].id, survey_id: surveys[100].id }] } : result });
    const result = await getResponseCountsByCompany(companyA);
    expect(result.error).toContain("duplicada entre lotes");
    expect(result.counts.size).toBe(0);
  });
  it("keeps surveys with nullable creation dates eligible", async () => {
    const surveys = [survey("s1"), { ...survey("s2"), created_at: null } as unknown as Survey];
    fixture(surveys, responses("s2", 3));
    const result = await getResponseCountsByCompany(companyA);
    expect(result.error).toBeNull();
    expect(result.surveys.map((item) => item.id)).toEqual(["s2", "s1"]);
    expect(result.counts).toEqual(reference(surveys, responses("s2", 3)));
  });
  it("renders all page counters from the complete company dataset", async () => {
    const surveys = [survey("s1"), survey("s2"), survey("s3")];
    const mock = fixture(surveys, [...responses("s1", 1201), ...responses("s2", 1001)], { cap: 500 });
    const html = renderToStaticMarkup(await RespostasPage({ searchParams: {} }));
    expect(html).toContain(">1201</p>");
    expect(html).toContain(">1001</p>");
    expect(html).toContain(">0</p>");
    expect(companyMock).toHaveBeenCalledOnce();
    expect(mock.requests.filter((url) => url.pathname.endsWith("/surveys"))).toHaveLength(1);
  });
  it.each(["surveys", "responses"])("shows %s failure without zero cards or misleading empty state", async (failedTable) => {
    fixture([survey("s1")], responses("s1", 3), { transform: (table, _page, result) => table === failedTable ? { ...result, status: 500 } : result });
    const html = renderToStaticMarkup(await RespostasPage({ searchParams: {} }));
    expect(html).toContain("INCOMPLETE_SURVEY_DATA");
    expect(html).not.toContain(">0</p>");
    expect(html).not.toContain("Nenhuma resposta recebida ainda");
    expect(html).not.toContain("Nenhuma pesquisa criada ainda");
    if (failedTable === "responses") expect(html).toContain("—");
  });
  it("distinguishes empty, zero and missing counter states", () => {
    const empty = renderToStaticMarkup(React.createElement(ResponsesPanel, { surveys: [], responseCounts: {} }));
    expect(empty).toContain("Nenhuma pesquisa criada ainda");
    const zero = renderToStaticMarkup(React.createElement(ResponsesPanel, { surveys: [survey("s1")], responseCounts: { s1: 0 } }));
    expect(zero).toContain("Nenhuma resposta recebida ainda");
    expect(zero).toContain(">0</p>");
    const missing = renderToStaticMarkup(React.createElement(ResponsesPanel, { surveys: [survey("s1")], responseCounts: {}, error: "failed" }));
    expect(missing).toContain("—");
    expect(missing).not.toContain(">0</p>");
  });
  it("preserves the feedback view without loading counters", async () => {
    expect(renderToStaticMarkup(await RespostasPage({ searchParams: { view: "feedbacks" } }))).toContain("FEEDBACK_VIEW");
    expect(clientMock).not.toHaveBeenCalled();
  });
});
