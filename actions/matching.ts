"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  normalizeDealSector,
  STAGE_MAP,
  GEO_COMPATIBILITY,
  scoreGeography,
} from "@/lib/crm/matching-maps";
import {
  parseTicketText,
  normalizeStageText,
  normalizeSectorText,
  normalizeGeoText,
} from "@/lib/crm/investor-parsers";

// ── Types ────────────────────────────────────────────────────────────────

export interface InvestorMatchBreakdown {
  thesis:    { earned: number; max: number; filled: boolean };
  stage:     { earned: number; max: number; filled: boolean };
  ticket:    { earned: number; max: number; filled: boolean };
  relation:  { earned: number; max: number; filled: boolean };
  /** true si deal éliminé par géo (drop-dead) */
  geoMismatch: boolean;
  /** true si deal éliminé par secteur (drop-dead) */
  sectorMismatch: boolean;
}

export interface InvestorMatch {
  org: {
    id: string;
    name: string;
    organization_type: string;
    base_status: string;
    investor_ticket_min: number | null;
    investor_ticket_max: number | null;
    investor_sectors: string[];
    investor_stages: string[];
    investor_geographies: string[];
    investor_thesis: string | null;
  };
  /** Score 0-100, ou null si aucun critère renseigné (profil incomplet) */
  score: number | null;
  breakdown: InvestorMatchBreakdown;
  pipelineStatus: "non_contacte" | "contacte" | "en_cours" | "ko";
}

// ── Investor org types ────────────────────────────────────────────────
const INVESTOR_ORG_TYPES = ["investor", "business_angel", "family_office", "corporate"];

// Parsers importés depuis lib/crm/investor-parsers.ts

/**
 * Résout les champs investisseur en privilégiant les nouvelles colonnes V15
 * et en tombant en fallback sur les anciens champs texte si les nouvelles sont vides.
 */
// Ordre fixe des stades pour dériver la plage depuis min/max
const STAGE_ORDER = ["Seed", "Pré-Série A", "Série A", "Série B", "Growth", "Late Stage"];

function resolveInvestorFields(inv: {
  investor_ticket_min?: number | null;
  investor_ticket_max?: number | null;
  investor_sectors?: string[] | null;
  investor_stages?: string[] | null;
  investor_geographies?: string[] | null;
  investor_stage_min?: string | null;
  investor_stage_max?: string | null;
  investment_ticket?: string | null;
  investment_stage?: string | null;
  sector?: string | null;
  location?: string | null;
}) {
  // Ticket
  let ticketMin = inv.investor_ticket_min ?? null;
  let ticketMax = inv.investor_ticket_max ?? null;
  if (ticketMin === null && ticketMax === null && inv.investment_ticket) {
    const parsed = parseTicketText(inv.investment_ticket);
    if (parsed) { ticketMin = parsed.min; ticketMax = parsed.max; }
  }

  // Stages — priorité : investor_stages[] > stage_min/max > investment_stage texte
  let stages: string[] = (inv.investor_stages ?? []).filter(Boolean);
  if (stages.length === 0 && (inv.investor_stage_min || inv.investor_stage_max)) {
    const sMin = inv.investor_stage_min ?? inv.investor_stage_max!;
    const sMax = inv.investor_stage_max ?? inv.investor_stage_min!;
    const iMin = STAGE_ORDER.indexOf(sMin);
    const iMax = STAGE_ORDER.indexOf(sMax);
    if (iMin >= 0 && iMax >= 0) {
      stages = STAGE_ORDER.slice(Math.min(iMin, iMax), Math.max(iMin, iMax) + 1);
    } else if (iMin >= 0) {
      stages = [sMin];
    } else if (iMax >= 0) {
      stages = [sMax];
    }
  }
  if (stages.length === 0 && inv.investment_stage) {
    const norm = normalizeStageText(inv.investment_stage);
    if (norm) stages = [norm];
  }

  // Sectors
  let sectors: string[] = (inv.investor_sectors ?? []).filter(Boolean);
  if (sectors.length === 0 && inv.sector) {
    const norm = normalizeSectorText(inv.sector);
    if (norm) sectors = [norm];
  }

  // Geographies — fallback depuis location
  let geographies: string[] = (inv.investor_geographies ?? []).filter(Boolean);
  if (geographies.length === 0 && inv.location) {
    const norm = normalizeGeoText(inv.location);
    if (norm) geographies = [norm];
  }

  return { ticketMin, ticketMax, stages, sectors, geographies };
}

