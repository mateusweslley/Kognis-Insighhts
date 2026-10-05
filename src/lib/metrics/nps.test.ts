import { describe, expect, it } from "vitest";

import {
  classifyNps,
  computeNps,
} from "@/lib/metrics/metrics-engine";
import {
  extractNpsValues,
  identifyNpsQuestion,
} from "@/lib/metrics/dashboard-metrics";
import { extractResponseData } from "@/lib/metrics/extract";
import type { SurveyQuestion } from "@/types/survey-question";
import type { SurveyResponse } from "@/types/response";

function question(overrides: Partial<SurveyQuestion>): SurveyQuestion {
  return {
    id: "q1",
    survey_id: "s1",
    type: "rating_10",
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

describe("computeNps", () => {
  it("caso 1: 100% promotores → +100", () => {
    const result = computeNps([9, 10, 10, 9]);
    expect(result.score).toBe(100);
    expect(result.promoters).toBe(4);
    expect(result.detractors).toBe(0);
  });

  it("caso 2: 100% detratores → -100", () => {
    const result = computeNps([0, 1, 6, 3]);
    expect(result.score).toBe(-100);
  });

  it("caso 3: 60 promotores, 25 neutros, 15 detratores → +45", () => {
    const values = [
      ...Array(60).fill(9),
      ...Array(25).fill(8),
      ...Array(15).fill(5),
    ];
    const result = computeNps(values);
    expect(result.promoters).toBe(60);
    expect(result.passives).toBe(25);
    expect(result.detractors).toBe(15);
    expect(result.score).toBe(45);
  });

  it("caso 4: 50 promotores, 50 detratores → 0", () => {
    const values = [...Array(50).fill(10), ...Array(50).fill(0)];
    const result = computeNps(values);
    expect(result.score).toBe(0);
  });

  it("caso 5: somente neutros → 0", () => {
    const result = computeNps([7, 8, 7, 8]);
    expect(result.score).toBe(0);
    expect(result.promoters).toBe(0);
    expect(result.detractors).toBe(0);
    expect(result.passives).toBe(4);
  });

  it("caso 6: valores inválidos são ignorados", () => {
    const result = computeNps([
      9,
      10,
      "abc",
      null,
      undefined,
      11,
      -1,
      3.5,
      "8",
    ] as Array<string | number>);
    expect(result.count).toBe(3); // 9, 10 e "8"
    expect(result.promoters).toBe(2);
    expect(result.passives).toBe(1);
    expect(result.detractors).toBe(0);
  });

  it("caso 7: sem respostas → score null", () => {
    const result = computeNps([]);
    expect(result.count).toBe(0);
    expect(result.score).toBeNull();
  });

  it("strings numéricas válidas na faixa são contabilizadas", () => {
    const result = computeNps(["10", "6", "0"]);
    expect(result.promoters).toBe(1);
    expect(result.detractors).toBe(2);
  });
});

describe("identifyNpsQuestion", () => {
  it("caso 8: pesquisa sem pergunta rating_10 → no_question", () => {
    const questions = [question({ type: "short_text" })];
    const result = identifyNpsQuestion(questions);
    expect(result.availability).toBe("no_question");
    expect(result.questionId).toBeNull();
  });

  it("uma pergunta rating_10 → available", () => {
    const questions = [question({ id: "nps1", type: "rating_10" })];
    const result = identifyNpsQuestion(questions);
    expect(result.availability).toBe("available");
    expect(result.questionId).toBe("nps1");
  });

  it("caso 9: múltiplas perguntas rating_10 → ambiguous, sem escolha arbitrária", () => {
    const questions = [
      question({ id: "nps1", type: "rating_10" }),
      question({ id: "nps2", type: "rating_10" }),
    ];
    const result = identifyNpsQuestion(questions);
    expect(result.availability).toBe("ambiguous");
    expect(result.questionId).toBeNull();
  });
});

describe("extractNpsValues (resposta dinâmica e legada)", () => {
  it("caso 10: resposta dinâmica encontra o valor 0–10 pelo question_id", () => {
    const questions = [question({ id: "nps1", type: "rating_10" })];
    const responses: SurveyResponse[] = [
      {
        id: "r1",
        survey_id: "s1",
        created_at: "2026-01-01T00:00:00.000Z",
        answers: { mode: "dynamic", answers: { nps1: 9, nps1_ignored: 3 } },
      },
    ];
    const data = extractResponseData(responses, questions);
    const values = extractNpsValues(data, "nps1");
    expect(values).toEqual([9]);
  });

  it("caso 11: resposta legada sem rating_10 não é confundida com NPS", () => {
    // Respostas legadas possuem apenas rating 1–5; não há vínculo com pergunta rating_10.
    const responses: SurveyResponse[] = [
      {
        id: "r1",
        survey_id: "s1",
        created_at: "2026-01-01T00:00:00.000Z",
        answers: { name: "Maria", rating: 5 },
      },
    ];
    const data = extractResponseData(responses, []);
    const values = extractNpsValues(data, "nps1");
    expect(values).toEqual([]);
  });
});

describe("classifyNps (caso 12: faixas)", () => {
  it("classifica todas as faixas adotadas", () => {
    expect(classifyNps(-50)?.band).toBe("critical");
    expect(classifyNps(-1)?.band).toBe("critical");
    expect(classifyNps(0)?.band).toBe("attention");
    expect(classifyNps(30)?.band).toBe("attention");
    expect(classifyNps(31)?.band).toBe("good");
    expect(classifyNps(50)?.band).toBe("good");
    expect(classifyNps(51)?.band).toBe("very_good");
    expect(classifyNps(75)?.band).toBe("very_good");
    expect(classifyNps(76)?.band).toBe("excellent");
    expect(classifyNps(100)?.band).toBe("excellent");
  });

  it("retorna null quando score é null", () => {
    expect(classifyNps(null)).toBeNull();
  });
});
