// Tests unitaires lib/crm/ma-scoring.ts
// Verrouillent les sémantiques corrigées :
//   - breaker taille ma_sell basé sur deal.financial.revenue (jamais asking_price)
//   - ma_buy : partial_sale_ok ne déclenche plus de breaker
//   - scoreSize ma_sell basé sur le CA du deal vs fourchette buyer
//   - axe bilan : levier EBITDA vs gearing avec libellés exacts
//   - score combiné 0.65/0.35 et passthrough si financier absent

import { describe, it, expect } from "vitest";
import {
  checkMaDealBreakers,
  computeMaStrategicScore,
  computeMaFinancialScore,
  computeMaCombinedScore,
  scoreMaMatch,
  type MaDealProfile,
  type MaOrganisationProfile,
} from "@/lib/crm/ma-scoring";

function makeDeal(overrides: Partial<MaDealProfile> = {}): MaDealProfile {
  return { id: "d1", name: "Deal Test", deal_type: "ma_sell", ...overrides };
}

function makeOrg(overrides: Partial<MaOrganisationProfile> = {}): MaOrganisationProfile {
  return { id: "o1", name: "Org Test", organization_type: "buyer", ...overrides };
}

// ── checkMaDealBreakers — ma_sell ────────────────────────────────────────────

describe("checkMaDealBreakers — ma_sell", () => {
  it("déclenche un breaker si le type d'organisation n'est pas acquéreur", () => {
    const result = checkMaDealBreakers(makeDeal(), makeOrg({ organization_type: "target" }));
    expect(result).not.toBeNull();
    expect(result).toContain("ne peut pas être acquéreur");
  });

  it("accepte les types acquéreur valides (buyer, corporate, investor, business_angel, family_office)", () => {
    for (const type of ["buyer", "corporate", "investor", "business_angel", "family_office"]) {
      expect(checkMaDealBreakers(makeDeal(), makeOrg({ organization_type: type }))).toBeNull();
    }
  });

  it("déclenche un breaker si le secteur normalisé du deal est exclu par le buyer", () => {
    const deal = makeDeal({ sector: "Technologie / SaaS" }); // normalisé → SaaS
    const org = makeOrg({ excluded_sectors: ["saas"] });     // comparaison insensible à la casse
    const result = checkMaDealBreakers(deal, org);
    expect(result).not.toBeNull();
    expect(result).toContain("SaaS");
    expect(result).toContain("exclu");
  });

  it("pas de breaker si le secteur du deal n'est pas dans excluded_sectors", () => {
    const deal = makeDeal({ sector: "Technologie / SaaS" });
    const org = makeOrg({ excluded_sectors: ["Industrie"] });
    expect(checkMaDealBreakers(deal, org)).toBeNull();
  });

  it("déclenche un breaker si le CA du deal < target_revenue_min × 0.5", () => {
    const deal = makeDeal({ financial: { revenue: 2_400_000 } });
    const org = makeOrg({ target_revenue_min: 5_000_000, target_revenue_max: 20_000_000 });
    const result = checkMaDealBreakers(deal, org);
    expect(result).not.toBeNull();
    expect(result).toContain("hors fourchette acquéreur");
  });

  it("déclenche un breaker si le CA du deal > target_revenue_max × 2", () => {
    const deal = makeDeal({ financial: { revenue: 50_000_000 } });
    const org = makeOrg({ target_revenue_min: 5_000_000, target_revenue_max: 20_000_000 });
    expect(checkMaDealBreakers(deal, org)).toContain("hors fourchette acquéreur");
  });

  it("pas de breaker si le CA est dans la fourchette élargie (bornes ×0.5 et ×2 incluses)", () => {
    const org = makeOrg({ target_revenue_min: 5_000_000, target_revenue_max: 20_000_000 });
    expect(checkMaDealBreakers(makeDeal({ financial: { revenue: 10_000_000 } }), org)).toBeNull();
    // Bornes exactes : 2.5M (= min × 0.5) et 40M (= max × 2) ne déclenchent pas
    expect(checkMaDealBreakers(makeDeal({ financial: { revenue: 2_500_000 } }), org)).toBeNull();
    expect(checkMaDealBreakers(makeDeal({ financial: { revenue: 40_000_000 } }), org)).toBeNull();
  });

  it("asking_price extrême ne déclenche JAMAIS le breaker taille si le CA est dans la fourchette", () => {
    const deal = makeDeal({
      financial: { revenue: 10_000_000 },
      asking_price_min: 500_000_000,
      asking_price_max: 900_000_000,
    });
    const org = makeOrg({ target_revenue_min: 5_000_000, target_revenue_max: 20_000_000 });
    expect(checkMaDealBreakers(deal, org)).toBeNull();
  });

  it("pas de breaker taille si le CA du deal est absent, même avec fourchette buyer renseignée", () => {
    const deal = makeDeal({ asking_price_min: 500_000_000 });
    const org = makeOrg({ target_revenue_min: 5_000_000, target_revenue_max: 20_000_000 });
    expect(checkMaDealBreakers(deal, org)).toBeNull();
  });
});

