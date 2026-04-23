// Calcul canonique des honoraires par type de mandat.
// Source de vérité unique pour : UI fiche mandat, dashboard fees, rapports
// client. Les règles reflètent la section "Calcul success fee par deal_type"
// de CLAUDE.md.
//
// Principe : toutes les entrées sont nullable. Le calculateur retourne la
// meilleure estimation possible, précise la base retenue et note les manques
// qui empêcheraient une estimation fiable. Aucun throw — le caller affiche
// les notes à l'utilisateur pour qu'il complète les champs manquants.

// ── Types d'entrée ─────────────────────────────────────────────────────────────

export interface MandateForFee {
  type: string;                          // fundraising|ma_sell|ma_buy|cfo_advisor|recruitment
  currency?: string | null;              // défaut EUR
  success_fee_percent?: number | null;   // % (ex: 3 pour 3%)
  retainer_monthly?: number | null;      // retainer mensuel
  operation_amount?: number | null;      // override manuel — prioritaire sur le deal
  start_date?: string | null;            // ISO date — pour CFO
  target_close_date?: string | null;     // ISO date — pour CFO
  end_date?: string | null;              // ISO date — pour CFO
}

export interface DealForFee {
  deal_type?: string | null;
  // Fundraising
  target_raise_amount?: number | null;
  closed_amount?: number | null;         // levée réalisée
  // M&A (sell & buy)
  asking_price_min?: number | null;
  asking_price_max?: number | null;
  target_ev_min?: number | null;         // buy-side
  target_ev_max?: number | null;         // buy-side
  acquisition_budget_min?: number | null;
  acquisition_budget_max?: number | null;
  // Recrutement
  salary_min?: number | null;
  salary_max?: number | null;
  // Générique
  target_amount?: number | null;
  committed_amount?: number | null;
}

// ── Types de sortie ────────────────────────────────────────────────────────────

export type FeeBaseSource =
  | "operation_amount"
  | "closed_amount"
  | "target_raise_amount"
  | "asking_price_mid"
  | "target_ev_mid"
  | "acquisition_budget_mid"
  | "salary_mid"
  | "target_amount"
  | "retainer_duration"
  | null;

