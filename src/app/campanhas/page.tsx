import { PanelPage } from "@/components/dashboard/panel-page";
import { AppShell } from "@/components/layout/app-shell";

export default function CampanhasPage() {
  return (
    <AppShell>
      <PanelPage
        title="Campanhas"
        description="Organize QR Codes por origem, como etiqueta, sacola, loja física ou pós-venda."
        actionLabel="Nova campanha"
        emptyTitle="Nenhuma campanha criada ainda."
        emptyDescription="Cada campanha ajudará a identificar de onde vieram as respostas dos consumidores."
      />
    </AppShell>
  );
}