// ── checkMaDealBreakers — ma_buy ─────────────────────────────────────────────

describe("checkMaDealBreakers — ma_buy", () => {
  it("déclenche un breaker si le type d'organisation n'est pas une cible", () => {
    const deal = makeDeal({ deal_type: "ma_buy" });
    const result = checkMaDealBreakers(deal, makeOrg({ organization_type: "investor" }));
    expect(result).not.toBeNull();
    expect(result).toContain("n'est pas une cible M&A");
  });

  it("déclenche un breaker si sale_readiness = not_for_sale", () => {
    const deal = makeDeal({ deal_type: "ma_buy" });
    const org = makeOrg({ organization_type: "target", sale_readiness: "not_for_sale" });
    const result = checkMaDealBreakers(deal, org);
    expect(result).not.toBeNull();
    expect(result).toContain("not_for_sale");
  });

  it("partial_sale_ok = true avec full_acquisition_required = true ne déclenche PAS de breaker (comportement corrigé)", () => {
    const deal = makeDeal({ deal_type: "ma_buy", full_acquisition_required: true });
    const org = makeOrg({
      organization_type: "target",
      sale_readiness: "open",
      partial_sale_ok: true,
    });
    expect(checkMaDealBreakers(deal, org)).toBeNull();
  });

  it("déclenche un breaker si le secteur de la cible est exclu par le deal", () => {
    const deal = makeDeal({ deal_type: "ma_buy", excluded_sectors: ["fintech"] });
    const org = makeOrg({ organization_type: "target", sector: "Fintech / Insurtech" }); // normalisé → Fintech
    expect(checkMaDealBreakers(deal, org)).toContain("exclu");
  });

  it("déclenche un breaker si le CA de la cible est hors fourchette ×0.5 / ×2 du deal", () => {
    const deal = makeDeal({ deal_type: "ma_buy", target_revenue_min: 10_000_000, target_revenue_max: 20_000_000 });
    const org = makeOrg({ organization_type: "target", financial: { revenue: 4_000_000 } });
    expect(checkMaDealBreakers(deal, org)).toContain("hors fourchette deal");
  });

  it("bornes exactes ×0.5 et ×2 incluses : pas de breaker pile sur la borne, breaker juste au-delà", () => {
    const deal = makeDeal({ deal_type: "ma_buy", target_revenue_min: 10_000_000, target_revenue_max: 20_000_000 });
    const target = (revenue: number) => makeOrg({ organization_type: "target", financial: { revenue } });

    expect(checkMaDealBreakers(deal, target(5_000_000))).toBeNull();   // = min × 0.5
    expect(checkMaDealBreakers(deal, target(40_000_000))).toBeNull();  // = max × 2
    expect(checkMaDealBreakers(deal, target(4_999_999))).toContain("hors fourchette deal");
    expect(checkMaDealBreakers(deal, target(40_000_001))).toContain("hors fourchette deal");
  });

  it("pas de breaker taille si le CA de la cible est inconnu ou si la fourchette du deal est incomplète", () => {
    const dealFull = makeDeal({ deal_type: "ma_buy", target_revenue_min: 10_000_000, target_revenue_max: 20_000_000 });
    expect(checkMaDealBreakers(dealFull, makeOrg({ organization_type: "target" }))).toBeNull();

    const dealPartial = makeDeal({ deal_type: "ma_buy", target_revenue_min: 10_000_000 });
    expect(checkMaDealBreakers(dealPartial, makeOrg({ organization_type: "target", financial: { revenue: 1_000_000 } }))).toBeNull();
  });
});

// ── scoreSize ma_sell (via computeMaStrategicScore) ──────────────────────────

