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
} from "@/lib/crm/investor-parsers";

// ── Types ────────────────────────────────────────────────────────────────

export interface InvestorMatchBreakdown {
  ticket:    { earned: number; max: number; filled: boolean };
  sector:    { earned: number; max: number; filled: boolean };
  stage:     { earned: number; max: number; filled: boolean };
  geography: { earned: number; max: number; filled: boolean };
  /** true si deal ET investisseur ont une géo renseignée mais aucune intersection */
  geoMismatch: boolean;
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
function resolveInvestorFields(inv: {
  investor_ticket_min?: number | null;
  investor_ticket_max?: number | null;
  investor_sectors?: string[] | null;
  investor_stages?: string[] | null;
  investor_geographies?: string[] | null;
  investment_ticket?: string | null;
  investment_stage?: string | null;
  sector?: string | null;
}) {
  // Ticket
  let ticketMin = inv.investor_ticket_min ?? null;
  let ticketMax = inv.investor_ticket_max ?? null;
  if (ticketMin === null && ticketMax === null && inv.investment_ticket) {
    const parsed = parseTicketText(inv.investment_ticket);
    if (parsed) { ticketMin = parsed.min; ticketMax = parsed.max; }
  }

  // Stages
  let stages: string[] = (inv.investor_stages ?? []).filter(Boolean);
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

  // Geographies
  const geographies: string[] = (inv.investor_geographies ?? []).filter(Boolean);

  return { ticketMin, ticketMax, stages, sectors, geographies };
}

// ── Scoring ───────────────────────────────────────────────────────────

function scoreTicket(targetAmount: number | null, min: number | null, max: number | null): number {
  if (!targetAmount) return 0;
  const lo = min ?? 0;
  const hi = max ?? Infinity;
  if (targetAmount >= lo && targetAmount <= hi) return 30;
  if (targetAmount >= lo * 0.5 && targetAmount <= hi * 2) return 15;
  return 0;
}

function scoreSector(dealSector: string | null, investorSectors: string[]): number {
  if (!dealSector || !investorSectors?.length) return 0;
  // Généraliste : match automatique
  if (investorSectors.some(s => s.toLowerCase() === "généraliste")) return 30;
  // Normalise le secteur deal (anciens labels → référentiel court)
  const normalized = normalizeDealSector(dealSector) ?? dealSector;
  const deal = normalized.toLowerCase();
  return investorSectors.some(s =>
    s.toLowerCase() === deal ||
    deal.includes(s.toLowerCase()) ||
    s.toLowerCase().includes(deal)
  ) ? 30 : 0;
}

function scoreStage(dealStage: string | null, investorStages: string[]): number {
  if (!dealStage || !investorStages?.length) return 0;
  // Généraliste (investisseur "toutes étapes") → match automatique
  if (investorStages.some(s => s.toLowerCase() === "généraliste")) return 15;
  // STAGE_MAP : clé = company_stage du deal, valeurs = labels investor_stages compatibles
  const compatible = STAGE_MAP[dealStage] ?? [];
  return investorStages.some(s => compatible.includes(s)) ? 15 : 0;
}

/**
 * Vérifie si la géographie du deal et de l'investisseur sont compatibles.
 * Retourne true si match (ou si l'un des deux n'a pas de géo = pas de restriction).
 */
function isGeographyMatch(dealGeo: string | null, investorGeos: string[]): boolean {
  if (!dealGeo || investorGeos.length === 0) return true;
  const compatible = GEO_COMPATIBILITY[dealGeo] ?? [];
  return investorGeos.some(g => compatible.includes(g));
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
  inv: {
    investor_ticket_min: number | null;
    investor_ticket_max: number | null;
    investor_sectors: string[];
    investor_stages: string[];
    investor_geographies: string[];
  }
): { score: number | null; breakdown: InvestorMatchBreakdown } {
  // Pondération : Ticket 30 · Secteur 30 · Stage 15 · Géo 15 = 90pts → normalisé /90 × 100
  const hasTicket  = inv.investor_ticket_min !== null || inv.investor_ticket_max !== null;
  const hasSectors = inv.investor_sectors?.length > 0;
  const hasStages  = inv.investor_stages?.length > 0;
  const hasGeo     = inv.investor_geographies?.length > 0;

  // Score par critère : si le deal n'a pas la donnée → points max (pas de pénalité deal incomplet)
  const ticketEarned  = hasTicket  ? (dealAmount  !== null ? scoreTicket(dealAmount, inv.investor_ticket_min, inv.investor_ticket_max) : 30) : 0;
  const sectorEarned  = hasSectors ? (dealSector  !== null ? scoreSector(dealSector, inv.investor_sectors) : 30) : 0;
  const stageEarned   = hasStages  ? (dealStage   !== null ? scoreStage(dealStage, inv.investor_stages) : 15) : 0;
  const geoEarned     = hasGeo     ? (dealGeo     !== null ? scoreGeography(dealGeo, inv.investor_geographies) : 15) : 0;

  // Geo mismatch = les deux côtés ont une géo ET aucune intersection → drop-dead
  const geoMismatch = hasGeo && dealGeo !== null && !isGeographyMatch(dealGeo, inv.investor_geographies);

  const breakdown: InvestorMatchBreakdown = {
    ticket:    { earned: ticketEarned,  max: 30, filled: hasTicket },
    sector:    { earned: sectorEarned,  max: 30, filled: hasSectors },
    stage:     { earned: stageEarned,   max: 15, filled: hasStages },
    geography: { earned: geoEarned,     max: 15, filled: hasGeo },
    geoMismatch,
  };

  const criteria = [breakdown.ticket, breakdown.sector, breakdown.stage, breakdown.geography].filter(c => c.filled);
  // Aucun critère investisseur renseigné → profil vraiment incomplet
  if (criteria.length === 0) return { score: null, breakdown };

  const totalWeight = criteria.reduce((s, c) => s + c.max, 0);
  const earned      = criteria.reduce((s, c) => s + c.earned, 0);
  let rawScore = Math.round(earned / totalWeight * 100);

  // Pénalité profil investisseur incomplet : moins de 3 critères renseignés → score × 0.6
  if (criteria.length < 3) rawScore = Math.round(rawScore * 0.6);

  // GEO DROP-DEAD : si géo incompatible, score cappé à 20 max
  if (geoMismatch) rawScore = Math.min(rawScore, 20);

  return { score: rawScore, breakdown };
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
    .select("id, target_amount, sector, location, company_stage, company_geography")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .single();
  if (dealErr || !deal) return { matches: [], error: "Dossier introuvable" };

  let query = supabase
    .from("organizations")
    .select("id, name, organization_type, base_status, investor_ticket_min, investor_ticket_max, investor_sectors, investor_stages, investor_geographies, investor_thesis, investment_ticket, investment_stage, sector")
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
    const { score, breakdown } = computeScore(
      deal.target_amount ?? null,
      deal.sector ?? null,
      deal.company_stage ?? null,
      dealGeo,
      {
        investor_ticket_min:  resolved.ticketMin,
        investor_ticket_max:  resolved.ticketMax,
        investor_sectors:     resolved.sectors,
        investor_stages:      resolved.stages,
        investor_geographies: resolved.geographies,
      }
    );
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
