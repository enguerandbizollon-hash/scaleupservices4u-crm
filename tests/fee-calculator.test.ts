// Tests unitaires lib/crm/fee-calculator.ts
// computeSuccessFee par deal_type, fallbacks et notes, agrégation de jalons.

import { describe, it, expect } from "vitest";
import {
  computeSuccessFee,
  sumMilestonesByStatus,
  projectYearEndFromYtd,
  filterOverdueMilestones,
  type MandateForFee,
} from "@/lib/crm/fee-calculator";

function makeMandate(overrides: Partial<MandateForFee> & { type: string }): MandateForFee {
  return { ...overrides };
}

// ── CFO Advisory : retainer × durée ──────────────────────────────────────────

describe("computeSuccessFee — cfo_advisor", () => {
  it("calcule retainer × mois entre start_date et end_date", () => {
    const result = computeSuccessFee(makeMandate({
      type: "cfo_advisor",
      retainer_monthly: 5000,
      start_date: "2026-01-01",
      end_date: "2026-07-01", // 181 jours / 30.44 ≈ 5.95 → 6 mois
    }));
    expect(result.estimated).toBe(30_000);
    expect(result.base).toBe(5000);
    expect(result.percent).toBeNull();
    expect(result.source).toBe("retainer_duration");
    expect(result.notes).toEqual(["Retainer 5000 × 6 mois"]);
  });

  it("utilise target_close_date si end_date est absent", () => {
    const result = computeSuccessFee(makeMandate({
      type: "cfo_advisor",
      retainer_monthly: 4000,
      start_date: "2026-01-01",
      target_close_date: "2026-04-01", // 90 jours ≈ 2.96 → 3 mois
    }));
    expect(result.estimated).toBe(12_000);
  });

  it("durée minimale de 1 mois même pour un mandat de quelques jours", () => {
    const result = computeSuccessFee(makeMandate({
      type: "cfo_advisor",
      retainer_monthly: 4000,
      start_date: "2026-01-01",
      end_date: "2026-01-05",
    }));
    expect(result.estimated).toBe(4000);
  });

  it("retainer absent → estimation null avec note", () => {
    const result = computeSuccessFee(makeMandate({ type: "cfo_advisor" }));
    expect(result.estimated).toBeNull();
    expect(result.base).toBeNull();
    expect(result.source).toBeNull();
    expect(result.notes).toContain("Retainer mensuel non renseigné.");
  });

  it("dates absentes → estimation null mais base = retainer", () => {
    const result = computeSuccessFee(makeMandate({ type: "cfo_advisor", retainer_monthly: 4000 }));
    expect(result.estimated).toBeNull();
    expect(result.base).toBe(4000);
    expect(result.source).toBe("retainer_duration");
    expect(result.notes[0]).toContain("Durée du mandat non renseignée");
  });

  it("ignore success_fee_percent pour un mandat CFO", () => {
    const result = computeSuccessFee(makeMandate({
      type: "cfo_advisor",
      retainer_monthly: 5000,
      success_fee_percent: 5,
      start_date: "2026-01-01",
      end_date: "2026-07-01",
    }));
    expect(result.percent).toBeNull();
    expect(result.estimated).toBe(30_000);
  });
});

// ── Fundraising : montant levé × % ───────────────────────────────────────────

describe("computeSuccessFee — fundraising", () => {
  it("closed_amount prioritaire sur target_raise_amount", () => {
    const result = computeSuccessFee(
      makeMandate({ type: "fundraising", success_fee_percent: 5 }),
      { closed_amount: 3_000_000, target_raise_amount: 5_000_000 },
    );
    expect(result.estimated).toBe(150_000);
    expect(result.base).toBe(3_000_000);
    expect(result.percent).toBe(5);
    expect(result.source).toBe("closed_amount");
  });

  it("fallback sur target_raise_amount si closed_amount absent", () => {
    const result = computeSuccessFee(
      makeMandate({ type: "fundraising", success_fee_percent: 3 }),
      { target_raise_amount: 2_000_000 },
    );
    expect(result.estimated).toBe(60_000);
    expect(result.source).toBe("target_raise_amount");
  });

  it("closed_amount à 0 est ignoré (pickFirst saute les zéros)", () => {
    const result = computeSuccessFee(
      makeMandate({ type: "fundraising", success_fee_percent: 3 }),
      { closed_amount: 0, target_raise_amount: 2_000_000 },
    );
    expect(result.base).toBe(2_000_000);
    expect(result.source).toBe("target_raise_amount");
  });

  it("fallback final sur target_amount", () => {
    const result = computeSuccessFee(
      makeMandate({ type: "fundraising", success_fee_percent: 4 }),
      { target_amount: 1_000_000 },
    );
    expect(result.estimated).toBe(40_000);
    expect(result.source).toBe("target_amount");
  });
});

