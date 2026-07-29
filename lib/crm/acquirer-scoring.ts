/**
 * lib/crm/acquirer-scoring.ts — Scoring acquéreurs small cap V2 (phase 3, temps 3).
 *
 * Grille validée le 2026-07-30 : 6 dimensions sur 100 points, un bonus
 * relation, un malus préférences révélées, des éliminatoires nommés.
 *
 *   capacité 25 · secteur 20 · type d'opération 20 · appétit 15 ·
 *   géographie 10 · structure 10 · bonus relation CRM +10 (plafond 100)
 *
 * Trois principes non négociables :
 *   1. Chaque point porte sa raison (breakdown affichable tel quel).
 *   2. Un critère non renseigné ne donne JAMAIS de points : il est marqué
 *      non évalué et sort de la couverture (« 72 · 5/6 critères »).
 *      C'est l'inverse de l'ancien scoring qui donnait des points neutres.
 *   3. Éliminatoires nommés : secteur exclu, taille à plus de 3 fois la
 *      fourchette DÉCLARÉE (jamais la taille propre de l'acquéreur : un
 *      groupe 4 fois plus gros qui se diversifie est le cas normal),
 *      structure incompatible, aucune opération pratiquée compatible.
 *
 * Module pur, zéro I/O : l'action (actions/ma-matching.ts) charge et mappe.
 * La direction buy_to_target reste servie par lib/crm/ma-scoring.ts.
 */

import {
  normalizeDealSector,
  sectorsAreAdjacent,
  GEO_LABELS,
  GEO_COMPATIBILITY,
  CONTEXT_OPERATION_COMPAT,
  DEAL_CONTEXTS,
  OPERATION_TYPES,
  type DealContext,
} from "@/lib/crm/matching-maps";
import { normalizeGeoText } from "@/lib/crm/investor-parsers";

// ── Entrées ──────────────────────────────────────────────────────────────────

export interface AcquirerDealInput {
  name: string;
  sector: string | null;
  location: string | null;
  deal_context: string | null;          // DEAL_CONTEXTS (v67)
  partial_sale_ok: boolean | null;      // true = cession partielle acceptée
  management_retention: boolean | null;
  ebitda: number | null;                // dernier exercice réel
  revenue: number | null;
}

export interface AcquirerOrgInput {
  id: string;
  name: string;
  organization_type: string;
  target_sectors: string[] | null;
  excluded_sectors: string[] | null;
  target_ebitda_min: number | null;
  target_ebitda_max: number | null;
  target_revenue_min: number | null;
  target_revenue_max: number | null;
  target_geographies: string[] | null;
  operation_types: string[] | null;     // OPERATION_TYPES (v67)
  deal_stance: string | null;           // majority | minority | both (v67)
  acquisition_history: string | null;
}

/** Relation CRM avec l'acquéreur, calculée par l'action (zéro saisie). */
export interface AcquirerRelationInput {
  contact_count: number;
  last_interaction_days: number | null;
}

/** Préférences révélées : historique des approches (deal_target_suggestions). */
export interface AcquirerHistoryInput {
  approaches_24m: number;        // approved/contacted < 24 mois, tous dossiers
  rejections_similar: number;    // rejets sur dossiers de même secteur
}

// ── Sorties ──────────────────────────────────────────────────────────────────

export interface AcquirerDimension {
  earned: number;
  max: number;
  evaluated: boolean;
  reason: string;
}

export interface AcquirerScoreResult {
  score: number | null;                 // null = éliminé
  dealBreaker: string | null;
  coverage: { evaluated: number; total: number };
  breakdown: {
    capacite: AcquirerDimension;
    secteur: AcquirerDimension;
    operation: AcquirerDimension;
    appetit: AcquirerDimension;
    geographie: AcquirerDimension;
    structure: AcquirerDimension;
  };
  bonusRelation: { earned: number; max: number; reasons: string[] };
  malusHistorique: { points: number; reason: string | null };
}

export const ACQUIRER_BUYER_TYPES = ["buyer", "corporate", "investor", "business_angel", "family_office"];

/** Facteur d'éliminatoire taille : au-delà de x3 la fourchette déclarée. */
export const SIZE_BREAKER_FACTOR = 3;

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtM = (n: number) => `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M EUR`;

const contextLabel = (v: string) =>
  DEAL_CONTEXTS.find((c) => c.value === v)?.label ?? v;

const operationLabel = (v: string) =>
  OPERATION_TYPES.find((o) => o.value === v)?.label ?? v;

function notEvaluated(max: number, reason: string): AcquirerDimension {
  return { earned: 0, max, evaluated: false, reason };
}

