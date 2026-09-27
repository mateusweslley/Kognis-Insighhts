import { CompanyForm } from "@/components/company/company-form";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentCompany } from "@/lib/company";

export default async function ConfiguracoesPage() {
  const company = await requireCurrentCompany();

  return (
    <AppShell>
      <PageContainer size="wide">
        <PageHeader
          title="Configurações"
          description="Gerencie os dados básicos da empresa vinculada à sua conta."
        />
        <Card>
          <CardHeader>
            <CardTitle>Empresa</CardTitle>
            <CardDescription>
              Atualize nome, segmento e uma URL pública da logo, se desejar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyForm mode="edit" company={company} />
          </CardContent>
        </Card>
      </PageContainer>
    </AppShell>
  );
}
