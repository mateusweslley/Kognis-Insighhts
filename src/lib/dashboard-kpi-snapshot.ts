import type { DashboardKpis, DashboardPeriodDays } from "@/lib/metrics/dashboard-kpis";

export const dashboardKpiPeriods = [7, 30, 90] as const satisfies readonly DashboardPeriodDays[];

export type DashboardKpiSnapshot = {
  periods: Record<DashboardPeriodDays, DashboardKpis>;
  primaryQuestionConfigurationUnavailable: boolean;
};

export function selectDashboardPeriod(
  snapshot: DashboardKpiSnapshot,
  periodDays: DashboardPeriodDays,
): DashboardKpis {
  return snapshot.periods[periodDays];
}
