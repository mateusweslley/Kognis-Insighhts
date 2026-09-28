import { describe, expect, it } from "vitest";

import {
  computeChoiceDistribution,
  computeRatingStats,
  computeResponseVolumeOverTime,
  computeTopicMetrics,
  computeTrend,
} from "@/lib/metrics/metrics-engine";

describe("computeRatingStats", () => {
  it("retorna vazio para zero respostas", () => {
    const result = computeRatingStats([]);
    expect(result.count).toBe(0);
    expect(result.average).toBeNull();
    expect(result.min).toBeNull();
    expect(result.max).toBeNull();
    expect(result.distribution).toEqual({});
  });

  it("calcula estatísticas de rating válido (números)", () => {
    const result = computeRatingStats([1, 2, 3, 4, 5]);
    expect(result.count).toBe(5);
    expect(result.average).toBe(3);
    expect(result.min).toBe(1);
    expect(result.max).toBe(5);
    expect(result.distribution).toEqual({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 });
  });

  it("calcula rating a partir de strings numéricas", () => {
    const result = computeRatingStats(["4", "5"]);
    expect(result.count).toBe(2);
    expect(result.average).toBe(4.5);
  });

  it("ignora ratings inválidos", () => {
    const result = computeRatingStats([1, 0, 6, 2.5, "abc", null, "", 3] as Array<string | number>);
    expect(result.count).toBe(2);
    expect(result.average).toBe(2);
    expect(result.min).toBe(1);
    expect(result.max).toBe(3);
  });

  it("não inventa valor quando tudo é inválido", () => {
    const result = computeRatingStats(["x", "y", 0, 99]);
    expect(result.count).toBe(0);
    expect(result.average).toBeNull();
    expect(result.distribution).toEqual({});
  });

  it("acumula valores repetidos na distribuição", () => {
    const result = computeRatingStats([5, 5, 5, 1]);
    expect(result.distribution).toEqual({ 5: 3, 1: 1 });
    expect(result.average).toBe(4);
  });
});

describe("computeChoiceDistribution", () => {
  it("retorna distribuição vazia para zero respostas", () => {
    const result = computeChoiceDistribution([], ["Sim", "Não"]);
    expect(result.total).toBe(0);
    expect(result.buckets).toEqual([]);
  });

  it("respeita as opções existentes e ordena por opção", () => {
    const result = computeChoiceDistribution(["Sim", "Não", "Sim", "Talvez"], ["Não", "Sim", "Talvez"]);
    expect(result.total).toBe(4);
    expect(result.buckets).toEqual([
      { value: "Não", count: 1, pct: 0.25 },
      { value: "Sim", count: 2, pct: 0.5 },
      { value: "Talvez", count: 1, pct: 0.25 },
    ]);
  });

  it("ignora valores fora das opções e vazios", () => {
    const result = computeChoiceDistribution(["Sim", "OutroValor", null, ""] as Array<string | number>, ["Sim", "Não"]);
    expect(result.total).toBe(1);
    expect(result.buckets).toEqual([{ value: "Sim", count: 1, pct: 1 }]);
  });

  it("omite buckets com zero contagem", () => {
    const result = computeChoiceDistribution(["Sim"], ["Sim", "Não"]);
    expect(result.buckets.map((b) => b.value)).toEqual(["Sim"]);
  });
});

describe("computeTopicMetrics", () => {
  it("retorna vazio para zero entradas", () => {
    expect(computeTopicMetrics([])).toEqual([]);
  });

  it("agrupa por tópico e separa perguntas sem tópico", () => {
    const result = computeTopicMetrics([
      { topic: "Atendimento", value: 5 },
      { topic: "Atendimento", value: 4 },
      { topic: "Produto", value: 3 },
      { topic: null, value: 5 },
    ]);

    const atendimento = result.find((m) => m.topic === "Atendimento");
    const produto = result.find((m) => m.topic === "Produto");
    const semTopico = result.find((m) => m.topic === null);

    expect(atendimento?.count).toBe(2);
    expect(atendimento?.avgRating).toBe(4.5);
    expect(produto?.count).toBe(1);
    expect(produto?.avgRating).toBe(3);
    expect(semTopico?.count).toBe(1);
    expect(semTopico?.avgRating).toBe(5);
  });

  it("mantém tópico null sem inferir a partir do valor", () => {
    const result = computeTopicMetrics([{ topic: null, value: "Excelente atendimento" }]);
    expect(result).toHaveLength(1);
    expect(result[0].topic).toBeNull();
    expect(result[0].count).toBe(1);
    expect(result[0].avgRating).toBeNull(); // texto livre não é rating
  });

  it("avgRating null quando só há texto", () => {
    const result = computeTopicMetrics([
      { topic: "Feedback", value: "bom" },
      { topic: "Feedback", value: "ótimo" },
    ]);
    expect(result[0].avgRating).toBeNull();
  });
});

