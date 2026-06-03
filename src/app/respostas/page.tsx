import { PanelPage } from "@/components/dashboard/panel-page";
import { AppShell } from "@/components/layout/app-shell";

export default function RespostasPage() {
  return (
    <AppShell>
      <PanelPage
        title="Respostas"
        description="Veja as respostas coletadas pelas pesquisas públicas da sua marca."
        actionLabel="Exportar CSV"
        emptyTitle="Nenhuma resposta recebida ainda."
        emptyDescription="As respostas aparecerão aqui quando consumidores acessarem os links públicos das pesquisas."
      />
    </AppShell>
  );
}
