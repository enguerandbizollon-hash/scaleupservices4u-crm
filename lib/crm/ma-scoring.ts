// ─────────────────────────────────────────────────────────────────────────────
// Algorithme scoring M&A — CLAUDE.md source de vérité
//
// Deux directions :
//   sell_to_buyer  : deal ma_sell  → scorer les organisations buyer/investor
//   buy_to_target  : deal ma_buy   → scorer les organisations target
//
// Score stratégique 100 pts  : secteur(30) + taille(25) + géo(15) + profil(20) + timing(10)
// Score IA financier 0-100   : croissance(25) + marge(25) + bilan(25) + comparables(25)
// Score combiné              : strategic × 0.65 + financial × 0.35
//                              Si financial absent → combined = strategic
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeDealSector, GEO_LABELS, GEO_COMPATIBILITY } from "@/lib/crm/matching-maps";
import { normalizeGeoText } from "@/lib/crm/investor-parsers";

// ── Types d'entrée ────────────────────────────────────────────────────────────

export interface MaDealProfile {
  id: string;
  name: string;
  deal_type: "ma_sell" | "ma_buy";
  sector?: string | null;
  location?: string | null;
  // Sell-side : caractéristiques de la cible à vendre
  asking_price_min?: number | null;
  asking_price_max?: number | null;
  partial_sale_ok?: boolean | null;
  management_retention?: boolean | null;
  deal_timing?: string | null;          // now|6months|1year|2years+
  // Buy-side : critères d'acquisition
  target_sectors?: string[] | null;
  target_geographies?: string[] | null;
  target_revenue_min?: number | null;
  target_revenue_max?: number | null;
  target_ev_min?: number | null;
  target_ev_max?: number | null;
  full_acquisition_required?: boolean | null;
  excluded_sectors?: string[] | null;
  target_stage?: string | null;         // startup|pme|eti|grand_groupe
  // Données financières du deal (via financial_data)
  financial?: MaFinancialData | null;
}

export interface MaOrganisationProfile {
  id: string;
  name: string;
  organization_type: string;   // buyer | target | investor | corporate
  sector?: string | null;
  location?: string | null;
  company_stage?: string | null;       // startup|pme|eti|grand_groupe
  revenue_range?: string | null;
  sale_readiness?: string | null;      // not_for_sale|open|actively_selling
  partial_sale_ok?: boolean | null;
  // Buy-side : critères d'acquisition de ce buyer
  acquisition_rationale?: string | null;
  target_sectors?: string[] | null;
  target_geographies?: string[] | null;
  target_revenue_min?: number | null;
  target_revenue_max?: number | null;
  excluded_sectors?: string[] | null;
  // Données financières de l'organisation
  financial?: MaFinancialData | null;
}

export interface MaFinancialData {
  revenue?: number | null;
  revenue_growth?: number | null;
  ebitda?: number | null;
  ebitda_margin?: number | null;
  net_debt?: number | null;
  equity?: number | null;
  ev_estimate?: number | null;
  // SaaS
  arr?: number | null;
  nrr?: number | null;
}

// ── Types de résultat ─────────────────────────────────────────────────────────

export interface MaScoreBreakdown {
  sector:    { earned: number; max: number; reason: string };
  size:      { earned: number; max: number; reason: string };
  geography: { earned: number; max: number; reason: string };
  profile:   { earned: number; max: number; reason: string };
  timing:    { earned: number; max: number; reason: string };
}

export interface MaFinancialBreakdown {
  growth:      { earned: number; max: number; reason: string };
  margin:      { earned: number; max: number; reason: string };
  balance:     { earned: number; max: number; reason: string };
  comparables: { earned: number; max: number; reason: string };
}