// ── Scoring ───────────────────────────────────────────────────────────

// Index ordinal des stades pour scoring par distance
const STAGE_INDEX: Record<string, number> = {
  "Seed": 0, "Pré-Série A": 1, "Série A": 2, "Série B": 3, "Growth": 4, "Late Stage": 5,
};

/** Éliminatoire géo : aucune intersection entre deal et investisseur */
function isGeoEliminated(dealGeo: string | null, investorGeos: string[]): boolean {
  if (!dealGeo || investorGeos.length === 0) return false;
  const compatible = GEO_COMPATIBILITY[dealGeo] ?? [];
  return !investorGeos.some(g => compatible.includes(g));
}

/** Éliminatoire secteur : investisseur a des secteurs, pas Généraliste, et aucune intersection */
function isSectorEliminated(dealSector: string | null, investorSectors: string[]): boolean {
  if (!dealSector || investorSectors.length === 0) return false;
  if (investorSectors.some(s => s.toLowerCase() === "généraliste")) return false;
  const normalized = normalizeDealSector(dealSector) ?? dealSector;
  const deal = normalized.toLowerCase();
  return !investorSectors.some(s =>
    s.toLowerCase() === deal ||
    deal.includes(s.toLowerCase()) ||
    s.toLowerCase().includes(deal)
  );
}

/** Thèse (40pts) : matching thesis texte vs secteur+description deal */
function scoreThesis(investorThesis: string | null, dealSector: string | null, dealDescription: string | null): number {
  if (!investorThesis) return 20; // Non renseigné → 20/40
  const thesis = investorThesis.toLowerCase();
  let score = 0;
  // Secteur deal mentionné dans la thèse
  if (dealSector) {
    const normalized = (normalizeDealSector(dealSector) ?? dealSector).toLowerCase();
    if (thesis.includes(normalized)) score += 20;
  }
  // Mots-clés de la description deal dans la thèse
  if (dealDescription) {
    const keywords = dealDescription.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const matched = keywords.filter(k => thesis.includes(k)).length;
    score += Math.min(20, Math.round((matched / Math.max(keywords.length, 1)) * 20));
  }
  return Math.min(40, score || 20); // Thèse renseignée sans match → 20/40 (neutre)
}

/** Stage (30pts) : distance entre stade deal et plage investisseur */
function scoreStageRange(dealStage: string | null, investorStages: string[]): number {
  if (!dealStage || investorStages.length === 0) return 15; // Non renseigné → 15/30
  if (investorStages.some(s => s.toLowerCase() === "généraliste")) return 30;

  // Trouver min/max index des stages investisseur
  const indices = investorStages.map(s => STAGE_INDEX[s]).filter(i => i !== undefined);
  if (indices.length === 0) return 15;
  const invMin = Math.min(...indices);
  const invMax = Math.max(...indices);

  // Index du deal via STAGE_MAP compatible stages
  const compatible = STAGE_MAP[dealStage] ?? [];
  const dealIndices = compatible.map(s => STAGE_INDEX[s]).filter(i => i !== undefined);
  if (dealIndices.length === 0) return 15;
  const dealIdx = Math.min(...dealIndices); // Plus petit index compatible

  // Calcul écart
  let ecart = 0;
  if (dealIdx < invMin) ecart = invMin - dealIdx;
  else if (dealIdx > invMax) ecart = dealIdx - invMax;

  if (ecart === 0) return 30;
  if (ecart === 1) return 15;
  return 0;
}

/** Ticket (20pts) : deal amount dans fourchette investisseur */
function scoreTicket(dealAmount: number | null, min: number | null, max: number | null): number {
  if (!dealAmount) return 10; // Non renseigné → 10/20
  if (min === null && max === null) return 10;
  const lo = min ?? 0;
  const hi = max ?? Infinity;
  if (dealAmount >= lo && dealAmount <= hi) return 20;
  // Calcul par distance
  const ecart = dealAmount < lo ? lo - dealAmount : dealAmount - hi;
  return Math.max(0, Math.round(20 * (1 - ecart / 2_200_000)));
}

/** Relation (10pts) : interaction existante sur ce dossier */
function scoreRelation(hasInteraction: boolean): number {
  return hasInteraction ? 10 : 5;
}

