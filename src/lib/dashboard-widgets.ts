import { createClient } from "@/lib/supabase/client";
import type { DashboardVisualization, DashboardMetric, DashboardWidget, WidgetConfig } from "@/types/dashboard";

type WidgetsResult = {
  widgets: DashboardWidget[];
  error: string | null;
};

type WidgetResult = {
  widget: DashboardWidget | null;
  error: string | null;
};

type WidgetDeleteResult = {
  error: string | null;
};

export type NewDashboardWidget = {
  dashboard_id: string;
  title: string;
  survey_id: string | null;
  question_id: string | null;
  metric: DashboardMetric;
  visualization: DashboardVisualization;
  config?: WidgetConfig;
  position?: number;
  width?: number;
  height?: number;
};

export type DashboardWidgetUpdate = {
  title?: string;
  survey_id?: string | null;
  question_id?: string | null;
  metric?: DashboardMetric;
  visualization?: DashboardVisualization;
  config?: WidgetConfig;
  position?: number;
  width?: number;
  height?: number;
};

export async function getDashboardWidgets(dashboardId: string): Promise<WidgetsResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("dashboard_widgets")
    .select("*")
    .eq("dashboard_id", dashboardId)
    .order("position", { ascending: true });

  if (error) {
    console.error("Erro ao carregar widgets:", error);
    return { widgets: [], error: getFriendlyWidgetError(error.message, error.code) };
  }

  return { widgets: (data ?? []) as DashboardWidget[], error: null };
}

export async function createDashboardWidget(
  input: NewDashboardWidget,
): Promise<WidgetResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("dashboard_widgets")
    .insert({
      dashboard_id: input.dashboard_id,
      title: input.title,
      survey_id: input.survey_id ?? null,
      question_id: input.question_id ?? null,
      metric: input.metric,
      visualization: input.visualization,
      config: input.config ?? {},
      position: input.position ?? 1,
      width: input.width ?? 1,
      height: input.height ?? 1,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Erro ao criar widget:", error);
    return { widget: null, error: getFriendlyWidgetError(error.message, error.code) };
  }

  return { widget: data as DashboardWidget, error: null };
}

export async function updateDashboardWidget(
  widgetId: string,
  input: DashboardWidgetUpdate,
): Promise<WidgetResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("dashboard_widgets")
    .update(input)
    .eq("id", widgetId)
    .select("*")
    .single();

  if (error) {
    console.error("Erro ao atualizar widget:", error);
    return { widget: null, error: getFriendlyWidgetError(error.message, error.code) };
  }

  return { widget: data as DashboardWidget, error: null };
}

export async function deleteDashboardWidget(widgetId: string): Promise<WidgetDeleteResult> {
  const supabase = createClient();

  const { error } = await supabase.from("dashboard_widgets").delete().eq("id", widgetId);

  if (error) {
    console.error("Erro ao excluir widget:", error);
    return { error: getFriendlyWidgetError(error.message, error.code) };
  }

  return { error: null };
}

export async function reorderDashboardWidgets(
  widgets: Array<{ id: string; position: number }>,
): Promise<WidgetDeleteResult> {
  const supabase = createClient();

  const updates = widgets.map((widget) =>
    supabase.from("dashboard_widgets").update({ position: widget.position }).eq("id", widget.id),
  );

  const results = await Promise.all(updates);
  const failedResult = results.find((result) => result.error);

  if (failedResult?.error) {
    console.error("Erro ao reordenar widgets:", failedResult.error);
    return { error: getFriendlyWidgetError(failedResult.error.message, failedResult.error.code) };
  }

  return { error: null };
}

function getFriendlyWidgetError(message: string, code?: string) {
  const normalizedMessage = message.toLowerCase();

  if (code === "42P01" || normalizedMessage.includes("does not exist")) {
    return "A tabela de widgets ainda não foi criada no Supabase. Aplique o SQL de supabase/2026_dashboard_builder.sql.";
  }

  if (normalizedMessage.includes("permission") || normalizedMessage.includes("row-level security")) {
    return "Você não tem permissão para gerenciar este widget.";
  }

  return "Não foi possível gerenciar o widget agora. Tente novamente.";
}
