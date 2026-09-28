import { describe, expect, it } from "vitest";

import {
  deriveCampaignDisplayStatus,
  isCampaignExpired,
  isClaimExpired,
  isValidCampaignClaimStatus,
  isValidCampaignCodeMode,
  isValidCampaignRewardType,
  isValidCampaignStatus,
  isValidCampaignType,
  isValidIdentityRequirement,
} from "@/lib/campaign-utils";

describe("campaign-utils: status", () => {
  it("aceita os status válidos", () => {
    expect(isValidCampaignStatus("draft")).toBe(true);
    expect(isValidCampaignStatus("active")).toBe(true);
    expect(isValidCampaignStatus("paused")).toBe(true);
    expect(isValidCampaignStatus("archived")).toBe(true);
  });

  it("rejeita status inválidos", () => {
    expect(isValidCampaignStatus("expired")).toBe(false);
    expect(isValidCampaignStatus("deleted")).toBe(false);
    expect(isValidCampaignStatus("")).toBe(false);
  });
});

describe("campaign-utils: campaign_type", () => {
  it("aceita reward_on_response", () => {
    expect(isValidCampaignType("reward_on_response")).toBe(true);
  });

  it("rejeita tipos inválidos/desconhecidos", () => {
    expect(isValidCampaignType("referral")).toBe(false);
    expect(isValidCampaignType("")).toBe(false);
  });
});

describe("campaign-utils: identity_requirement", () => {
  it("aceita none, email e phone", () => {
    expect(isValidIdentityRequirement("none")).toBe(true);
    expect(isValidIdentityRequirement("email")).toBe(true);
    expect(isValidIdentityRequirement("phone")).toBe(true);
  });

  it("rejeita valores inválidos", () => {
    expect(isValidIdentityRequirement("cpf")).toBe(false);
    expect(isValidIdentityRequirement("")).toBe(false);
  });
});

describe("campaign-utils: reward type", () => {
  it("aceita os tipos de recompensa", () => {
    expect(isValidCampaignRewardType("percentage")).toBe(true);
    expect(isValidCampaignRewardType("fixed_amount")).toBe(true);
    expect(isValidCampaignRewardType("gift")).toBe(true);
    expect(isValidCampaignRewardType("custom")).toBe(true);
  });

  it("rejeita tipos inválidos", () => {
    expect(isValidCampaignRewardType("cashback")).toBe(false);
    expect(isValidCampaignRewardType("")).toBe(false);
  });
});

describe("campaign-utils: code mode", () => {
  it("aceita unique e fixed", () => {
    expect(isValidCampaignCodeMode("unique")).toBe(true);
    expect(isValidCampaignCodeMode("fixed")).toBe(true);
  });

  it("rejeita modos inválidos", () => {
    expect(isValidCampaignCodeMode("manual")).toBe(false);
  });
});

describe("campaign-utils: claim status", () => {
  it("aceita issued, redeemed e voided", () => {
    expect(isValidCampaignClaimStatus("issued")).toBe(true);
    expect(isValidCampaignClaimStatus("redeemed")).toBe(true);
    expect(isValidCampaignClaimStatus("voided")).toBe(true);
  });

  it("rejeita status inválidos", () => {
    expect(isValidCampaignClaimStatus("expired")).toBe(false);
  });
});

describe("campaign-utils: expiração derivada", () => {
  const now = new Date("2026-09-28T12:00:00Z");

  it("não expira sem ends_at", () => {
    expect(isCampaignExpired({ status: "active", ends_at: null }, now)).toBe(false);
  });

  it("não expira quando ends_at está no futuro", () => {
    expect(isCampaignExpired({ status: "active", ends_at: "2026-10-01T00:00:00Z" }, now)).toBe(false);
  });

  it("expira quando ends_at já passou", () => {
    expect(isCampaignExpired({ status: "active", ends_at: "2026-09-01T00:00:00Z" }, now)).toBe(true);
  });

  it("campanha arquivada nunca é considerada expirada", () => {
    expect(isCampaignExpired({ status: "archived", ends_at: "2026-09-01T00:00:00Z" }, now)).toBe(false);
  });

  it("ignora ends_at inválido", () => {
    expect(isCampaignExpired({ status: "active", ends_at: "not-a-date" }, now)).toBe(false);
  });

  it("deriveCampaignDisplayStatus retorna expired para ativa vencida", () => {
    expect(
      deriveCampaignDisplayStatus({ status: "active", ends_at: "2026-09-01T00:00:00Z" }, now),
    ).toBe("expired");
  });

  it("deriveCampaignDisplayStatus mantém o status original quando não vencida", () => {
    expect(
      deriveCampaignDisplayStatus({ status: "paused", ends_at: "2026-10-01T00:00:00Z" }, now),
    ).toBe("paused");
  });

  it("deriveCampaignDisplayStatus não trata rascunho vencido como expired", () => {
    expect(
      deriveCampaignDisplayStatus({ status: "draft", ends_at: "2026-09-01T00:00:00Z" }, now),
    ).toBe("draft");
  });

  it("claim expira quando issued e expires_at passou", () => {
    expect(
      isClaimExpired({ status: "issued", expires_at: "2026-09-01T00:00:00Z" }, now),
    ).toBe(true);
  });

  it("claim emitida sem expires_at não expira", () => {
    expect(isClaimExpired({ status: "issued", expires_at: null }, now)).toBe(false);
  });

  it("claim não-issued não expira", () => {
    expect(
      isClaimExpired({ status: "redeemed", expires_at: "2026-09-01T00:00:00Z" }, now),
    ).toBe(false);
  });
});
