"use server";

/**
 * actions/sourcing.ts — Orchestrateur Server Actions du Sourcing (S3)
 *
 * Flux complet :
 *   1. generateSourcingPlanAction(dealId) → plan IA (via lib/ai/sourcing-strategy)
 *   2. executeSourcingPlanAction(dealId, plan) → pour chaque segment :
 *      - exécute CRM source + Apollo source en parallèle
 *      - dédup cross-source
 *      - score algo + IA optionnel
 *      - upsert deal_target_suggestions avec batch_id unique
 *
 * Les actions workflow (approve / reject / defer / scoreAi / brief) restent
 * dans actions/suggestions.ts et sont réexportées ici pour que le composant
 * SourcingWizard n'ait qu'un seul module à importer.
 */

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateSourcingPlan,
  buildFallbackPlan,
  type SourcingPlan,
  type SourcingStrategyInput,
} from "@/lib/ai/sourcing-strategy";
import { executeCrmSource } from "@/lib/sourcing/crm-source";
import { executeApolloSource } from "@/lib/sourcing/apollo-source";
import {
  dedupCandidates,
  computeQuickAlgoScore,
  type SourcingCandidate,
  type SourcingExecutionContext,
} from "@/lib/sourcing/engine";
import {
  scoreSuggestionWithAI,
  type MatchingBrainDealContext,
  type MatchingBrainOrgProfile,
} from "@/lib/ai/matching-brain";
import {
  defaultSuggestionRoleForDealType,
  isScreeningReady,
} from "@/lib/crm/matching-maps";

// Réexport des actions workflow déjà livrées (suggestions.ts reste la vérité)
export {
  approveSuggestion,
  rejectSuggestion,
  deferSuggestion,
  markSuggestionContacted,
  scoreSuggestionAI,
  generateOutreachBriefForSuggestion,
} from "./suggestions";

// ── Types de retour ──────────────────────────────────────────────────────────

export type GeneratePlanResult =
  | { success: true; plan: SourcingPlan; from_ai: boolean }
  | { success: false; error: string };

export interface ExecutePlanResult {
  success: true;
  batch_id: string;
  segments_processed: number;
  candidates_total: number;
  suggestions_created: number;
  suggestions_enriched: number;
  ai_scored: number;
  warnings: string[];
}

export type ExecutePlanResponse = ExecutePlanResult | { success: false; error: string };

// ── Chargement du contexte dossier ──────────────────────────────────────────

interface DealContextForSourcing {
  id: string;
  user_id: string;
  name: string;
  deal_type: string;
  sector: string | null;
  currency: string;
  screening_status: string | null;
  executive_summary: string | null;
  motivation_narrative: string | null;
  key_differentiators: string[] | null;
  key_risks: string[] | null;
  competitive_landscape: string | null;
  market_context: string | null;
  target_sectors: string[] | null;
  excluded_sectors: string[] | null;
  target_geographies: string[] | null;
  excluded_geographies: string[] | null;
  target_revenue_min: number | null;
  target_revenue_max: number | null;
  target_stage: string | null;
  strategic_rationale: string | null;
  target_raise_amount: number | null;
  round_type: string | null;
  use_of_funds: string | null;
  asking_price_min: number | null;
  asking_price_max: number | null;
  company_geography: string | null;
  company_stage: string | null;
  latest_revenue: number | null;
  latest_ebitda: number | null;
  latest_revenue_growth: number | null;
}

async function loadDealContextForSourcing(
  dealId: string,
  userId: string,
): Promise<DealContextForSourcing | null> {
  const supabase = await createClient();
  const { data: deal } = await supabase
    .from("deals")
    .select(`
      id, user_id, name, deal_type, sector, currency,
      screening_status, executive_summary, motivation_narrative,
      key_differentiators, key_risks, competitive_landscape, market_context,
      target_sectors, excluded_sectors, target_geographies, excluded_geographies,
      target_revenue_min, target_revenue_max, target_stage, strategic_rationale,
      target_raise_amount, round_type, use_of_funds,
      asking_price_min, asking_price_max,
      company_geography, company_stage
    `)
    .eq("id", dealId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!deal) return null;

  // Financier sur 2 ans pour calculer la croissance
  const { data: finYears } = await supabase
    .from("financial_data")
    .select("fiscal_year, revenue, ebitda")
    .eq("deal_id", dealId)
    .eq("user_id", userId)
    .order("fiscal_year", { ascending: false })
    .limit(2);

  const latest = finYears?.[0] ?? null;
  const previous = finYears?.[1] ?? null;
  const growth =
    latest && previous && latest.revenue && previous.revenue
      ? Math.round(((latest.revenue - previous.revenue) / previous.revenue) * 100)
      : null;

  return {
    ...deal,
    currency: deal.currency ?? "EUR",
    latest_revenue: latest?.revenue ?? null,
    latest_ebitda: latest?.ebitda ?? null,
    latest_revenue_growth: growth,
  };
}

