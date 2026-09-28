import { isDynamicResponseAnswers } from "@/lib/response-utils";
import type { ResponseAnswers, SurveyResponse } from "@/types/response";
import type { SurveyQuestion } from "@/types/survey-question";

export type NormalizedResponseField = {
  questionId?: string;
  label: string;
  value: string | number | boolean | null;
  type?: string;
  position?: number;
};

export type NormalizedResponse = {
  id: string;
  surveyId: string;
  createdAt: string;
  respondentLabel: string;
  summary: string;
  fields: NormalizedResponseField[];
};

type QuestionMeta = {
  id: string;
  title: string;
  type: string;
  position: number;
};

export function normalizeResponses(
  responses: SurveyResponse[],
  questions: SurveyQuestion[] = [],
): NormalizedResponse[] {
  const questionMetas = questions
    .map((question) => ({
      id: question.id,
      title: question.title,
      type: question.type,
      position: question.position,
    }))
    .sort((firstQuestion, secondQuestion) => firstQuestion.position - secondQuestion.position);

  return responses.map((response, index) =>
    normalizeResponse(response, questionMetas, index + 1),
  );
}

export function exportNormalizedResponsesToCsv(responses: NormalizedResponse[]) {
  const fieldLabels = collectFieldLabels(responses);
  const headers = ["Data", ...fieldLabels];
  const rows = responses.map((response) => [
    formatCsvDate(response.createdAt),
    ...fieldLabels.map((label) => getFieldValueByLabel(response, label)),
  ]);

  return [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

function normalizeResponse(
  response: SurveyResponse,
  questionMetas: QuestionMeta[],
  responseNumber: number,
): NormalizedResponse {
  const fields = isDynamicResponseAnswers(response.answers)
    ? normalizeDynamicFields(response.answers, questionMetas)
    : normalizeLegacyFields(response.answers);

  return {
    id: response.id,
    surveyId: response.survey_id,
    createdAt: response.created_at,
    respondentLabel: getRespondentLabel(fields, responseNumber),
    summary: getSummary(fields),
    fields,
  };
}

function normalizeDynamicFields(
  answers: Extract<ResponseAnswers, { mode: "dynamic" }>,
  questionMetas: QuestionMeta[],
) {
  const questionIds = new Set(questionMetas.map((questionMeta) => questionMeta.id));
  const knownFields = questionMetas.map((questionMeta) => ({
    questionId: questionMeta.id,
    label: questionMeta.title,
    value: answers.answers[questionMeta.id] ?? null,
    type: questionMeta.type,
    position: questionMeta.position,
  } satisfies NormalizedResponseField));

  const extraFields = Object.entries(answers.answers)
    .filter(([questionId]) => !questionIds.has(questionId))
    .map(([questionId, value]) => ({
      questionId,
      label: questionId,
      value,
      position: Number.MAX_SAFE_INTEGER,
    } satisfies NormalizedResponseField));

  return [...knownFields, ...extraFields]
    .sort((firstField, secondField) => {
      const firstPosition = firstField.position ?? Number.MAX_SAFE_INTEGER;
      const secondPosition = secondField.position ?? Number.MAX_SAFE_INTEGER;

      return firstPosition - secondPosition || firstField.label.localeCompare(secondField.label);
    });
}

function normalizeLegacyFields(answers: Exclude<ResponseAnswers, { mode: "dynamic" }>) {
  return [
    {
      label: "Nome",
      value: answers.name,
      type: "short_text",
      position: 1,
    },
    {
      label: "E-mail",
      value: answers.email ?? null,
      type: "short_text",
      position: 2,
    },
    {
      label: "Nota",
      value: answers.rating,
      type: "rating",
      position: 3,
    },
    {
      label: "Comentário",
      value: answers.comment ?? null,
      type: "long_text",
      position: 4,
    },
  ] satisfies NormalizedResponseField[];
}

function getRespondentLabel(fields: NormalizedResponseField[], responseNumber: number) {
  const identityField = fields.find((field) => {
    const label = normalizeText(field.label);

    return (
      label.includes("nome") ||
      label.includes("name") ||
      label.includes("email") ||
      label.includes("telefone") ||
      label.includes("phone") ||
      label.includes("instagram")
    );
  });

  if (identityField?.value) {
    return String(identityField.value);
  }

  return `Resposta #${responseNumber}`;
}

function getSummary(fields: NormalizedResponseField[]) {
  const visibleFields = fields
    .filter((field) => field.value !== null && field.value !== "")
    .slice(0, 3)
    .map((field) => formatSummaryValue(field));

  return visibleFields.length > 0 ? visibleFields.join(" - ") : "Sem respostas preenchidas";
}

function formatSummaryValue(field: NormalizedResponseField) {
  const isRating = field.type === "rating" || field.type === "rating_10";

  if (isRating || normalizeText(field.label).includes("nota")) {
    return `Nota ${field.value}`;
  }

  return String(field.value);
}

function collectFieldLabels(responses: NormalizedResponse[]) {
  const labels = new Map<string, number>();

  responses.forEach((response) => {
    response.fields.forEach((field) => {
      const position = field.position ?? Number.MAX_SAFE_INTEGER;
      const currentPosition = labels.get(field.label);

      if (currentPosition === undefined || position < currentPosition) {
        labels.set(field.label, position);
      }
    });
  });

  return Array.from(labels.entries())
    .sort(
      ([firstLabel, firstPosition], [secondLabel, secondPosition]) =>
        firstPosition - secondPosition || firstLabel.localeCompare(secondLabel),
    )
    .map(([label]) => label);
}

function getFieldValueByLabel(response: NormalizedResponse, label: string) {
  const field = response.fields.find((item) => item.label === label);

  return field?.value ?? "";
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatCsvDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
