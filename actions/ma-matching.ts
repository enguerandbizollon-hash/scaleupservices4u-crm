"use server";

import { createClient } from "@/lib/supabase/server";
import {
  scoreMaMatch,
  type MaDealProfile,
  type MaOrganisationProfile,
  type MaMatchResult,
} from "@/lib/crm/ma-scoring";
import {
  scoreAcquirer,
  ACQUIRER_BUYER_TYPES,
  type AcquirerScoreResult,
  type AcquirerOrgInput,
} from "@/lib/crm/acquirer-scoring";
import { normalizeDealSector } from "@/lib/crm/matching-maps";
import { scoreSuggestionAI } from "@/actions/suggestions";

// ── getMaBuyerMatches ─────────────────────────────────────────────────────────
// Direction : deal ma_sell → trouver des buyers/repreneurs
//
// Scope : organisations de type buyer | corporate | investor | business_angel | family_office
//         avec base_status IN ('active', 'to_qualify')

export async function getMaBuyerMatches(
  dealId: string,
  includeInactive = false,
): Promise<{ matches: MaMatchResult[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { matches: [], error: "Non autorisé" };

  // Charger le deal
  const { data: dealRow, error: dealErr } = await supabase
    .from("deals")
    .select(`
      id, name, deal_type, sector, location,
      asking_price_min, asking_price_max,
      partial_sale_ok, management_retention, deal_timing,
      target_sectors, target_geographies,
      target_revenue_min, target_revenue_max,
      target_ev_min, target_ev_max,
      full_acquisition_required,
      strategic_rationale,
      excluded_sectors,
      target_stage
    `)
    .eq("id", dealId)
    .eq("user_id", user.id)
    .eq("deal_type", "ma_sell")
    .maybeSingle();

  if (dealErr || !dealRow) return { matches: [], error: "Dossier M&A Sell introuvable" };

  // Charger données financières de la cible — exercices RÉELS uniquement :
  // les projections (is_forecast=true, v60) ont toujours un fiscal_year
  // supérieur au dernier réel et contamineraient le breaker taille et le
  // scoring avec un CA prévisionnel.
  const { data: finData } = await supabase
    .from("financial_data")
    .select("revenue, revenue_growth, ebitda, ebitda_margin, net_debt, equity, ev_estimate, arr, nrr")
    .eq("deal_id", dealId)
    .eq("user_id", user.id)
    .eq("is_forecast", false)
    .order("fiscal_year", { ascending: false })
    .limit(1)
    .maybeSingle();

  const deal: MaDealProfile = {
    id:                   dealRow.id,
    name:                 dealRow.name,
    deal_type:            "ma_sell",
    sector:               dealRow.sector,
    location:             dealRow.location,
    asking_price_min:     (dealRow as any).asking_price_min     ?? null,
    asking_price_max:     (dealRow as any).asking_price_max     ?? null,
    partial_sale_ok:      (dealRow as any).partial_sale_ok      ?? true,
    management_retention: (dealRow as any).management_retention ?? true,
    deal_timing:          (dealRow as any).deal_timing          ?? null,
    excluded_sectors:     (dealRow as any).excluded_sectors     ?? [],
    financial:            finData ?? null,
  };

  // Charger les buyers
  const BUYER_TYPES = ["buyer", "corporate", "investor", "business_angel", "family_office"];
  let query = supabase
    .from("organizations")
    .select(`
      id, name, organization_type, base_status, sector, location,
      company_stage, revenue_range, sale_readiness, partial_sale_ok,
      acquisition_rationale, target_sectors, target_geographies,
      target_revenue_min, target_revenue_max, excluded_sectors,
      acquirer_type, acquisition_motivations, target_ebitda_min, target_ebitda_max
    `)
    .eq("user_id", user.id)
    .in("organization_type", BUYER_TYPES);

  if (!includeInactive) {
    query = query.in("base_status", ["active", "to_qualify", "qualified", "priority"]);
  }

  const { data: buyers, error: buyersErr } = await query;
  if (buyersErr) return { matches: [], error: buyersErr.message };

  const matches: MaMatchResult[] = (buyers ?? []).map(buyer => {
    const orgProfile: MaOrganisationProfile = {
      id:                    buyer.id,
      name:                  buyer.name,
      organization_type:     buyer.organization_type,
      sector:                buyer.sector,
      location:              buyer.location,
      company_stage:         (buyer as any).company_stage       ?? null,
      revenue_range:         (buyer as any).revenue_range       ?? null,
      sale_readiness:        (buyer as any).sale_readiness      ?? null,
      partial_sale_ok:       (buyer as any).partial_sale_ok     ?? null,
      acquisition_rationale: (buyer as any).acquisition_rationale ?? null,
      target_sectors:        (buyer as any).target_sectors      ?? [],
      target_geographies:    (buyer as any).target_geographies  ?? [],
      target_revenue_min:    (buyer as any).target_revenue_min  ?? null,
      target_revenue_max:    (buyer as any).target_revenue_max  ?? null,
      excluded_sectors:      (buyer as any).excluded_sectors    ?? [],
    };
    return scoreMaMatch(deal, orgProfile);
  });

  matches.sort((a, b) => {
    if (a.score === null && b.score !== null) return 1;
    if (a.score !== null && b.score === null) return -1;
    return (b.score ?? 0) - (a.score ?? 0);
  });

  return { matches };
}

// ── getAcquirerMatches — scoring V2 (phase 3, grille validée 2026-07-30) ─────
// Direction : deal ma_sell → classer la base acquéreurs avec la grille métier
// (capacité EBITDA déclarée, type d'opération, appétit, relation CRM,
// préférences révélées). Remplace getMaBuyerMatches pour les dossiers de
// cession ; l'ancien chemin reste servi pour buy_to_target.

export interface AcquirerMatchView {
  org: {
    id: string;
    name: string;
    organization_type: string;
    sector: string | null;
    location: string | null;
    deal_stance: string | null;
    operation_types: string[] | null;
    acquirer_summary: string | null;
  };
  result: AcquirerScoreResult;
  suggestion: {
    id: string;
    status: string;
    score_ai: number | null;
    ai_explanation: string | null;
  } | null;
}

const MONTHS_24 = 24 * 30.5 * 86_400_000;

export async function getAcquirerMatches(
  dealId: string,
  includeInactive = false,
): Promise<{ matches: AcquirerMatchView[]; deal_context: string | null; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { matches: [], deal_context: null, error: "Non autorisé" };

  const { data: dealRow } = await supabase
    .from("deals")
    .select("id, name, deal_type, sector, location, deal_context, partial_sale_ok, management_retention")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .eq("deal_type", "ma_sell")
    .maybeSingle();
  if (!dealRow) return { matches: [], deal_context: null, error: "Dossier M&A Sell introuvable" };

  // Dernier exercice réel du dossier (jamais les projections).
  const { data: fin } = await supabase
    .from("financial_data")
    .select("revenue, ebitda")
    .eq("deal_id", dealId)
    .eq("user_id", user.id)
    .eq("is_forecast", false)
    .order("fiscal_year", { ascending: false })
    .limit(1)
    .maybeSingle();

  let query = supabase
    .from("organizations")
    .select(`
      id, name, organization_type, base_status, sector, location,
      target_sectors, excluded_sectors, target_geographies,
      target_revenue_min, target_revenue_max,
      target_ebitda_min, target_ebitda_max,
      operation_types, deal_stance, acquirer_summary, acquisition_history
    `)
    .eq("user_id", user.id)
    .in("organization_type", ACQUIRER_BUYER_TYPES);
  if (!includeInactive) {
    query = query.in("base_status", ["active", "to_qualify", "qualified", "priority"]);
  }
  const { data: buyers, error: buyersErr } = await query;
  if (buyersErr) return { matches: [], deal_context: null, error: buyersErr.message };
  const orgIds = (buyers ?? []).map((b) => b.id);
  if (orgIds.length === 0) return { matches: [], deal_context: dealRow.deal_context ?? null };

  // Relation CRM : contacts rattachés + dernier échange (deux chemins d'actions).
  const [contactsRes, actionsDirectRes, actionsPivotRes, suggestionsRes] = await Promise.all([
    supabase.from("organization_contacts").select("organization_id").in("organization_id", orgIds),
    supabase.from("actions").select("organization_id, created_at").in("organization_id", orgIds)
      .order("created_at", { ascending: false }).limit(1000),
    supabase.from("action_organizations").select("organization_id, actions(created_at)").in("organization_id", orgIds).limit(1000),
    supabase.from("deal_target_suggestions")
      .select("id, organization_id, deal_id, status, created_at, score_ai, ai_explanation, deals(sector)")
      .eq("user_id", user.id)
      .in("organization_id", orgIds),
  ]);

  const contactCount = new Map<string, number>();
  for (const c of contactsRes.data ?? []) {
    contactCount.set(c.organization_id, (contactCount.get(c.organization_id) ?? 0) + 1);
  }

  const lastAction = new Map<string, number>();
  const noteAction = (orgId: string | null, iso: string | null | undefined) => {
    if (!orgId || !iso) return;
    const t = new Date(iso).getTime();
    if (Number.isFinite(t) && t > (lastAction.get(orgId) ?? 0)) lastAction.set(orgId, t);
  };
  for (const a of actionsDirectRes.data ?? []) noteAction(a.organization_id, a.created_at);
  for (const a of (actionsPivotRes.data ?? []) as Array<{ organization_id: string; actions: { created_at: string } | { created_at: string }[] | null }>) {
    const linked = Array.isArray(a.actions) ? a.actions[0] : a.actions;
    noteAction(a.organization_id, linked?.created_at);
  }

  // Préférences révélées + suggestion active de CE dossier.
  const dealSector = dealRow.sector ? (normalizeDealSector(dealRow.sector) ?? dealRow.sector) : null;
  const now = Date.now();
  const approaches = new Map<string, number>();
  const rejections = new Map<string, number>();
  const dealSuggestion = new Map<string, { id: string; status: string; score_ai: number | null; ai_explanation: string | null; created_at: string }>();

  for (const s of (suggestionsRes.data ?? []) as Array<{
    id: string; organization_id: string; deal_id: string; status: string;
    created_at: string; score_ai: number | null; ai_explanation: string | null;
    deals: { sector: string | null } | { sector: string | null }[] | null;
  }>) {
    if (["approved", "contacted"].includes(s.status) && now - new Date(s.created_at).getTime() < MONTHS_24) {
      approaches.set(s.organization_id, (approaches.get(s.organization_id) ?? 0) + 1);
    }
    if (s.status === "rejected" && dealSector) {
      const sd = Array.isArray(s.deals) ? s.deals[0] : s.deals;
      const sSector = sd?.sector ? (normalizeDealSector(sd.sector) ?? sd.sector) : null;
      if (sSector && sSector.toLowerCase() === dealSector.toLowerCase()) {
        rejections.set(s.organization_id, (rejections.get(s.organization_id) ?? 0) + 1);
      }
    }
    if (s.deal_id === dealId) {
      const prev = dealSuggestion.get(s.organization_id);
      const isActive = !["rejected", "contacted"].includes(s.status);
      const prevActive = prev ? !["rejected", "contacted"].includes(prev.status) : false;
      if (!prev || (isActive && !prevActive) || (isActive === prevActive && s.created_at > prev.created_at)) {
        dealSuggestion.set(s.organization_id, s);
      }
    }
  }

  const dealInput = {
    name: dealRow.name,
    sector: dealRow.sector ?? null,
    location: dealRow.location ?? null,
    deal_context: dealRow.deal_context ?? null,
    partial_sale_ok: dealRow.partial_sale_ok ?? null,
    management_retention: dealRow.management_retention ?? null,
    ebitda: fin?.ebitda ?? null,
    revenue: fin?.revenue ?? null,
  };

  const matches: AcquirerMatchView[] = (buyers ?? []).map((b) => {
    const lastTs = lastAction.get(b.id);
    const result = scoreAcquirer(dealInput, b as unknown as AcquirerOrgInput, {
      relation: {
        contact_count: contactCount.get(b.id) ?? 0,
        last_interaction_days: lastTs ? Math.floor((now - lastTs) / 86_400_000) : null,
      },
      history: {
        approaches_24m: approaches.get(b.id) ?? 0,
        rejections_similar: rejections.get(b.id) ?? 0,
      },
    });
    const sug = dealSuggestion.get(b.id);
    return {
      org: {
        id: b.id,
        name: b.name,
        organization_type: b.organization_type,
        sector: b.sector ?? null,
        location: b.location ?? null,
        deal_stance: b.deal_stance ?? null,
        operation_types: b.operation_types ?? null,
        acquirer_summary: b.acquirer_summary ?? null,
      },
      result,
      suggestion: sug ? { id: sug.id, status: sug.status, score_ai: sug.score_ai, ai_explanation: sug.ai_explanation } : null,
    };
  });

  matches.sort((a, b) => {
    if (a.result.score === null && b.result.score !== null) return 1;
    if (a.result.score !== null && b.result.score === null) return -1;
    if ((b.result.score ?? 0) !== (a.result.score ?? 0)) return (b.result.score ?? 0) - (a.result.score ?? 0);
    return b.result.coverage.evaluated - a.result.coverage.evaluated;
  });

  return { matches, deal_context: dealRow.deal_context ?? null };
}

/**
 * Garantit une suggestion (deal, organisation) en rôle acquéreur pour porter
 * le statut d'approche (approve/reject/contacted) et la justification IA.
 */
export async function ensureAcquirerSuggestion(
  dealId: string,
  organizationId: string,
  scoreAlgo?: number | null,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { data: existing } = await supabase
    .from("deal_target_suggestions")
    .select("id, status")
    .eq("deal_id", dealId)
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return { success: true, id: existing.id };

  const { data: created, error } = await supabase
    .from("deal_target_suggestions")
    .insert({
      user_id: user.id,
      deal_id: dealId,
      organization_id: organizationId,
      role_suggested: "acquirer",
      source_connector: "matching",
      status: "suggested",
      score_algo: scoreAlgo ?? null,
    })
    .select("id")
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, id: created.id };
}

