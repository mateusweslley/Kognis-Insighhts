export const surveyQuestionTypes = ["short_text", "long_text", "single_choice", "rating"] as const;

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
};

export type SurveyQuestionUpdate = {
  type?: SurveyQuestionType;
  title?: string;
  description?: string | null;
  required?: boolean;
  position?: number;
  options?: SurveyQuestionOption[];
};

export const surveyQuestionTypeLabels: Record<SurveyQuestionType, string> = {
  short_text: "Texto curto",
  long_text: "Texto longo",
  single_choice: "Escolha única",
  rating: "Nota de 1 a 5",
};
