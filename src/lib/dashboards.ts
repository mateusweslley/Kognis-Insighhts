import { createClient } from "@/lib/supabase/client";
import type { Dashboard } from "@/types/dashboard";

type DashboardsResult = {
  dashboards: Dashboard[];
  error: string | null;
};

type DashboardResult = {
  dashboard: Dashboard | null;
  error: string | null;
};

type DashboardMutationResult = {
  dashboard: Dashboard | null;
  error: string | null;
};

type DashboardDeleteResult = {
  error: string | null;
};

export type NewDashboard = {
  company_id: string;
  name: string;
  description?: string | null;
  template_id?: string | null;
};

export type DashboardUpdate = {
  name?: string;
  description?: string | null;
  template_id?: string | null;
};

export async function getDashboards(companyId: string): Promise<DashboardsResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("dashboards")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar dashboards:", error);
    return { dashboards: [], error: getFriendlyDashboardError(error.message, error.code) };
  }

  return { dashboards: (data ?? []) as Dashboard[], error: null };
}

export async function getDashboard(dashboardId: string, companyId: string): Promise<DashboardResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("dashboards")
    .select("*")
    .eq("id", dashboardId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar dashboard:", error);
    return { dashboard: null, error: getFriendlyDashboardError(error.message, error.code) };
  }

  return { dashboard: (data as Dashboard | null) ?? null, error: null };
}

export async function createDashboard(input: NewDashboard): Promise<DashboardMutationResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("dashboards")
    .insert({
      company_id: input.company_id,
      name: input.name,
      description: input.description ?? null,
      template_id: input.template_id ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Erro ao criar dashboard:", error);
    return { dashboard: null, error: getFriendlyDashboardError(error.message, error.code) };
  }

  return { dashboard: data as Dashboard, error: null };
}

export async function updateDashboard(
  dashboardId: string,
  companyId: string,
  input: DashboardUpdate,
): Promise<DashboardMutationResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("dashboards")
    .update(input)
    .eq("id", dashboardId)
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (error) {
    console.error("Erro ao atualizar dashboard:", error);
    return { dashboard: null, error: getFriendlyDashboardError(error.message, error.code) };
  }

  return { dashboard: data as Dashboard, error: null };
}

export async function deleteDashboard(
  dashboardId: string,
  companyId: string,
): Promise<DashboardDeleteResult> {
  const supabase = createClient();

  const { error } = await supabase
    .from("dashboards")
    .delete()
    .eq("id", dashboardId)
    .eq("company_id", companyId);

  if (error) {
    console.error("Erro ao excluir dashboard:", error);
    return { error: getFriendlyDashboardError(error.message, error.code) };
  }

  return { error: null };
}

function getFriendlyDashboardError(message: string, code?: string) {
  const normalizedMessage = message.toLowerCase();

  if (code === "42P01" || normalizedMessage.includes("does not exist")) {
    return "A tabela de dashboards ainda não foi criada no Supabase. Aplique o SQL de supabase/2026_dashboard_builder.sql.";
  }

  if (normalizedMessage.includes("permission") || normalizedMessage.includes("row-level security")) {
    return "Você não tem permissão para acessar este dashboard.";
  }

  return "Não foi possível carregar os dashboards agora. Tente novamente.";
}