describe("scoreSize ma_sell — via computeMaStrategicScore", () => {
  const buyer = () => makeOrg({ target_revenue_min: 10_000_000, target_revenue_max: 20_000_000 });

  it("25 pts si le CA du deal est dans la fourchette du buyer", () => {
    const { breakdown } = computeMaStrategicScore(makeDeal({ financial: { revenue: 15_000_000 } }), buyer());
    expect(breakdown.size.earned).toBe(25);
    expect(breakdown.size.max).toBe(25);
    expect(breakdown.size.reason).toContain("dans la fourchette du buyer");
  });

  it("12 pts si le CA est proche de la fourchette (≥ min×0.7 et ≤ max×1.5)", () => {
    const below = computeMaStrategicScore(makeDeal({ financial: { revenue: 8_000_000 } }), buyer());
    expect(below.breakdown.size.earned).toBe(12);
    expect(below.breakdown.size.reason).toContain("proche de la fourchette");

    const above = computeMaStrategicScore(makeDeal({ financial: { revenue: 25_000_000 } }), buyer());
    expect(above.breakdown.size.earned).toBe(12);
  });

  it("0 pt si le CA est hors fourchette élargie", () => {
    const { breakdown } = computeMaStrategicScore(makeDeal({ financial: { revenue: 2_000_000 } }), buyer());
    expect(breakdown.size.earned).toBe(0);
    expect(breakdown.size.reason).toContain("hors fourchette du buyer");
  });

  it("12 pts neutre si le CA du deal est absent", () => {
    const { breakdown } = computeMaStrategicScore(makeDeal(), buyer());
    expect(breakdown.size.earned).toBe(12);
    expect(breakdown.size.reason).toContain("CA du deal non renseigné");
  });

  it("12 pts neutre si les critères de taille du buyer sont absents", () => {
    const { breakdown } = computeMaStrategicScore(makeDeal({ financial: { revenue: 15_000_000 } }), makeOrg());
    expect(breakdown.size.earned).toBe(12);
    expect(breakdown.size.reason).toContain("Critères de taille buyer non renseignés");
  });
});

// ── computeMaFinancialScore — axe bilan ──────────────────────────────────────

describe("computeMaFinancialScore — axe bilan", () => {
  it("retourne null si financial est null ou undefined", () => {
    expect(computeMaFinancialScore(null)).toBeNull();
    expect(computeMaFinancialScore(undefined)).toBeNull();
  });

  it("25 pts si net_debt <= 0 (dette nulle ou cash net)", () => {
    const zero = computeMaFinancialScore({ net_debt: 0 });
    expect(zero?.breakdown.balance.earned).toBe(25);
    expect(zero?.breakdown.balance.reason).toBe("Dette nulle ou cash net");

    const cash = computeMaFinancialScore({ net_debt: -2_000_000 });
    expect(cash?.breakdown.balance.earned).toBe(25);
  });

  it("levier net_debt/ebitda ≤ 1 → 20 pts avec raison en x EBITDA", () => {
    const r = computeMaFinancialScore({ net_debt: 1_000_000, ebitda: 2_000_000 });
    expect(r?.breakdown.balance.earned).toBe(20);
    expect(r?.breakdown.balance.reason).toContain("x EBITDA");
    expect(r?.breakdown.balance.reason).toContain("0.5");
  });

  it("levier ≤ 3 → 10 pts, levier > 3 → 2 pts", () => {
    const mid = computeMaFinancialScore({ net_debt: 4_000_000, ebitda: 2_000_000 }); // 2.0x
    expect(mid?.breakdown.balance.earned).toBe(10);
    expect(mid?.breakdown.balance.reason).toContain("x EBITDA");

    const high = computeMaFinancialScore({ net_debt: 8_000_000, ebitda: 2_000_000 }); // 4.0x
    expect(high?.breakdown.balance.earned).toBe(2);
    expect(high?.breakdown.balance.reason).toContain("x EBITDA");
  });

  it("bornes exactes du levier : 1.0x → 20 pts, 3.0x → 10 pts (seuils inclusifs)", () => {
    const atOne = computeMaFinancialScore({ net_debt: 2_000_000, ebitda: 2_000_000 }); // 1.0x
    expect(atOne?.breakdown.balance.earned).toBe(20);

    const atThree = computeMaFinancialScore({ net_debt: 6_000_000, ebitda: 2_000_000 }); // 3.0x
    expect(atThree?.breakdown.balance.earned).toBe(10);
  });

  it("dette avérée sans EBITDA positif ni fonds propres positifs → 2 pts, bilan dégradé et non inconnu", () => {
    const zeroEquity = computeMaFinancialScore({ net_debt: 5_000_000, equity: 0 });
    expect(zeroEquity?.breakdown.balance.earned).toBe(2);
    expect(zeroEquity?.breakdown.balance.reason).toContain("Dette nette");

    const zeroEbitda = computeMaFinancialScore({ net_debt: 5_000_000, ebitda: 0 });
    expect(zeroEbitda?.breakdown.balance.earned).toBe(2);

    const negativeEquity = computeMaFinancialScore({ net_debt: 5_000_000, ebitda: -300_000, equity: -1_000_000 });
    expect(negativeEquity?.breakdown.balance.earned).toBe(2);
  });

  it("net_debt > 0 sans EBITDA mais equity > 0 → gearing avec raison Gearing et sans EBITDA", () => {
    const r = computeMaFinancialScore({ net_debt: 1_000_000, equity: 4_000_000 }); // gearing 0.25
    expect(r?.breakdown.balance.earned).toBe(20);
    expect(r?.breakdown.balance.reason).toContain("Gearing");
    expect(r?.breakdown.balance.reason).not.toContain("EBITDA");
  });

  it("EBITDA négatif → repli sur le gearing, pas sur le levier EBITDA", () => {
    const r = computeMaFinancialScore({ net_debt: 5_000_000, ebitda: -500_000, equity: 2_000_000 }); // gearing 2.5
    expect(r?.breakdown.balance.earned).toBe(10);
    expect(r?.breakdown.balance.reason).toContain("Gearing");
    expect(r?.breakdown.balance.reason).not.toContain("EBITDA");
  });

  it("net_debt null et equity > 0 → 12 pts neutres, sans prétendre que la dette est nulle", () => {
    const r = computeMaFinancialScore({ net_debt: null, equity: 5_000_000 });
    expect(r?.breakdown.balance.earned).toBe(12);
    expect(r?.breakdown.balance.reason).toBe("Fonds propres positifs, dette nette non renseignée");
  });

  it("net_debt et equity absents → 0 pt, bilan inconnu", () => {
    const r = computeMaFinancialScore({ revenue: 10_000_000 });
    expect(r?.breakdown.balance.earned).toBe(0);
    expect(r?.breakdown.balance.reason).toBe("Bilan inconnu");
  });
});

