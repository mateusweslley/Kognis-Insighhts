import { NextResponse } from "next/server";

import { loadCurrentDashboardKpiSourceData, toDashboardKpisInput } from "@/lib/dashboard-kpi-source.server";
import { calculateDashboardKpis } from "@/lib/metrics/dashboard-kpis";
import { dashboardKpiPeriods, type DashboardKpiSnapshot } from "@/lib/dashboard-kpi-snapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  const source = await loadCurrentDashboardKpiSourceData();
  const periods = Object.fromEntries(
    dashboardKpiPeriods.map((periodDays) => [
      periodDays,
      calculateDashboardKpis(toDashboardKpisInput(source, periodDays)),
    ]),
  ) as DashboardKpiSnapshot["periods"];

  const snapshot: DashboardKpiSnapshot = {
    periods,
    primaryQuestionConfigurationUnavailable: source.primaryQuestionConfiguration.status === "error",
  };

  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
