import { describe, expect, it } from "vitest";

import {
  getAvailableMetricsForQuestion,
  getAvailableMetricsForSurvey,
  getAvailableVisualizationsForMetric,
  isMetricAvailableForQuestion,
  isVisualizationValidForMetric,
} from "@/lib/dashboard-metric-compat";
import type { SurveyQuestion } from "@/types/survey-question";

function question(type: SurveyQuestion["type"]): SurveyQuestion {
  return {
    id: "q1",
    survey_id: "s1",
    type,
    title: "Pergunta",
    description: null,
    required: false,
    position: 1,
    options: [],
    topic: null,
    created_at: "",
    updated_at: "",
  };
}

describe("getAvailableMetricsForQuestion", () => {
  it("rating oferece average, distribution, trend", () => {
    expect(getAvailableMetricsForQuestion(question("rating"))).toEqual([
      "average",
      "distribution",
      "trend",
    ]);
  });

  it("rating_10 oferece average, distribution, trend", () => {
    expect(getAvailableMetricsForQuestion(question("rating_10"))).toEqual([
      "average",
      "distribution",
      "trend",
    ]);
  });

  it("single_choice oferece apenas distribution", () => {
    expect(getAvailableMetricsForQuestion(question("single_choice"))).toEqual(["distribution"]);
  });

  it("number oferece apenas average", () => {
    expect(getAvailableMetricsForQuestion(question("number"))).toEqual(["average"]);
  });

  it("short_text não oferece média", () => {
    expect(getAvailableMetricsForQuestion(question("short_text"))).toEqual([]);
  });

  it("texto livre (long_text, full_name, email, phone) não oferece métricas numéricas", () => {
    expect(getAvailableMetricsForQuestion(question("long_text"))).toEqual([]);
    expect(getAvailableMetricsForQuestion(question("full_name"))).toEqual([]);
    expect(getAvailableMetricsForQuestion(question("email"))).toEqual([]);
    expect(getAvailableMetricsForQuestion(question("phone"))).toEqual([]);
  });
});

describe("isMetricAvailableForQuestion", () => {
  it("rating aceita average", () => {
    expect(isMetricAvailableForQuestion("average", question("rating"))).toBe(true);
  });

  it("short_text rejeita average", () => {
    expect(isMetricAvailableForQuestion("average", question("short_text"))).toBe(false);
  });
});

describe("getAvailableMetricsForSurvey", () => {
  it("oferece response_count e top_topics", () => {
    expect(getAvailableMetricsForSurvey()).toEqual(["response_count", "top_topics"]);
  });
});

describe("getAvailableVisualizationsForMetric", () => {
  it("distribution permite pie e bar e table", () => {
    expect(getAvailableVisualizationsForMetric("distribution")).toEqual(["bar", "pie", "table"]);
  });

  it("average permite kpi, bar, line", () => {
    expect(getAvailableVisualizationsForMetric("average")).toEqual(["kpi", "bar", "line"]);
  });
});

describe("isVisualizationValidForMetric", () => {
  it("distribution + pie = válido", () => {
    expect(isVisualizationValidForMetric("distribution", "pie")).toBe(true);
  });

  it("average + pie = inválido", () => {
    expect(isVisualizationValidForMetric("average", "pie")).toBe(false);
  });
});