function computePipelineStatus(
  orgId: string,
  commitments: { organization_id: string | null; status: string }[],
  activityOrgs: string[],
): InvestorMatch["pipelineStatus"] {
  const c = commitments.find(c => c.organization_id === orgId);
  if (c) {
    if (c.status === "cancelled") return "ko";
    if (["hard", "signed", "transferred"].includes(c.status)) return "en_cours";
    return "contacte";
  }
  return activityOrgs.includes(orgId) ? "contacte" : "non_contacte";
}

function computeScore(
  dealAmount: number | null,
  dealSector: string | null,
  dealStage: string | null,
  dealGeo: string | null,
  dealDescription: string | null,
  hasInteraction: boolean,
  inv: {
    investor_ticket_min: number | null;
    investor_ticket_max: number | null;
    investor_sectors: string[];
    investor_stages: string[];
    investor_geographies: string[];
    investor_thesis: string | null;
  }
): { score: number | null; breakdown: InvestorMatchBreakdown } {
  const hasAnyCriteria = inv.investor_ticket_min !== null || inv.investor_ticket_max !== null
    || inv.investor_sectors.length > 0 || inv.investor_stages.length > 0
    || inv.investor_geographies.length > 0 || !!inv.investor_thesis;

  // Éliminatoires
  const geoMismatch    = isGeoEliminated(dealGeo, inv.investor_geographies);
  const sectorMismatch = isSectorEliminated(dealSector, inv.investor_sectors);

  if (!hasAnyCriteria) {
    return {
      score: null,
      breakdown: {
        thesis:   { earned: 0, max: 40, filled: false },
        stage:    { earned: 0, max: 30, filled: false },
        ticket:   { earned: 0, max: 20, filled: false },
        relation: { earned: 0, max: 10, filled: true },
        geoMismatch, sectorMismatch,
      },
    };
  }

  if (geoMismatch || sectorMismatch) {
    return {
      score: 0,
      breakdown: {
        thesis:   { earned: 0, max: 40, filled: !!inv.investor_thesis },
        stage:    { earned: 0, max: 30, filled: inv.investor_stages.length > 0 },
        ticket:   { earned: 0, max: 20, filled: inv.investor_ticket_min !== null || inv.investor_ticket_max !== null },
        relation: { earned: 0, max: 10, filled: true },
        geoMismatch, sectorMismatch,
      },
    };
  }

  // Pondérés (100pts)
  const thesisEarned  = scoreThesis(inv.investor_thesis, dealSector, dealDescription);
  const stageEarned   = scoreStageRange(dealStage, inv.investor_stages);
  const ticketEarned  = scoreTicket(dealAmount, inv.investor_ticket_min, inv.investor_ticket_max);
  const relationEarned = scoreRelation(hasInteraction);

  const total = thesisEarned + stageEarned + ticketEarned + relationEarned;

  return {
    score: Math.min(100, total),
    breakdown: {
      thesis:   { earned: thesisEarned,   max: 40, filled: !!inv.investor_thesis },
      stage:    { earned: stageEarned,    max: 30, filled: inv.investor_stages.length > 0 },
      ticket:   { earned: ticketEarned,   max: 20, filled: inv.investor_ticket_min !== null || inv.investor_ticket_max !== null },
      relation: { earned: relationEarned, max: 10, filled: true },
      geoMismatch, sectorMismatch,
    },
  };
}

// ── getInvestorMatches ────────────────────────────────────────────────

