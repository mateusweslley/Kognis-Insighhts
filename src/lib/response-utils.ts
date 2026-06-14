import type { DynamicResponseAnswers, ResponseAnswers, SurveyResponseWithSurvey } from "@/types/response";

export function exportResponsesToCsv(responses: SurveyResponseWithSurvey[]) {
  const dynamicColumnIds = collectDynamicColumnIds(responses);
  const dynamicHeaders = dynamicColumnIds.map((questionId) =>
    getDynamicQuestionHeader(questionId, responses),
  );
  const headers = [
    "id",
    "survey_id",
    "survey_title",
    "name",
    "email",
    "rating",
    "comment",
    ...dynamicHeaders,
    "created_at",
  ];
  const rows = responses.map((response) => {
    const legacyAnswers = isDynamicResponseAnswers(response.answers) ? null : response.answers;
    const dynamicAnswers = isDynamicResponseAnswers(response.answers) ? response.answers.answers : {};

    return [
      response.id,
      response.survey_id,
      response.survey_title,
      legacyAnswers?.name ?? "",
      legacyAnswers?.email ?? "",
      legacyAnswers?.rating ? String(legacyAnswers.rating) : "",
      legacyAnswers?.comment ?? "",
      ...dynamicColumnIds.map((questionId) => dynamicAnswers[questionId] ?? ""),
      response.created_at,
    ];
  });

  return [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

export function isDynamicResponseAnswers(answers: ResponseAnswers): answers is DynamicResponseAnswers {
  return (
    typeof answers === "object" &&
    answers !== null &&
    "mode" in answers &&
    answers.mode === "dynamic" &&
    "answers" in answers &&
    typeof answers.answers === "object" &&
    answers.answers !== null
  );
}

export function getResponseSummary(answers: ResponseAnswers) {
  if (isDynamicResponseAnswers(answers)) {
    const answeredCount = Object.keys(answers.answers).length;

    return answeredCount === 1 ? "1 resposta dinamica" : `${answeredCount} respostas dinamicas`;
  }

  return `${answers.name} - Nota ${answers.rating}`;
}

export function getLegacyComment(answers: ResponseAnswers) {
  if (isDynamicResponseAnswers(answers)) {
    return null;
  }

  return answers.comment ?? null;
}

function collectDynamicColumnIds(responses: SurveyResponseWithSurvey[]) {
  const questionIds = new Set<string>();

  responses.forEach((response) => {
    if (!isDynamicResponseAnswers(response.answers)) {
      return;
    }

    Object.keys(response.answers.answers).forEach((questionId) => {
      questionIds.add(questionId);
    });
  });

  return Array.from(questionIds);
}

function getDynamicQuestionHeader(questionId: string, responses: SurveyResponseWithSurvey[]) {
  const title = responses.find((response) => response.question_titles?.[questionId])?.question_titles?.[
    questionId
  ];

  return title ? `${title} (${questionId})` : questionId;
}