function toSourcingStrategyInput(d: DealContextForSourcing): SourcingStrategyInput {
  return {
    deal: {
      name: d.name,
      deal_type: d.deal_type,
      sector: d.sector,
      currency: d.currency,
      executive_summary: d.executive_summary,
      motivation_narrative: d.motivation_narrative,
      key_differentiators: d.key_differentiators,
      key_risks: d.key_risks,
      competitive_landscape: d.competitive_landscape,
      market_context: d.market_context,
      target_sectors: d.target_sectors,
      excluded_sectors: d.excluded_sectors,
      target_geographies: d.target_geographies,
      excluded_geographies: d.excluded_geographies,
      target_revenue_min: d.target_revenue_min,
      target_revenue_max: d.target_revenue_max,
      target_stage: d.target_stage,
      strategic_rationale: d.strategic_rationale,
      target_raise_amount: d.target_raise_amount,
      round_type: d.round_type,
      use_of_funds: d.use_of_funds,
      asking_price_min: d.asking_price_min,
      asking_price_max: d.asking_price_max,
      company_geography: d.company_geography,
      company_stage: d.company_stage,
      latest_revenue: d.latest_revenue,
      latest_ebitda: d.latest_ebitda,
      latest_revenue_growth: d.latest_revenue_growth,
    },
  };
}

// ── Étape 1 : générer le plan IA ────────────────────────────────────────────

export async function generateSourcingPlanAction(
  dealId: string,
): Promise<GeneratePlanResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const deal = await loadDealContextForSourcing(dealId, user.id);
  if (!deal) return { success: false, error: "Dossier introuvable" };
  if (!isScreeningReady(deal.screening_status)) {
    return { success: false, error: "Le screening du dossier doit être validé." };
  }

  const strategyInput = toSourcingStrategyInput(deal);
  const plan = await generateSourcingPlan(strategyInput);

  if (plan) return { success: true, plan, from_ai: true };
  return { success: true, plan: buildFallbackPlan(strategyInput), from_ai: false };
}

// ── Étape 2 : exécuter le plan (CRM + Apollo) ───────────────────────────────