// ── computeMaCombinedScore ───────────────────────────────────────────────────

describe("computeMaCombinedScore", () => {
  it("pondère 0.65 stratégique / 0.35 financier avec arrondi", () => {
    expect(computeMaCombinedScore(80, 60)).toBe(73);  // 52 + 21 = 73
    expect(computeMaCombinedScore(70, 40)).toBe(60);  // 45.5 + 14 = 59.5 → 60
    expect(computeMaCombinedScore(75, 50)).toBe(66);  // 48.75 + 17.5 = 66.25 → 66
    expect(computeMaCombinedScore(0, 0)).toBe(0);
    expect(computeMaCombinedScore(100, 100)).toBe(100);
  });

  it("retourne le score stratégique tel quel si financial est null", () => {
    expect(computeMaCombinedScore(87, null)).toBe(87);
    expect(computeMaCombinedScore(0, null)).toBe(0);
  });
});

// ── scoreMaMatch ─────────────────────────────────────────────────────────────

describe("scoreMaMatch", () => {
  it("deal breaker → score null, strategicScore 0 et breakdown à 0", () => {
    const result = scoreMaMatch(makeDeal(), makeOrg({ organization_type: "target" }));
    expect(result.score).toBeNull();
    expect(result.strategicScore).toBe(0);
    expect(result.financialScore).toBeNull();
    expect(result.dealBreaker).not.toBeNull();
    expect(result.financialBreakdown).toBeNull();
    for (const axis of Object.values(result.breakdown)) {
      expect(axis.earned).toBe(0);
      expect(axis.reason).toBe("Deal breaker");
    }
    // Les max restent ceux de la grille
    expect(result.breakdown.sector.max).toBe(30);
    expect(result.breakdown.size.max).toBe(25);
    expect(result.breakdown.geography.max).toBe(15);
    expect(result.breakdown.profile.max).toBe(20);
    expect(result.breakdown.timing.max).toBe(10);
  });

  it("sans breaker et sans données financières org → score = score stratégique", () => {
    const deal = makeDeal({ sector: "Technologie / SaaS", financial: { revenue: 15_000_000 } });
    const org = makeOrg({ target_sectors: ["SaaS"], target_revenue_min: 10_000_000, target_revenue_max: 20_000_000 });
    const result = scoreMaMatch(deal, org);
    expect(result.dealBreaker).toBeNull();
    expect(result.financialScore).toBeNull();
    expect(result.score).toBe(result.strategicScore);
  });

  it("avec données financières org → score combiné 0.65/0.35 cohérent avec les fonctions unitaires", () => {
    const deal = makeDeal({ sector: "Technologie / SaaS", financial: { revenue: 15_000_000 } });
    const org = makeOrg({
      target_sectors: ["SaaS"],
      target_revenue_min: 10_000_000,
      target_revenue_max: 20_000_000,
      sale_readiness: "actively_selling",
      financial: { revenue_growth: 35, ebitda_margin: 20, net_debt: 0, revenue: 10_000_000, ev_estimate: 50_000_000 },
    });
    const result = scoreMaMatch(deal, org);
    expect(result.dealBreaker).toBeNull();

    const strategic = computeMaStrategicScore(deal, org);
    const financial = computeMaFinancialScore(org.financial);
    expect(result.strategicScore).toBe(strategic.score);
    expect(result.financialScore).toBe(financial?.score ?? null);
    expect(result.score).toBe(computeMaCombinedScore(strategic.score, financial?.score ?? null));
    expect(result.financialBreakdown).toEqual(financial?.breakdown ?? null);
  });
});
