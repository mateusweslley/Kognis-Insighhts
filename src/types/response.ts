export type ResponseAnswers = {
  name: string;
  email?: string;
  rating: number;
  comment?: string;
};

export type SurveyResponse = {
  id: string;
  survey_id: string;
  answers: ResponseAnswers;
  created_at: string;
};

export type SurveyResponseWithSurvey = SurveyResponse & {
  survey_title: string;
};

export type PublicSurvey = {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "active" | "archived";
};
