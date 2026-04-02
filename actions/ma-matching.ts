"use server";

import { createClient } from "@/lib/supabase/server";
import {
  scoreMaMatch,
  type MaDealProfile,
  type MaOrganisationProfile,
  type MaMatchResult,
} from "@/lib/crm/ma-scoring";

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
      excluded_sectors, excluded_geographies,
      target_stage
    `)
    .eq("id", dealId)
    .eq("user_id", user.id)
    .eq("deal_type", "ma_sell")
    .maybeSingle();

  if (dealErr || !dealRow) return { matches: [], error: "Dossier M&A Sell introuvable" };

  // Charger données financières de la cible
  const { data: finData } = await supabase
    .from("financial_data")
    .select("revenue, revenue_growth, ebitda, ebitda_margin, net_debt, equity, ev_estimate, arr, nrr")
    .eq("deal_id", dealId)
    .eq("user_id", user.id)
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
      target_revenue_min, target_revenue_max, excluded_sectors, excluded_geographies
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
      excluded_geographies:  (buyer as any).excluded_geographies ?? [],
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
      excluded_sectors, excluded_geographies,
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
    excluded_geographies:      (dealRow as any).excluded_geographies  ?? [],
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
