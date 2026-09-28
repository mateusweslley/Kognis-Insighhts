"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDashboards } from "@/lib/dashboards";
import { createDashboardFromTemplate, internalDashboardTemplates } from "@/lib/dashboard-templates";
import type { Dashboard } from "@/types/dashboard";

type DashboardManagerProps = {
  companyId: string;
};

export function DashboardManager({ companyId }: DashboardManagerProps) {
  const router = useRouter();
  const [dashboards, setDashboards] = useState<Dashboard[] | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<string>("custom");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboards() {
    const result = await getDashboards(companyId);
    setDashboards(result.dashboards);
    if (result.error && dashboards === null) {
      setError(result.error);
    }
  }

  async function handleCreate() {
    setIsLoading(true);
    setError(null);

    const result = await createDashboardFromTemplate(
      templateId,
      companyId,
      name.trim() || "Meu dashboard",
    );

    if (result.error || !result.dashboardId) {
      setError(result.error ?? "Não foi possível criar o dashboard.");
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    setName("");
    setTemplateId("custom");
    setIsCreating(false);
    router.push(`/dashboard/${result.dashboardId}`);
  }

  // Carrega a listagem de forma controlada via botão de "Ver dashboards".
  if (dashboards === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Meus dashboards</CardTitle>
          <CardDescription>Crie e gerencie os painéis da sua empresa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={loadDashboards} disabled={isLoading}>
              Ver dashboards
            </Button>
            <Button variant="secondary" onClick={() => setIsCreating(true)}>
              Novo dashboard
            </Button>
          </div>
          {error ? (
            <p className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meus dashboards</CardTitle>
        <CardDescription>Crie e gerencie os painéis da sua empresa.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <p className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {isCreating ? (
          <div className="space-y-3 rounded-md border border-border p-4">
            <div className="space-y-2">
              <Label htmlFor="dashboard-name">Nome do dashboard</Label>
              <Input
                id="dashboard-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex: Satisfação do cliente"
              />
            </div>
            <div className="space-y-2">
              <Label>Começar com um modelo</Label>
              <div className="grid gap-2 md:grid-cols-2">
                {internalDashboardTemplates.map((template) => {
                  const isSelected = templateId === template.id;

                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setTemplateId(template.id)}
                      className={`rounded-md border p-3 text-left transition-colors ${
                        isSelected
                          ? "border-brand bg-brand-soft text-text-primary"
                          : "border-border bg-surface-muted text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      <span className="block text-sm font-semibold text-text-primary">{template.name}</span>
                      <span className="mt-1 block text-sm leading-5">{template.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={handleCreate} disabled={isLoading}>
                {isLoading ? "Criando..." : "Criar dashboard"}
              </Button>
              <Button variant="secondary" onClick={() => setIsCreating(false)} disabled={isLoading}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setIsCreating(true)} disabled={isLoading}>
            Novo dashboard
          </Button>
        )}

        <div className="space-y-3">
          {dashboards.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum dashboard criado ainda. Crie um para começar.
            </p>
          ) : (
            dashboards.map((dashboard) => (
              <div
                key={dashboard.id}
                className="flex flex-col gap-2 rounded-md border border-border bg-surface-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-text-primary">{dashboard.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {dashboard.description || "Sem descrição."}
                  </p>
                </div>
                <Button size="sm" variant="secondary" asChild>
                  <Link href={`/dashboard/${dashboard.id}`}>Abrir</Link>
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
