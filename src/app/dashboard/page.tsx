import { PanelPage } from "@/components/dashboard/panel-page";
import { AppShell } from "@/components/layout/app-shell";

export default function DashboardPage() {
  return (
    <AppShell>
      <PanelPage
        title="Dashboard"
        description="Acompanhe os principais sinais das pesquisas e campanhas da sua marca."
        actionLabel="Criar primeira pesquisa"
        emptyTitle="Dashboard aguardando respostas."
        emptyDescription="Quando consumidores responderem suas pesquisas, os indicadores principais aparecerão aqui."
      />
    </AppShell>
  );
}
