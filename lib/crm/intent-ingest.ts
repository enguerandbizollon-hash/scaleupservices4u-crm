// Calcul et persistance du score d'intention (plan R1 lot 5).
// Les signaux email viennent des actions type "email" ingérées par
// gmail-sync (email_direction inbound/outbound, gmail_thread_id).
// Réutilisé par les Server Actions du funnel (client SSR) et par le
// Job 5 du cron (client admin, requête mails BATCHÉE, jamais en boucle).

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeIntentScore, type IntentResult, type InboundSignals } from "./intent-score";
import { computeFunnelStage, type SuggestionForFunnel } from "./funnel";

export interface SuggestionForIntent extends SuggestionForFunnel {
  id: string;
  gmail_thread_id: string | null;
  last_outreach_at: string | null;
}

export interface MailRow {
  gmail_thread_id: string | null;
  email_direction: string | null;
  at: string | null;
}

/** Signaux entrants d'un fil, à partir de lignes mails déjà chargées. */
export function inboundFromRows(s: SuggestionForIntent, sentAt: string | null, rows: MailRow[]): InboundSignals {
  if (!s.gmail_thread_id || !sentAt) {
    return { first_reply_at: null, inbound_count: 0, last_interaction_at: null, thread_known: !!s.gmail_thread_id };
  }
  const sentTs = new Date(sentAt).getTime();
  const thread = rows
    .filter(r => r.gmail_thread_id === s.gmail_thread_id && r.at)
    .sort((a, b) => new Date(a.at!).getTime() - new Date(b.at!).getTime());
  const inbound = thread.filter(r => r.email_direction === "inbound" && new Date(r.at!).getTime() >= sentTs);
  return {
    thread_known: true,
    first_reply_at: inbound[0]?.at ?? null,
    inbound_count: inbound.length,
    last_interaction_at: thread.length > 0 ? thread[thread.length - 1].at : null,
  };
}

/** Mails d'un ensemble de fils, en UNE requête (pour le cron). */
export async function fetchMailRowsForThreads(
  client: SupabaseClient,
  threadIds: string[],
): Promise<MailRow[]> {
  if (threadIds.length === 0) return [];
  const { data } = await client
    .from("actions")
    .select("gmail_thread_id, email_direction, start_datetime, created_at")
    .eq("type", "email")
    .in("gmail_thread_id", threadIds)
    .limit(2000);
  return (data ?? []).map(m => ({
    gmail_thread_id: m.gmail_thread_id as string | null,
    email_direction: m.email_direction as string | null,
    at: (m.start_datetime ?? m.created_at) as string | null,
  }));
}

/** Calcule le score et le persiste sur la suggestion. */
export async function computeAndPersistIntent(
  client: SupabaseClient,
  userId: string,
  s: SuggestionForIntent,
  prefetchedRows?: MailRow[],
  now: Date = new Date(),
): Promise<IntentResult> {
  const sentAt = s.teaser_sent_at ?? s.last_outreach_at ?? null;
  const rows = prefetchedRows ?? (s.gmail_thread_id
    ? await fetchMailRowsForThreads(client, [s.gmail_thread_id])
    : []);
  const result = computeIntentScore(
    { stage: computeFunnelStage(s), sent_at: sentAt, inbound: inboundFromRows(s, sentAt, rows) },
    now,
  );
  await client
    .from("deal_target_suggestions")
    .update({
      intent_score: result.score,
      intent_breakdown: { raisons: result.raisons },
      intent_computed_at: now.toISOString(),
    })
    .eq("id", s.id)
    .eq("user_id", userId);
  return result;
}

/**
 * Rafraîchit le score d'intention de toutes les suggestions (non écartées)
 * d'un utilisateur rattachées aux fils Gmail donnés, mails de TOUS les fils
 * chargés en UNE requête (jamais de requête par ligne). Appelé après
 * l'ingestion Gmail : une réponse d'acquéreur fait monter sa chaleur SANS
 * attendre un geste du funnel ni une relance échue (organisme vivant, chaque
 * brique nourrit la suivante : email entrant → intention → revue du matin).
 * Renvoie le nombre de suggestions recalculées.
 */
export async function refreshIntentForThreads(
  client: SupabaseClient,
  userId: string,
  threadIds: string[],
  now: Date = new Date(),
): Promise<number> {
  const uniq = [...new Set(threadIds.filter((t): t is string => !!t))];
  if (uniq.length === 0) return 0;

  const { data } = await client
    .from("deal_target_suggestions")
    .select("id, status, teaser_sent_at, nda_signed_at, im_sent_at, offer_received_at, last_outreach_at, gmail_thread_id")
    .eq("user_id", userId)
    .in("gmail_thread_id", uniq)
    .neq("status", "rejected");

  const suggestions = (data ?? []) as unknown as SuggestionForIntent[];
  if (suggestions.length === 0) return 0;

  const mailRows = await fetchMailRowsForThreads(client, uniq);
  for (const s of suggestions) {
    await computeAndPersistIntent(client, userId, s, mailRows, now);
  }
  return suggestions.length;
}
