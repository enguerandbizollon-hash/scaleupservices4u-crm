"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { CANDIDATE_STATUSES, SENIORITY_OPTIONS } from "@/lib/crm/matching-maps";

export const DEFAULT_RECRUITMENT_STAGES = [
  { value: "sourcing",         label: "Sourcing" },
  { value: "approche",         label: "Approche" },
  { value: "entretien_rh",     label: "Entretien RH" },
  { value: "entretien_client", label: "Entretien client" },
  { value: "offre",            label: "Offre" },
  { value: "closing",          label: "Closing" },
] as const;

export type PipelineStage = { value: string; label: string };

export type KanbanCandidate = {
  dc_id: string;
  stage: string;
  combined_score: number | null;
  notes: string | null;
  candidate: {
    id: string;
    first_name: string;
    last_name: string;
    title: string | null;
    current_company: string | null;
    candidate_status: string;
    seniority: string | null;
  } | null;
};

export type KanbanData = {
  stages: PipelineStage[];
  columns: Record<string, KanbanCandidate[]>;
};

// ── getRecruitmentKanban ──────────────────────────────────────────────

export async function getRecruitmentKanban(dealId: string): Promise<KanbanData> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { stages: [], columns: {} };

  // Stages personnalisés ou défauts
  const { data: customStages } = await supabase
    .from("candidate_stages")
    .select("name, position")
    .eq("deal_id", dealId)
    .eq("user_id", user.id)
    .order("position");

  const stages: PipelineStage[] = customStages && customStages.length > 0
    ? customStages.map(s => ({ value: s.name, label: s.name }))
    : [...DEFAULT_RECRUITMENT_STAGES];

  // Candidats liés au dossier
  const { data: rows } = await supabase
    .from("deal_candidates")
    .select("id,stage,combined_score,notes,candidates(id,first_name,last_name,title,current_company,candidate_status,seniority)")
    .eq("deal_id", dealId)
    .eq("user_id", user.id)
    .order("added_at", { ascending: true });

  // Initialiser toutes les colonnes
  const columns: Record<string, KanbanCandidate[]> = {};
  for (const s of stages) columns[s.value] = [];

  for (const row of rows ?? []) {
    const stage = row.stage ?? "sourcing";
    if (!columns[stage]) columns[stage] = []; // stage hors-liste possible
    const cand = Array.isArray(row.candidates) ? row.candidates[0] : row.candidates;
    columns[stage].push({
      dc_id:          row.id,
      stage,
      combined_score: row.combined_score,
      notes:          row.notes,
      candidate:      cand as KanbanCandidate["candidate"],
    });
  }

  return { stages, columns };
}

// ── searchCandidatesForDeal ───────────────────────────────────────────

export async function searchCandidatesForDeal(dealId: string, search: string): Promise<{
  id: string; first_name: string; last_name: string; title: string | null; candidate_status: string;
}[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // IDs déjà dans le dossier
  const { data: existing } = await supabase
    .from("deal_candidates")
    .select("candidate_id")
    .eq("deal_id", dealId)
    .eq("user_id", user.id);
  const existingIds = (existing ?? []).map(r => r.candidate_id as string);

  let query = supabase
    .from("candidates")
    .select("id,first_name,last_name,title,candidate_status")
    .eq("user_id", user.id)
    .order("last_name")
    .limit(15);

  if (search.trim()) {
    const s = `%${search.trim()}%`;
    query = query.or(`first_name.ilike.${s},last_name.ilike.${s},title.ilike.${s}`);
  }

  if (existingIds.length > 0) {
    query = query.not("id", "in", `(${existingIds.join(",")})`);
  }

  const { data } = await query;
  return data ?? [];
}

// ── addCandidateToDealAction ──────────────────────────────────────────

export async function addCandidateToDealAction(
  dealId: string,
  candidateId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const { error } = await supabase.from("deal_candidates").insert({
    deal_id:      dealId,
    candidate_id: candidateId,
    user_id:      user.id,
    stage:        "sourcing",
  });

  if (error) return { success: false, error: error.message };

  revalidatePath(`/protected/dossiers/${dealId}`);
  revalidatePath(`/protected/candidats/${candidateId}`);
  return { success: true };
}

// ── moveCandidateStageAction ──────────────────────────────────────────

export async function moveCandidateStageAction(
  dealCandidateId: string,
  newStage: string,
  dealId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const { error } = await supabase
    .from("deal_candidates")
    .update({ stage: newStage })
    .eq("id", dealCandidateId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true };
}

// ── removeCandidateFromDealAction ─────────────────────────────────────

export async function removeCandidateFromDealAction(
  dealCandidateId: string,
  dealId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const { error } = await supabase
    .from("deal_candidates")
    .delete()
    .eq("id", dealCandidateId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true };
}

// ── Re-export des maps pour usage client ─────────────────────────────
export { CANDIDATE_STATUSES, SENIORITY_OPTIONS };
