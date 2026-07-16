/**
 * lib/connectors/gmail-ingest.ts — Orchestrateur ingestion Gmail (V57)
 *
 * Pipeline :
 *   1. Charge gmail_sync_state du user (créé à la volée).
 *   2. Construit la query Gmail (incrémentale via after:date).
 *   3. List message IDs depuis Gmail.
 *   4. Pour chaque ID non encore vu (filtré via gmail_processed_messages) :
 *        - getGmailMessage
 *        - filtre ignore list (domaines, expéditeurs)
 *        - matching contact (email exact dans contacts.email)
 *        - classification IA vers un deal (si dossiers actifs existent)
 *        - décision needs_review selon (match contact, confiance IA)
 *        - insertion action type=email + liaison contact si match
 *        - upsert gmail_processed_messages
 *   5. Met à jour gmail_sync_state (compteurs + last_synced_at).
 *
 * Appelé par :
 *   - actions/gmail-ingest.ts::triggerGmailSync() (UI manuelle)
 *   - app/api/cron/gmail-sync/route.ts (Vercel Cron)
 *
 * Toujours appelé avec un client admin (RLS bypass nécessaire pour
 * la lecture cross-user dans le cron). Le user_id est passé explicitement.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listGmailMessageIds,
  getGmailMessage,
  type ParsedGmailMessage,
} from "@/lib/gmail/gmail-client";
import {
  classifyEmailWithAI,
  type ActiveDealCandidate,
} from "@/lib/ai/email-classifier";

// =============================================================================
// Types
// =============================================================================

export interface GmailIngestResult {
  user_id: string;
  fetched: number;
  created_actions: number;
  needs_review: number;
  ignored: number;
  errors: string[];
}

interface GmailSyncStateRow {
  id: string;
  user_id: string;
  last_history_id: string | null;
  last_synced_at: string | null;
  is_enabled: boolean;
  ignore_domains: string[] | null;
  ignore_from_emails: string[] | null;
}

interface ContactMatchRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface DealRow {
  id: string;
  name: string;
  deal_type: string;
  sector: string | null;
  organization_id: string | null;
}

interface OrganizationRow {
  id: string;
  name: string;
}

// =============================================================================
// Helpers
// =============================================================================

const CONFIDENCE_THRESHOLD = 60;
const MAX_MESSAGES_PER_RUN = 50;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function toGmailDateQuery(d: Date | null): string {
  if (!d) return "newer_than:14d";
  // Format Gmail : after:YYYY/M/D
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `after:${y}/${m}/${day}`;
}

function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).toLowerCase();
}

function shouldIgnoreEmail(
  email: string,
  ignoreDomains: string[],
  ignoreFromEmails: string[],
): { ignore: boolean; reason?: string } {
  const lower = email.toLowerCase();
  if (ignoreFromEmails.some((e) => e.toLowerCase() === lower)) {
    return { ignore: true, reason: "from_blacklist" };
  }
  const domain = emailDomain(lower);
  if (domain && ignoreDomains.some((d) => d.toLowerCase() === domain)) {
    return { ignore: true, reason: "domain_blacklist" };
  }
  // Filtre standards : no-reply, notifications systèmes, mailing lists évidentes
  if (/^(no-?reply|noreply|donot-?reply|notifications?|mailer-?daemon|postmaster)@/i.test(lower)) {
    return { ignore: true, reason: "noreply" };
  }
  return { ignore: false };
}

// =============================================================================
// Chargement état + référentiels
// =============================================================================

async function loadOrCreateSyncState(
  admin: SupabaseClient,
  userId: string,
): Promise<GmailSyncStateRow | null> {
  const { data: existing } = await admin
    .from("gmail_sync_state")
    .select("id, user_id, last_history_id, last_synced_at, is_enabled, ignore_domains, ignore_from_emails")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing as GmailSyncStateRow;

  const { data: created, error } = await admin
    .from("gmail_sync_state")
    .insert({ user_id: userId, is_enabled: true })
    .select("id, user_id, last_history_id, last_synced_at, is_enabled, ignore_domains, ignore_from_emails")
    .single();
  if (error) return null;
  return created as GmailSyncStateRow;
}

async function loadActiveDeals(
  admin: SupabaseClient,
  userId: string,
): Promise<ActiveDealCandidate[]> {
  const { data: deals } = await admin
    .from("deals")
    .select("id, name, deal_type, sector, organization_id")
    .eq("user_id", userId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (deals ?? []) as DealRow[];
  const orgIds = Array.from(new Set(rows.map((r) => r.organization_id).filter(Boolean) as string[]));

  let orgsById: Map<string, string> = new Map();
  if (orgIds.length) {
    const { data: orgs } = await admin
      .from("organizations")
      .select("id, name")
      .in("id", orgIds);
    orgsById = new Map((orgs ?? []).map((o: OrganizationRow) => [o.id, o.name]));
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    deal_type: r.deal_type,
    sector: r.sector,
    organization_name: r.organization_id ? orgsById.get(r.organization_id) ?? null : null,
  }));
}

async function findContactByEmail(
  admin: SupabaseClient,
  userId: string,
  email: string,
): Promise<ContactMatchRow | null> {
  const { data } = await admin
    .from("contacts")
    .select("id, first_name, last_name, email")
    .eq("user_id", userId)
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  return (data as ContactMatchRow | null) ?? null;
}

// =============================================================================
// Traitement d'un message
// =============================================================================

interface ProcessOutcome {
  status: "processed" | "ignored" | "failed";
  ignore_reason?: string;
  action_id?: string;
  needs_review: boolean;
}

async function processOneMessage(
  admin: SupabaseClient,
  userId: string,
  parsed: ParsedGmailMessage,
  candidates: ActiveDealCandidate[],
  ignoreDomains: string[],
  ignoreFromEmails: string[],
): Promise<ProcessOutcome> {
  // Filtre ignore list sur l'expéditeur (toujours)
  const counterpartEmail = parsed.direction === "inbound"
    ? parsed.from?.email ?? ""
    : parsed.to[0]?.email ?? "";

  if (!counterpartEmail) {
    return { status: "ignored", ignore_reason: "no_counterpart", needs_review: false };
  }

  const ignored = shouldIgnoreEmail(counterpartEmail, ignoreDomains, ignoreFromEmails);
  if (ignored.ignore) {
    return { status: "ignored", ignore_reason: ignored.reason, needs_review: false };
  }

  // Matching contact (email exact case-insensitive)
  const contact = await findContactByEmail(admin, userId, counterpartEmail);

  // Classification IA vers un dossier
  let dealId: string | null = null;
  let confidence: number | null = null;
  let classificationSource: "subject_id" | "ai" | "none" = "none";

  // Petit fast path : si le sujet contient un UUID de dossier exact, prioritaire
  const uuidInSubject = parsed.subject.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuidInSubject) {
    const found = candidates.find((c) => c.id.toLowerCase() === uuidInSubject[0].toLowerCase());
    if (found) {
      dealId = found.id;
      confidence = 100;
      classificationSource = "subject_id";
    }
  }

  if (!dealId && candidates.length > 0) {
    const cls = await classifyEmailWithAI({
      subject: parsed.subject,
      bodyPreview: parsed.bodyPreview,
      fromName: parsed.from?.name ?? "",
      fromEmail: parsed.from?.email ?? "",
      toEmails: parsed.to.map((t) => t.email),
      direction: parsed.direction,
      candidates,
    });
    if (cls?.deal_id && cls.confidence >= CONFIDENCE_THRESHOLD) {
      dealId = cls.deal_id;
      confidence = cls.confidence;
      classificationSource = "ai";
    } else if (cls) {
      confidence = cls.confidence;
    }
  }

  // Décision tri : needs_review si pas de contact OU pas de dossier OU IA peu confiante
  let reviewReason: string | null = null;
  if (!contact) reviewReason = "no_contact_match";
  else if (!dealId && candidates.length > 0) reviewReason = "no_deal_match";

  const needsReview = reviewReason !== null;

  // Statut de l'action selon la direction
  const status = parsed.direction === "outbound" ? "sent" : "received";

  // Titre concis : sujet ou snippet
  const title = parsed.subject?.trim() || parsed.snippet.slice(0, 80) || "(sans objet)";

  const { data: created, error } = await admin
    .from("actions")
    .insert({
      user_id: userId,
      type: "email",
      status,
      priority: "medium",
      title,
      notes: null,
      due_date: parsed.internalDate.toISOString().slice(0, 10),
      is_all_day: true,
      gmail_thread_id: parsed.threadId,
      gmail_message_id: parsed.id,
      email_subject: parsed.subject || null,
      email_direction: parsed.direction,
      email_from: parsed.from?.email ?? null,
      email_to: parsed.to.map((t) => t.email),
      email_cc: parsed.cc.map((c) => c.email),
      email_body_preview: parsed.bodyPreview || null,
      deal_id: dealId,
      needs_review: needsReview,
      review_reason: reviewReason,
      classification_source: dealId ? classificationSource : "none",
      classification_confidence: confidence,
    })
    .select("id")
    .single();

  if (error) {
    return { status: "failed", needs_review: false };
  }

  // Liaison contact si trouvé + mise à jour last_contact_date.
  // On ne push la date QUE si elle est plus récente que celle déjà stockée,
  // pour ne pas régresser quand on rejoue un ancien thread.
  if (contact) {
    await admin.from("action_contacts").insert({
      action_id: created.id,
      contact_id: contact.id,
      role: null,
      attended: true,
    });

    const emailDateISO = parsed.internalDate.toISOString().slice(0, 10);
    const { data: contactRow } = await admin
      .from("contacts")
      .select("last_contact_date")
      .eq("id", contact.id)
      .maybeSingle();
    const current = (contactRow?.last_contact_date as string | null) ?? null;
    if (!current || emailDateISO > current) {
      await admin
        .from("contacts")
        .update({ last_contact_date: emailDateISO })
        .eq("id", contact.id)
        .eq("user_id", userId);
    }
  }

  return {
    status: "processed",
    action_id: created.id,
    needs_review: needsReview,
  };
}

// =============================================================================
// Entrée principale
// =============================================================================

export async function syncGmailForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<GmailIngestResult> {
  const result: GmailIngestResult = {
    user_id: userId,
    fetched: 0,
    created_actions: 0,
    needs_review: 0,
    ignored: 0,
    errors: [],
  };

  const state = await loadOrCreateSyncState(admin, userId);
  if (!state) {
    result.errors.push("Impossible de charger gmail_sync_state");
    return result;
  }
  if (!state.is_enabled) {
    return result;
  }

  const ignoreDomains = state.ignore_domains ?? [];
  const ignoreFromEmails = state.ignore_from_emails ?? [];

  // Construire la query Gmail incrémentale
  const lastSyncedAt = state.last_synced_at ? new Date(state.last_synced_at) : null;
  // On recule de 2h pour gérer les late-arriving messages.
  const cursor = lastSyncedAt ? new Date(lastSyncedAt.getTime() - 2 * 60 * 60 * 1000) : null;
  const dateQuery = toGmailDateQuery(cursor);
  // INBOX = reçus, SENT = envoyés, on exclut spam et trash
  const query = `(in:inbox OR in:sent) ${dateQuery} -in:spam -in:trash`;

  // 1. Liste des IDs candidats
  const ids = await listGmailMessageIds(userId, {
    query,
    maxResults: MAX_MESSAGES_PER_RUN,
  });
  result.fetched = ids.length;

  if (ids.length === 0) {
    await admin.from("gmail_sync_state").update({
      last_synced_at: new Date().toISOString(),
      last_run_status: "success",
      last_run_error: null,
      last_run_fetched: 0,
      last_run_created: 0,
      last_run_review: 0,
    }).eq("id", state.id);
    return result;
  }

  // 2. Filtre dedup : ne traiter que les IDs non encore vus
  const { data: alreadyProcessed } = await admin
    .from("gmail_processed_messages")
    .select("gmail_message_id")
    .eq("user_id", userId)
    .in("gmail_message_id", ids.map((m) => m.id));
  const seen = new Set((alreadyProcessed ?? []).map((r: { gmail_message_id: string }) => r.gmail_message_id));
  const fresh = ids.filter((m) => !seen.has(m.id));

  if (fresh.length === 0) {
    await admin.from("gmail_sync_state").update({
      last_synced_at: new Date().toISOString(),
      last_run_status: "success",
      last_run_error: null,
      last_run_fetched: ids.length,
      last_run_created: 0,
      last_run_review: 0,
    }).eq("id", state.id);
    return result;
  }

  // 3. Charger référentiel dossiers actifs (1 seul appel par run)
  const candidates = await loadActiveDeals(admin, userId);

  // 4. Boucle de traitement
  for (const ref of fresh) {
    try {
      const parsed = await getGmailMessage(userId, ref.id);
      if (!parsed) {
        await admin.from("gmail_processed_messages").insert({
          user_id: userId,
          gmail_message_id: ref.id,
          gmail_thread_id: ref.threadId,
          direction: "inbound",
          status: "failed",
          ignore_reason: "fetch_failed",
        });
        continue;
      }

      const outcome = await processOneMessage(
        admin,
        userId,
        parsed,
        candidates,
        ignoreDomains,
        ignoreFromEmails,
      );

      await admin.from("gmail_processed_messages").insert({
        user_id: userId,
        gmail_message_id: parsed.id,
        gmail_thread_id: parsed.threadId,
        internal_date: parsed.internalDate.toISOString(),
        direction: parsed.direction,
        action_id: outcome.action_id ?? null,
        status: outcome.status,
        ignore_reason: outcome.ignore_reason ?? null,
      });

      if (outcome.status === "processed") result.created_actions++;
      else if (outcome.status === "ignored") result.ignored++;
      if (outcome.needs_review) result.needs_review++;
    } catch (err) {
      result.errors.push(`msg ${ref.id}: ${err instanceof Error ? err.message : "erreur"}`);
    }
  }

  // 5. Mettre à jour l'état
  await admin.from("gmail_sync_state").update({
    last_synced_at: new Date().toISOString(),
    last_run_status: result.errors.length === 0 ? "success" : (result.created_actions > 0 ? "partial" : "failure"),
    last_run_error: result.errors[0] ?? null,
    last_run_fetched: result.fetched,
    last_run_created: result.created_actions,
    last_run_review: result.needs_review,
  }).eq("id", state.id);

  // Traçabilité : log dans connector_runs (table déjà prête à recevoir 'gmail')
  await admin.from("connector_runs").insert({
    user_id: userId,
    source_connector: "gmail",
    triggered_by: "cron",
    started_at: new Date(Date.now() - 1000).toISOString(),
    completed_at: new Date().toISOString(),
    status: result.errors.length === 0 ? "success" : (result.created_actions > 0 ? "partial" : "failure"),
    records_fetched: result.fetched,
    records_created: result.created_actions,
    records_skipped: result.ignored,
    error_message: result.errors[0] ?? null,
    query_params: { date_query: dateQuery, run_date: todayISO() },
  });

  return result;
}
