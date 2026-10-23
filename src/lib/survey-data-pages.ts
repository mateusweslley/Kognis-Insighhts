import type { SupabaseClient } from "@supabase/supabase-js";
import type { SurveyResponse } from "@/types/response";
import type { SurveyQuestion } from "@/types/survey-question";

const PAGE_SIZE = 500;
const COLUMNS = "id,survey_id,answers,created_at";

type PageResult<T> = { data: T[] | null; error: { message: string } | null; count: number | null };
type CompleteRead<T> = { rows: T[]; error: string | null };

// Exact counts refer to the remaining keyset tail, not just the returned page.
// Never expose accumulated rows when completeness cannot be confirmed.
export async function readCompletePages<T extends { id: string }, Cursor>(
  fetchPage: (cursor: Cursor | null) => PromiseLike<PageResult<T>>,
  cursorFor: (row: T) => Cursor,
  belongsToSurvey: (row: T) => boolean,
): Promise<CompleteRead<T>> {
  const rows: T[] = [];
  const seen = new Set<string>();
  let expected: number | null = null;
  let cursor: Cursor | null = null;
  const failure = (reason: string): CompleteRead<T> => ({
    rows: [], error: `INCOMPLETE_SURVEY_DATA: ${reason}`,
  });

  try {
    do {
      const page = await fetchPage(cursor);
      if (page.error) return failure("Falha ao consultar uma página da pesquisa.");
      if (page.count === null || !Number.isSafeInteger(page.count) || page.count < 0) {
        return failure("Contagem completa indisponível.");
      }
      if (expected === null) expected = page.count;
      if (rows.length + page.count !== expected) return failure("Contagem alterada durante a leitura.");
      const batch = page.data ?? [];
      if ((!batch.length && rows.length < expected) || batch.length > expected - rows.length) {
        return failure("Página incompatível com a contagem confirmada.");
      }
      for (const row of batch) {
        if (!row || typeof row.id !== "string" || !row.id || seen.has(row.id) || !belongsToSurvey(row)) {
          return failure("Registro inválido, duplicado ou fora da pesquisa.");
        }
        seen.add(row.id);
      }
      rows.push(...batch);
      if (rows.length < expected) cursor = cursorFor(batch[batch.length - 1]);
    } while (rows.length < expected);
    return { rows, error: null };
  } catch {
    return failure("Não foi possível concluir a paginação da pesquisa.");
  }
}

/** All responses, under the supplied client's existing session and RLS. */
export function loadAllSurveyResponses(
  client: SupabaseClient,
  surveyId: string,
  ascending = false,
): Promise<CompleteRead<SurveyResponse>> {
  type Cursor = { created_at: string; id: string };
  const comparison = ascending ? "gt" : "lt";
  return readCompletePages<SurveyResponse, Cursor>(async (cursor) => {
    let query = client.from("responses").select(COLUMNS, { count: "exact" })
      .eq("survey_id", surveyId)
      .order("created_at", { ascending }).order("id", { ascending });
    if (cursor) {
      query = query.or(
        `created_at.${comparison}.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.${comparison}.${cursor.id})`,
      );
    }
    const result = await query.limit(PAGE_SIZE);
    return { ...result, data: result.data as SurveyResponse[] | null };
  }, (row) => ({ created_at: row.created_at, id: row.id }), (row) =>
    row.survey_id === surveyId && typeof row.created_at === "string"
      && Number.isFinite(Date.parse(row.created_at)));
}

/** Questions must also be complete: extraction discards unknown question IDs. */
export async function loadAllSurveyQuestions(
  client: SupabaseClient,
  surveyId: string,
  includeTopic = false,
): Promise<CompleteRead<SurveyQuestion>> {
  const columns = "id,survey_id,type,title,description,required,position,options,created_at,updated_at";
  const result = await readCompletePages<SurveyQuestion, string>(async (cursor) => {
    let query = client.from("survey_questions")
      .select(includeTopic ? `${columns},topic` : columns, { count: "exact" })
      .eq("survey_id", surveyId).order("id", { ascending: true });
    if (cursor) query = query.gt("id", cursor);
    const page = await query.limit(PAGE_SIZE);
    return { ...page, data: page.data as unknown as SurveyQuestion[] | null };
  }, (row) => row.id, (row) => row.survey_id === surveyId);
  result.rows.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  return result;
}
