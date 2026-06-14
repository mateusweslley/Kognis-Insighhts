export type LegacyResponseAnswers = {
  name: string;
  email?: string;
  rating: number;
  comment?: string;
};

export type DynamicResponseValue = string | number;

export type DynamicResponseAnswers = {
  mode: "dynamic";
  answers: Record<string, DynamicResponseValue>;
};

export type ResponseAnswers = LegacyResponseAnswers | DynamicResponseAnswers;

export type SurveyResponse = {
  id: string;
  survey_id: string;
  answers: ResponseAnswers;
  created_at: string;
};

export type SurveyResponseWithSurvey = SurveyResponse & {
  survey_title: string;
  question_titles?: Record<string, string>;
};

export type PublicSurvey = {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "active" | "archived";
};