// ── Dimensions ───────────────────────────────────────────────────────────────

/**
 * Capacité (25) : la taille du dossier confrontée à la fourchette DÉCLARÉE
 * de l'acquéreur. EBITDA prioritaire, CA en repli. Peut produire un
 * éliminatoire (> x3 dans un sens ou l'autre). Jamais évaluée sur la
 * taille propre de l'acquéreur.
 */
function scoreCapacite(
  deal: AcquirerDealInput,
  org: AcquirerOrgInput,
): { dim: AcquirerDimension; breaker: string | null } {
  const hasEbitdaRange = org.target_ebitda_min != null || org.target_ebitda_max != null;
  const hasRevenueRange = org.target_revenue_min != null || org.target_revenue_max != null;

  if (!hasEbitdaRange && !hasRevenueRange) {
    return { dim: notEvaluated(25, "Fourchette cible non déclarée par l'acquéreur"), breaker: null };
  }
  if (deal.ebitda == null && deal.revenue == null) {
    return { dim: notEvaluated(25, "Finances du dossier absentes (EBITDA et CA inconnus)"), breaker: null };
  }

  let metric: "EBITDA" | "CA";
  let value: number;
  let lo: number | null;
  let hi: number | null;

  if (deal.ebitda != null && hasEbitdaRange) {
    metric = "EBITDA"; value = deal.ebitda;
    lo = org.target_ebitda_min; hi = org.target_ebitda_max;
  } else if (deal.revenue != null && hasRevenueRange) {
    metric = "CA"; value = deal.revenue;
    lo = org.target_revenue_min; hi = org.target_revenue_max;
  } else {
    const declared = hasEbitdaRange ? "EBITDA" : "CA";
    const missing = hasEbitdaRange ? "EBITDA" : "CA";
    return {
      dim: notEvaluated(25, `Fourchette déclarée en ${declared} mais ${missing} du dossier inconnu`),
      breaker: null,
    };
  }

  const floor = lo ?? 0;
  const ceil = hi ?? Infinity;

  if (value >= floor && value <= ceil) {
    return {
      dim: { earned: 25, max: 25, evaluated: true, reason: `${metric} ${fmtM(value)} dans la fourchette déclarée` },
      breaker: null,
    };
  }

  // Ratio de dépassement sur la borne violée uniquement.
  const ratio = value > ceil ? value / ceil : floor / value;
  const direction = value > ceil ? "au-dessus" : "en dessous";

  if (ratio > SIZE_BREAKER_FACTOR) {
    return {
      dim: { earned: 0, max: 25, evaluated: true, reason: `${metric} ${fmtM(value)} à ${ratio.toFixed(1)}x ${direction} de la fourchette déclarée` },
      breaker: `${metric} du dossier (${fmtM(value)}) à plus de ${SIZE_BREAKER_FACTOR}x la fourchette déclarée de ${org.name}`,
    };
  }
  if (ratio <= 1.5) {
    return {
      dim: { earned: 12, max: 25, evaluated: true, reason: `${metric} ${fmtM(value)} déborde modérément la fourchette (${ratio.toFixed(1)}x ${direction})` },
      breaker: null,
    };
  }
  return {
    dim: { earned: 5, max: 25, evaluated: true, reason: `${metric} ${fmtM(value)} loin de la fourchette (${ratio.toFixed(1)}x ${direction})` },
    breaker: null,
  };
}

/** Secteur (20) : exact 20, adjacent 12, généraliste 8, hors thèse 0. */
function scoreSecteur(
  deal: AcquirerDealInput,
  org: AcquirerOrgInput,
): { dim: AcquirerDimension; breaker: string | null } {
  if (!deal.sector) {
    return { dim: notEvaluated(20, "Secteur du dossier non renseigné"), breaker: null };
  }
  const sector = normalizeDealSector(deal.sector) ?? deal.sector;

  if (org.excluded_sectors?.some((s) => s.toLowerCase() === sector.toLowerCase())) {
    return {
      dim: { earned: 0, max: 20, evaluated: true, reason: `Secteur ${sector} exclu par l'acquéreur` },
      breaker: `Secteur ${sector} explicitement exclu par ${org.name}`,
    };
  }

  const targets = org.target_sectors ?? [];
  if (targets.length === 0) {
    return { dim: notEvaluated(20, "Thèse sectorielle non déclarée"), breaker: null };
  }
  if (targets.some((s) => s.toLowerCase() === sector.toLowerCase())) {
    return { dim: { earned: 20, max: 20, evaluated: true, reason: `Secteur ${sector} au cœur de la thèse` }, breaker: null };
  }
  const adjacent = targets.find((s) => sectorsAreAdjacent(s, sector));
  if (adjacent) {
    return { dim: { earned: 12, max: 20, evaluated: true, reason: `Secteur adjacent à la thèse (${sector} proche de ${adjacent})` }, breaker: null };
  }
  if (targets.some((s) => s.toLowerCase() === "généraliste")) {
    return { dim: { earned: 8, max: 20, evaluated: true, reason: "Acquéreur généraliste assumé" }, breaker: null };
  }
  return {
    dim: { earned: 0, max: 20, evaluated: true, reason: `Secteur ${sector} hors thèse (${targets.slice(0, 3).join(", ")})` },
    breaker: null,
  };
}

