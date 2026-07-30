// Tests de la profondeur financière du screening (recette 2026-07-30 :
// « 5/5 juste avec un CA » était flatteur). Barème M&A : +2 CA, +1
// pluri-annuel, +1 résultat net, +1 EBITDA (la métrique du métier).

import { describe, it, expect } from "vitest";
import { computeFinancialDepth } from "@/lib/crm/screening";

const year = (fiscal_year: number, over: Partial<{ revenue: number | null; ebitda: number | null; net_income: number | null }> = {}) => ({
  fiscal_year,
  revenue: over.revenue ?? null,
  ebitda: over.ebitda ?? null,
  net_income: over.net_income ?? null,
});

describe("computeFinancialDepth", () => {
  it("aucune ligne : 0", () => {
    expect(computeFinancialDepth([])).toBe(0);
  });

  it("un CA seul : 2/5, plus jamais le score plein", () => {
    expect(computeFinancialDepth([year(2024, { revenue: 1_600_000 })])).toBe(2);
  });

  it("deux exercices de CA sans résultat : 3/5", () => {
    expect(computeFinancialDepth([
      year(2024, { revenue: 1_600_000 }),
      year(2023, { revenue: 1_500_000 }),
    ])).toBe(3);
  });

  it("cas GRANITIERE (CA + RN sur 3 exercices, pas d'EBITDA) : 4/5", () => {
    expect(computeFinancialDepth([
      year(2024, { revenue: 1_600_000, net_income: -984 }),
      year(2023, { revenue: 1_500_000, net_income: 20_000 }),
      year(2022, { revenue: 1_400_000, net_income: 15_000 }),
    ])).toBe(4);
  });

  it("avec l'EBITDA du dernier exercice (Pappers) : 5/5 mérité", () => {
    expect(computeFinancialDepth([
      year(2024, { revenue: 1_600_000, net_income: -984, ebitda: 90_000 }),
      year(2023, { revenue: 1_500_000, net_income: 20_000 }),
    ])).toBe(5);
  });

  it("le RN et l'EBITDA comptent sur le DERNIER exercice, pas un ancien", () => {
    expect(computeFinancialDepth([
      year(2024, { revenue: 1_600_000 }),
      year(2023, { revenue: 1_500_000, net_income: 20_000, ebitda: 80_000 }),
    ])).toBe(3);
  });

  it("des lignes sans CA ne comptent pas comme exercices", () => {
    expect(computeFinancialDepth([
      year(2024, { net_income: 10_000 }),
    ])).toBe(0);
  });
});
