// Tests du scoring acquéreurs small cap V2 (phase 3, temps 3).
// Grille validée 2026-07-30 : 25/20/20/15/10/10 + bonus relation +10,
// malus préférences révélées, éliminatoires nommés, couverture affichée.

import { describe, it, expect } from "vitest";
import {
  scoreAcquirer,
  SIZE_BREAKER_FACTOR,
  type AcquirerDealInput,
  type AcquirerOrgInput,
} from "@/lib/crm/acquirer-scoring";

const deal = (over: Partial<AcquirerDealInput> = {}): AcquirerDealInput => ({
  name: "Cession Transports Martin",
  sector: "Transport",
  location: "Lyon",
  deal_context: "succession",
  partial_sale_ok: false,
  management_retention: false,
  ebitda: 1_200_000,
  revenue: 8_000_000,
  ...over,
});

const org = (over: Partial<AcquirerOrgInput> = {}): AcquirerOrgInput => ({
  id: "o1",
  name: "Groupe Levage SA",
  organization_type: "corporate",
  target_sectors: ["Transport"],
  excluded_sectors: [],
  target_ebitda_min: 500_000,
  target_ebitda_max: 3_000_000,
  target_revenue_min: null,
  target_revenue_max: null,
  target_geographies: ["france"],
  operation_types: ["succession", "build_up"],
  deal_stance: "majority",
  acquisition_history: "3 acquisitions depuis 2022",
  ...over,
});

describe("scoreAcquirer — cas nominal", () => {
  it("score un fit parfait avec couverture 6/6 et raisons partout", () => {
    const r = scoreAcquirer(deal(), org());
    expect(r.dealBreaker).toBeNull();
    // 25 capacité + 20 secteur + 20 opération + 10 appétit (historique) + 10 géo + 10 structure
    expect(r.score).toBe(95);
    expect(r.coverage).toEqual({ evaluated: 6, total: 6 });
    for (const dim of Object.values(r.breakdown)) {
      expect(dim.reason.length).toBeGreaterThan(3);
    }
  });

  it("monte à 100 avec le bonus relation, jamais au-delà", () => {
    const r = scoreAcquirer(deal(), org(), {
      relation: { contact_count: 2, last_interaction_days: 30 },
    });
    expect(r.bonusRelation.earned).toBe(10);
    expect(r.score).toBe(100); // 95 + 10 plafonné
  });
});

describe("capacité — fourchette déclarée uniquement", () => {
  it("cas Enguérand : acquéreur 4x plus gros SANS fourchette déclarée, jamais éliminé", () => {
    const r = scoreAcquirer(deal(), org({
      target_ebitda_min: null, target_ebitda_max: null,
      target_revenue_min: null, target_revenue_max: null,
    }));
    expect(r.dealBreaker).toBeNull();
    expect(r.breakdown.capacite.evaluated).toBe(false);
    expect(r.breakdown.capacite.earned).toBe(0);
    expect(r.coverage.evaluated).toBe(5);
  });

  it("éliminé au-delà de 3x la fourchette haute déclarée", () => {
    const r = scoreAcquirer(deal({ ebitda: 10_000_000 }), org());
    expect(r.dealBreaker).toContain("3");
    expect(r.score).toBeNull();
  });

  it("éliminé quand le dossier fait moins d'un tiers de la fourchette basse", () => {
    const r = scoreAcquirer(deal({ ebitda: 100_000 }), org({ target_ebitda_min: 500_000 }));
    expect(r.dealBreaker).not.toBeNull();
  });

  it("débordement modéré (≤1,5x) : 12 points, pas d'élimination", () => {
    const r = scoreAcquirer(deal({ ebitda: 4_000_000 }), org());
    expect(r.dealBreaker).toBeNull();
    expect(r.breakdown.capacite.earned).toBe(12);
  });

  it("loin mais sous 3x : 5 points", () => {
    const r = scoreAcquirer(deal({ ebitda: 7_500_000 }), org());
    expect(r.breakdown.capacite.earned).toBe(5);
    expect(r.dealBreaker).toBeNull();
  });

  it("repli sur le CA quand l'EBITDA du dossier manque", () => {
    const r = scoreAcquirer(
      deal({ ebitda: null }),
      org({ target_ebitda_min: null, target_ebitda_max: null, target_revenue_min: 2_000_000, target_revenue_max: 15_000_000 }),
    );
    expect(r.breakdown.capacite.earned).toBe(25);
    expect(r.breakdown.capacite.reason).toContain("CA");
  });

  it("métriques croisées indisponibles : non évalué, pas de points gratuits", () => {
    // Fourchette déclarée en EBITDA, dossier sans EBITDA (CA seul).
    const r = scoreAcquirer(deal({ ebitda: null }), org());
    expect(r.breakdown.capacite.evaluated).toBe(false);
    expect(r.breakdown.capacite.earned).toBe(0);
  });

  it("finances du dossier totalement absentes : non évalué", () => {
    const r = scoreAcquirer(deal({ ebitda: null, revenue: null }), org());
    expect(r.breakdown.capacite.evaluated).toBe(false);
  });
});

