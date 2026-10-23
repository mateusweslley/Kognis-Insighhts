import type { SupabaseClient } from "@supabase/supabase-js";
import { readCompletePages } from "@/lib/survey-data-pages";

const PAGE_SIZE = 500;
const SURVEY_BATCH_SIZE = 100;
type FeedbackSurvey = { id: string; title: string; company_id: string };
type TextQuestion = { id: string; survey_id: string; title: string; type: "short_text" | "long_text" };

/** Complete metadata under the existing session/RLS, before any feed scan. */
export async function loadFeedbackMetadata(client: SupabaseClient, companyId: string): Promise<{
  surveys: FeedbackSurvey[];
  questions: TextQuestion[];
  error: string | null;
}> {
  const surveys = await readCompletePages<FeedbackSurvey, string>(async (cursor) => {
    let query = client.from("surveys").select("id,title,company_id", { count: "exact" })
      .eq("company_id", companyId).order("id", { ascending: true });
    if (cursor) query = query.gt("id", cursor);
    const result = await query.limit(PAGE_SIZE);
    return { ...result, data: result.data as FeedbackSurvey[] | null };
  }, (row) => row.id, (row) => row.company_id === companyId && typeof row.title === "string");
  const failure = (error: string) => ({ surveys: [], questions: [], error });
  if (surveys.error) return failure(surveys.error);

  const questions: TextQuestion[] = [];
  const seenQuestions = new Set<string>();
  for (let offset = 0; offset < surveys.rows.length; offset += SURVEY_BATCH_SIZE) {
    const ids = surveys.rows.slice(offset, offset + SURVEY_BATCH_SIZE).map((row) => row.id);
    const allowed = new Set(ids);
    const result = await readCompletePages<TextQuestion, string>(async (cursor) => {
      let query = client.from("survey_questions").select("id,survey_id,type,title", { count: "exact" })
        .in("survey_id", ids).in("type", ["short_text", "long_text"])
        .order("id", { ascending: true });
      if (cursor) query = query.gt("id", cursor);
      const page = await query.limit(PAGE_SIZE);
      return { ...page, data: page.data as TextQuestion[] | null };
    }, (row) => row.id, (row) => allowed.has(row.survey_id) && typeof row.title === "string"
      && (row.type === "short_text" || row.type === "long_text"));
    if (result.error) return failure(result.error);
    for (const row of result.rows) {
      if (seenQuestions.has(row.id)) return failure("INCOMPLETE_SURVEY_DATA: Pergunta duplicada entre lotes.");
      seenQuestions.add(row.id);
      questions.push(row);
    }
  }
  return { surveys: surveys.rows, questions, error: null };
}
