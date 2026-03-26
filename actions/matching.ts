"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  normalizeDealSector,
  STAGE_MAP,
  GEO_COMPATIBILITY,
  scoreGeography,
} from "@/lib/crm/matching-maps";

// ── Types ────────────────────────────────────────────────────────────────

export interface InvestorMatchBreakdown {
  ticket:    { earned: number; max: number; filled: boolean };
  sector:    { earned: number; max: number; filled: boolean };
  stage:     { earned: number; max: number; filled: boolean };
  geography: { earned: number; max: number; filled: boolean };
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

// ── Fallback parsers (anciens champs texte → valeurs structurées) ─────

/** Parse "< 500k€", "1M – 3M€", "> 25M€" → {min, max} en euros */
function parseTicketText(text: string | null): { min: number | null; max: number | null } | null {
  if (!text) return null;
  const t = text.replace(/\s/g, "").toLowerCase();

  function toNum(s: string): number {
    const m = s.match(/(\d+(?:[.,]\d+)?)(k|m)?/);
    if (!m) return 0;
    const n = parseFloat(m[1].replace(",", "."));
    return m[2] === "m" ? n * 1_000_000 : m[2] === "k" ? n * 1_000 : n;
  }

  if (t.startsWith("<")) return { min: null, max: toNum(t.slice(1)) };
  if (t.startsWith(">")) return { min: toNum(t.slice(1)), max: null };
  const parts = t.split(/[–-]/).map(s => s.replace(/[€chfusd$]/g, ""));
  if (parts.length === 2) return { min: toNum(parts[0]), max: toNum(parts[1]) };
  return null;
}

/** Normalise un texte de stage vers nos valeurs de STAGE_OPTIONS */
function normalizeStageText(text: string | null): string | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("pre-seed") || t.includes("preseed") || t.includes("pré-seed")) return "Seed";
  if (t.includes("pré-série a") || t.includes("pre-series a") || t.includes("pre-a")) return "Pré-Série A";
  if (t.includes("série a") || t.includes("series a")) return "Série A";
  if (t.includes("série b") || t.includes("series b")) return "Série B";
  if (t.includes("late") || t.includes("buyout")) return "Late Stage";
  if (t.includes("growth")) return "Growth";
  if (t.includes("seed")) return "Seed";
  if (t.includes("toutes") || t.includes("généraliste") || t.includes("generaliste")) return "Généraliste";
  return text;
}

/** Normalise un texte de secteur vers nos valeurs du référentiel */
function normalizeSectorText(text: string | null): string | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("généraliste") || t.includes("generaliste")) return "Généraliste";
  if (t.includes("saas") || t.includes("logiciel") || t.includes("software")) return "SaaS";
  if (t.includes("fintech") || t.includes("insurtech")) return "Fintech";
  if (t.includes("santé") || t.includes("medtech") || t.includes("health")) return "Healthtech";
  if (t.includes("ia") || t.includes("intelligence artificielle") || t.includes("ai") || t.includes("deeptech")) return "Deeptech";
  if (t.includes("cyber")) return "Cybersécurité";
  if (t.includes("industrie") || t.includes("industrial") || t.includes("manufacturing")) return "Industrie";
  if (t.includes("retail") || t.includes("e-commerce") || t.includes("commerce") || t.includes("distribution")) return "Retail";
  if (t.includes("energie") || t.includes("énergie") || t.includes("cleantech")) return "Energie";
  if (t.includes("immobilier") || t.includes("real estate")) return "Immobilier";
  if (t.includes("transport") || t.includes("mobility") || t.includes("logistique")) return "Transport";
  if (t.includes("food") || t.includes("agri") || t.includes("agroalimentaire")) return "Food";
  if (t.includes("edtech") || t.includes("éducation") || t.includes("education")) return "Edtech";
  if (t.includes("marketplace")) return "Marketplace";
  if (t.includes("hardware")) return "Hardware";
  if (t.includes("impact")) return "Impact";
  if (t.includes("juridique") || t.includes("legal")) return "Juridique";
  return text;
}

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
  if (investorStages.some(s => s.toLowerCase() === "généraliste")) return 25;
  // STAGE_MAP : clé = company_stage du deal, valeurs = labels investor_stages compatibles
  const compatible = STAGE_MAP[dealStage] ?? [];
  return investorStages.some(s => compatible.includes(s)) ? 25 : 0;
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
  // Un critère est "filled" (scoré) seulement si LES DEUX CÔTÉS ont la donnée.
  // Si le dossier n'a pas de stade/géo/montant, on ne pénalise pas l'investisseur.
  const ticketFilled  = (inv.investor_ticket_min !== null || inv.investor_ticket_max !== null) && dealAmount !== null;
  const sectorsFilled = inv.investor_sectors?.length > 0 && dealSector !== null;
  const stagesFilled  = inv.investor_stages?.length > 0 && dealStage !== null;
  const geoFilled     = inv.investor_geographies?.length > 0 && dealGeo !== null;

  const geoEarned = geoFilled ? scoreGeography(dealGeo, inv.investor_geographies) : 0;

  const breakdown: InvestorMatchBreakdown = {
    ticket:    { earned: ticketFilled  ? scoreTicket(dealAmount, inv.investor_ticket_min, inv.investor_ticket_max) : 0, max: 30, filled: ticketFilled },
    sector:    { earned: sectorsFilled ? scoreSector(dealSector, inv.investor_sectors) : 0,   max: 30, filled: sectorsFilled },
    stage:     { earned: stagesFilled  ? scoreStage(dealStage, inv.investor_stages) : 0,       max: 25, filled: stagesFilled },
    geography: { earned: geoEarned,   max: 15, filled: geoFilled },
  };

  const criteria = [breakdown.ticket, breakdown.sector, breakdown.stage, breakdown.geography].filter(c => c.filled);
  if (criteria.length === 0) return { score: null, breakdown };

  const totalWeight = criteria.reduce((s, c) => s + c.max, 0);
  const earned      = criteria.reduce((s, c) => s + c.earned, 0);
  return { score: Math.round(earned / totalWeight * 100), breakdown };
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
    .select("id, target_amount, sector, location, company_stage")
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
    // Inclure active, qualified (ancien), priority (ancien)
    query = query.in("base_status", ["active", "qualified", "priority"]);
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

  // Géo effective : company_geography si la colonne existe (migration V15b), sinon null
  const dealGeo = (deal as any).company_geography ?? null;

  const matches: InvestorMatch[] = (investors ?? []).map(inv => {
    const resolved = resolveInvestorFields(inv as any);
    const { score, breakdown } = computeScore(
      deal.target_amount ?? null,
      deal.sector ?? null,
      (deal as any).company_stage ?? null,
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
