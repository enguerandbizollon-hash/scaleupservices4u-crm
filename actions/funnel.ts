"use server";
// Server Actions du funnel acquéreur (plan R1 lot 2, migration v73).
// Les règles de relance s'appliquent AU GESTE (le cron ne fait que
// réveiller les échéances), et chaque transition laisse une trace
// append-only dans deal_suggestion_events : reviewed_* n'est plus le
// seul souvenir.

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  FUNNEL_STEPS,
  type FunnelStepKey,
  computeFunnelStage,
  defaultNextFollowup,
  isOutboundStep,
  FOLLOWUP_AFTER_DONE_DAYS,
} from "@/lib/crm/funnel";

type FunnelResult =
  | { success: true; data: { stage: string; next_followup_at: string | null } }
  | { success: false; error: string };

interface SuggestionRow {
  id: string;
  deal_id: string;
  organization_id: string;
  status: string;
  teaser_sent_at: string | null;
  nda_signed_at: string | null;
  im_sent_at: string | null;
  offer_received_at: string | null;
  next_followup_at: string | null;
}

const SUGGESTION_COLS =
  "id, deal_id, organization_id, status, teaser_sent_at, nda_signed_at, im_sent_at, offer_received_at, next_followup_at";

type FunnelContext =
  | { ok: false; error: string }
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string; s: SuggestionRow };

async function loadContext(suggestionId: string): Promise<FunnelContext> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non autorisé" };

  const { data: s, error } = await supabase
    .from("deal_target_suggestions")
    .select(SUGGESTION_COLS)
    .eq("id", suggestionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !s) return { ok: false, error: "Suggestion introuvable" };
  return { ok: true, supabase, userId: user.id, s: s as unknown as SuggestionRow };
}

async function logEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  s: SuggestionRow,
  eventType: string,
  extra: { from_status?: string | null; to_status?: string | null; notes?: string | null; metadata?: Record<string, unknown> } = {},
) {
  // Journal best-effort : un échec d'audit ne doit pas faire échouer le geste.
  await supabase.from("deal_suggestion_events").insert({
    user_id: userId,
    suggestion_id: s.id,
    deal_id: s.deal_id,
    organization_id: s.organization_id,
    event_type: eventType,
    from_status: extra.from_status ?? null,
    to_status: extra.to_status ?? null,
    notes: extra.notes ?? null,
    metadata: extra.metadata ?? null,
  });
}

function revalidateFunnel(dealId: string) {
  revalidatePath(`/protected/dossiers/${dealId}`);
  revalidatePath("/protected/acquereurs");
}

/**
 * Marque une étape du funnel (teaser envoyé, NDA signé, IM envoyé, offre
 * reçue) : pose la date, fait vivre le statut (première approche =>
 * contacted), applique la règle de relance de l'étape DÉRIVÉE, journalise.
 */
export async function markFunnelStep(suggestionId: string, step: FunnelStepKey): Promise<FunnelResult> {
  const stepDef = FUNNEL_STEPS.find(x => x.key === step);
  if (!stepDef) return { success: false, error: `Étape inconnue : ${step}` };

  const ctx = await loadContext(suggestionId);
  if (!ctx.ok) return { success: false, error: ctx.error };
  const { supabase, userId, s } = ctx;

  if (s.status === "rejected") {
    return { success: false, error: "Suggestion écartée : repassez-la Approuvée avant de marquer une étape." };
  }

  const now = new Date();
  const nowIso = now.toISOString();

  const merged = { ...s, [stepDef.field]: nowIso } as SuggestionRow;
  const stage = computeFunnelStage(merged);
  const nextFollowup = defaultNextFollowup(stage, now);

  const updates: Record<string, unknown> = {
    [stepDef.field]: nowIso,
    status: "contacted",
    next_followup_at: nextFollowup,
  };
  if (isOutboundStep(step)) updates.last_outreach_at = nowIso;

  const { error } = await supabase
    .from("deal_target_suggestions")
    .update(updates)
    .eq("id", suggestionId)
    .eq("user_id", userId);
  if (error) return { success: false, error: error.message };

  await logEvent(supabase, userId, s, stepDef.event, {
    from_status: s.status,
    to_status: "contacted",
    metadata: { next_followup_at: nextFollowup },
  });

  revalidateFunnel(s.deal_id);
  return { success: true, data: { stage, next_followup_at: nextFollowup } };
}

