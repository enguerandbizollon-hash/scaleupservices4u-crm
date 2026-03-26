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
  needs_review: boolean;
  placement_fee: number | null;
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
    .select("id,stage,combined_score,notes,needs_review,placement_fee,candidates(id,first_name,last_name,title,current_company,candidate_status,seniority)")
    .eq("deal_id", dealId)
    .eq("user_id", user.id)
    .order("added_at", { ascending: true });

  // Initialiser toutes les colonnes
  const columns: Record<string, KanbanCandidate[]> = {};
  for (const s of stages) columns[s.value] = [];

  for (const row of rows ?? []) {
    const stage = row.stage ?? "sourcing";
    if (!columns[stage]) columns[stage] = [];
    const cand = Array.isArray(row.candidates) ? row.candidates[0] : row.candidates;
    columns[stage].push({
      dc_id:          row.id,
      stage,
      combined_score: row.combined_score,
      notes:          row.notes,
      needs_review:   row.needs_review ?? false,
      placement_fee:  row.placement_fee ?? null,
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
// M5 trigger : stage "closing" → deal won + autres candidats needs_review + candidat → placed

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

  // ── Trigger M5 : Closing → deal won ──────────────────────────────
  if (newStage === "closing") {
    // Récupérer le deal_candidates pour avoir candidate_id
    const { data: dc } = await supabase
      .from("deal_candidates")
      .select("candidate_id")
      .eq("id", dealCandidateId)
      .eq("user_id", user.id)
      .single();

    if (dc?.candidate_id) {
      // 1. Marquer le dossier comme gagné
      await supabase
        .from("deals")
        .update({ deal_status: "won" })
        .eq("id", dealId);

      // 2. Flaguer les autres candidats du dossier à revoir
      await supabase
        .from("deal_candidates")
        .update({ needs_review: true })
        .eq("deal_id", dealId)
        .neq("id", dealCandidateId)
        .eq("user_id", user.id);

      // 3. Passer le candidat en "placed" si pas déjà
      const { data: cand } = await supabase
        .from("candidates")
        .select("candidate_status")
        .eq("id", dc.candidate_id)
        .single();

      if (cand && cand.candidate_status !== "placed") {
        await supabase
          .from("candidates")
          .update({ candidate_status: "placed", updated_at: new Date().toISOString() })
          .eq("id", dc.candidate_id)
          .eq("user_id", user.id);

        await supabase.from("candidate_status_log").insert({
          candidate_id: dc.candidate_id,
          user_id:      user.id,
          old_status:   cand.candidate_status,
          new_status:   "placed",
          note:         "Placé automatiquement suite au closing du dossier",
        });
      }

      revalidatePath(`/protected/candidats/${dc.candidate_id}`);
      revalidatePath("/protected/candidats");
    }
  }

  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true };
}

// ── clearNeedsReviewAction ────────────────────────────────────────────

export async function clearNeedsReviewAction(
  dealCandidateId: string,
  dealId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const { error } = await supabase
    .from("deal_candidates")
    .update({ needs_review: false })
    .eq("id", dealCandidateId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true };
}

// ── setPlacementFeeAction ─────────────────────────────────────────────
// M5 trigger : fee → deals.value_amount mis à jour

export async function setPlacementFeeAction(
  dealCandidateId: string,
  dealId: string,
  fee: number | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const { error } = await supabase
    .from("deal_candidates")
    .update({ placement_fee: fee })
    .eq("id", dealCandidateId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  // Propager vers deals.value_amount
  if (fee != null) {
    await supabase
      .from("deals")
      .update({ value_amount: fee })
      .eq("id", dealId);
  }

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
