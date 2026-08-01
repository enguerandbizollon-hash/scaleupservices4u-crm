"use server";
// Brouillons Gmail du funnel acquéreur (plan R1 lot 3). L'outil DÉPOSE un
// brouillon, l'utilisateur relit et envoie depuis Gmail, puis marque
// l'étape sur la carte : créer un brouillon ne marque jamais « envoyé »
// (principe propose/dispose). La relance s'accroche au fil d'origine
// (threadId + In-Reply-To) quand il est connu.

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createGmailDraft, getThreadLastMessageMeta } from "@/lib/gmail/gmail-client";
import { computeFunnelStage, type FunnelStage } from "@/lib/crm/funnel";

type OutreachResult =
  | { success: true; data: { draftId: string; threadId: string | null } }
  | { success: false; error: string; reconnect?: boolean };

interface OutreachBriefJson {
  email_subject?: string;
  email_body?: string;
  linkedin_message?: string;
  reasoning?: string | null;
  generated_at?: string;
}

interface SuggestionForDraft {
  id: string;
  deal_id: string;
  organization_id: string;
  contact_id: string | null;
  status: string;
  gmail_thread_id: string | null;
  outreach_brief_json: OutreachBriefJson | null;
  teaser_sent_at: string | null;
  nda_signed_at: string | null;
  im_sent_at: string | null;
  offer_received_at: string | null;
}

function gmailFailure(reason: "no_token" | "insufficient_scope" | "api_error", detail?: string): OutreachResult {
  if (reason === "no_token") {
    return { success: false, reconnect: true, error: "Google non connecté : ouvrez Connecteurs et cliquez Connecter." };
  }
  if (reason === "insufficient_scope") {
    return { success: false, reconnect: true, error: "Droits Gmail manquants : ouvrez Connecteurs et cliquez Reconnecter pour accorder la création de brouillons." };
  }
  return { success: false, error: `Gmail a refusé le brouillon${detail ? ` : ${detail}` : "."}` };
}

async function loadForDraft(suggestionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Non autorisé" };

  const { data: s, error } = await supabase
    .from("deal_target_suggestions")
    .select("id, deal_id, organization_id, contact_id, status, gmail_thread_id, outreach_brief_json, teaser_sent_at, nda_signed_at, im_sent_at, offer_received_at")
    .eq("id", suggestionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !s) return { ok: false as const, error: "Suggestion introuvable" };
  return { ok: true as const, supabase, userId: user.id, s: s as unknown as SuggestionForDraft };
}

/**
 * Email du destinataire : le contact rattaché à la suggestion d'abord,
 * sinon le contact principal (puis n'importe quel contact avec email) de
 * l'organisation.
 */
async function resolveRecipient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  s: SuggestionForDraft,
): Promise<{ email: string } | { error: string }> {
  if (s.contact_id) {
    const { data: c } = await supabase
      .from("contacts")
      .select("email")
      .eq("id", s.contact_id)
      .maybeSingle();
    if (c?.email) return { email: c.email };
  }
  const { data: ocs } = await supabase
    .from("organization_contacts")
    .select("is_primary, contacts(email)")
    .eq("organization_id", s.organization_id);
  const withEmail = (ocs ?? [])
    .map(oc => {
      const c = Array.isArray(oc.contacts) ? oc.contacts[0] : oc.contacts;
      return { is_primary: !!oc.is_primary, email: (c as { email?: string | null } | null)?.email ?? null };
    })
    .filter(x => !!x.email);
  const primary = withEmail.find(x => x.is_primary) ?? withEmail[0];
  if (primary?.email) return { email: primary.email };
  return { error: "Aucun email : rattachez un contact avec email à cet acquéreur (bouton Enrichir sur sa fiche)." };
}

async function persistDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  s: SuggestionForDraft,
  draftId: string,
  threadId: string | null,
  kind: "initial" | "followup",
  stage: FunnelStage,
) {
  await supabase
    .from("deal_target_suggestions")
    .update({
      gmail_draft_id: draftId,
      ...(threadId ? { gmail_thread_id: threadId } : {}),
    })
    .eq("id", s.id)
    .eq("user_id", userId);

  await supabase.from("deal_suggestion_events").insert({
    user_id: userId,
    suggestion_id: s.id,
    deal_id: s.deal_id,
    organization_id: s.organization_id,
    event_type: "draft_created",
    metadata: { kind, stage, draft_id: draftId, thread_id: threadId },
  });

  revalidatePath(`/protected/dossiers/${s.deal_id}`);
}

