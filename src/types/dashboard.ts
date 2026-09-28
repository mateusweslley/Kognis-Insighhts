// Tipos do Dashboard Builder (Sprint 2).
// O Dashboard organiza, não calcula. Toda métrica é resolvida via Metrics Engine.

export type DashboardMetric =
  | "response_count"
  | "average"
  | "distribution"
  | "trend"
  | "nps"
  | "top_topics";

export type DashboardVisualization = "kpi" | "bar" | "pie" | "line" | "table";

// Configuração de apresentação flexível. Nunca guardar aqui informação estrutural
// (survey_id / question_id / metric / visualization) — essas têm coluna própria.
export type WidgetConfig = Record<string, unknown>;

export type Dashboard = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  template_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DashboardWidget = {
  id: string;
  dashboard_id: string;
  title: string;
  survey_id: string | null;
  question_id: string | null;
  metric: DashboardMetric;
  visualization: DashboardVisualization;
  config: WidgetConfig;
  position: number;
  width: number;
  height: number;
  created_at: string;
  updated_at: string;
};

export type DashboardTemplate = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  type: string | null;
  config: WidgetConfig;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// Receita de widget usada internamente para interpretação de templates.
// Mantida fora do banco (templates internos são definidos em código).
export type DashboardTemplateWidget = {
  title: string;
  metric: DashboardMetric;
  visualization: DashboardVisualization;
};
