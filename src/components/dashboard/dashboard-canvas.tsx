"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { WidgetRenderer } from "@/components/dashboard/widget-renderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { getDashboard } from "@/lib/dashboards";
import {
  createDashboardWidget,
  deleteDashboardWidget,
  getDashboardWidgets,
  reorderDashboardWidgets,
  updateDashboardWidget,
} from "@/lib/dashboard-widgets";
import {
  dashboardMetricLabels,
  dashboardVisualizationLabels,
  getAvailableMetricsForQuestion,
  getAvailableMetricsForSurvey,
  getAvailableVisualizationsForMetric,
} from "@/lib/dashboard-metric-compat";
import { resolveMetric, type MetricResult } from "@/lib/dashboard-metric-resolver";
import { loadMetricData } from "@/lib/dashboard-metric-loader";
import type {
  Dashboard,
  DashboardMetric,
  DashboardVisualization,
  DashboardWidget,
} from "@/types/dashboard";
import type { Survey } from "@/types/survey";
import type { SurveyQuestion } from "@/types/survey-question";
import { surveyQuestionTypeLabels } from "@/types/survey-question";

type DashboardCanvasProps = {
  dashboardId: string;
  companyId: string;
};

export function DashboardCanvas({ dashboardId, companyId }: DashboardCanvasProps) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      const supabase = createClient();
      const [dashboardResult, widgetsResult, surveysResult] = await Promise.all([
        getDashboard(dashboardId, companyId),
        getDashboardWidgets(dashboardId),
        supabase
          .from("surveys")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
      ]);

      if (!active) return;

      setDashboard(dashboardResult.dashboard);
      setWidgets(widgetsResult.widgets);
      setSurveys((surveysResult.data ?? []) as Survey[]);
      setError(dashboardResult.error ?? widgetsResult.error ?? null);
      setIsLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [dashboardId, companyId]);

  async function refreshWidgets() {
    const result = await getDashboardWidgets(dashboardId);
    setWidgets(result.widgets);
    if (result.error) setError(result.error);
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando dashboard…</p>;
  }

  if (error && !dashboard) {
    return (
      <div className="space-y-3">
        <p className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
          Não foi possível carregar este dashboard.
        </p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!dashboard) {
    return <p className="text-sm text-muted-foreground">Dashboard não encontrado.</p>;
  }

  const formIsOpen = isAdding || editingWidget !== null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">{dashboard.name}</h2>
          {dashboard.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{dashboard.description}</p>
          ) : null}
        </div>
        <Button onClick={() => setIsAdding(true)} disabled={formIsOpen}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar widget
        </Button>
      </div>

      <FilterBar />

      {isAdding ? (
        <WidgetForm
          dashboardId={dashboard.id}
          surveys={surveys}
          onCancel={() => setIsAdding(false)}
          onSaved={async () => {
            setIsAdding(false);
            await refreshWidgets();
          }}
        />
      ) : null}

      {editingWidget ? (
        <WidgetForm
          dashboardId={dashboard.id}
          surveys={surveys}
          widget={editingWidget}
          onCancel={() => setEditingWidget(null)}
          onSaved={async () => {
            setEditingWidget(null);
            await refreshWidgets();
          }}
        />
      ) : null}

      {widgets.length === 0 && !formIsOpen ? (
        <div className="grid gap-4 rounded-lg border border-dashed border-border p-10 text-center">
          <div className="mx-auto">
            <p className="text-sm font-medium text-text-primary">
              Este dashboard ainda não possui widgets.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Adicione uma análise para começar a acompanhar seus dados.
            </p>
            <Button className="mt-4" onClick={() => setIsAdding(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar widget
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {widgets.map((widget, index) => (
            <WidgetCard
              key={widget.id}
              widget={widget}
              widgets={widgets}
              index={index}
              onChanged={refreshWidgets}
              onEdit={() => setEditingWidget(widget)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Barra de contexto/filtros. Nesta etapa é apenas estrutura preparada: o resolver
// atual ainda não aplica filtros globais (pesquisa/período) de forma segura.
// Pendência documentada para uma sprint futura.
function FilterBar() {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-muted px-3 py-2 sm:flex-row sm:items-center">
      <div className="relative">
        <Select defaultValue="" aria-label="Filtrar por pesquisa" disabled>
          <option value="">Todas as pesquisas</option>
        </Select>
      </div>
      <div className="relative">
        <Select defaultValue="" aria-label="Filtrar por período" disabled>
          <option value="">Últimos 30 dias</option>
        </Select>
      </div>
      <Button variant="secondary" size="sm" disabled title="Filtros globais ainda não disponíveis">
        Atualizar
      </Button>
    </div>
  );
}

function WidgetCard({
  widget,
  widgets,
  index,
  onChanged,
  onEdit,
}: {
  widget: DashboardWidget;
  widgets: DashboardWidget[];
  index: number;
  onChanged: () => Promise<void>;
  onEdit: () => void;
}) {
  const [metricResult, setMetricResult] = useState<MetricResult | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!widget.survey_id) {
        const data = await loadEmptyMetric(widget);
        if (active) setMetricResult(data);
        return;
      }

      const loaded = await loadMetricData(widget.survey_id);
      if (!active) return;

      if (loaded.error) {
        return;
      }

      setMetricResult(resolveMetric(widget, loaded.data, loaded.questions));
    })();

    return () => {
      active = false;
    };
  }, [widget]);

  async function move(direction: "up" | "down") {
    const otherIndex = direction === "up" ? index - 1 : index + 1;

    if (otherIndex < 0 || otherIndex >= widgets.length) return;

    const next = [...widgets];
    [next[index], next[otherIndex]] = [next[otherIndex], next[index]];
    await reorderDashboardWidgets(next.map((item, i) => ({ id: item.id, position: i + 1 })));
    await onChanged();
  }

  async function remove() {
    setIsDeleting(true);
    await deleteDashboardWidget(widget.id);
    setIsDeleting(false);
    setIsConfirmingDelete(false);
    await onChanged();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle className="text-base">{widget.title}</CardTitle>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => move("up")}
            disabled={index === 0}
            aria-label="Mover para cima"
          >
            ↑
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => move("down")}
            disabled={index === widgets.length - 1}
            aria-label="Mover para baixo"
          >
            ↓
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsConfirmingDelete(true)}
            aria-label="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {metricResult ? (
          <WidgetRenderer metric={metricResult} visualization={widget.visualization} />
        ) : (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        )}
      </CardContent>

      {isConfirmingDelete ? (
        <div className="border-t border-border p-4">
          <p className="text-sm text-text-primary">Excluir esta análise?</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="destructive" onClick={remove} disabled={isDeleting}>
              {isDeleting ? "Excluindo…" : "Excluir"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsConfirmingDelete(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

async function loadEmptyMetric(widget: DashboardWidget): Promise<MetricResult> {
  const empty = {
    timestamps: [],
    totalResponses: 0,
    valuesByQuestion: new Map(),
    topicByQuestion: new Map(),
    legacyRatings: [],
  };
  return resolveMetric(widget, empty, []);
}

function WidgetForm({
  dashboardId,
  surveys,
  widget,
  onCancel,
  onSaved,
}: {
  dashboardId: string;
  surveys: Survey[];
  widget?: DashboardWidget | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const isEditing = Boolean(widget);
  const [surveyId, setSurveyId] = useState<string>(widget?.survey_id ?? "");
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [questionsLoaded, setQuestionsLoaded] = useState(false);
  const [questionId, setQuestionId] = useState<string>(widget?.question_id ?? "");
  const [metric, setMetric] = useState<DashboardMetric>(widget?.metric ?? "response_count");
  const [visualization, setVisualization] = useState<DashboardVisualization>(
    widget?.visualization ?? "kpi",
  );
  const [title, setTitle] = useState(widget?.title ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedQuestion = useMemo(
    () => questions.find((q) => q.id === questionId) ?? null,
    [questions, questionId],
  );

  const availableMetrics = useMemo(() => {
    if (selectedQuestion) {
      return getAvailableMetricsForQuestion(selectedQuestion);
    }
    return getAvailableMetricsForSurvey();
  }, [selectedQuestion]);

  useEffect(() => {
    let active = true;

    if (!surveyId) {
      setQuestions([]);
      setQuestionsLoaded(true);
      return;
    }

    setQuestionsLoaded(false);

    (async () => {
      const supabase = createClient();
      const result = await supabase
        .from("survey_questions")
        .select("id,survey_id,type,title,description,required,position,options,created_at,updated_at,topic")
        .eq("survey_id", surveyId)
        .order("position", { ascending: true });

      if (!active) return;
      setQuestions((result.data ?? []) as SurveyQuestion[]);
      setQuestionsLoaded(true);
    })();

    return () => {
      active = false;
    };
  }, [surveyId]);

  useEffect(() => {
    // Enquanto as perguntas ainda carregam, não reajusta a métrica para evitar
    // sobrescrever a seleção original (ex.: edição de um widget com pergunta).
    if (!questionsLoaded) return;

    // Ao trocar de pergunta, reajusta a métrica para a primeira disponível.
    if (!availableMetrics.includes(metric)) {
      setMetric(availableMetrics[0] ?? "response_count");
    }
  }, [questionsLoaded, availableMetrics, metric]);

  useEffect(() => {
    if (!questionsLoaded) return;

    const visuals = getAvailableVisualizationsForMetric(metric);
    if (!visuals.includes(visualization)) {
      setVisualization(visuals[0] ?? "kpi");
    }
  }, [questionsLoaded, metric, visualization]);

  async function handleSave() {
    setIsSaving(true);
    setError(null);

    const payload = {
      title: title.trim() || "Análise",
      survey_id: surveyId || null,
      question_id: questionId || null,
      metric,
      visualization,
    };

    const result = widget
      ? await updateDashboardWidget(widget.id, payload)
      : await createDashboardWidget({ dashboard_id: dashboardId, ...payload });

    if (result.error) {
      setError(result.error);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    await onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {isEditing ? "Editar análise" : "Adicionar widget"}
        </CardTitle>
        <CardDescription>Escolha a fonte de dados e a visualização.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="widget-survey">Pesquisa</Label>
          <Select
            id="widget-survey"
            value={surveyId}
            onChange={(event) => {
              setSurveyId(event.target.value);
              setQuestionId("");
            }}
          >
            <option value="">— Selecionar —</option>
            {surveys.map((survey) => (
              <option key={survey.id} value={survey.id}>
                {survey.title}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="widget-question">Pergunta (opcional)</Label>
          <Select
            id="widget-question"
            value={questionId}
            onChange={(event) => setQuestionId(event.target.value)}
          >
            <option value="">— Nível da pesquisa —</option>
            {questions.map((question) => (
              <option key={question.id} value={question.id}>
                {question.title} ({surveyQuestionTypeLabels[question.type]})
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="widget-metric">Métrica</Label>
          <Select
            id="widget-metric"
            value={metric}
            onChange={(event) => setMetric(event.target.value as DashboardMetric)}
          >
            {availableMetrics.map((m) => (
              <option key={m} value={m}>
                {dashboardMetricLabels[m]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="widget-visualization">Visualização</Label>
          <Select
            id="widget-visualization"
            value={visualization}
            onChange={(event) => setVisualization(event.target.value as DashboardVisualization)}
          >
            {getAvailableVisualizationsForMetric(metric).map((v) => (
              <option key={v} value={v}>
                {dashboardVisualizationLabels[v]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="widget-title">Título</Label>
          <Input
            id="widget-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex: Média de satisfação"
          />
        </div>

        {error ? (
          <p className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={handleSave} disabled={isSaving || !surveyId}>
            {isSaving ? "Salvando…" : isEditing ? "Salvar alterações" : "Adicionar ao dashboard"}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