export async function getInvestorMatches(
  dealId: string,
  includeInactive = false,
): Promise<{ matches: InvestorMatch[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { matches: [], error: "Non autorisé" };

  const { data: deal, error: dealErr } = await supabase
    .from("deals")
    .select("id, target_amount, sector, location, company_stage, company_geography, description")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .single();
  if (dealErr || !deal) return { matches: [], error: "Dossier introuvable" };

  let query = supabase
    .from("organizations")
    .select("id, name, organization_type, base_status, investor_ticket_min, investor_ticket_max, investor_sectors, investor_stages, investor_geographies, investor_thesis, investor_stage_min, investor_stage_max, investment_ticket, investment_stage, sector, location")
    .eq("user_id", user.id)
    .in("organization_type", INVESTOR_ORG_TYPES);

  if (!includeInactive) {
    // Inclure active + to_qualify (non qualifié) + anciens labels backward-compat
    query = query.in("base_status", ["active", "to_qualify", "qualified", "priority"]);
  }

  const { data: investors, error: invErr } = await query;
  if (invErr) return { matches: [], error: invErr.message };

  const { data: commitments } = await supabase
    .from("investor_commitments")
    .select("organization_id, status")
    .eq("deal_id", dealId)
    .eq("user_id", user.id);

  const { data: activities } = await supabase
    .from("activities")
    .select("organization_id")
    .eq("deal_id", dealId)
    .eq("user_id", user.id)
    .not("organization_id", "is", null);

  const activityOrgIds = (activities ?? []).map((a: any) => a.organization_id).filter(Boolean) as string[];
  const commitmentsList = (commitments ?? []) as { organization_id: string | null; status: string }[];

  const dealGeo = deal.company_geography ?? null;

  const matches: InvestorMatch[] = (investors ?? []).map(inv => {
    const resolved = resolveInvestorFields(inv as any);
    const hasInteraction = activityOrgIds.includes(inv.id)
      || commitmentsList.some(c => c.organization_id === inv.id);

    // DEBUG temporaire — investisseur "0001"
    if (inv.name.includes("0001")) {
      const geoElim = isGeoEliminated(deal.company_geography ?? null, resolved.geographies);
      const secElim = isSectorEliminated(deal.sector ?? null, resolved.sectors);
      console.log("[MATCH DEBUG 0001]", JSON.stringify({
        name: inv.name,
        deal: { sector: deal.sector, stage: deal.company_stage, geo: deal.company_geography, amount: deal.target_amount, desc: deal.description?.slice(0, 50) },
        resolved_sectors: resolved.sectors,
        resolved_geographies: resolved.geographies,
        resolved_stages: resolved.stages,
        resolved_ticket: { min: resolved.ticketMin, max: resolved.ticketMax },
        geo_eliminated: geoElim,
        sector_eliminated: secElim,
        thesis: inv.investor_thesis?.slice(0, 60),
      }, null, 2));
    }

    const { score, breakdown } = computeScore(
      deal.target_amount ?? null,
      deal.sector ?? null,
      deal.company_stage ?? null,
      dealGeo,
      deal.description ?? null,
      hasInteraction,
      {
        investor_ticket_min:  resolved.ticketMin,
        investor_ticket_max:  resolved.ticketMax,
        investor_sectors:     resolved.sectors,
        investor_stages:      resolved.stages,
        investor_geographies: resolved.geographies,
        investor_thesis:      inv.investor_thesis ?? null,
      }
    );
    // DEBUG temporaire — score investisseur "0001"
    if (inv.name.includes("0001")) {
      console.log("[MATCH SCORE 0001]", JSON.stringify({
        score,
        thesis: breakdown.thesis.earned,
        stage: breakdown.stage.earned,
        ticket: breakdown.ticket.earned,
        relation: breakdown.relation.earned,
        geoMismatch: breakdown.geoMismatch,
        sectorMismatch: breakdown.sectorMismatch,
      }));
    }

    return {
      org: {
        id:                   inv.id,
        name:                 inv.name,
        organization_type:    inv.organization_type,
        base_status:          inv.base_status,
        investor_ticket_min:  resolved.ticketMin,
        investor_ticket_max:  resolved.ticketMax,
        investor_sectors:     resolved.sectors,
        investor_stages:      resolved.stages,
        investor_geographies: resolved.geographies,
        investor_thesis:      inv.investor_thesis ?? null,
      },
      score,
      breakdown,
      pipelineStatus: computePipelineStatus(inv.id, commitmentsList, activityOrgIds),
    };
  });

  matches.sort((a, b) => {
    if (a.score === null && b.score !== null) return 1;
    if (a.score !== null && b.score === null) return -1;
    return (b.score ?? 0) - (a.score ?? 0);
  });

  return { matches };
}

// ── setInvestorStatusAction — utilise base_status ────────────────────

export async function setInvestorStatusAction(
  orgId: string,
  status: "active" | "inactive",
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase
    .from("organizations")
    .update({ base_status: status })
    .eq("id", orgId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/protected/dossiers");
  return { success: true };
}

// ── updateDealMatchingProfile — met à jour les champs de matching d'un dossier ──

export async function updateDealMatchingProfile(
  dealId: string,
  data: {
    company_stage?: string | null;
    company_geography?: string | null;
  },
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase
    .from("deals")
    .update({
      company_stage:     data.company_stage     ?? null,
      company_geography: data.company_geography ?? null,
    })
    .eq("id", dealId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true };
}
