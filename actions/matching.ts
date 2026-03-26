"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

// ── Scoring ───────────────────────────────────────────────────────────

function scoreTicket(targetAmount: number | null, min: number | null, max: number | null): number {
  if (!targetAmount) return 0;
  if (min !== null && max !== null) {
    if (targetAmount >= min && targetAmount <= max) return 30;
    const lowerOk = targetAmount >= min * 0.5 && targetAmount < min;
    const upperOk = targetAmount > max && targetAmount <= max * 1.5;
    return (lowerOk || upperOk) ? 15 : 0;
  }
  if (min !== null) return targetAmount >= min ? 30 : (targetAmount >= min * 0.5 ? 15 : 0);
  if (max !== null) return targetAmount <= max ? 30 : (targetAmount <= max * 1.5 ? 15 : 0);
  return 0;
}

function scoreSector(dealSector: string | null, investorSectors: string[]): number {
  if (!dealSector || !investorSectors?.length) return 0;
  // Règle Généraliste : match parfait automatique
  if (investorSectors.some(s => s.toLowerCase() === "généraliste")) return 30;
  const deal = dealSector.toLowerCase();
  return investorSectors.some(s =>
    s.toLowerCase() === deal || deal.includes(s.toLowerCase()) || s.toLowerCase().includes(deal)
  ) ? 30 : 0;
}

function scoreStage(dealStage: string | null, investorStages: string[]): number {
  if (!dealStage || !investorStages?.length) return 0;
  return investorStages.some(s => s.toLowerCase() === dealStage.toLowerCase()) ? 25 : 0;
}

function scoreGeography(dealGeo: string | null, investorGeos: string[]): number {
  if (!dealGeo || !investorGeos?.length) return 0;
  const deal = dealGeo.toLowerCase();
  return investorGeos.some(g => {
    const geo = g.toLowerCase();
    return geo === deal || geo === "global" || deal.includes(geo) || geo.includes(deal);
  }) ? 15 : 0;
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
  const ticketFilled  = inv.investor_ticket_min !== null || inv.investor_ticket_max !== null;
  const sectorsFilled = inv.investor_sectors?.length > 0;
  const stagesFilled  = inv.investor_stages?.length > 0;
  const geoFilled     = inv.investor_geographies?.length > 0;

  const breakdown: InvestorMatchBreakdown = {
    ticket:    { earned: ticketFilled  ? scoreTicket(dealAmount, inv.investor_ticket_min, inv.investor_ticket_max) : 0, max: 30, filled: ticketFilled },
    sector:    { earned: sectorsFilled ? scoreSector(dealSector, inv.investor_sectors)   : 0, max: 30, filled: sectorsFilled },
    stage:     { earned: stagesFilled  ? scoreStage(dealStage, inv.investor_stages)      : 0, max: 25, filled: stagesFilled },
    geography: { earned: geoFilled     ? scoreGeography(dealGeo, inv.investor_geographies) : 0, max: 15, filled: geoFilled },
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
    .select("id, name, organization_type, base_status, investor_ticket_min, investor_ticket_max, investor_sectors, investor_stages, investor_geographies, investor_thesis")
    .eq("user_id", user.id)
    .in("organization_type", INVESTOR_ORG_TYPES);

  // Par défaut : uniquement les actifs
  if (!includeInactive) {
    query = query.eq("base_status", "active");
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

  const matches: InvestorMatch[] = (investors ?? []).map(inv => {
    const { score, breakdown } = computeScore(
      deal.target_amount ?? null,
      deal.sector ?? null,
      (deal as any).company_stage ?? null,
      deal.location ?? null,
      {
        investor_ticket_min:  inv.investor_ticket_min ?? null,
        investor_ticket_max:  inv.investor_ticket_max ?? null,
        investor_sectors:     inv.investor_sectors ?? [],
        investor_stages:      inv.investor_stages ?? [],
        investor_geographies: inv.investor_geographies ?? [],
      }
    );
    return {
      org: {
        id:                   inv.id,
        name:                 inv.name,
        organization_type:    inv.organization_type,
        base_status:          inv.base_status,
        investor_ticket_min:  inv.investor_ticket_min ?? null,
        investor_ticket_max:  inv.investor_ticket_max ?? null,
        investor_sectors:     inv.investor_sectors ?? [],
        investor_stages:      inv.investor_stages ?? [],
        investor_geographies: inv.investor_geographies ?? [],
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
