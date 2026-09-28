import { describe, expect, it } from "vitest";

import { computeNumericStats } from "@/lib/metrics/metrics-engine";

describe("computeNumericStats", () => {
  it("retorna vazio para zero valores", () => {
    const result = computeNumericStats([]);
    expect(result.count).toBe(0);
    expect(result.average).toBeNull();
    expect(result.min).toBeNull();
    expect(result.max).toBeNull();
  });

  it("calcula média, min e max de números genéricos", () => {
    const result = computeNumericStats([0, 10, 5]);
    expect(result.count).toBe(3);
    expect(result.average).toBe(5);
    expect(result.min).toBe(0);
    expect(result.max).toBe(10);
  });

  it("aceita strings numéricas", () => {
    const result = computeNumericStats(["8", "10"]);
    expect(result.average).toBe(9);
  });

  it("ignora valores não numéricos", () => {
    const result = computeNumericStats([1, "abc", null, "", 3] as Array<string | number>);
    expect(result.count).toBe(2);
    expect(result.average).toBe(2);
  });

  it("aceita decimais (número)", () => {
    const result = computeNumericStats([1.5, 2.5]);
    expect(result.average).toBe(2);
  });
});