describe("computeResponseVolumeOverTime", () => {
  const base = "2026-01-15T10:00:00.000Z";

  it("agrupa por dia", () => {
    const timestamps = [
      "2026-01-15T08:00:00.000Z",
      "2026-01-15T20:00:00.000Z",
      "2026-01-16T08:00:00.000Z",
    ];
    const result = computeResponseVolumeOverTime(timestamps, "day");
    expect(result).toEqual([
      { period: "2026-01-15", value: 2 },
      { period: "2026-01-16", value: 1 },
    ]);
  });

  it("agrupa por mês", () => {
    const timestamps = [
      "2026-01-05T00:00:00.000Z",
      "2026-01-20T00:00:00.000Z",
      "2026-02-01T00:00:00.000Z",
    ];
    const result = computeResponseVolumeOverTime(timestamps, "month");
    expect(result).toEqual([
      { period: "2026-01", value: 2 },
      { period: "2026-02", value: 1 },
    ]);
  });

  it("agrupa por semana", () => {
    // 2026-01-05 é segunda-feira (semana 02); 2026-01-06 terça (mesma semana).
    const timestamps = [
      "2026-01-05T00:00:00.000Z",
      "2026-01-06T00:00:00.000Z",
    ];
    const result = computeResponseVolumeOverTime(timestamps, "week");
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(2);
    expect(result[0].period).toMatch(/^2026-W0[12]$/);
  });

  it("retorna vazio para zero timestamps", () => {
    expect(computeResponseVolumeOverTime([], "day")).toEqual([]);
  });

  it("ignora timestamps inválidos", () => {
    const result = computeResponseVolumeOverTime(["data-invalida", base], "day");
    expect(result).toEqual([{ period: "2026-01-15", value: 1 }]);
  });
});

describe("computeTrend", () => {
  it("tendência positiva", () => {
    const result = computeTrend(
      { totalResponses: 10, avgRating: 4 },
      { totalResponses: 5, avgRating: 3 },
    );
    expect(result.deltaAbsolute).toBe(5);
    expect(result.deltaPercent).toBe(1);
    expect(result.direction).toBe("up");
  });

  it("tendência negativa", () => {
    const result = computeTrend(
      { totalResponses: 3, avgRating: 4 },
      { totalResponses: 6, avgRating: 4 },
    );
    expect(result.deltaAbsolute).toBe(-3);
    expect(result.deltaPercent).toBe(-0.5);
    expect(result.direction).toBe("down");
  });

  it("tendência sem período anterior", () => {
    const result = computeTrend({ totalResponses: 7, avgRating: 4 }, null);
    expect(result.deltaAbsolute).toBe(7);
    expect(result.deltaPercent).toBeNull();
    expect(result.direction).toBe("up");
  });

  it("divisão por zero retorna percentual null", () => {
    const result = computeTrend(
      { totalResponses: 5, avgRating: null },
      { totalResponses: 0, avgRating: null },
    );
    expect(result.deltaAbsolute).toBe(5);
    expect(result.deltaPercent).toBeNull();
    expect(result.direction).toBe("up");
  });

  it("flat quando delta é zero", () => {
    const result = computeTrend(
      { totalResponses: 4, avgRating: 4 },
      { totalResponses: 4, avgRating: 4 },
    );
    expect(result.deltaAbsolute).toBe(0);
    expect(result.deltaPercent).toBe(0);
    expect(result.direction).toBe("flat");
  });
});