/**
 * Type d'opération (20) : contexte du dossier vs opérations pratiquées.
 * Exact 20, compatible 12. Éliminatoire seulement si TOUTES les opérations
 * déclarées sont incompatibles avec le contexte.
 */
function scoreOperation(
  deal: AcquirerDealInput,
  org: AcquirerOrgInput,
): { dim: AcquirerDimension; breaker: string | null } {
  if (!deal.deal_context) {
    return { dim: notEvaluated(20, "Contexte d'opération du dossier non renseigné"), breaker: null };
  }
  const ops = org.operation_types ?? [];
  if (ops.length === 0) {
    return { dim: notEvaluated(20, "Opérations pratiquées non déclarées"), breaker: null };
  }

  const compat = CONTEXT_OPERATION_COMPAT[deal.deal_context as DealContext];
  if (!compat) {
    return { dim: notEvaluated(20, `Contexte ${deal.deal_context} inconnu du référentiel`), breaker: null };
  }

  const ctxLabel = contextLabel(deal.deal_context);
  const exactOp = ops.find((o) => (compat.exact as string[]).includes(o));
  if (exactOp) {
    return {
      dim: { earned: 20, max: 20, evaluated: true, reason: `${operationLabel(exactOp)} : cœur de métier pour un dossier ${ctxLabel}` },
      breaker: null,
    };
  }
  const compatibleOp = ops.find((o) => !(compat.incompatible as string[]).includes(o));
  if (compatibleOp) {
    return {
      dim: { earned: 12, max: 20, evaluated: true, reason: `${operationLabel(compatibleOp)} : jouable sur un dossier ${ctxLabel}` },
      breaker: null,
    };
  }
  return {
    dim: { earned: 0, max: 20, evaluated: true, reason: `Aucune opération pratiquée compatible avec ${ctxLabel}` },
    breaker: `Opérations de ${org.name} (${ops.map(operationLabel).join(", ")}) incompatibles avec un dossier ${ctxLabel}`,
  };
}

/** Appétit (15) : activité récente 15, historique déclaré 10, rien = non évalué. */
function scoreAppetit(
  org: AcquirerOrgInput,
  history: AcquirerHistoryInput | null,
): AcquirerDimension {
  if (history && history.approaches_24m > 0) {
    return {
      earned: 15, max: 15, evaluated: true,
      reason: `Actif : ${history.approaches_24m} approche${history.approaches_24m > 1 ? "s" : ""} sur vos dossiers en 24 mois`,
    };
  }
  if (org.acquisition_history && org.acquisition_history.trim()) {
    return { earned: 10, max: 15, evaluated: true, reason: "Historique d'acquisitions déclaré" };
  }
  return notEvaluated(15, "Aucun signal d'appétit connu (ni approche, ni historique)");
}

/** Géographie (10) : périmètre couvre 10, global 8, limitrophe 6, hors 0. */
function scoreGeographie(
  deal: AcquirerDealInput,
  org: AcquirerOrgInput,
): AcquirerDimension {
  const dealGeo = normalizeGeoText(deal.location ?? null);
  if (!dealGeo) {
    return notEvaluated(10, "Localisation du dossier non normalisable");
  }
  const geos = org.target_geographies ?? [];
  if (geos.length === 0) {
    return notEvaluated(10, "Géographies cibles non déclarées");
  }
  const label = GEO_LABELS[dealGeo] ?? dealGeo;
  if (geos.includes(dealGeo)) {
    return { earned: 10, max: 10, evaluated: true, reason: `${label} dans le périmètre déclaré` };
  }
  if (geos.includes("global")) {
    return { earned: 8, max: 10, evaluated: true, reason: "Couverture globale déclarée" };
  }
  // GEO_COMPATIBILITY[région] contient les zones qui l'englobent (france,
  // europe...) : un acquéreur qui couvre la France couvre Lyon, plein score.
  // Le référentiel ne distingue pas encore « limitrophe » (palier 6 réservé).
  const compatible = GEO_COMPATIBILITY[dealGeo] ?? [dealGeo];
  if (geos.some((g) => compatible.includes(g))) {
    return { earned: 10, max: 10, evaluated: true, reason: `${label} couvert par le périmètre déclaré` };
  }
  return { earned: 0, max: 10, evaluated: true, reason: `${label} hors périmètre géographique` };
}