export interface FeeComputeResult {
  /** Montant estimé du success fee ; null si entrées insuffisantes */
  estimated: number | null;
  /** Base retenue pour le calcul (ex: 3 000 000 de levée) */
  base: number | null;
  /** Pourcentage appliqué (ex: 3 pour 3%) — null pour CFO (forfaitaire) */
  percent: number | null;
  /** Origine de la base dans les données — utile pour tracer l'auditabilité */
  source: FeeBaseSource;
  /** Devise retenue */
  currency: string;
  /** Notes humaines — champs manquants, hypothèses, ambiguïtés */
  notes: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function mid(a: number | null | undefined, b: number | null | undefined): number | null {
  const ha = typeof a === "number" && !isNaN(a);
  const hb = typeof b === "number" && !isNaN(b);
  if (ha && hb) return ((a as number) + (b as number)) / 2;
  if (ha) return a as number;
  if (hb) return b as number;
  return null;
}

function pickFirst(...vals: (number | null | undefined)[]): number | null {
  for (const v of vals) {
    if (typeof v === "number" && !isNaN(v) && v !== 0) return v;
  }
  return null;
}

/** Calcule la durée d'un mandat en mois entiers (min 1) */
function mandateDurationMonths(m: MandateForFee): number | null {
  const start = m.start_date ?? null;
  const endCandidate = m.end_date ?? m.target_close_date ?? null;
  if (!start || !endCandidate) return null;
  const s = new Date(start).getTime();
  const e = new Date(endCandidate).getTime();
  if (isNaN(s) || isNaN(e) || e <= s) return null;
  const months = Math.round((e - s) / (30.44 * 86_400_000));
  return Math.max(1, months);
}

// ── Calcul principal ──────────────────────────────────────────────────────────

/**
 * Calcule le success fee estimé pour un mandat, selon les règles CLAUDE.md.
 * Le deal est optionnel : sans deal, seul l'override `operation_amount` est
 * utilisable. Pour les mandats CFO Advisory, le calcul devient retainer ×
 * durée et ignore `success_fee_percent`.
 */
export function computeSuccessFee(
  mandate: MandateForFee,
  deal?: DealForFee | null,
): FeeComputeResult {
  const currency = mandate.currency ?? "EUR";
  const notes: string[] = [];
  const type = mandate.type;

  // ── Cas CFO Advisory : retainer × durée ─────────────────────────────────
  if (type === "cfo_advisor") {
    const retainer = mandate.retainer_monthly;
    const months = mandateDurationMonths(mandate);
    if (!retainer || retainer <= 0) {
      notes.push("Retainer mensuel non renseigné.");
      return { estimated: null, base: null, percent: null, source: null, currency, notes };
    }
    if (!months) {
      notes.push("Durée du mandat non renseignée (start_date + end/target_close_date).");
      return {
        estimated: null, base: retainer, percent: null,
        source: "retainer_duration", currency, notes,
      };
    }
    return {
      estimated: retainer * months,
      base: retainer,
      percent: null,
      source: "retainer_duration",
      currency,
      notes: [`Retainer ${retainer} × ${months} mois`],
    };
  }

  // ── Cas avec success_fee_percent ────────────────────────────────────────
  const percent = mandate.success_fee_percent ?? null;
  if (!percent || percent <= 0) {
    notes.push("Pourcentage de success fee non renseigné.");
  }

  // Résolution de la base : override manuel > deal selon type
  let base: number | null = null;
  let source: FeeBaseSource = null;

  if (mandate.operation_amount && mandate.operation_amount > 0) {
    base = mandate.operation_amount;
    source = "operation_amount";
  } else if (deal) {
    switch (type) {
      case "fundraising": {
        base = pickFirst(deal.closed_amount, deal.target_raise_amount, deal.target_amount, deal.committed_amount);
        source = base === deal.closed_amount ? "closed_amount"
               : base === deal.target_raise_amount ? "target_raise_amount"
               : base !== null ? "target_amount" : null;
        break;
      }
      case "ma_sell": {
        base = pickFirst(deal.closed_amount, mid(deal.asking_price_min, deal.asking_price_max), deal.target_amount);
        source = base === deal.closed_amount ? "closed_amount"
               : base !== null && (deal.asking_price_min || deal.asking_price_max) ? "asking_price_mid"
               : base !== null ? "target_amount" : null;
        break;
      }
      case "ma_buy": {
        base = pickFirst(deal.closed_amount, mid(deal.acquisition_budget_min, deal.acquisition_budget_max), mid(deal.target_ev_min, deal.target_ev_max), deal.target_amount);
        source = base === deal.closed_amount ? "closed_amount"
               : base !== null && (deal.acquisition_budget_min || deal.acquisition_budget_max) ? "acquisition_budget_mid"
               : base !== null && (deal.target_ev_min || deal.target_ev_max) ? "target_ev_mid"
               : base !== null ? "target_amount" : null;
        break;
      }
      case "recruitment": {
        base = pickFirst(mid(deal.salary_min, deal.salary_max), deal.target_amount);
        source = base !== null && (deal.salary_min || deal.salary_max) ? "salary_mid" : base !== null ? "target_amount" : null;
        break;
      }
      default: {
        base = pickFirst(deal.target_amount, deal.closed_amount);
        source = base === deal.closed_amount ? "closed_amount" : base !== null ? "target_amount" : null;
      }
    }
  }

  if (base === null) {
    notes.push("Aucune base de calcul disponible (operation_amount ou données deal).");
  }

  if (base === null || percent === null) {
    return { estimated: null, base, percent, source, currency, notes };
  }

  return {
    estimated: base * (percent / 100),
    base,
    percent,
    source,
    currency,
    notes,
  };
}

// ── Agrégation jalons ──────────────────────────────────────────────────────────

export interface MilestoneForAggregation {
  amount: number | null | undefined;
  status: string | null | undefined;
  due_date?: string | null;
  paid_date?: string | null;
}

/**
 * Somme des jalons par statut. Retourne 0 pour les statuts absents, pas null.
 * Filtre `cancelled` automatiquement.
 */
export function sumMilestonesByStatus(milestones: MilestoneForAggregation[]): {
  pending: number;
  invoiced: number;
  paid: number;
  total_non_cancelled: number;
} {
  let pending = 0, invoiced = 0, paid = 0;
  for (const m of milestones) {
    const a = m.amount ?? 0;
    if (m.status === "pending") pending += a;
    else if (m.status === "invoiced") invoiced += a;
    else if (m.status === "paid") paid += a;
  }
  return { pending, invoiced, paid, total_non_cancelled: pending + invoiced + paid };
}

/**
 * Projection linéaire d'atterrissage annuel à partir du encaissé YTD.
 * Formule : paid_ytd / mois_écoulés × 12.
 * Retourne null si on est avant fin janvier (bruit statistique trop fort).
 */
export function projectYearEndFromYtd(paidYtd: number, now: Date = new Date()): number | null {
  const monthsElapsed = now.getMonth() + now.getDate() / 30.44;
  if (monthsElapsed < 1) return null;
  return (paidYtd / monthsElapsed) * 12;
}

/**
 * Retourne les jalons en retard : pending et due_date < aujourd'hui - threshold.
 */
export function filterOverdueMilestones<T extends { status?: string | null; due_date?: string | null }>(
  milestones: T[],
  thresholdDays: number = 30,
  now: Date = new Date(),
): T[] {
  const cutoff = new Date(now.getTime() - thresholdDays * 86_400_000);
  return milestones.filter(m => {
    if (m.status !== "pending") return false;
    if (!m.due_date) return false;
    const due = new Date(m.due_date);
    return !isNaN(due.getTime()) && due < cutoff;
  });
}