/**
 * Justification IA du haut du classement : pour chaque organisation, garantit
 * la suggestion puis fait rejustifier le match par l'IA (2-3 lignes + red
 * flags, persistés sur la suggestion). Sur bouton, coût de quelques centimes.
 */
export async function aiJustifyAcquirers(
  dealId: string,
  organizationIds: string[],
): Promise<{ success: true; scored: number; failed: number } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const ids = organizationIds.slice(0, 10);
  let scored = 0;
  let failed = 0;

  const CHUNK = 3;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const results = await Promise.all(chunk.map(async (orgId) => {
      const ensured = await ensureAcquirerSuggestion(dealId, orgId);
      if (!ensured.success) return false;
      const res = await scoreSuggestionAI(ensured.id);
      return res.success;
    }));
    for (const ok of results) { if (ok) scored += 1; else failed += 1; }
  }

  return { success: true, scored, failed };
}

// ── getMaTargetMatches ────────────────────────────────────────────────────────
// Direction : deal ma_buy → trouver des cibles à acquérir
//
// Scope : organisations de type target | client | prospect_client
//         avec sale_readiness IN ('open', 'actively_selling')
//         ou dont le statut est actif

export async function getMaTargetMatches(
  dealId: string,
  includeNotForSale = false,
): Promise<{ matches: MaMatchResult[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { matches: [], error: "Non autorisé" };

  // Charger le deal
  const { data: dealRow, error: dealErr } = await supabase
    .from("deals")
    .select(`
      id, name, deal_type, sector, location,
      target_sectors, target_geographies,
      target_revenue_min, target_revenue_max,
      target_ev_min, target_ev_max,
      acquisition_budget_min, acquisition_budget_max,
      full_acquisition_required,
      strategic_rationale,
      excluded_sectors,
      target_stage, deal_timing
    `)
    .eq("id", dealId)
    .eq("user_id", user.id)
    .eq("deal_type", "ma_buy")
    .maybeSingle();

  if (dealErr || !dealRow) return { matches: [], error: "Dossier M&A Buy introuvable" };

  const deal: MaDealProfile = {
    id:                        dealRow.id,
    name:                      dealRow.name,
    deal_type:                 "ma_buy",
    sector:                    dealRow.sector,
    location:                  dealRow.location,
    target_sectors:            (dealRow as any).target_sectors        ?? [],
    target_geographies:        (dealRow as any).target_geographies    ?? [],
    target_revenue_min:        (dealRow as any).target_revenue_min    ?? null,
    target_revenue_max:        (dealRow as any).target_revenue_max    ?? null,
    target_ev_min:             (dealRow as any).target_ev_min         ?? null,
    target_ev_max:             (dealRow as any).target_ev_max         ?? null,
    full_acquisition_required: (dealRow as any).full_acquisition_required ?? false,
    excluded_sectors:          (dealRow as any).excluded_sectors      ?? [],
    target_stage:              (dealRow as any).target_stage          ?? null,
    deal_timing:               (dealRow as any).deal_timing           ?? null,
  };

  // Charger les cibles
  const TARGET_TYPES = ["target", "client", "prospect_client"];
  let query = supabase
    .from("organizations")
    .select(`
      id, name, organization_type, base_status, sector, location,
      company_stage, revenue_range, sale_readiness, partial_sale_ok,
      excluded_sectors
    `)
    .eq("user_id", user.id)
    .in("organization_type", TARGET_TYPES);

  if (!includeNotForSale) {
    query = query.in("sale_readiness", ["open", "actively_selling"]);
  }

  const { data: targets, error: targetsErr } = await query;
  if (targetsErr) return { matches: [], error: targetsErr.message };

  // Charger données financières des cibles (dernière année disponible)
  const targetIds = (targets ?? []).map(t => t.id);
  let financialMap: Record<string, {
    revenue?: number | null;
    revenue_growth?: number | null;
    ebitda?: number | null;
    ebitda_margin?: number | null;
    net_debt?: number | null;
    equity?: number | null;
    ev_estimate?: number | null;
    arr?: number | null;
    nrr?: number | null;
  }> = {};

  if (targetIds.length > 0) {
    const { data: finRows } = await supabase
      .from("financial_data")
      .select("organization_id, revenue, revenue_growth, ebitda, ebitda_margin, net_debt, equity, ev_estimate, arr, nrr, fiscal_year")
      .in("organization_id", targetIds)
      .eq("user_id", user.id)
      .eq("is_forecast", false)
      .order("fiscal_year", { ascending: false });

    // Garder seulement la dernière année par organisation
    for (const row of finRows ?? []) {
      if (!financialMap[row.organization_id]) {
        financialMap[row.organization_id] = {
          revenue:        row.revenue,
          revenue_growth: row.revenue_growth,
          ebitda:         row.ebitda,
          ebitda_margin:  row.ebitda_margin,
          net_debt:       row.net_debt,
          equity:         row.equity,
          ev_estimate:    row.ev_estimate,
          arr:            row.arr,
          nrr:            row.nrr,
        };
      }
    }
  }

  const matches: MaMatchResult[] = (targets ?? []).map(target => {
    const orgProfile: MaOrganisationProfile = {
      id:                target.id,
      name:              target.name,
      organization_type: target.organization_type,
      sector:            target.sector,
      location:          target.location,
      company_stage:     (target as any).company_stage  ?? null,
      revenue_range:     (target as any).revenue_range  ?? null,
      sale_readiness:    (target as any).sale_readiness ?? null,
      partial_sale_ok:   (target as any).partial_sale_ok ?? null,
      excluded_sectors:  (target as any).excluded_sectors ?? [],
      financial:         financialMap[target.id] ?? null,
    };
    return scoreMaMatch(deal, orgProfile);
  });

  matches.sort((a, b) => {
    if (a.score === null && b.score !== null) return 1;
    if (a.score !== null && b.score === null) return -1;
    return (b.score ?? 0) - (a.score ?? 0);
  });

  return { matches };
}
