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
import { computeAndPersistIntent } from "@/lib/crm/intent-ingest";

type FunnelResult =
  | { success: true; data: { stage: string; next_followup_at: string | null } }
  | { success: false; error: string };

// ── Lecture du funnel des CIBLES d'un mandat d'acquisition ──────────────────

export interface TargetFunnelRow {
  id: string;
  organization_id: string;
  organization_name: string;
  organization_siren: string | null;
  status: string;
  stage: string;
  teaser_sent_at: string | null;
  nda_signed_at: string | null;
  im_sent_at: string | null;
  offer_received_at: string | null;
  next_followup_at: string | null;
  intent_score: number | null;
  has_brief: boolean;
  has_contact: boolean;
}

/**
 * Les cibles suivies d'un mandat ma_buy (suggestions role='target'), avec
 * leurs étapes d'approche. Même moteur que le funnel acquéreurs, lu côté buy.
 */
export async function getDealTargetFunnel(dealId: string): Promise<TargetFunnelRow[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rows } = await supabase
    .from("deal_target_suggestions")
    .select(`
      id, organization_id, status, contact_id, outreach_brief_json,
      teaser_sent_at, nda_signed_at, im_sent_at, offer_received_at,
      next_followup_at, intent_score,
      organizations(name, siren)
    `)
    .eq("deal_id", dealId)
    .eq("user_id", user.id)
    .eq("role_suggested", "target")
    .neq("status", "rejected")
    .order("created_at", { ascending: true });

  return (rows ?? []).map((r) => {
    const org = (Array.isArray(r.organizations) ? r.organizations[0] : r.organizations) as
      | { name?: string | null; siren?: string | null }
      | null;
    return {
      id: r.id as string,
      organization_id: r.organization_id as string,
      organization_name: org?.name ?? "Organisation",
      organization_siren: org?.siren ?? null,
      status: r.status as string,
      stage: computeFunnelStage({
        status: r.status as string,
        teaser_sent_at: r.teaser_sent_at,
        nda_signed_at: r.nda_signed_at,
        im_sent_at: r.im_sent_at,
        offer_received_at: r.offer_received_at,
      }),
      teaser_sent_at: r.teaser_sent_at,
      nda_signed_at: r.nda_signed_at,
      im_sent_at: r.im_sent_at,
      offer_received_at: r.offer_received_at,
      next_followup_at: r.next_followup_at,
      intent_score: r.intent_score,
      has_brief: r.outreach_brief_json != null,
      has_contact: r.contact_id != null,
    };
  });
}

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
  last_outreach_at: string | null;
  gmail_thread_id: string | null;
}

const SUGGESTION_COLS =
  "id, deal_id, organization_id, status, teaser_sent_at, nda_signed_at, im_sent_at, offer_received_at, next_followup_at, last_outreach_at, gmail_thread_id";

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

  // Recalcul du score d'intention avec l'état à jour (étape + last_outreach).
  await computeAndPersistIntent(supabase, userId, {
    ...merged,
    last_outreach_at: isOutboundStep(step) ? nowIso : s.last_outreach_at,
  });

  revalidateFunnel(s.deal_id);
  return { success: true, data: { stage, next_followup_at: nextFollowup } };
}

/**
 * Annule une étape marquée par erreur : efface la date, recale la relance
 * sur l'étape restante (à partir de SA date), journalise l'annulation.
 *
 * Un misclick doit être ENTIÈREMENT réversible (revue adversariale
 * 2026-08-01) : markFunnelStep force status='contacted' et écrase donc
 * 'approved'. Quand l'annulation ne laisse plus aucune étape, on restaure
 * le statut d'avant le marquage, lu dans le journal (from_status), sinon
 * la suggestion resterait « approche partie » alors que rien n'est parti.
 * Même logique pour last_outreach_at : effacé si plus aucun geste sortant.
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

  const updates: Record<string, unknown> = {
    [stepDef.field]: null,
    next_followup_at: nextFollowup,
  };

  const plusAucuneEtape = FUNNEL_STEPS.every(x => !merged[x.field]);
  const plusAucunGesteSortant = FUNNEL_STEPS
    .filter(x => isOutboundStep(x.key))
    .every(x => !merged[x.field]);

  if (plusAucunGesteSortant) updates.last_outreach_at = null;

  // Statut d'avant le marquage : journalisé par markFunnelStep (from_status).
  let statutRestaure: string | null = null;
  if (plusAucuneEtape && s.status === "contacted") {
    const { data: ev } = await supabase
      .from("deal_suggestion_events")
      .select("from_status")
      .eq("suggestion_id", suggestionId)
      .eq("event_type", stepDef.event)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const from = (ev as { from_status?: string | null } | null)?.from_status ?? null;
    if (from && from !== "contacted") {
      updates.status = from;
      statutRestaure = from;
    }
  }

  const { error } = await supabase
    .from("deal_target_suggestions")
    .update(updates)
    .eq("id", suggestionId)
    .eq("user_id", userId);
  if (error) return { success: false, error: error.message };

  await logEvent(supabase, userId, s, "note", {
    notes: `Étape annulée : ${step}`,
    from_status: s.status,
    to_status: statutRestaure ?? s.status,
    metadata: { undo: step, next_followup_at: nextFollowup },
  });

  // L'intention se recalcule sur l'état après annulation.
  await computeAndPersistIntent(supabase, userId, {
    ...merged,
    last_outreach_at: plusAucunGesteSortant ? null : s.last_outreach_at,
    status: statutRestaure ?? s.status,
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

  await computeAndPersistIntent(supabase, userId, { ...s, last_outreach_at: now.toISOString() });

  revalidateFunnel(s.deal_id);
  return { success: true, data: { stage: computeFunnelStage(s), next_followup_at: next } };
}
