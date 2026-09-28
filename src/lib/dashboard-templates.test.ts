import { describe, expect, it } from "vitest";

import {
  getDashboardTemplate,
  getDashboardTemplates,
  internalDashboardTemplates,
} from "@/lib/dashboard-templates";

describe("dashboard templates internos", () => {
  it("possui os quatro templates previstos", () => {
    const ids = internalDashboardTemplates.map((t) => t.id).sort();
    expect(ids).toEqual(["custom", "know_customers", "nps", "satisfaction"]);
  });

  it("template custom não gera widgets", () => {
    const custom = getDashboardTemplate("custom");
    expect(custom).not.toBeNull();
  });

  it("template nps gera widgets base sem fórmula de NPS", () => {
    const nps = internalDashboardTemplates.find((t) => t.id === "nps");
    expect(nps).toBeDefined();
    // Não deve haver widget com métrica nps (pendência de fórmula).
    expect(nps?.widgets.some((w) => w.metric === "nps")).toBe(false);
  });

  it("getDashboardTemplates retorna lista mapeada", () => {
    const templates = getDashboardTemplates();
    expect(templates).toHaveLength(4);
    expect(templates.every((t) => t.type === "internal")).toBe(true);
  });

  it("getDashboardTemplate retorna null para id inexistente", () => {
    expect(getDashboardTemplate("nope")).toBeNull();
  });
});
