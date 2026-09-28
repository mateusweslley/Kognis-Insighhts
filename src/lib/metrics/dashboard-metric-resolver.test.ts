import { describe, expect, it } from "vitest";

import { extractResponseData } from "@/lib/metrics/extract";
import { resolveMetric } from "@/lib/dashboard-metric-resolver";
import type { DashboardWidget } from "@/types/dashboard";
import type { SurveyQuestion } from "@/types/survey-question";
import type { SurveyResponse } from "@/types/response";

function makeQuestion(overrides: Partial<SurveyQuestion>): SurveyQuestion {
  return {
    id: "q1",
    survey_id: "s1",
    type: "rating",
    title: "Nota",
    description: null,
    required: false,
    position: 1,
    options: [],
    topic: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function makeWidget(overrides: Partial<DashboardWidget>): DashboardWidget {
  return {
    id: "w1",
    dashboard_id: "d1",
    title: "Métrica",
    survey_id: "s1",
    question_id: "q1",
    metric: "response_count",
    visualization: "kpi",
    config: {},
    position: 1,
    width: 1,
    height: 1,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("extractResponseData", () => {
  it("extrai valores dinâmicos por pergunta e tópicos", () => {
    const questions = [makeQuestion({ id: "q1", type: "rating", topic: "Atendimento" })];
    const responses: SurveyResponse[] = [
      {
        id: "r1",
        survey_id: "s1",
        created_at: "2026-01-01T00:00:00.000Z",
        answers: { mode: "dynamic", answers: { q1: 5 } },
      },
      {
        id: "r2",
        survey_id: "s1",
        created_at: "2026-01-02T00:00:00.000Z",
        answers: { mode: "dynamic", answers: { q1: 4 } },
      },
    ];

    const data = extractResponseData(responses, questions);

    expect(data.totalResponses).toBe(2);
    expect(data.valuesByQuestion.get("q1")).toEqual([5, 4]);
    expect(data.topicByQuestion.get("q1")).toBe("Atendimento");
  });

  it("extrai rating legado sem tópico", () => {
    const responses: SurveyResponse[] = [
      {
        id: "r1",
        survey_id: "s1",
        created_at: "2026-01-01T00:00:00.000Z",
        answers: { name: "Maria", rating: 4 },
      },
    ];

    const data = extractResponseData(responses, []);

    expect(data.legacyRatings).toEqual([4]);
    expect(data.totalResponses).toBe(1);
  });
});

describe("resolveMetric", () => {
  it("response_count", () => {
    const widget = makeWidget({ metric: "response_count", question_id: null });
    const data = extractResponseData([], []);
    const result = resolveMetric(widget, data, []);

    expect(result.kind).toBe("kpi");
    if (result.kind === "kpi") expect(result.value).toBe(0);
  });

  it("average de rating (1-5)", () => {
    const questions = [makeQuestion({ id: "q1", type: "rating" })];
    const responses: SurveyResponse[] = [
      { id: "r1", survey_id: "s1", created_at: "2026-01-01T00:00:00.000Z", answers: { mode: "dynamic", answers: { q1: 5 } } },
      { id: "r2", survey_id: "s1", created_at: "2026-01-01T00:00:00.000Z", answers: { mode: "dynamic", answers: { q1: 3 } } },
    ];
    const data = extractResponseData(responses, questions);
    const widget = makeWidget({ metric: "average", question_id: "q1" });

    const result = resolveMetric(widget, data, questions);
    expect(result.kind).toBe("kpi");
    if (result.kind === "kpi") expect(result.value).toBe(4);
  });

  it("distribution de single_choice", () => {
    const questions = [makeQuestion({ id: "q1", type: "single_choice", options: ["Sim", "Não", "Talvez"] })];
    const responses: SurveyResponse[] = [
      { id: "r1", survey_id: "s1", created_at: "2026-01-01T00:00:00.000Z", answers: { mode: "dynamic", answers: { q1: "Sim" } } },
      { id: "r2", survey_id: "s1", created_at: "2026-01-01T00:00:00.000Z", answers: { mode: "dynamic", answers: { q1: "Sim" } } },
      { id: "r3", survey_id: "s1", created_at: "2026-01-01T00:00:00.000Z", answers: { mode: "dynamic", answers: { q1: "Não" } } },
    ];
    const data = extractResponseData(responses, questions);
    const widget = makeWidget({ metric: "distribution", question_id: "q1", visualization: "pie" });

    const result = resolveMetric(widget, data, questions);
    expect(result.kind).toBe("distribution");
    if (result.kind === "distribution") {
      expect(result.labels).toEqual(["Sim", "Não"]);
      expect(result.values).toEqual([2, 1]);
    }
  });

  it("top_topics agrupa por tópico", () => {
    const questions = [
      makeQuestion({ id: "q1", type: "rating", topic: "Atendimento" }),
      makeQuestion({ id: "q2", type: "rating", topic: "Produto" }),
    ];
    const responses: SurveyResponse[] = [
      { id: "r1", survey_id: "s1", created_at: "2026-01-01T00:00:00.000Z", answers: { mode: "dynamic", answers: { q1: 5, q2: 3 } } },
    ];
    const data = extractResponseData(responses, questions);
    const widget = makeWidget({ metric: "top_topics", question_id: null, visualization: "bar" });

    const result = resolveMetric(widget, data, questions);
    expect(result.kind).toBe("topics");
    if (result.kind === "topics") {
      expect(result.items).toHaveLength(2);
    }
  });

  it("nps retorna valor nulo (pendência de fórmula)", () => {
    const widget = makeWidget({ metric: "nps", question_id: null });
    const result = resolveMetric(widget, extractResponseData([], []), []);

    expect(result.kind).toBe("kpi");
    if (result.kind === "kpi") expect(result.value).toBeNull();
  });

  it("trend retorna pontos de volume", () => {
    const responses: SurveyResponse[] = [
      { id: "r1", survey_id: "s1", created_at: "2026-01-01T00:00:00.000Z", answers: { mode: "dynamic", answers: {} } },
    ];
    const data = extractResponseData(responses, []);
    const widget = makeWidget({ metric: "trend", question_id: null, visualization: "line" });

    const result = resolveMetric(widget, data, []);
    expect(result.kind).toBe("trend");
    if (result.kind === "trend") expect(result.points).toHaveLength(1);
  });
});
