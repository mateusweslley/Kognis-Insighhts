import type { SurveyResponseWithSurvey } from "@/types/response";

export function exportResponsesToCsv(responses: SurveyResponseWithSurvey[]) {
  const headers = ["id", "survey_id", "name", "email", "rating", "comment", "created_at"];
  const rows = responses.map((response) => [
    response.id,
    response.survey_id,
    response.answers.name,
    response.answers.email ?? "",
    String(response.answers.rating),
    response.answers.comment ?? "",
    response.created_at,
  ]);

  return [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}