/**
 * Structure (10) : position capitalistique vs cession envisagée.
 * Minoritaire seul + cession totale exigée = éliminatoire.
 */
function scoreStructure(
  deal: AcquirerDealInput,
  org: AcquirerOrgInput,
): { dim: AcquirerDimension; breaker: string | null } {
  if (!org.deal_stance) {
    return { dim: notEvaluated(10, "Position capitalistique non renseignée"), breaker: null };
  }
  if (org.deal_stance === "minority") {
    if (deal.partial_sale_ok === false) {
      return {
        dim: { earned: 0, max: 10, evaluated: true, reason: "Minoritaire uniquement, cession totale exigée" },
        breaker: `${org.name} n'intervient qu'en minoritaire, le dossier exige une cession totale`,
      };
    }
    return {
      dim: { earned: 10, max: 10, evaluated: true, reason: "Cession partielle envisagée, position minoritaire compatible" },
      breaker: null,
    };
  }
  // majority | both : compatible avec cession totale comme partielle.
  return {
    dim: { earned: 10, max: 10, evaluated: true, reason: org.deal_stance === "both" ? "Majoritaire ou minoritaire : flexible" : "Prise majoritaire, compatible" },
    breaker: null,
  };
}

/** Bonus relation CRM (+10 max) : départage les bons, ne rachète pas un mauvais fit. */
function bonusRelation(relation: AcquirerRelationInput | null): { earned: number; max: number; reasons: string[] } {
  if (!relation) return { earned: 0, max: 10, reasons: [] };
  const reasons: string[] = [];
  let earned = 0;
  if (relation.contact_count > 0) {
    earned += 4;
    reasons.push(`${relation.contact_count} contact${relation.contact_count > 1 ? "s" : ""} chez l'acquéreur`);
  }
  if (relation.last_interaction_days != null && relation.last_interaction_days <= 180) {
    earned += 6;
    reasons.push(`Échange récent (il y a ${relation.last_interaction_days} j)`);
  }
  return { earned: Math.min(10, earned), max: 10, reasons };
}

// ── Entrée principale ────────────────────────────────────────────────────────

export function scoreAcquirer(
  deal: AcquirerDealInput,
  org: AcquirerOrgInput,
  ctx: { relation?: AcquirerRelationInput | null; history?: AcquirerHistoryInput | null } = {},
): AcquirerScoreResult {
  const capacite = scoreCapacite(deal, org);
  const secteur = scoreSecteur(deal, org);
  const operation = scoreOperation(deal, org);
  const appetit = scoreAppetit(org, ctx.history ?? null);
  const geographie = scoreGeographie(deal, org);
  const structure = scoreStructure(deal, org);

  const breakdown = {
    capacite: capacite.dim,
    secteur: secteur.dim,
    operation: operation.dim,
    appetit,
    geographie,
    structure: structure.dim,
  };

  const dims = Object.values(breakdown);
  const coverage = { evaluated: dims.filter((d) => d.evaluated).length, total: dims.length };

  const bonus = bonusRelation(ctx.relation ?? null);

  const rejections = ctx.history?.rejections_similar ?? 0;
  const malus = rejections >= 3
    ? { points: -10, reason: `${rejections} refus sur des dossiers similaires (mémoire de vos approches)` }
    : { points: 0, reason: null };

  // Éliminatoires : type d'organisation, puis dimensions.
  let dealBreaker: string | null = null;
  if (!ACQUIRER_BUYER_TYPES.includes(org.organization_type)) {
    dealBreaker = `Type ${org.organization_type} : pas un acquéreur`;
  } else {
    dealBreaker = secteur.breaker ?? capacite.breaker ?? operation.breaker ?? structure.breaker ?? null;
  }

  if (dealBreaker) {
    return { score: null, dealBreaker, coverage, breakdown, bonusRelation: bonus, malusHistorique: malus };
  }

  const base = dims.reduce((sum, d) => sum + d.earned, 0);
  const score = Math.max(0, Math.min(100, base + bonus.earned + malus.points));

  return { score, dealBreaker: null, coverage, breakdown, bonusRelation: bonus, malusHistorique: malus };
}