// ── M&A sell : EV × % ────────────────────────────────────────────────────────

describe("computeSuccessFee — ma_sell", () => {
  it("base = milieu de fourchette asking_price", () => {
    const result = computeSuccessFee(
      makeMandate({ type: "ma_sell", success_fee_percent: 3 }),
      { asking_price_min: 8_000_000, asking_price_max: 12_000_000 },
    );
    expect(result.base).toBe(10_000_000);
    expect(result.estimated).toBe(300_000);
    expect(result.source).toBe("asking_price_mid");
  });

  it("une seule borne asking_price suffit (mid = borne unique)", () => {
    const result = computeSuccessFee(
      makeMandate({ type: "ma_sell", success_fee_percent: 3 }),
      { asking_price_min: 8_000_000 },
    );
    expect(result.base).toBe(8_000_000);
    expect(result.source).toBe("asking_price_mid");
  });

  it("closed_amount prioritaire sur asking_price", () => {
    const result = computeSuccessFee(
      makeMandate({ type: "ma_sell", success_fee_percent: 2 }),
      { closed_amount: 9_000_000, asking_price_min: 8_000_000, asking_price_max: 12_000_000 },
    );
    expect(result.base).toBe(9_000_000);
    expect(result.estimated).toBe(180_000);
    expect(result.source).toBe("closed_amount");
  });
});

// ── M&A buy : budget d'acquisition × % ───────────────────────────────────────

describe("computeSuccessFee — ma_buy", () => {
  it("acquisition_budget mid prioritaire sur target_ev mid", () => {
    const result = computeSuccessFee(
      makeMandate({ type: "ma_buy", success_fee_percent: 2 }),
      {
        acquisition_budget_min: 10_000_000,
        acquisition_budget_max: 20_000_000,
        target_ev_min: 5_000_000,
        target_ev_max: 6_000_000,
      },
    );
    expect(result.base).toBe(15_000_000);
    expect(result.estimated).toBe(300_000);
    expect(result.source).toBe("acquisition_budget_mid");
  });

  it("fallback sur target_ev mid si pas de budget", () => {
    const result = computeSuccessFee(
      makeMandate({ type: "ma_buy", success_fee_percent: 2 }),
      { target_ev_min: 5_000_000, target_ev_max: 7_000_000 },
    );
    expect(result.base).toBe(6_000_000);
    expect(result.estimated).toBe(120_000);
    expect(result.source).toBe("target_ev_mid");
  });
});

// ── Cas transverses ──────────────────────────────────────────────────────────

