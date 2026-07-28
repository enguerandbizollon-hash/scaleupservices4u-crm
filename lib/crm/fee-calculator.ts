// Calcul canonique des honoraires d'un dossier.
// Source de vérité unique pour : fiche dossier (onglet Honoraires), dashboard
// fees, exports client. Les règles reflètent la section "Calcul success fee
// par deal_type" de CLAUDE.md.
//
// Depuis la fusion mandats → dossiers (v65), le dossier porte lui-même son
// économie : success_fee_percent, success_fee_base, operation_amount, currency.
//
// Principe : toutes les entrées sont nullable. Le calculateur retourne la
// meilleure estimation possible, précise la base retenue et note les manques
// ou hypothèses. Aucun throw — le caller affiche les notes à l'utilisateur
// pour qu'il complète les champs manquants.
//
// Résolution de la base, par priorité :
//   1. operation_amount        — montant saisi à la main, écrase tout
//   2. success_fee_base        — base choisie explicitement, si calculable
//   3. automatique par deal_type (comportement historique)

// ── Types d'entrée ─────────────────────────────────────────────────────────────

export interface DealForFee {
  deal_type?: string | null;             // ma_sell|ma_buy
  currency?: string | null;              // défaut EUR
  // Paramètres d'honoraires (portés par le dossier depuis v65)
  success_fee_percent?: number | null;   // % (ex: 3 pour 3%)
  success_fee_base?: string | null;      // clé FeeBaseSource explicite ; null = auto
  operation_amount?: number | null;      // override manuel — prioritaire sur tout
  // Chiffres du dossier
  closed_amount?: number | null;         // opération réalisée
  asking_price_min?: number | null;      // sell-side
  asking_price_max?: number | null;
  target_ev_min?: number | null;         // buy-side
  target_ev_max?: number | null;
  acquisition_budget_min?: number | null;
  acquisition_budget_max?: number | null;
  target_amount?: number | null;         // générique
}

// ── Types de sortie ────────────────────────────────────────────────────────────

export type FeeBaseSource =
  | "operation_amount"
  | "closed_amount"
  | "asking_price_mid"
  | "target_ev_mid"
  | "acquisition_budget_mid"
  | "target_amount"
  | null;

export interface FeeComputeResult {
  /** Montant estimé du success fee ; null si entrées insuffisantes */
  estimated: number | null;
  /** Base retenue pour le calcul (ex: 3 000 000 de cession) */
  base: number | null;
  /** Pourcentage appliqué (ex: 3 pour 3%) */
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

/** Valeur d'une base nommée sur le dossier ; null si non calculable (0 = absent). */
function baseValue(key: Exclude<FeeBaseSource, null>, deal: DealForFee): number | null {
  switch (key) {
    case "operation_amount":        return pickFirst(deal.operation_amount);
    case "closed_amount":           return pickFirst(deal.closed_amount);
    case "asking_price_mid":        return mid(deal.asking_price_min, deal.asking_price_max);
    case "target_ev_mid":           return mid(deal.target_ev_min, deal.target_ev_max);
    case "acquisition_budget_mid":  return mid(deal.acquisition_budget_min, deal.acquisition_budget_max);
    case "target_amount":           return pickFirst(deal.target_amount);
  }
}

const EXPLICIT_BASE_KEYS: ReadonlySet<string> = new Set([
  "operation_amount", "closed_amount", "asking_price_mid",
  "target_ev_mid", "acquisition_budget_mid", "target_amount",
]);

// ── Calcul principal ──────────────────────────────────────────────────────────

/**
 * Calcule le success fee estimé d'un dossier, selon les règles CLAUDE.md.
 * Priorité : operation_amount > success_fee_base explicite > auto par deal_type.
 */
export function computeSuccessFee(deal: DealForFee): FeeComputeResult {
  const currency = deal.currency ?? "EUR";
  const notes: string[] = [];
  const type = deal.deal_type;

  const percent = deal.success_fee_percent ?? null;
  if (!percent || percent <= 0) {
    notes.push("Pourcentage de success fee non renseigné.");
  }

  // ── Résolution de la base ───────────────────────────────────────────────
  let base: number | null = null;
  let source: FeeBaseSource = null;

  // 1. Override manuel
  if (deal.operation_amount && deal.operation_amount > 0) {
    base = deal.operation_amount;
    source = "operation_amount";
  }

  // 2. Base explicite choisie sur le dossier
  if (base === null && deal.success_fee_base) {
    if (EXPLICIT_BASE_KEYS.has(deal.success_fee_base)) {
      const key = deal.success_fee_base as Exclude<FeeBaseSource, null>;
      const v = baseValue(key, deal);
      if (v !== null) {
        base = v;
        source = key;
      } else {
        notes.push(`Base choisie (${deal.success_fee_base}) sans donnée sur le dossier, résolution automatique.`);
      }
    } else {
      notes.push(`Base (${deal.success_fee_base}) inconnue, résolution automatique.`);
    }
  }

  // 3. Résolution automatique par type de dossier
  if (base === null) {
    switch (type) {
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
