// Fusion des finances à la re-ingestion (revue adversariale 2026-07-30) :
// chaque chasse ou veille remplaçait le JSONB finances entier, effaçant
// l'EBITDA, les dettes et la trésorerie ramenés par Pappers, puis rescorait
// le radar sur ces données appauvries.

import { describe, it, expect } from "vitest";
import { mergeFinancesReingest } from "@/lib/crm/univers-ingest";

describe("mergeFinancesReingest", () => {
  it("les champs Pappers survivent au rafraîchissement API", () => {
    const existing = {
      "2024": { ca: 1_500_000, resultat_net: 80_000, ebitda: 220_000, dettes_financieres: 300_000, tresorerie: 150_000 },
    };
    const fresh = { "2024": { ca: 1_520_000, resultat_net: 85_000 } };
    const merged = mergeFinancesReingest(existing, fresh);
    expect(merged["2024"].ca).toBe(1_520_000);
    expect(merged["2024"].resultat_net).toBe(85_000);
    expect(merged["2024"].ebitda).toBe(220_000);
    expect(merged["2024"].dettes_financieres).toBe(300_000);
    expect(merged["2024"].tresorerie).toBe(150_000);
  });

  it("les exercices absents de la source fraîche sont conservés", () => {
    const existing = { "2022": { ca: 1_300_000, ebitda: 190_000 } };
    const fresh = { "2024": { ca: 1_500_000 } };
    const merged = mergeFinancesReingest(existing, fresh);
    expect(merged["2022"].ebitda).toBe(190_000);
    expect(merged["2024"].ca).toBe(1_500_000);
  });

  it("une valeur fraîche nulle n'écrase pas une valeur existante", () => {
    const existing = { "2024": { ca: 1_500_000, resultat_net: 80_000 } };
    const fresh = { "2024": { ca: 1_500_000, resultat_net: null } };
    const merged = mergeFinancesReingest(existing, fresh);
    expect(merged["2024"].resultat_net).toBe(80_000);
  });

  it("fiche neuve (aucun existant) : les finances fraîches passent telles quelles", () => {
    const merged = mergeFinancesReingest(null, { "2024": { ca: 900_000 } });
    expect(merged["2024"].ca).toBe(900_000);
  });

  it("aucune source : objet vide, jamais null", () => {
    expect(mergeFinancesReingest(null, undefined)).toEqual({});
  });

  it("ne mute ni l'existant ni le frais", () => {
    const existing = { "2024": { ca: 1, ebitda: 2 } };
    const fresh = { "2024": { ca: 3 } };
    mergeFinancesReingest(existing, fresh);
    expect(existing["2024"]).toEqual({ ca: 1, ebitda: 2 });
    expect(fresh["2024"]).toEqual({ ca: 3 });
  });
});