export async function executeSourcingPlanAction(
  dealId: string,
  plan: SourcingPlan,
  opts: { withAI?: boolean; maxAiScorings?: number } = {},
): Promise<ExecutePlanResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const deal = await loadDealContextForSourcing(dealId, user.id);
  if (!deal) return { success: false, error: "Dossier introuvable" };
  if (!isScreeningReady(deal.screening_status)) {
    return { success: false, error: "Le screening du dossier doit être validé." };
  }

  const context: SourcingExecutionContext = {
    userId: user.id,
    dealId,
    dealType: deal.deal_type,
    currency: deal.currency,
    dealSector: deal.sector,
    dealGeography: deal.company_geography,
    latestRevenue: deal.latest_revenue,
    targetSectors: deal.target_sectors,
    excludedSectors: deal.excluded_sectors,
  };

  const batchId = randomUUID();
  const warnings: string[] = [];
  const allCandidates: SourcingCandidate[] = [];

  // Exécution segment par segment (CRM + Apollo en parallèle pour chaque)
  for (const segment of plan.segments) {
    try {
      const [crmCandidates, apolloCandidates] = await Promise.all([
        executeCrmSource(segment, context).catch((e) => {
          warnings.push(`CRM "${segment.name}" : ${e instanceof Error ? e.message : "erreur"}`);
          return [] as SourcingCandidate[];
        }),
        executeApolloSource(segment, context).catch((e) => {
          warnings.push(`Apollo "${segment.name}" : ${e instanceof Error ? e.message : "erreur"}`);
          return [] as SourcingCandidate[];
        }),
      ]);
      allCandidates.push(...crmCandidates, ...apolloCandidates);
    } catch (err) {
      warnings.push(`Segment "${segment.name}" : ${err instanceof Error ? err.message : "erreur"}`);
    }
  }

  // Dédup cross-source
  const candidates = dedupCandidates(allCandidates);

  // Score algo pour tous
  const scored = candidates.map((c) => {
    const segmentForCandidate = plan.segments.find((s) => s.name === c.segment_name) ?? plan.segments[0]!;
    return {
      candidate: c,
      score_algo: computeQuickAlgoScore(c, segmentForCandidate, context),
    };
  }).sort((a, b) => b.score_algo - a.score_algo);

  // Scoring IA optionnel, borné aux N meilleurs pour contrôler le coût
  const aiLimit = opts.withAI ? Math.min(opts.maxAiScorings ?? 15, scored.length) : 0;
  const aiScores = new Map<string, { score: number; explanation: string; red_flags: string[]; confidence: number }>();

  for (let i = 0; i < aiLimit; i++) {
    const entry = scored[i];
    if (!entry || !entry.candidate.existing_org_id) continue;
    const brainDealContext: MatchingBrainDealContext = {
      name: deal.name,
      deal_type: deal.deal_type,
      sector: deal.sector,
      executive_summary: deal.executive_summary,
      motivation_narrative: deal.motivation_narrative,
      key_differentiators: deal.key_differentiators,
      key_risks: deal.key_risks,
      target_sectors: deal.target_sectors,
      excluded_sectors: deal.excluded_sectors,
      target_revenue_min: deal.target_revenue_min,
      target_revenue_max: deal.target_revenue_max,
      strategic_rationale: deal.strategic_rationale,
      target_raise_amount: deal.target_raise_amount,
      round_type: deal.round_type,
      latest_revenue: deal.latest_revenue,
      latest_ebitda: deal.latest_ebitda,
      currency: deal.currency,
    };
    const orgProfile: MatchingBrainOrgProfile = {
      name: entry.candidate.name,
      organization_type: entry.candidate.organization_type,
      sector: entry.candidate.sector,
      description: entry.candidate.description,
      employee_count: entry.candidate.employee_count,
      company_stage: null,
      location: entry.candidate.location,
      website: entry.candidate.website,
      investor_sectors: null,
      investor_stages: null,
      investor_ticket_min: null,
      investor_ticket_max: null,
    };
    const role = defaultSuggestionRoleForDealType(deal.deal_type);
    try {
      const brain = await scoreSuggestionWithAI({
        deal: brainDealContext,
        organization: orgProfile,
        role_suggested: role,
      });
      if (brain) {
        aiScores.set(entry.candidate.unique_key, {
          score: brain.score_ai,
          explanation: brain.explanation,
          red_flags: brain.red_flags,
          confidence: brain.confidence,
        });
      }
    } catch (e) {
      warnings.push(`IA "${entry.candidate.name}" : ${e instanceof Error ? e.message : "erreur"}`);
    }
  }

  // Upsert dans deal_target_suggestions
  const admin = createAdminClient();
  const role = defaultSuggestionRoleForDealType(deal.deal_type);
  let suggestionsCreated = 0;
  let suggestionsEnriched = 0;

  for (const entry of scored) {
    const c = entry.candidate;
    if (!c.existing_org_id) continue;

    const ai = aiScores.get(c.unique_key);
    const scoreCombined =
      ai == null
        ? entry.score_algo
        : Math.round(entry.score_algo * 0.6 + ai.score * 0.4);

    const primaryContactId = c.contacts[0]?.contact_id ?? null;

    // Vérifier s'il existe déjà une suggestion active pour ce couple (deal, org)
    const { data: existing } = await admin
      .from("deal_target_suggestions")
      .select("id")
      .eq("deal_id", dealId)
      .eq("organization_id", c.existing_org_id)
      .not("status", "in", '("rejected","contacted")')
      .maybeSingle();

    const payload = {
      score_algo: entry.score_algo,
      score_ai: ai?.score ?? null,
      score_combined: scoreCombined,
      score_breakdown: {
        sources: c.sources,
        segment: c.segment_name,
        segment_priority: c.segment_priority,
      },
      ai_explanation: ai?.explanation ?? null,
      ai_red_flags: ai?.red_flags ?? [],
      ai_confidence: ai?.confidence ?? null,
      contact_id: primaryContactId,
    };

    if (existing) {
      await admin
        .from("deal_target_suggestions")
        .update(payload)
        .eq("id", existing.id);
      suggestionsEnriched++;
    } else {
      const { error: insertErr } = await admin.from("deal_target_suggestions").insert({
        user_id: user.id,
        deal_id: dealId,
        organization_id: c.existing_org_id,
        role_suggested: role,
        source_connector: c.sources.includes("apollo") ? "apollo" : "manual",
        external_reference: c.apollo_id,
        suggestion_batch_id: batchId,
        status: "suggested",
        ...payload,
      });
      if (!insertErr) suggestionsCreated++;
    }
  }

  revalidatePath(`/protected/dossiers/${dealId}`);

  return {
    success: true,
    batch_id: batchId,
    segments_processed: plan.segments.length,
    candidates_total: candidates.length,
    suggestions_created: suggestionsCreated,
    suggestions_enriched: suggestionsEnriched,
    ai_scored: aiScores.size,
    warnings,
  };
}
