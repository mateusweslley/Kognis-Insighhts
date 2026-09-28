export const surveyQuestionTypes = [
  "short_text",
  "long_text",
  "single_choice",
  "rating",
  "full_name",
  "email",
  "phone",
  "number",
  "rating_10",
] as const;

export type SurveyQuestionType = (typeof surveyQuestionTypes)[number];

export type SurveyQuestionOption = string;

export type SurveyQuestion = {
  id: string;
  survey_id: string;
  type: SurveyQuestionType;
  title: string;
  description: string | null;
  required: boolean;
  position: number;
  options: SurveyQuestionOption[];
  topic?: string | null;
  created_at: string;
  updated_at: string;
};

export type NewSurveyQuestion = {
  survey_id: string;
  type: SurveyQuestionType;
  title: string;
  description?: string | null;
  required?: boolean;
  position: number;
  options?: SurveyQuestionOption[];
  topic?: string | null;
};

export type SurveyQuestionUpdate = {
  type?: SurveyQuestionType;
  title?: string;
  description?: string | null;
  required?: boolean;
  position?: number;
  options?: SurveyQuestionOption[];
  topic?: string | null;
};

export const surveyQuestionTypeLabels: Record<SurveyQuestionType, string> = {
  short_text: "Texto curto",
  long_text: "Texto longo",
  single_choice: "Escolha única",
  rating: "Nota de 1 a 5",
  full_name: "Nome completo",
  email: "E-mail",
  phone: "Telefone",
  number: "Número",
  rating_10: "Nota de 0 a 10",
};