export interface MaMatchResult {
  org: MaOrganisationProfile;
  /** null = deal breaker déclenché */
  score: number | null;
  strategicScore: number;
  financialScore: number | null;
  dealBreaker: string | null;
  breakdown: MaScoreBreakdown;
  financialBreakdown: MaFinancialBreakdown | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// normalizeGeo : utilise normalizeGeoText depuis investor-parsers (référentiel GEO_ALL)
function normalizeGeo(geo: string | null | undefined): string | null {
  return normalizeGeoText(geo ?? null);
}

/** Parse revenue_range → {min, max} en unité native */
function parseRevenueRange(range: string | null | undefined): { min: number | null; max: number | null } {
  if (!range) return { min: null, max: null };
  switch (range) {
    case "<1M":      return { min: null,        max: 1_000_000 };
    case "1M-5M":    return { min: 1_000_000,   max: 5_000_000 };
    case "5M-20M":   return { min: 5_000_000,   max: 20_000_000 };
    case "20M-100M": return { min: 20_000_000,  max: 100_000_000 };
    case ">100M":    return { min: 100_000_000, max: null };
    default:         return { min: null,        max: null };
  }
}

// ── Deal Breakers ─────────────────────────────────────────────────────────────

/**
 * Vérifie les deal breakers éliminatoires.
 * Retourne un message de raison ou null si aucun deal breaker.
 */
export function checkMaDealBreakers(
  deal: MaDealProfile,
  org: MaOrganisationProfile,
): string | null {
  if (deal.deal_type === "ma_sell") {
    // Le deal vend une entreprise → on cherche des buyers
    // L'org doit être de type buyer, corporate ou investor
    const validBuyerTypes = ["buyer", "corporate", "investor", "business_angel", "family_office"];
    if (!validBuyerTypes.includes(org.organization_type)) {
      return `Type incompatible : ${org.organization_type} ne peut pas être acquéreur`;
    }

    // Secteur exclu par le buyer
    if (deal.sector && org.excluded_sectors?.length) {
      const normalizedDeal = normalizeDealSector(deal.sector) ?? deal.sector;
      if (org.excluded_sectors.some(s => s.toLowerCase() === normalizedDeal.toLowerCase())) {
        return `Secteur ${normalizedDeal} exclu par ${org.name}`;
      }
    }

    // Taille hors fourchette × 0.5 / × 2
    if (deal.asking_price_min && org.target_revenue_min && org.target_revenue_max) {
      const price = deal.asking_price_min;
      if (price < org.target_revenue_min * 0.5 || price > org.target_revenue_max * 2) {
        return `Taille deal (${(price/1e6).toFixed(1)}M€) hors fourchette acquéreur`;
      }
    }

  }

  if (deal.deal_type === "ma_buy") {
    // Le deal cherche à acheter → on cherche des cibles (targets)
    const validTargetTypes = ["target", "client", "prospect_client"];
    if (!validTargetTypes.includes(org.organization_type)) {
      return `Type incompatible : ${org.organization_type} n'est pas une cible M&A`;
    }

    // Cible non disponible à la vente
    if (org.sale_readiness === "not_for_sale") {
      return `${org.name} n'est pas en vente (sale_readiness = not_for_sale)`;
    }

    // Secteur de la cible dans excluded_sectors du deal
    if (org.sector && deal.excluded_sectors?.length) {
      const normalizedOrg = normalizeDealSector(org.sector) ?? org.sector;
      if (deal.excluded_sectors.some(s => s.toLowerCase() === normalizedOrg.toLowerCase())) {
        return `Secteur ${normalizedOrg} exclu dans les critères d'acquisition`;
      }
    }

    // Revenue de la cible hors fourchette × 0.5 / × 2
    if (org.financial?.revenue && deal.target_revenue_min && deal.target_revenue_max) {
      const rev = org.financial.revenue;
      if (rev < deal.target_revenue_min * 0.5 || rev > deal.target_revenue_max * 2) {
        return `CA cible (${(rev/1e6).toFixed(1)}M€) hors fourchette deal`;
      }
    }

    // full_acquisition_required : buyer veut 100% mais la cible n'accepte que partiel
    if (deal.full_acquisition_required === true && org.partial_sale_ok === true) {
      return `Acquisition 100% requise mais ${org.name} n'accepte que la cession partielle`;
    }
  }

  return null;
}

// ── Scoring stratégique ───────────────────────────────────────────────────────

function scoreSector(deal: MaDealProfile, org: MaOrganisationProfile): { earned: number; reason: string } {
  if (deal.deal_type === "ma_sell") {
    // On cherche un buyer pour le deal — on score le secteur du buyer vs le secteur du deal
    if (!deal.sector) return { earned: 15, reason: "Secteur deal non renseigné — neutre" };
    const normalized = normalizeDealSector(deal.sector) ?? deal.sector;

    // Buyer généraliste
    if (!org.target_sectors?.length) return { earned: 20, reason: "Buyer généraliste — match neutre" };

    const match = org.target_sectors.some(s =>
      s.toLowerCase() === normalized.toLowerCase() ||
      s.toLowerCase() === "généraliste"
    );
    return match
      ? { earned: 30, reason: `Secteur ${normalized} dans la thèse du buyer` }
      : { earned: 0,  reason: `Secteur ${normalized} hors thèse buyer (${org.target_sectors.slice(0,2).join(", ")})` };
  }

  // ma_buy : on score la cible vs les secteurs cibles du deal
  if (!org.sector) return { earned: 15, reason: "Secteur cible non renseigné — neutre" };
  const normalizedOrg = normalizeDealSector(org.sector) ?? org.sector;

  if (!deal.target_sectors?.length) return { earned: 20, reason: "Secteurs cibles non définis — neutre" };

  const match = deal.target_sectors.some(s =>
    s.toLowerCase() === normalizedOrg.toLowerCase() ||
    s.toLowerCase() === "généraliste"
  );
  return match
    ? { earned: 30, reason: `Secteur ${normalizedOrg} dans les critères d'acquisition` }
    : { earned: 5,  reason: `Secteur ${normalizedOrg} hors critères (${deal.target_sectors.slice(0,2).join(", ")})` };
}

function scoreSize(deal: MaDealProfile, org: MaOrganisationProfile): { earned: number; reason: string } {
  if (deal.deal_type === "ma_sell") {
    // Vérifier si le deal (asking_price) rentre dans le budget du buyer
    const price = deal.asking_price_min ?? deal.asking_price_max;
    if (!price) return { earned: 12, reason: "Prix demandé non renseigné — neutre" };
    if (!org.target_revenue_min && !org.target_revenue_max) return { earned: 12, reason: "Budget buyer non renseigné — neutre" };

    const lo = org.target_revenue_min ?? 0;
    const hi = org.target_revenue_max ?? Infinity;
    if (price >= lo && price <= hi)  return { earned: 25, reason: `Prix ${(price/1e6).toFixed(1)}M€ dans le budget buyer` };
    if (price >= lo * 0.7 && price <= hi * 1.5) return { earned: 12, reason: `Prix proche du budget buyer` };
    return { earned: 0, reason: `Prix ${(price/1e6).toFixed(1)}M€ hors budget buyer` };
  }

  // ma_buy : vérifier si le CA / EV de la cible rentre dans les critères du deal
  if (!org.financial?.revenue) return { earned: 12, reason: "CA cible inconnu — neutre" };
  const rev = org.financial.revenue;

  const lo = deal.target_revenue_min ?? 0;
  const hi = deal.target_revenue_max ?? Infinity;
  if (rev >= lo && rev <= hi)          return { earned: 25, reason: `CA ${(rev/1e6).toFixed(1)}M€ dans la fourchette cible` };
  if (rev >= lo * 0.7 && rev <= hi * 1.5) return { earned: 12, reason: `CA proche de la fourchette cible` };
  return { earned: 0, reason: `CA ${(rev/1e6).toFixed(1)}M€ hors fourchette cible` };
}

function scoreGeography(deal: MaDealProfile, org: MaOrganisationProfile): { earned: number; reason: string } {
  const dealGeo = normalizeGeo(deal.location);

  if (deal.deal_type === "ma_sell") {
    if (!dealGeo) return { earned: 8, reason: "Localisation deal non renseignée — neutre" };
    if (!org.target_geographies?.length) return { earned: 8, reason: "Géographies buyer non définies — neutre" };
    const compatible = GEO_COMPATIBILITY[dealGeo] ?? [dealGeo];
    const match = org.target_geographies.some(g => compatible.includes(g) || g === "global");
    const label = GEO_LABELS[dealGeo] ?? dealGeo;
    return match
      ? { earned: 15, reason: `${label} dans les géographies cibles du buyer` }
      : { earned: 0,  reason: `${label} hors zone buyer` };
  }

  // ma_buy
  const orgGeo = normalizeGeo(org.location);
  if (!orgGeo) return { earned: 8, reason: "Localisation cible inconnue — neutre" };
  if (!deal.target_geographies?.length) return { earned: 8, reason: "Géographies d'acquisition non définies — neutre" };
  const compatibleOrg = GEO_COMPATIBILITY[orgGeo] ?? [orgGeo];
  const match = deal.target_geographies.some(g => compatibleOrg.includes(g) || g === "global");
  const label = GEO_LABELS[orgGeo] ?? orgGeo;
  return match
    ? { earned: 15, reason: `${label} dans les géographies d'acquisition` }
    : { earned: 0,  reason: `${label} hors zones d'acquisition` };
}

function scoreProfile(deal: MaDealProfile, org: MaOrganisationProfile): { earned: number; reason: string } {
  if (deal.deal_type === "ma_sell") {
    // Maturité de la cible : actively_selling = strong signal
    if (org.sale_readiness === "actively_selling") return { earned: 20, reason: "Organisation activement en cession" };
    if (org.sale_readiness === "open")             return { earned: 12, reason: "Organisation ouverte aux offres" };
    return { earned: 5, reason: "Disponibilité cession non précisée" };
  }

  // ma_buy : évaluer si la cible a un profil M&A adapté au stade attendu
  if (!deal.target_stage) return { earned: 10, reason: "Stade cible non défini — neutre" };
  if (!org.company_stage) return { earned: 10, reason: "Stade organisation inconnu — neutre" };
  if (org.company_stage === deal.target_stage) return { earned: 20, reason: `Stade ${org.company_stage} correspond au critère` };
  // Tolérance : stade adjacent
  const adjacency: Record<string, string[]> = {
    startup: ["startup", "pme"],
    pme:     ["startup", "pme", "eti"],
    eti:     ["pme", "eti", "grand_groupe"],
    grand_groupe: ["eti", "grand_groupe"],
  };
  const adjacent = adjacency[deal.target_stage] ?? [];
  if (adjacent.includes(org.company_stage)) return { earned: 12, reason: `Stade ${org.company_stage} proche du critère ${deal.target_stage}` };
  return { earned: 0, reason: `Stade ${org.company_stage} ne correspond pas au critère ${deal.target_stage}` };
}

function scoreTiming(deal: MaDealProfile, org: MaOrganisationProfile): { earned: number; reason: string } {
  // Timing du deal vs disponibilité organisation
  if (deal.deal_type === "ma_sell") {
    const t = deal.deal_timing;
    if (!t || t === "now") return { earned: 10, reason: "Deal prêt maintenant" };
    if (t === "6months")   return { earned: 8,  reason: "Deal dans 6 mois" };
    if (t === "1year")     return { earned: 5,  reason: "Deal dans 1 an" };
    return { earned: 2, reason: "Deal dans 2 ans+" };
  }

  // ma_buy : pas de timing côté cible → score neutre
  return { earned: 7, reason: "Timing non applicable côté cible" };
}

// ── Scoring stratégique 100 pts ───────────────────────────────────────────────

export function computeMaStrategicScore(
  deal: MaDealProfile,
  org: MaOrganisationProfile,
): { score: number; breakdown: MaScoreBreakdown } {
  const sector    = scoreSector(deal, org);
  const size      = scoreSize(deal, org);
  const geography = scoreGeography(deal, org);
  const profile   = scoreProfile(deal, org);
  const timing    = scoreTiming(deal, org);

  const breakdown: MaScoreBreakdown = {
    sector:    { earned: sector.earned,    max: 30, reason: sector.reason },
    size:      { earned: size.earned,      max: 25, reason: size.reason },
    geography: { earned: geography.earned, max: 15, reason: geography.reason },
    profile:   { earned: profile.earned,   max: 20, reason: profile.reason },
    timing:    { earned: timing.earned,    max: 10, reason: timing.reason },
  };

  const score = sector.earned + size.earned + geography.earned + profile.earned + timing.earned;
  return { score, breakdown };
}

// ── Scoring financier IA (0-100) ──────────────────────────────────────────────

export function computeMaFinancialScore(
  financial: MaFinancialData | null | undefined,
): { score: number; breakdown: MaFinancialBreakdown } | null {
  if (!financial) return null;

  const { revenue_growth, ebitda_margin, net_debt, equity, ev_estimate, revenue, arr, nrr } = financial;

  // Croissance revenue (25 pts)
  let growthEarned = 0;
  let growthReason = "Croissance inconnue";
  if (revenue_growth != null) {
    if (revenue_growth >= 30)      { growthEarned = 25; growthReason = `Forte croissance +${revenue_growth.toFixed(0)}%`; }
    else if (revenue_growth >= 15) { growthEarned = 18; growthReason = `Bonne croissance +${revenue_growth.toFixed(0)}%`; }
    else if (revenue_growth >= 5)  { growthEarned = 12; growthReason = `Croissance modérée +${revenue_growth.toFixed(0)}%`; }
    else if (revenue_growth >= 0)  { growthEarned = 5;  growthReason = `Croissance faible +${revenue_growth.toFixed(0)}%`; }
    else                           { growthEarned = 0;  growthReason = `Décroissance ${revenue_growth.toFixed(0)}%`; }
  } else if (arr && nrr && nrr >= 110) {
    growthEarned = 20; growthReason = `NRR ${nrr.toFixed(0)}% — forte rétention SaaS`;
  }

  // Marge EBITDA (25 pts)
  let marginEarned = 0;
  let marginReason = "Marge EBITDA inconnue";
  if (ebitda_margin != null) {
    if (ebitda_margin >= 30)      { marginEarned = 25; marginReason = `Excellente marge EBITDA ${ebitda_margin.toFixed(0)}%`; }
    else if (ebitda_margin >= 15) { marginEarned = 18; marginReason = `Bonne marge EBITDA ${ebitda_margin.toFixed(0)}%`; }
    else if (ebitda_margin >= 5)  { marginEarned = 10; marginReason = `Marge EBITDA correcte ${ebitda_margin.toFixed(0)}%`; }
    else if (ebitda_margin >= 0)  { marginEarned = 4;  marginReason = `Marge EBITDA faible ${ebitda_margin.toFixed(0)}%`; }
    else                          { marginEarned = 0;  marginReason = `EBITDA négatif ${ebitda_margin.toFixed(0)}%`; }
  }

  // Bilan : net_debt / equity (25 pts)
  let balanceEarned = 0;
  let balanceReason = "Bilan inconnu";
  if (equity != null && equity > 0) {
    if (net_debt == null || net_debt <= 0)             { balanceEarned = 25; balanceReason = "Bilan net positif, dette nulle ou cash net"; }
    else {
      const leverage = net_debt / equity;
      if (leverage <= 1)      { balanceEarned = 20; balanceReason = `Levier modéré ${leverage.toFixed(1)}x EBITDA`; }
      else if (leverage <= 3) { balanceEarned = 10; balanceReason = `Levier élevé ${leverage.toFixed(1)}x EBITDA`; }
      else                    { balanceEarned = 2;  balanceReason = `Levier très élevé ${leverage.toFixed(1)}x EBITDA`; }
    }
  }

  // Comparables valorisation (25 pts)
  let compEarned = 0;
  let compReason = "Valorisation non disponible";
  if (ev_estimate != null && revenue != null && revenue > 0) {
    const multiple = ev_estimate / revenue;
    if (multiple >= 3 && multiple <= 8)      { compEarned = 25; compReason = `Multiple EV/CA ${multiple.toFixed(1)}x — dans les normes de marché`; }
    else if (multiple < 3)                   { compEarned = 18; compReason = `Multiple EV/CA ${multiple.toFixed(1)}x — décote vs marché`; }
    else if (multiple > 8 && multiple <= 15) { compEarned = 15; compReason = `Multiple EV/CA ${multiple.toFixed(1)}x — prime premium`; }
    else                                     { compEarned = 5;  compReason = `Multiple EV/CA ${multiple.toFixed(1)}x — hors normes`; }
  } else if (arr != null && ev_estimate != null && arr > 0) {
    const arrMult = ev_estimate / arr;
    if (arrMult >= 5 && arrMult <= 15)   { compEarned = 25; compReason = `Multiple EV/ARR ${arrMult.toFixed(1)}x — premium SaaS`; }
    else if (arrMult < 5)                { compEarned = 15; compReason = `Multiple EV/ARR ${arrMult.toFixed(1)}x — décote`; }
    else                                 { compEarned = 12; compReason = `Multiple EV/ARR ${arrMult.toFixed(1)}x — élevé`; }
  }

  const score = growthEarned + marginEarned + balanceEarned + compEarned;

  const breakdown: MaFinancialBreakdown = {
    growth:      { earned: growthEarned,  max: 25, reason: growthReason  },
    margin:      { earned: marginEarned,  max: 25, reason: marginReason  },
    balance:     { earned: balanceEarned, max: 25, reason: balanceReason },
    comparables: { earned: compEarned,    max: 25, reason: compReason    },
  };

  return { score, breakdown };
}

// ── Score combiné ─────────────────────────────────────────────────────────────

export function computeMaCombinedScore(strategicScore: number, financialScore: number | null): number {
  if (financialScore === null) return strategicScore;
  return Math.round(strategicScore * 0.65 + financialScore * 0.35);
}

// ── Fonction principale ───────────────────────────────────────────────────────

export function scoreMaMatch(deal: MaDealProfile, org: MaOrganisationProfile): MaMatchResult {
  const dealBreaker = checkMaDealBreakers(deal, org);
  if (dealBreaker) {
    return {
      org,
      score: null,
      strategicScore: 0,
      financialScore: null,
      dealBreaker,
      breakdown: {
        sector:    { earned: 0, max: 30, reason: "Deal breaker" },
        size:      { earned: 0, max: 25, reason: "Deal breaker" },
        geography: { earned: 0, max: 15, reason: "Deal breaker" },
        profile:   { earned: 0, max: 20, reason: "Deal breaker" },
        timing:    { earned: 0, max: 10, reason: "Deal breaker" },
      },
      financialBreakdown: null,
    };
  }

  const { score: strategicScore, breakdown } = computeMaStrategicScore(deal, org);
  const financial = computeMaFinancialScore(org.financial);
  const financialScore = financial?.score ?? null;
  const combinedScore  = computeMaCombinedScore(strategicScore, financialScore);

  return {
    org,
    score: combinedScore,
    strategicScore,
    financialScore,
    dealBreaker: null,
    breakdown,
    financialBreakdown: financial?.breakdown ?? null,
  };
}
