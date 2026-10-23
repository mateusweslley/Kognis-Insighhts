import type { SupabaseClient } from "@supabase/supabase-js";
import { readCompletePages } from "@/lib/survey-data-pages";
import type { Survey } from "@/types/survey";

const PAGE_SIZE = 500;
const SURVEY_BATCH_SIZE = 100;

export type CompanyResponseCounts = {
  surveys: Survey[];
  counts: Map<string, number>;
  error: string | null;
};

/** Count stored rows, preserving the existing all-time/all-status contract.
 * Reuse verified keyset pagination instead of N exact-count requests for N surveys.
 * Only response IDs and survey IDs are transferred; answers never leave the DB.
 */
export async function loadCompanyResponseCounts(
  client: SupabaseClient,
  companyId: string,
): Promise<CompanyResponseCounts> {
  const source = await readCompletePages<Survey, string>(async (cursor) => {
    let query = client.from("surveys").select("*", { count: "exact" })
      .eq("company_id", companyId).order("id", { ascending: true });
    if (cursor) query = query.gt("id", cursor);
    const result = await query.limit(PAGE_SIZE);
    return { ...result, data: result.data as Survey[] | null };
  }, (survey) => survey.id, (survey) => survey.company_id === companyId);

  if (source.error) return { surveys: [], counts: new Map(), error: source.error };
  const surveys = source.rows.sort((a, b) => {
    // Match PostgreSQL's descending timestamp order (NULLS FIRST).
    if (a.created_at == null || b.created_at == null) {
      return a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at == null ? -1 : 1;
    }
    return b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id);
  });
  const ids = surveys.map((survey) => survey.id);
  const counts = new Map(ids.map((id) => [id, 0]));
  const seen = new Set<string>();

  // Bound IN filters and run batches sequentially to avoid unbounded concurrency.
  for (let offset = 0; offset < ids.length; offset += SURVEY_BATCH_SIZE) {
    const batchIds = ids.slice(offset, offset + SURVEY_BATCH_SIZE);
    const allowed = new Set(batchIds);
    type CountRow = { id: string; survey_id: string };
    const result = await readCompletePages<CountRow, string>(async (cursor) => {
      let query = client.from("responses").select("id,survey_id", { count: "exact" })
        .in("survey_id", batchIds).order("id", { ascending: true });
      if (cursor) query = query.gt("id", cursor);
      const page = await query.limit(PAGE_SIZE);
      return { ...page, data: page.data as CountRow[] | null };
    }, (row) => row.id, (row) => allowed.has(row.survey_id));
    if (result.error) return { surveys, counts: new Map(), error: result.error };
    for (const row of result.rows) {
      if (seen.has(row.id)) {
        return { surveys, counts: new Map(), error: "INCOMPLETE_SURVEY_DATA: Resposta duplicada entre lotes." };
      }
      seen.add(row.id);
      counts.set(row.survey_id, counts.get(row.survey_id)! + 1);
    }
  }
  return { surveys, counts, error: null };
}
