import { describe, expect, it } from "vitest";

import { calculateConsolidatedRatingMetrics } from "@/lib/metrics/consolidated-metrics";
import type { SurveyQuestionType } from "@/types/survey-question";

function question(id: string, type: SurveyQuestionType = "rating") {
  return { id, type };
}

function calculate(
  primaryQuestionId: string | null,
  values: Map<string, readonly unknown[]>,
  options: {
    questions?: Array<{ id: string; type: SurveyQuestionType }>;
    responsesReceived?: number;
  } = {},
) {
  return calculateConsolidatedRatingMetrics({
    primaryQuestionId,
    questions: options.questions ?? [question("q-main")],
    valuesByQuestion: values,
    responsesReceived: options.responsesReceived ?? 0,
  });
}

describe("calculateConsolidatedRatingMetrics", () => {
  it("retorna aguardando mais respostas sem avaliações válidas", () => {
    const result = calculate("q-main", new Map([[
      "q-main", [null, "", "  ", 0, 6, "0x4", "4e0", true],
    ]]));

    expect(result).toMatchObject({
      responsesReceived: 0,
      validRatingCount: 0,
      positiveCount: 0,
      average: null,
      positivePercent: null,
      health: "Aguardando mais respostas",
    });
  });

  it("calcula média e percepção positiva a partir de uma avaliação válida", () => {
    const result = calculate("q-main", new Map([["q-main", ["4"]]]), {
      responsesReceived: 7,
    });

    expect(result).toMatchObject({
      responsesReceived: 7,
      validRatingCount: 1,
      positiveCount: 1,
      average: 4,
      positivePercent: 100,
      health: "Aguardando mais respostas",
    });
  });

  it("mantém saúde aguardando com 29 avaliações e classifica com 30", () => {
    const values = new Map([["q-main", Array(30).fill(5)]]);

    const at29 = calculate("q-main", new Map([["q-main", values.get("q-main")!.slice(0, 29)]]));
    const at30 = calculate("q-main", values);

    expect(at29.health).toBe("Aguardando mais respostas");
    expect(at29.validRatingCount).toBe(29);
    expect(at30.health).toBe("Excelente");
    expect(at30.validRatingCount).toBe(30);
  });

  it("classifica usando a média integral, inclusive perto dos limites", () => {
    const nearExcellent = Array(501).fill(4).concat(Array(499).fill(5));
    const exactlyExcellent = Array(25).fill(4).concat(Array(25).fill(5));

    expect(calculate("q-main", new Map([["q-main", nearExcellent]])).average).toBe(4.499);
    expect(calculate("q-main", new Map([["q-main", nearExcellent]])).health).toBe("Boa");
    expect(calculate("q-main", new Map([["q-main", exactlyExcellent]])).health).toBe("Excelente");
    expect(calculate("q-main", new Map([["q-main", Array(30).fill(4)]])).health).toBe("Boa");
    expect(calculate("q-main", new Map([["q-main", Array(30).fill(3)]])).health).toBe("Regular");
    expect(
      calculate("q-main", new Map([["q-main", Array(30).fill(2).concat([5])]])).health,
    ).toBe("Atenção necessária");
  });

  it("retorna aguardando dados sem pergunta principal compatível", () => {
    const values = new Map([["q-main", Array(30).fill(5)]]);

    expect(calculate(null, values).health).toBe("Aguardando dados");
    expect(calculate("q-deleted", values).health).toBe("Aguardando dados");
    expect(
      calculate("q-main", values, { questions: [question("q-main", "rating_10")] }),
      ).toMatchObject({ health: "Aguardando dados", average: null, positivePercent: null });
  });

  it("calcula percepção positiva somente sobre notas válidas da pergunta 1–5", () => {
    const result = calculate("q-main", new Map([["q-main", [1, 3, 4, 5, 0, 6, "4e0"]]]));

    expect(result.validRatingCount).toBe(4);
    expect(result.positiveCount).toBe(2);
    expect(result.positivePercent).toBe(50);
  });

  it("mantém escalas e perguntas distintas separadas e preserva respostas recebidas", () => {
    const values = new Map<string, readonly unknown[]>([
      ["q-main", [4, 5]],
      ["q-other-rating", [1, 1, 1]],
      ["q-nps", [0, 10, 10]],
    ]);
    const questions = [
      question("q-main"),
      question("q-other-rating"),
      question("q-nps", "rating_10"),
    ];

    const main = calculate("q-main", values, { questions, responsesReceived: 11 });
    const other = calculate("q-other-rating", values, { questions, responsesReceived: 11 });

    expect(main).toMatchObject({ responsesReceived: 11, validRatingCount: 2, average: 4.5 });
    expect(other).toMatchObject({ responsesReceived: 11, validRatingCount: 3, average: 1 });
  });
});
