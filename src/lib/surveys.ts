import { createClient } from "@/lib/supabase/server";
import type { Survey } from "@/types/survey";

export async function getCompanySurveys(companyId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("surveys")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Nao foi possivel carregar as pesquisas.");
  }

  return (data ?? []) as Survey[];
}
