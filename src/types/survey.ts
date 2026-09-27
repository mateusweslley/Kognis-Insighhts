export const surveyStatuses = ["draft", "active", "archived"] as const;

export type SurveyStatus = (typeof surveyStatuses)[number];

export type Survey = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  created_at: string;
  updated_at: string;
};

export const surveyStatusLabels: Record<SurveyStatus, string> = {
  draft: "Em preparação",
  active: "Recebendo respostas",
  archived: "Encerrada",
};
