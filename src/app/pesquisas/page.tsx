import { PanelPage } from "@/components/dashboard/panel-page";
import { AppShell } from "@/components/layout/app-shell";

export default function PesquisasPage() {
  return (
    <AppShell>
      <PanelPage
        title="Pesquisas"
        description="Crie e gerencie pesquisas de consumidor vinculadas aos seus QR Codes."
        actionLabel="Nova pesquisa"
        emptyTitle="Nenhuma pesquisa criada ainda."
        emptyDescription="Comece criando uma pesquisa simples para coletar perfil, compra, satisfação e comentários."
      />
    </AppShell>
  );
}
