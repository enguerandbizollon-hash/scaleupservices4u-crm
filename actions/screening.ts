"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  computeScreeningScore,
  getDealScreening,
  SCREENING_READY_MIN_SCORE,
  type DealScreeningSnapshot,
  type ScreeningScoreBreakdown,
} from "@/lib/crm/screening";
import type { ScreeningStatus } from "@/lib/crm/matching-maps";

export type ScreeningPayload = {
  snapshot: DealScreeningSnapshot;
  breakdown: ScreeningScoreBreakdown;
};

// Lecture côté client : le composant ScreeningSection l'appelle au mount
// et après chaque mutation pour rester synchronisé avec la base.
export async function fetchDealScreening(dealId: string): Promise<ScreeningPayload | null> {
  const snapshot = await getDealScreening(dealId);
  if (!snapshot) return null;
  return { snapshot, breakdown: computeScreeningScore(snapshot) };
}

export interface ScreeningInput {
  executive_summary?: string | null;
  motivation_narrative?: string | null;
  competitive_landscape?: string | null;
  market_context?: string | null;
  key_differentiators?: string[] | null;
  key_risks?: string[] | null;
}

export type ScreeningActionResult =
  | { success: true; score: number; status: ScreeningStatus }
  | { success: false; error: string };

// Nettoie un tableau de chaînes : supprime les valeurs vides et les doublons
// insensibles à la casse.
function normalizeStringArray(arr: string[] | null | undefined): string[] {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

// Met à jour les champs narratifs du screening + recalcule le score.
// Ne change PAS screening_status (sauf si passage implicite de not_started
// à drafting quand au moins un champ est renseigné pour la première fois).
export async function updateDealScreening(
  dealId: string,
  input: ScreeningInput,
): Promise<ScreeningActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const current = await getDealScreening(dealId);
  if (!current) return { success: false, error: "Dossier introuvable" };

  const merged = {
    executive_summary: input.executive_summary ?? current.executive_summary,
    motivation_narrative: input.motivation_narrative ?? current.motivation_narrative,
    competitive_landscape: input.competitive_landscape ?? current.competitive_landscape,
    market_context: input.market_context ?? current.market_context,
    key_differentiators: input.key_differentiators
      ? normalizeStringArray(input.key_differentiators)
      : current.key_differentiators,
    key_risks: input.key_risks
      ? normalizeStringArray(input.key_risks)
      : current.key_risks,
  };

  const breakdown = computeScreeningScore({
    ...current,
    ...merged,
  });

  // Transition implicite : not_started -> drafting dès qu'un champ est rempli
  const nextStatus: ScreeningStatus =
    current.screening_status === "not_started" && breakdown.total > 0
      ? "drafting"
      : current.screening_status;

  const { error } = await supabase
    .from("deals")
    .update({
      executive_summary: merged.executive_summary,
      motivation_narrative: merged.motivation_narrative,
      competitive_landscape: merged.competitive_landscape,
      market_context: merged.market_context,
      key_differentiators: merged.key_differentiators,
      key_risks: merged.key_risks,
      screening_score: breakdown.total,
      screening_status: nextStatus,
      screening_updated_at: new Date().toISOString(),
    })
    .eq("id", dealId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/protected/dossiers/${dealId}`);
  revalidatePath("/protected/dossiers");
  return { success: true, score: breakdown.total, status: nextStatus };
}

// Bascule screening_status manuellement. Seuls drafting, ready_for_outreach
// et on_hold sont accessibles (not_started est l'état initial uniquement).
// Pour ready_for_outreach, on exige un score minimum.
export async function setScreeningStatus(
  dealId: string,
  target: ScreeningStatus,
): Promise<ScreeningActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  if (target === "not_started") {
    return { success: false, error: "Le statut 'not_started' ne peut pas être défini manuellement" };
  }

  const current = await getDealScreening(dealId);
  if (!current) return { success: false, error: "Dossier introuvable" };

  const breakdown = computeScreeningScore(current);

  if (target === "ready_for_outreach" && breakdown.total < SCREENING_READY_MIN_SCORE) {
    return {
      success: false,
      error: `Score de complétude insuffisant (${breakdown.total}/100, minimum ${SCREENING_READY_MIN_SCORE})`,
    };
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    screening_status: target,
    screening_score: breakdown.total,
    screening_updated_at: now,
  };

  if (target === "ready_for_outreach") {
    patch.screening_validated_by = user.id;
    patch.screening_validated_at = now;
  } else {
    patch.screening_validated_by = null;
    patch.screening_validated_at = null;
  }

  const { error } = await supabase
    .from("deals")
    .update(patch)
    .eq("id", dealId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/protected/dossiers/${dealId}`);
  revalidatePath("/protected/dossiers");
  return { success: true, score: breakdown.total, status: target };
}

export async function validateScreening(dealId: string): Promise<ScreeningActionResult> {
  return setScreeningStatus(dealId, "ready_for_outreach");
}

export async function invalidateScreening(dealId: string): Promise<ScreeningActionResult> {
  return setScreeningStatus(dealId, "drafting");
}

export async function putScreeningOnHold(dealId: string): Promise<ScreeningActionResult> {
  return setScreeningStatus(dealId, "on_hold");
}
