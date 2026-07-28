// Tests unitaires lib/crm/cedabilite.ts — radar de cédabilité déterministe.
// Chaque axe, les signaux éliminatoires, les ajustements et les bornes.

import { describe, it, expect } from "vitest";
import { computeCedabilite, cedabiliteBand } from "@/lib/crm/cedabilite";

const NOW = new Date("2026-07-28T12:00:00Z");

const cibleIdeale = {
  age_dirigeant_principal: 66,
  date_creation: "1990-03-15",
  finances: { "2025": { ca: 10_000_000, resultat_net: 1_000_000 } },
};

describe("computeCedabilite — profil type", () => {
  it("la cible idéale : dirigeant 66 ans, boîte de 36 ans, marge 10%, comptes frais → 90", () => {
    const r = computeCedabilite(cibleIdeale, { types: [] }, NOW);
    // 40 (âge) + 15 (ancienneté) + 25 (marge ≥8%) + 10 (comptes 2025) = 90
    expect(r.score).toBe(90);
    expect(r.raisons.some(x => x.includes("fenêtre de transmission"))).toBe(true);
  });

  it("dépôt de comptes récent au BODACC : +5 → 95", () => {
    const r = computeCedabilite(cibleIdeale, { types: ["depot_comptes"] }, NOW);
    expect(r.score).toBe(95);
  });

  it("jeune dirigeant de 40 ans : l'axe âge tombe à zéro", () => {
    const r = computeCedabilite({ ...cibleIdeale, age_dirigeant_principal: 40 }, { types: [] }, NOW);
    expect(r.score).toBe(50); // 0 + 15 + 25 + 10
    expect(r.raisons.some(x => x.includes("pas d'enjeu de transmission"))).toBe(true);
  });

  it("données manquantes partout : score bas mais jamais négatif, raisons explicites", () => {
    const r = computeCedabilite(
      { age_dirigeant_principal: null, date_creation: null, finances: {} },
      { types: [] },
      NOW,
    );
    expect(r.score).toBe(8); // uniquement le défaut finances non publiées
    expect(r.raisons).toContain("Âge dirigeant inconnu (0/40)");
    expect(r.raisons).toContain("Ancienneté inconnue (0/15)");
  });

  it("exercice déficitaire : la santé financière tombe à 3", () => {
    const r = computeCedabilite(
      { ...cibleIdeale, finances: { "2025": { ca: 5_000_000, resultat_net: -200_000 } } },
      { types: [] },
      NOW,
    );
    expect(r.score).toBe(68); // 40 + 15 + 3 + 10
  });

  it("comptes anciens (2022) : fraîcheur à zéro", () => {
    const r = computeCedabilite(
      { ...cibleIdeale, finances: { "2022": { ca: 10_000_000, resultat_net: 1_000_000 } } },
      { types: [] },
      NOW,
    );
    expect(r.score).toBe(80); // 40 + 15 + 25 + 0
    expect(r.raisons.some(x => x.includes("Comptes anciens"))).toBe(true);
  });
});

describe("computeCedabilite — signaux", () => {
  it("radiation : score 0, raison unique", () => {
    const r = computeCedabilite(cibleIdeale, { types: ["radiation"] }, NOW);
    expect(r.score).toBe(0);
    expect(r.raisons).toEqual(["Société radiée (signal BODACC)"]);
  });

  it("cession déjà publiée : score 0, trop tard", () => {
    const r = computeCedabilite(cibleIdeale, { types: ["vente_cession", "depot_comptes"] }, NOW);
    expect(r.score).toBe(0);
  });

  it("procédure collective : -30, jamais sous 0", () => {
    const r = computeCedabilite(cibleIdeale, { types: ["procedure_collective"] }, NOW);
    expect(r.score).toBe(60); // 90 - 30
    const faible = computeCedabilite(
      { age_dirigeant_principal: null, date_creation: null, finances: {} },
      { types: ["procedure_collective"] },
      NOW,
    );
    expect(faible.score).toBe(0); // 8 - 30 clampé
  });

  it("le score est toujours borné 0-100", () => {
    const r = computeCedabilite(cibleIdeale, { types: ["depot_comptes"] }, NOW);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});

describe("cedabiliteBand", () => {
  it("bandes d'affichage", () => {
    expect(cedabiliteBand(85).label).toBe("Chaude");
    expect(cedabiliteBand(55).label).toBe("Tiède");
    expect(cedabiliteBand(35).label).toBe("À suivre");
    expect(cedabiliteBand(10).label).toBe("Froide");
    expect(cedabiliteBand(null).label).toBe("Non scoré");
  });
});