describe("secteur — exact, adjacent, généraliste, exclu", () => {
  it("exact : 20 points", () => {
    const r = scoreAcquirer(deal(), org());
    expect(r.breakdown.secteur.earned).toBe(20);
  });

  it("adjacent (Transport ↔ Logistique) : 12 points", () => {
    const r = scoreAcquirer(deal(), org({ target_sectors: ["Logistique"] }));
    expect(r.breakdown.secteur.earned).toBe(12);
    expect(r.breakdown.secteur.reason).toContain("adjacent");
  });

  it("généraliste assumé : 8 points", () => {
    const r = scoreAcquirer(deal(), org({ target_sectors: ["Généraliste"] }));
    expect(r.breakdown.secteur.earned).toBe(8);
  });

  it("hors thèse : 0 point mais évalué", () => {
    const r = scoreAcquirer(deal(), org({ target_sectors: ["SaaS"] }));
    expect(r.breakdown.secteur.earned).toBe(0);
    expect(r.breakdown.secteur.evaluated).toBe(true);
  });

  it("secteur exclu : éliminatoire nommé", () => {
    const r = scoreAcquirer(deal(), org({ excluded_sectors: ["Transport"] }));
    expect(r.score).toBeNull();
    expect(r.dealBreaker).toContain("exclu");
  });

  it("thèse non déclarée : non évalué", () => {
    const r = scoreAcquirer(deal(), org({ target_sectors: [] }));
    expect(r.breakdown.secteur.evaluated).toBe(false);
  });
});

describe("type d'opération — la dimension qui manquait", () => {
  it("succession × repreneur en transmission : 20 points, cœur de métier", () => {
    const r = scoreAcquirer(deal(), org({ operation_types: ["succession"] }));
    expect(r.breakdown.operation.earned).toBe(20);
  });

  it("succession × fonds minoritaire uniquement : éliminatoire", () => {
    const r = scoreAcquirer(deal(), org({ operation_types: ["minoritaire_croissance"], deal_stance: "both" }));
    expect(r.score).toBeNull();
    expect(r.dealBreaker).toContain("incompatible");
  });

  it("succession × sponsor de MBO : compatible, 12 points", () => {
    const r = scoreAcquirer(deal(), org({ operation_types: ["mbo_sponsor"] }));
    expect(r.breakdown.operation.earned).toBe(12);
  });

  it("MBO × MBI seul : éliminatoire (conflit sur le fauteuil)", () => {
    const r = scoreAcquirer(deal({ deal_context: "mbo", partial_sale_ok: true }), org({ operation_types: ["mbi"] }));
    expect(r.score).toBeNull();
  });

  it("contexte non renseigné : non évalué, pas de points", () => {
    const r = scoreAcquirer(deal({ deal_context: null }), org());
    expect(r.breakdown.operation.evaluated).toBe(false);
    expect(r.coverage.evaluated).toBe(5);
  });

  it("opérations non déclarées : non évalué", () => {
    const r = scoreAcquirer(deal(), org({ operation_types: [] }));
    expect(r.breakdown.operation.evaluated).toBe(false);
  });
});

