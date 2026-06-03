import { redirect } from "next/navigation";
import Link from "next/link";

import { CompanyForm } from "@/components/company/company-form";
import { BrandMark } from "@/components/marketing/brand-mark";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentCompany } from "@/lib/company";

export default async function OnboardingPage() {
  const company = await getCurrentCompany();

  if (company) {
    redirect("/dashboard");
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <div className="w-full max-w-xl">
        <Link href="/dashboard" className="mb-8 flex justify-center" aria-label="Ir para o dashboard">
          <BrandMark />
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Cadastre sua empresa</CardTitle>
            <CardDescription>
              A Kognis usa estes dados para organizar pesquisas, campanhas e respostas da sua marca.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyForm mode="create" />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