/**
 * Brouillon d'approche initiale, pré-rempli depuis le brief structuré
 * (outreach_brief_json, généré par le bouton IA du sourcing).
 */
export async function createOutreachDraftForSuggestion(suggestionId: string): Promise<OutreachResult> {
  const ctx = await loadForDraft(suggestionId);
  if (!ctx.ok) return { success: false, error: ctx.error };
  const { supabase, userId, s } = ctx;

  const brief = s.outreach_brief_json;
  if (!brief?.email_subject || !brief?.email_body) {
    return { success: false, error: "Générez d'abord le brief d'approche (bouton IA de l'onglet Sourcing)." };
  }

  const recipient = await resolveRecipient(supabase, s);
  if ("error" in recipient) return { success: false, error: recipient.error };

  const res = await createGmailDraft(userId, {
    to: [recipient.email],
    subject: brief.email_subject,
    body: brief.email_body,
  });
  if (!res.ok) return gmailFailure(res.reason, res.detail);

  await persistDraft(supabase, userId, s, res.draftId, res.threadId, "initial", computeFunnelStage(s));
  return { success: true, data: { draftId: res.draftId, threadId: res.threadId } };
}

// Relances déterministes par étape : courtes, sobres, l'utilisateur ajuste
// dans Gmail. Pas d'IA ici (v1) : une relance doit partir en 10 secondes.
const FOLLOWUP_TEMPLATES: Partial<Record<FunnelStage, { subject: string; body: string }>> = {
  teaser_envoye: {
    subject: "Opportunité de reprise, relance",
    body: "Bonjour,\n\nJe me permets de revenir vers vous au sujet de l'opportunité de reprise que je vous ai adressée. Auriez-vous un intérêt de principe pour aller plus loin (NDA puis dossier complet) ?\n\nBien à vous",
  },
  nda_signe: {
    subject: "Information Memorandum",
    body: "Bonjour,\n\nMerci pour le NDA signé. Vous trouverez ci-joint l'Information Memorandum du dossier (pièce à joindre avant envoi). Je reste disponible pour un échange cette semaine.\n\nBien à vous",
  },
  im_envoye: {
    subject: "Information Memorandum, votre retour",
    body: "Bonjour,\n\nAvez-vous pu prendre connaissance de l'Information Memorandum ? Je serais heureux de recueillir votre position de principe et vos questions.\n\nBien à vous",
  },
};

/**
 * Brouillon de RELANCE adapté à l'étape courante, accroché au fil Gmail
 * d'origine quand il est connu (Re: + In-Reply-To), sinon nouveau fil.
 */
export async function createFollowupDraftForSuggestion(suggestionId: string): Promise<OutreachResult> {
  const ctx = await loadForDraft(suggestionId);
  if (!ctx.ok) return { success: false, error: ctx.error };
  const { supabase, userId, s } = ctx;

  const stage = computeFunnelStage(s);
  const template = FOLLOWUP_TEMPLATES[stage];
  if (!template) {
    return { success: false, error: "Aucune relance type à ce stade (marquez d'abord une étape du funnel)." };
  }

  const recipient = await resolveRecipient(supabase, s);
  if ("error" in recipient) return { success: false, error: recipient.error };

  let subject = template.subject;
  let inReplyTo: string | null = null;
  let references: string | null = null;
  if (s.gmail_thread_id) {
    const meta = await getThreadLastMessageMeta(userId, s.gmail_thread_id);
    if (meta) {
      if (meta.subject) subject = meta.subject.startsWith("Re:") ? meta.subject : `Re: ${meta.subject}`;
      inReplyTo = meta.rfcMessageId;
      references = meta.rfcMessageId;
    }
  }

  const res = await createGmailDraft(userId, {
    to: [recipient.email],
    subject,
    body: template.body,
    threadId: s.gmail_thread_id,
    inReplyTo,
    references,
  });
  if (!res.ok) return gmailFailure(res.reason, res.detail);

  await persistDraft(supabase, userId, s, res.draftId, res.threadId, "followup", stage);
  return { success: true, data: { draftId: res.draftId, threadId: res.threadId } };
}
