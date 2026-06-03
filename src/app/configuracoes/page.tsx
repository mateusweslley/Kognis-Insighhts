import { CompanyForm } from "@/components/company/company-form";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentCompany } from "@/lib/company";

export default async function ConfiguracoesPage() {
  const company = await requireCurrentCompany();

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-white">Configuracoes</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Gerencie os dados basicos da empresa vinculada a sua conta.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Empresa</CardTitle>
            <CardDescription>
              Atualize nome, segmento e URL da logo. O upload de imagem fica para uma sprint futura.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyForm mode="edit" company={company} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