describe("appétit et mémoire des approches", () => {
  it("approche récente : 15 points", () => {
    const r = scoreAcquirer(deal(), org(), { history: { approaches_24m: 2, rejections_similar: 0 } });
    expect(r.breakdown.appetit.earned).toBe(15);
  });

  it("historique déclaré sans approche : 10 points", () => {
    const r = scoreAcquirer(deal(), org());
    expect(r.breakdown.appetit.earned).toBe(10);
  });

  it("aucun signal : non évalué", () => {
    const r = scoreAcquirer(deal(), org({ acquisition_history: null }));
    expect(r.breakdown.appetit.evaluated).toBe(false);
  });

  it("3 refus similaires : malus -10 avec raison affichée", () => {
    const r = scoreAcquirer(deal(), org(), { history: { approaches_24m: 1, rejections_similar: 3 } });
    expect(r.malusHistorique.points).toBe(-10);
    expect(r.malusHistorique.reason).toContain("3 refus");
    // 25+20+20+15+10+10 = 100, -10 malus
    expect(r.score).toBe(90);
  });
});

describe("structure capitalistique", () => {
  it("minoritaire seul + cession totale exigée : éliminatoire", () => {
    const r = scoreAcquirer(
      deal({ partial_sale_ok: false }),
      org({ deal_stance: "minority", operation_types: ["succession"] }),
    );
    expect(r.score).toBeNull();
    expect(r.dealBreaker).toContain("minoritaire");
  });

  it("minoritaire + cession partielle acceptée : compatible", () => {
    const r = scoreAcquirer(
      deal({ partial_sale_ok: true }),
      org({ deal_stance: "minority" }),
    );
    expect(r.breakdown.structure.earned).toBe(10);
  });

  it("position non renseignée : non évalué", () => {
    const r = scoreAcquirer(deal(), org({ deal_stance: null }));
    expect(r.breakdown.structure.evaluated).toBe(false);
  });
});

describe("garde-fous transverses", () => {
  it("un type non acquéreur est éliminé", () => {
    const r = scoreAcquirer(deal(), org({ organization_type: "target" }));
    expect(r.score).toBeNull();
    expect(r.dealBreaker).toContain("pas un acquéreur");
  });

  it("fiche acquéreur totalement vide : score 0, couverture 0/6, jamais de points gratuits", () => {
    const r = scoreAcquirer(deal(), org({
      target_sectors: [], excluded_sectors: [],
      target_ebitda_min: null, target_ebitda_max: null,
      target_revenue_min: null, target_revenue_max: null,
      target_geographies: [], operation_types: [],
      deal_stance: null, acquisition_history: null,
    }));
    expect(r.dealBreaker).toBeNull();
    expect(r.score).toBe(0);
    expect(r.coverage.evaluated).toBe(0);
  });

  it("le facteur d'élimination est bien x3 (constante exportée)", () => {
    expect(SIZE_BREAKER_FACTOR).toBe(3);
  });
});

describe("géographie", () => {
  it("hors périmètre : 0 mais évalué", () => {
    const r = scoreAcquirer(deal(), org({ target_geographies: ["asie"] }));
    expect(r.breakdown.geographie.earned).toBe(0);
    expect(r.breakdown.geographie.evaluated).toBe(true);
  });

  it("couverture globale : 8 points", () => {
    const r = scoreAcquirer(deal(), org({ target_geographies: ["global"] }));
    expect(r.breakdown.geographie.earned).toBe(8);
  });
});