describe("computeSuccessFee — transverse", () => {
  it("operation_amount (override manuel) est prioritaire sur le deal", () => {
    const result = computeSuccessFee(
      makeMandate({ type: "fundraising", success_fee_percent: 5, operation_amount: 1_000_000 }),
      { closed_amount: 3_000_000 },
    );
    expect(result.base).toBe(1_000_000);
    expect(result.estimated).toBe(50_000);
    expect(result.source).toBe("operation_amount");
  });

  it("type inconnu → fallback générique target_amount puis closed_amount", () => {
    const result = computeSuccessFee(
      makeMandate({ type: "advisory_autre", success_fee_percent: 10 }),
      { target_amount: 100_000 },
    );
    expect(result.estimated).toBe(10_000);
    expect(result.source).toBe("target_amount");
  });

  it("pourcentage manquant → estimation null, base conservée, note ajoutée", () => {
    const result = computeSuccessFee(
      makeMandate({ type: "fundraising" }),
      { target_raise_amount: 2_000_000 },
    );
    expect(result.estimated).toBeNull();
    expect(result.base).toBe(2_000_000);
    expect(result.source).toBe("target_raise_amount");
    expect(result.notes).toContain("Pourcentage de success fee non renseigné.");
  });

  it("ni deal ni operation_amount → estimation null avec note base manquante", () => {
    const result = computeSuccessFee(makeMandate({ type: "fundraising", success_fee_percent: 5 }));
    expect(result.estimated).toBeNull();
    expect(result.base).toBeNull();
    expect(result.source).toBeNull();
    expect(result.notes).toContain("Aucune base de calcul disponible (operation_amount ou données deal).");
  });

  it("devise : EUR par défaut, sinon celle du mandat", () => {
    expect(computeSuccessFee(makeMandate({ type: "fundraising" })).currency).toBe("EUR");
    expect(computeSuccessFee(makeMandate({ type: "fundraising", currency: "CHF" })).currency).toBe("CHF");
  });

  it("documente le comportement actuel : percent = 0 note le manque mais calcule estimated = 0", () => {
    // Incohérence signalée dans le rapport : la note dit "non renseigné" mais
    // le calcul aboutit quand même (base × 0 = 0) car la garde finale ne
    // vérifie que percent === null, pas percent <= 0.
    const result = computeSuccessFee(
      makeMandate({ type: "fundraising", success_fee_percent: 0 }),
      { target_raise_amount: 2_000_000 },
    );
    expect(result.notes).toContain("Pourcentage de success fee non renseigné.");
    expect(result.estimated).toBe(0);
  });
});

// ── Agrégation jalons ────────────────────────────────────────────────────────

describe("sumMilestonesByStatus", () => {
  it("somme par statut et exclut cancelled du total", () => {
    const result = sumMilestonesByStatus([
      { amount: 100, status: "pending" },
      { amount: 200, status: "invoiced" },
      { amount: 300, status: "paid" },
      { amount: 400, status: "cancelled" },
      { amount: null, status: "pending" },
      { amount: 50, status: "paid" },
    ]);
    expect(result).toEqual({ pending: 100, invoiced: 200, paid: 350, total_non_cancelled: 650 });
  });

  it("retourne des zéros (pas null) pour une liste vide", () => {
    expect(sumMilestonesByStatus([])).toEqual({ pending: 0, invoiced: 0, paid: 0, total_non_cancelled: 0 });
  });
});

describe("projectYearEndFromYtd", () => {
  it("retourne null avant fin janvier (moins d'un mois écoulé)", () => {
    expect(projectYearEndFromYtd(50_000, new Date(2026, 0, 15))).toBeNull();
  });

  it("projette linéairement : au 1er juillet (mi-année), la projection double le YTD à ~3% près", () => {
    // Attente indépendante de la formule interne : 120k encaissés sur la
    // première moitié de l'année doivent projeter ~240k en fin d'année.
    const projected = projectYearEndFromYtd(120_000, new Date(2026, 6, 1));
    expect(projected).not.toBeNull();
    expect(projected!).toBeGreaterThan(232_000);
    expect(projected!).toBeLessThan(248_000);
  });

  it("projette 12× le rythme mensuel en tout début février", () => {
    // 10k encaissés après ~1 mois → ~120k projetés (tolérance large sur la
    // fraction de jour).
    const projected = projectYearEndFromYtd(10_000, new Date(2026, 1, 1));
    expect(projected).not.toBeNull();
    expect(projected!).toBeGreaterThan(110_000);
    expect(projected!).toBeLessThan(121_000);
  });
});

describe("filterOverdueMilestones", () => {
  const now = new Date("2026-07-15T00:00:00Z");

  it("retourne uniquement les jalons pending échus depuis plus de threshold jours", () => {
    const overdue = { status: "pending", due_date: "2026-06-01" };
    const recent = { status: "pending", due_date: "2026-07-01" };       // < 30 jours de retard
    const invoiced = { status: "invoiced", due_date: "2026-01-01" };    // mauvais statut
    const noDue = { status: "pending", due_date: null };
    const invalid = { status: "pending", due_date: "pas-une-date" };
    const result = filterOverdueMilestones([overdue, recent, invoiced, noDue, invalid], 30, now);
    expect(result).toEqual([overdue]);
  });

  it("respecte un threshold personnalisé", () => {
    const m = { status: "pending", due_date: "2026-07-10" }; // 5 jours de retard
    expect(filterOverdueMilestones([m], 3, now)).toEqual([m]);
    expect(filterOverdueMilestones([m], 10, now)).toEqual([]);
  });
});
