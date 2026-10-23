import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedbackBatch, FeedbackCursor, FeedbackResponse } from "@/lib/feedback-feed";

/** Bounded reads for the public feed, using the session/RLS already in force. */
export function createFeedbackResponseSource(client: SupabaseClient, surveyIds: string[]) {
  const allowed = new Set(surveyIds);
  const validateScope = (row: FeedbackResponse) => {
    if (!allowed.has(row.survey_id)) throw new Error("INCOMPLETE_SURVEY_DATA: Resposta fora do escopo do feed.");
    return row;
  };
  return {
    async fetchBatch(after: FeedbackCursor | null, limit: number): Promise<FeedbackBatch> {
      let query = client.from("responses")
        .select("id,survey_id,answers,created_at", { count: "exact" })
        .in("survey_id", surveyIds)
        .order("created_at", { ascending: false }).order("id", { ascending: false })
        .limit(limit);
      if (after) query = query.or(
        `created_at.lt.${after.createdAt},and(created_at.eq.${after.createdAt},id.lt.${after.responseId})`,
      );
      const { data, error, count } = await query;
      if (error) throw new Error("INCOMPLETE_SURVEY_DATA: Falha ao consultar respostas do feed.");
      return { rows: ((data ?? []) as FeedbackResponse[]).map(validateScope), count };
    },
    async fetchById(responseId: string): Promise<FeedbackResponse | null> {
      const { data, error } = await client.from("responses")
        .select("id,survey_id,answers,created_at").in("survey_id", surveyIds)
        .eq("id", responseId).maybeSingle();
      if (error) throw new Error("INCOMPLETE_SURVEY_DATA: Falha ao retomar uma resposta do feed.");
      return data ? validateScope(data as FeedbackResponse) : null;
    },
  };
}
