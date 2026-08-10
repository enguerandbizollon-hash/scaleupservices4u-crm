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
import {
  computeBuyQualificationScore,
  BUY_QUALIFICATION_READY_MIN_SCORE,
  type BuyQualificationSnapshot,
} from "@/lib/crm/buy-qualification";
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

// ── Qualification buy-side ──────────────────────────────────────────────────
// Un mandat d'acquisition ne se screene pas comme une cession : sa
// qualification se lit sur les critères du dossier (cadrage, projet, cibles,
// budget). Même machine à statuts (screening_status / screening_score), barème
// dédié (lib/crm/buy-qualification.ts).

export type BuyQualificationPayload = {
  snapshot: BuyQualificationSnapshot & {
    screening_status: ScreeningStatus;
    screening_validated_at: string | null;
  };
  breakdown: ScreeningScoreBreakdown;
};

async function getDealBuyQualification(dealId: string): Promise<BuyQualificationPayload["snapshot"] | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: deal } = await supabase
    .from("deals")
    .select(`
      cadrage_content, strategic_rationale,
      target_sectors, target_geographies,
      target_revenue_min, target_revenue_max,
      acquisition_budget_min, acquisition_budget_max,
      deal_timing, dirigeant_id, dirigeant_nom,
      screening_status, screening_validated_at
    `)
    .eq("id", dealId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!deal) return null;

  return {
    cadrage_present: deal.cadrage_content != null,
    strategic_rationale: deal.strategic_rationale,
    target_sectors: deal.target_sectors,
    target_geographies: deal.target_geographies,
    target_revenue_min: deal.target_revenue_min,
    target_revenue_max: deal.target_revenue_max,
    acquisition_budget_min: deal.acquisition_budget_min,
    acquisition_budget_max: deal.acquisition_budget_max,
    deal_timing: deal.deal_timing,
    dirigeant_id: deal.dirigeant_id,
    dirigeant_nom: deal.dirigeant_nom,
    screening_status: (deal.screening_status ?? "not_started") as ScreeningStatus,
    screening_validated_at: deal.screening_validated_at,
  };
}

// Lecture côté client : BuyQualificationSection l'appelle au mount et après
// chaque mutation.
export async function fetchBuyQualification(dealId: string): Promise<BuyQualificationPayload | null> {
  const snapshot = await getDealBuyQualification(dealId);
  if (!snapshot) return null;
  return { snapshot, breakdown: computeBuyQualificationScore(snapshot) };
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
// Pour ready_for_outreach, on exige un score minimum : barème cession
// (computeScreeningScore) pour ma_sell, barème de qualification du repreneur
// (computeBuyQualificationScore) pour ma_buy. Même machine à statuts.
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

  const { data: typed } = await supabase
    .from("deals")
    .select("deal_type")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!typed) return { success: false, error: "Dossier introuvable" };

  let breakdown: ScreeningScoreBreakdown;
  let minScore: number;
  if (typed.deal_type === "ma_buy") {
    const snap = await getDealBuyQualification(dealId);
    if (!snap) return { success: false, error: "Dossier introuvable" };
    breakdown = computeBuyQualificationScore(snap);
    minScore = BUY_QUALIFICATION_READY_MIN_SCORE;
  } else {
    const current = await getDealScreening(dealId);
    if (!current) return { success: false, error: "Dossier introuvable" };
    breakdown = computeScreeningScore(current);
    minScore = SCREENING_READY_MIN_SCORE;
  }

  if (target === "ready_for_outreach" && breakdown.total < minScore) {
    return {
      success: false,
      error: `Score de complétude insuffisant (${breakdown.total}/100, minimum ${minScore})`,
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