/**
 * Annule une étape marquée par erreur : efface la date, recale la relance
 * sur l'étape restante (à partir de SA date), journalise l'annulation.
 */
export async function undoFunnelStep(suggestionId: string, step: FunnelStepKey): Promise<FunnelResult> {
  const stepDef = FUNNEL_STEPS.find(x => x.key === step);
  if (!stepDef) return { success: false, error: `Étape inconnue : ${step}` };

  const ctx = await loadContext(suggestionId);
  if (!ctx.ok) return { success: false, error: ctx.error };
  const { supabase, userId, s } = ctx;

  const merged = { ...s, [stepDef.field]: null } as SuggestionRow;
  const stage = computeFunnelStage(merged);
  const stageDef = FUNNEL_STEPS.find(x => x.key === stage);
  const stageDate = stageDef ? merged[stageDef.field] : null;
  const nextFollowup = stageDate ? defaultNextFollowup(stage, new Date(stageDate)) : null;

  const { error } = await supabase
    .from("deal_target_suggestions")
    .update({ [stepDef.field]: null, next_followup_at: nextFollowup })
    .eq("id", suggestionId)
    .eq("user_id", userId);
  if (error) return { success: false, error: error.message };

  await logEvent(supabase, userId, s, "note", {
    notes: `Étape annulée : ${step}`,
    metadata: { undo: step, next_followup_at: nextFollowup },
  });

  revalidateFunnel(s.deal_id);
  return { success: true, data: { stage, next_followup_at: nextFollowup } };
}

/** Fixe (ou coupe, avec null) la prochaine relance à la main. */
export async function setNextFollowup(suggestionId: string, date: string | null): Promise<FunnelResult> {
  if (date != null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { success: false, error: "Date de relance invalide (format YYYY-MM-DD)." };
  }

  const ctx = await loadContext(suggestionId);
  if (!ctx.ok) return { success: false, error: ctx.error };
  const { supabase, userId, s } = ctx;

  const { error } = await supabase
    .from("deal_target_suggestions")
    .update({ next_followup_at: date })
    .eq("id", suggestionId)
    .eq("user_id", userId);
  if (error) return { success: false, error: error.message };

  await logEvent(supabase, userId, s, date ? "followup_planned" : "note", {
    notes: date ? `Relance planifiée : ${date}` : "Relance désactivée",
    metadata: { next_followup_at: date },
  });

  revalidateFunnel(s.deal_id);
  return { success: true, data: { stage: computeFunnelStage(s), next_followup_at: date } };
}

/**
 * « Relance faite » : trace le geste sortant et repropose une échéance
 * (J+7) sans changer d'étape.
 */
export async function markFollowupDone(suggestionId: string): Promise<FunnelResult> {
  const ctx = await loadContext(suggestionId);
  if (!ctx.ok) return { success: false, error: ctx.error };
  const { supabase, userId, s } = ctx;

  const now = new Date();
  const next = new Date(now.getTime() + FOLLOWUP_AFTER_DONE_DAYS * 86_400_000).toISOString().slice(0, 10);

  const { error } = await supabase
    .from("deal_target_suggestions")
    .update({ last_outreach_at: now.toISOString(), next_followup_at: next })
    .eq("id", suggestionId)
    .eq("user_id", userId);
  if (error) return { success: false, error: error.message };

  await logEvent(supabase, userId, s, "followup_done", {
    metadata: { next_followup_at: next },
  });

  revalidateFunnel(s.deal_id);
  return { success: true, data: { stage: computeFunnelStage(s), next_followup_at: next } };
}
