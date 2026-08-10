import { describe, it, expect } from "vitest";
import {
  computeBuyQualificationScore,
  BUY_QUALIFICATION_READY_MIN_SCORE,
  type BuyQualificationSnapshot,
} from "@/lib/crm/buy-qualification";

const EMPTY: BuyQualificationSnapshot = {
  cadrage_present: false,
  strategic_rationale: null,
  target_sectors: null,
  target_geographies: null,
  target_revenue_min: null,
  target_revenue_max: null,
  acquisition_budget_min: null,
  acquisition_budget_max: null,
  deal_timing: null,
  dirigeant_id: null,
  dirigeant_nom: null,
};

// Mandat ROUSSON complètement cadré (fiche importée + critères + budget).
const COMPLET: BuyQualificationSnapshot = {
  cadrage_present: true,
  strategic_rationale: "Reprendre et développer une PME de services en Rhône-Alpes, avec une transition accompagnée par le cédant.",
  target_sectors: ["Génie climatique / CVC", "Agences web / digital"],
  target_geographies: ["38", "69"],
  target_revenue_min: 500_000,
  target_revenue_max: 1_500_000,
  acquisition_budget_min: 300_000,
  acquisition_budget_max: null,
  deal_timing: "0_6_months",
  dirigeant_id: null,
  dirigeant_nom: "Damien ROUSSON",
};

describe("computeBuyQualificationScore", () => {
  it("un mandat vide score 0, aucun critère rempli", () => {
    const b = computeBuyQualificationScore(EMPTY);
    expect(b.total).toBe(0);
    expect(b.items.every((i) => !i.filled && i.earned === 0)).toBe(true);
  });

  it("un mandat complètement cadré score 100", () => {
    const b = computeBuyQualificationScore(COMPLET);
    expect(b.total).toBe(100);
    expect(b.items.every((i) => i.filled)).toBe(true);
  });

  it("le barème totalise 100 points", () => {
    const b = computeBuyQualificationScore(EMPTY);
    expect(b.items.reduce((s, i) => s + i.max, 0)).toBe(100);
  });

  it("cadrage + critères essentiels sans budget ni repreneur passent le seuil", () => {
    // cadrage 15 + projet 20 + secteurs 15 + géo 10 + CA 15 = 75 >= 60
    const b = computeBuyQualificationScore({
      ...COMPLET,
      acquisition_budget_min: null,
      dirigeant_nom: null,
      deal_timing: null,
    });
    expect(b.total).toBe(75);
    expect(b.total).toBeGreaterThanOrEqual(BUY_QUALIFICATION_READY_MIN_SCORE);
  });

  it("des critères seuls sans cadrage ni projet restent sous le seuil", () => {
    // secteurs 15 + géo 10 + CA 15 + budget 15 = 55 < 60 : le projet compte
    const b = computeBuyQualificationScore({
      ...COMPLET,
      cadrage_present: false,
      strategic_rationale: null,
      dirigeant_nom: null,
      deal_timing: null,
    });
    expect(b.total).toBe(55);
    expect(b.total).toBeLessThan(BUY_QUALIFICATION_READY_MIN_SCORE);
  });

  it("un projet trop court (moins de 50 caractères) ne compte pas", () => {
    const b = computeBuyQualificationScore({ ...EMPTY, strategic_rationale: "Reprendre une PME." });
    expect(b.total).toBe(0);
  });

  it("des tableaux de chaînes vides ne comptent pas", () => {
    const b = computeBuyQualificationScore({ ...EMPTY, target_sectors: ["", "  "], target_geographies: [] });
    expect(b.total).toBe(0);
  });

  it("une seule borne de CA ou de budget suffit pour le critère", () => {
    const b = computeBuyQualificationScore({ ...EMPTY, target_revenue_max: 2_000_000, acquisition_budget_max: 500_000 });
    const ca = b.items.find((i) => i.key === "ca_cible");
    const budget = b.items.find((i) => i.key === "budget");
    expect(ca?.filled).toBe(true);
    expect(budget?.filled).toBe(true);
    expect(b.total).toBe(30);
  });

  it("le repreneur compte par dirigeant_id OU par nom", () => {
    expect(computeBuyQualificationScore({ ...EMPTY, dirigeant_id: "uuid" }).total).toBe(5);
    expect(computeBuyQualificationScore({ ...EMPTY, dirigeant_nom: "Damien ROUSSON" }).total).toBe(5);
    expect(computeBuyQualificationScore({ ...EMPTY, dirigeant_nom: "   " }).total).toBe(0);
  });
});
