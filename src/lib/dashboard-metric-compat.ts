// Regras de compatibilidade entre tipo de pergunta e métricas disponíveis.
// Centraliza a validação para que a UI ofereça apenas combinações válidas.
// Camada pura: sem React/Supabase.

import type { DashboardMetric, DashboardVisualization } from "@/types/dashboard";
import type { SurveyQuestion, SurveyQuestionType } from "@/types/survey-question";

// Métricas que dependem de uma pergunta específica e de seu tipo.
const metricsByQuestionType: Record<SurveyQuestionType, DashboardMetric[]> = {
  rating: ["average", "distribution", "trend"],
  rating_10: ["average", "distribution", "trend"],
  number: ["average"],
  single_choice: ["distribution"],
  short_text: [],
  long_text: [],
  full_name: [],
  email: [],
  phone: [],
};

// Métricas disponíveis no nível da pesquisa (sem pergunta específica).
export const surveyLevelMetrics: DashboardMetric[] = ["response_count", "top_topics"];

// Visualizações disponíveis por métrica. Impede combinações sem sentido (ex.: pie para média).
const visualizationsByMetric: Record<DashboardMetric, DashboardVisualization[]> = {
  response_count: ["kpi"],
  average: ["kpi", "bar", "line"],
  distribution: ["bar", "pie", "table"],
  trend: ["line", "bar"],
  // Pendência: não há fórmula de NPS no Metrics Engine ainda.
  nps: ["kpi"],
  top_topics: ["bar", "table"],
};

// Rótulos legíveis por métrica e por visualização. A UI usa estes labels,
// nunca os valores crus, para manter a experiência consistente com o Kognis.
export const dashboardMetricLabels: Record<DashboardMetric, string> = {
  response_count: "Quantidade de respostas",
  average: "Média",
  distribution: "Distribuição",
  trend: "Evolução no tempo",
  nps: "NPS",
  top_topics: "Principais temas",
};

export const dashboardVisualizationLabels: Record<DashboardVisualization, string> = {
  kpi: "Indicador (KPI)",
  bar: "Barras",
  pie: "Pizza",
  line: "Linha",
  table: "Tabela",
};

export function getAvailableMetricsForQuestion(question: SurveyQuestion): DashboardMetric[] {
  return metricsByQuestionType[question.type] ?? [];
}

export function getAvailableMetricsForSurvey(): DashboardMetric[] {
  return surveyLevelMetrics;
}

export function getAvailableVisualizationsForMetric(metric: DashboardMetric): DashboardVisualization[] {
  return visualizationsByMetric[metric] ?? [];
}

export function isMetricAvailableForQuestion(
  metric: DashboardMetric,
  question: SurveyQuestion,
): boolean {
  return getAvailableMetricsForQuestion(question).includes(metric);
}

export function isVisualizationValidForMetric(
  metric: DashboardMetric,
  visualization: DashboardVisualization,
): boolean {
  return getAvailableVisualizationsForMetric(metric).includes(visualization);
}
