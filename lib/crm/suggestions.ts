import { createClient } from "@/lib/supabase/server";
import type { SuggestionStatus, SuggestionRole, ConnectorSource } from "@/lib/crm/matching-maps";

// ── Types exposés au reste de l'app ──────────────────────────────────────────

export interface DealTargetSuggestion {
  id: string;
  user_id: string;
  deal_id: string;
  organization_id: string;
  contact_id: string | null;

  role_suggested: SuggestionRole;
  source_connector: ConnectorSource;
  external_reference: string | null;
  suggestion_batch_id: string | null;

  score_algo: number | null;
  score_ai: number | null;
  score_combined: number | null;
  score_breakdown: Record<string, unknown> | null;

  ai_explanation: string | null;
  ai_red_flags: string[] | null;
  ai_confidence: number | null;

  status: SuggestionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewed_notes: string | null;

  outreach_brief: string | null;
  outreach_brief_generated_at: string | null;
  contacted_via_campaign_id: string | null;

  created_at: string;
  updated_at: string;
}

export interface SuggestionWithRelations extends DealTargetSuggestion {
  organization: {
    id: string;
    name: string;
    organization_type: string | null;
    base_status: string | null;
    website: string | null;
    location: string | null;
    company_stage: string | null;
    sector: string | null;
  } | null;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    title: string | null;
  } | null;
}

// ── Lectures ──────────────────────────────────────────────────────────────────

// Charge les suggestions d'un dossier avec leurs relations.
// RLS fait le filtrage par user_id.
export async function listSuggestionsForDeal(
  dealId: string,
  opts: { statuses?: SuggestionStatus[]; limit?: number } = {},
): Promise<SuggestionWithRelations[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("deal_target_suggestions")
    .select(`
      *,
      organizations (
        id, name, organization_type, base_status, website, location, company_stage, sector
      ),
      contacts (
        id, first_name, last_name, email, title
      )
    `)
    .eq("deal_id", dealId)
    .eq("user_id", user.id)
    .order("score_combined", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (opts.statuses?.length) {
    query = query.in("status", opts.statuses);
  }
  if (opts.limit) {
    query = query.limit(opts.limit);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => {
    const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
    return {
      ...row,
      organization: org ?? null,
      contact: contact ?? null,
    } as SuggestionWithRelations;
  });
}

// Compte les suggestions en attente (status=suggested) pour un user.
// Utilisé pour le badge sidebar et le dashboard.
export async function countPendingSuggestions(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("deal_target_suggestions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "suggested");

  return count ?? 0;
}

// Récupère une suggestion seule avec ses relations (pour UI détail).
export async function getSuggestionById(
  suggestionId: string,
): Promise<SuggestionWithRelations | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("deal_target_suggestions")
    .select(`
      *,
      organizations (
        id, name, organization_type, base_status, website, location, company_stage, sector
      ),
      contacts (
        id, first_name, last_name, email, title
      )
    `)
    .eq("id", suggestionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  const org = Array.isArray(data.organizations) ? data.organizations[0] : data.organizations;
  const contact = Array.isArray(data.contacts) ? data.contacts[0] : data.contacts;
  return {
    ...data,
    organization: org ?? null,
    contact: contact ?? null,
  } as SuggestionWithRelations;
}

// Combine score algo + score IA selon la pondération V55 (0.6 / 0.4).
// Si l'un des deux manque, on retombe sur l'autre.
export function computeCombinedScore(scoreAlgo: number | null, scoreAi: number | null): number | null {
  if (scoreAlgo == null && scoreAi == null) return null;
  if (scoreAlgo == null) return scoreAi;
  if (scoreAi == null) return scoreAlgo;
  return Math.round(scoreAlgo * 0.6 + scoreAi * 0.4);
}
