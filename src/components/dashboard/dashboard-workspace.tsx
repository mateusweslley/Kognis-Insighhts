"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DashboardCanvas } from "@/components/dashboard/dashboard-canvas";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getDashboards } from "@/lib/dashboards";
import { createDashboardFromTemplate, internalDashboardTemplates } from "@/lib/dashboard-templates";
import type { Dashboard } from "@/types/dashboard";
import type { Survey } from "@/types/survey";

type DashboardWorkspaceProps = {
  companyId: string;
  surveys: Survey[];
  totalResponses: number;
  totalCampaigns: number;
  error?: string | null;
};

// A opção "Visão geral" não é um dashboard persistido: é o dashboard padrão do
// sistema, apresentado quando o usuário ainda não selecionou um painel próprio.
const OVERVIEW_ID = "__overview__";

export function DashboardWorkspace({
  companyId,
  surveys,
  totalResponses,
  totalCampaigns,
  error: overviewError,
}: DashboardWorkspaceProps) {
  const router = useRouter();
  const [dashboards, setDashboards] = useState<Dashboard[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>(OVERVIEW_ID);
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

  useEffect(() => {
    loadDashboards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

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

    setName("");
    setTemplateId("custom");
    setIsCreating(false);
    setIsLoading(false);

    await loadDashboards();
    setSelectedId(result.dashboardId);
    router.refresh();
  }

  const selectedDashboard =
    selectedId !== OVERVIEW_ID ? dashboards?.find((d) => d.id === selectedId) ?? null : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sua central de inteligência a partir dos dados das pesquisas.
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo dashboard
        </Button>
      </div>

      {dashboards === null ? (
        <p className="text-sm text-muted-foreground">Carregando dashboard…</p>
      ) : error && dashboards === null ? (
        <p className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : (
        <>
          <div className="relative">
            <Select
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              className="w-full sm:max-w-xs"
              aria-label="Selecionar dashboard"
            >
              <option value={OVERVIEW_ID}>Visão geral</option>
              {dashboards.map((dashboard) => (
                <option key={dashboard.id} value={dashboard.id}>
                  {dashboard.name}
                </option>
              ))}
            </Select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          </div>

          {isCreating ? (
            <CreateDashboardCard
              name={name}
              setName={setName}
              templateId={templateId}
              setTemplateId={setTemplateId}
              isLoading={isLoading}
              error={error}
              onCancel={() => {
                setIsCreating(false);
                setError(null);
              }}
              onCreate={handleCreate}
            />
          ) : null}

          {selectedDashboard ? (
            <DashboardCanvas dashboardId={selectedDashboard.id} companyId={companyId} />
          ) : (
            <DashboardOverview
              surveys={surveys}
              totalResponses={totalResponses}
              totalCampaigns={totalCampaigns}
              error={overviewError}
            />
          )}
        </>
      )}
    </div>
  );
}

function CreateDashboardCard({
  name,
  setName,
  templateId,
  setTemplateId,
  isLoading,
  error,
  onCancel,
  onCreate,
}: {
  name: string;
  setName: (value: string) => void;
  templateId: string;
  setTemplateId: (value: string) => void;
  isLoading: boolean;
  error: string | null;
  onCancel: () => void;
  onCreate: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo dashboard</CardTitle>
        <CardDescription>Crie um painel para acompanhar suas métricas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="dashboard-name">Nome</Label>
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
                  <span className="block text-sm font-semibold text-text-primary">
                    {template.name}
                  </span>
                  <span className="mt-1 block text-sm leading-5">{template.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {error ? (
          <p className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={onCreate} disabled={isLoading}>
            {isLoading ? "Criando…" : "Criar dashboard"}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
