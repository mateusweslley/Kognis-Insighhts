// Templates internos de dashboard (Sprint 2).
//
// PENDÊNCIA EXPLÍCITA:
// - A métrica "nps" NÃO possui fórmula no Metrics Engine ainda. Não foi criada
//   fórmula improvisada. O template NPS cria apenas widgets que dependem de
//   métricas já existentes (response_count, trend), e os indicadores de NPS
//   ficam para uma sprint futura após o engine ganhar computeNps.
// - "average"/"distribution" por pergunta dependem do usuário escolher uma
//   pergunta elegível (rating/single_choice). Templates não amarram widgets a
//   perguntas específicas de antemão.

import { createDashboard } from "@/lib/dashboards";
import { createDashboardWidget } from "@/lib/dashboard-widgets";
import type { DashboardMetric, DashboardVisualization, DashboardTemplate } from "@/types/dashboard";

export type InternalDashboardTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  // Widgets base criados ao instanciar o template (nível pesquisa, sem pergunta).
  widgets: Array<{ title: string; metric: DashboardMetric; visualization: DashboardVisualization }>;
};

export const internalDashboardTemplates: InternalDashboardTemplate[] = [
  {
    id: "nps",
    name: "NPS",
    description: "Acompanhe a saúde do relacionamento com o cliente.",
    category: "customer_experience",
    widgets: [
      { title: "Respostas", metric: "response_count", visualization: "kpi" },
      { title: "Evolução", metric: "trend", visualization: "line" },
    ],
  },
  {
    id: "satisfaction",
    name: "Satisfação",
    description: "Veja a satisfação geral dos seus clientes.",
    category: "customer_experience",
    widgets: [
      { title: "Respostas", metric: "response_count", visualization: "kpi" },
      { title: "Evolução", metric: "trend", visualization: "line" },
    ],
  },
  {
    id: "know_customers",
    name: "Conhecer clientes",
    description: "Entenda o perfil e o comportamento dos seus clientes.",
    category: "customer_profile",
    widgets: [
      { title: "Respostas", metric: "response_count", visualization: "kpi" },
      { title: "Evolução", metric: "trend", visualization: "line" },
    ],
  },
  {
    id: "custom",
    name: "Personalizado",
    description: "Comece do zero e monte seu próprio dashboard.",
    category: "custom",
    widgets: [],
  },
];

export function getDashboardTemplates(): DashboardTemplate[] {
  return internalDashboardTemplates.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    type: "internal",
    config: { widgets: template.widgets },
    is_active: true,
    created_at: "",
    updated_at: "",
  }));
}

export function getDashboardTemplate(templateId: string): DashboardTemplate | null {
  const template = internalDashboardTemplates.find((item) => item.id === templateId);

  if (!template) {
    return null;
  }

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    type: "internal",
    config: { widgets: template.widgets },
    is_active: true,
    created_at: "",
    updated_at: "",
  };
}

export type CreateDashboardFromTemplateResult = {
  dashboardId: string | null;
  error: string | null;
};

export async function createDashboardFromTemplate(
  templateId: string,
  companyId: string,
  name: string,
): Promise<CreateDashboardFromTemplateResult> {
  const template = internalDashboardTemplates.find((item) => item.id === templateId);

  if (!template) {
    return { dashboardId: null, error: "Modelo de dashboard não encontrado." };
  }

  const created = await createDashboard({
    company_id: companyId,
    name,
    description: template.description,
    template_id: template.id,
  });

  if (created.error || !created.dashboard) {
    return { dashboardId: null, error: created.error };
  }

  const dashboardId = created.dashboard.id;

  for (let index = 0; index < template.widgets.length; index += 1) {
    const widget = template.widgets[index];

    const result = await createDashboardWidget({
      dashboard_id: dashboardId,
      title: widget.title,
      survey_id: null,
      question_id: null,
      metric: widget.metric,
      visualization: widget.visualization,
      position: index + 1,
    });

    if (result.error) {
      return { dashboardId, error: result.error };
    }
  }

  return { dashboardId, error: null };
}
