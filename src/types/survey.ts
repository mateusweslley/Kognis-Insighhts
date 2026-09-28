export const surveyStatuses = ["draft", "active", "archived"] as const;

export type SurveyStatus = (typeof surveyStatuses)[number];

export const surveyObjectives = [
  "know_customers",
  "customer_experience",
  "satisfaction",
  "purchase_intent",
  "product_service",
  "other",
  "undefined",
] as const;

export type SurveyObjective = (typeof surveyObjectives)[number];

export type Survey = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  objective?: SurveyObjective | null;
  objective_note?: string | null;
  created_at: string;
  updated_at: string;
};

export const surveyStatusLabels: Record<SurveyStatus, string> = {
  draft: "Em preparação",
  active: "Recebendo respostas",
  archived: "Encerrada",
};

export const surveyObjectiveLabels: Record<SurveyObjective, string> = {
  know_customers: "Conhecer melhor meus clientes",
  customer_experience: "Avaliar a experiência do cliente",
  satisfaction: "Medir satisfação",
  purchase_intent: "Entender intenção de compra",
  product_service: "Avaliar produto ou serviço",
  other: "Outro objetivo",
  undefined: "Ainda não definido",
};
