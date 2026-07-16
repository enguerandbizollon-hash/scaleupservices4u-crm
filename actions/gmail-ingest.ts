"use server";

/**
 * actions/gmail-ingest.ts — Server Actions de l'ingestion Gmail (V57)
 *
 * Expose les opérations consommables depuis l'UI :
 *   - triggerGmailSync()                       sync manuelle pour le user
 *   - getInboxToReview()                       liste les actions email needs_review=true
 *   - getInboxToReviewCount()                  compteur pour badge sidebar
 *   - assignReviewToDeal(actionId, dealId)     rattache un email à un dossier
 *   - assignReviewToContact(actionId, ...)     lie un contact à un email
 *   - dismissReview(actionId)                  retire de la boîte de tri (statut completed)
 *   - getGmailSyncStatus()                     état de la sync (dashboard)
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncGmailForUser, type GmailIngestResult } from "@/lib/connectors/gmail-ingest";
import { revalidatePath } from "next/cache";

// =============================================================================
// Types publics
// =============================================================================

export interface InboxReviewRow {
  id: string;
  title: string;
  email_subject: string | null;
  email_from: string | null;
  email_to: string[] | null;
  email_direction: string | null;
  email_body_preview: string | null;
  due_date: string | null;
  gmail_thread_id: string | null;
  classification_source: string | null;
  classification_confidence: number | null;
  review_reason: string | null;
  contacts: { id: string; first_name: string; last_name: string }[];
}

export interface GmailSyncStatus {
  is_enabled: boolean;
  last_synced_at: string | null;
  last_run_status: string | null;
  last_run_error: string | null;
  last_run_fetched: number | null;
  last_run_created: number | null;
  last_run_review: number | null;
}

// =============================================================================
// Sync manuelle
// =============================================================================

export async function triggerGmailSync(): Promise<{ success: boolean; result?: GmailIngestResult; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const admin = createAdminClient();
  const result = await syncGmailForUser(admin, user.id);

  revalidatePath("/protected/inbox");
  revalidatePath("/protected");

  return { success: true, result };
}

// =============================================================================
// Lecture de la boîte de tri
// =============================================================================

export async function getInboxToReview(): Promise<InboxReviewRow[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("actions")
    .select(`
      id, title, email_subject, email_from, email_to, email_direction,
      email_body_preview, due_date, gmail_thread_id,
      classification_source, classification_confidence, review_reason,
      action_contacts(contacts:contact_id(id, first_name, last_name))
    `)
    .eq("user_id", user.id)
    .eq("type", "email")
    .eq("needs_review", true)
    .order("due_date", { ascending: false })
    .limit(200);

  return (data ?? []).map((r) => {
    type ActionContactJoin = { contacts: { id: string; first_name: string; last_name: string } | { id: string; first_name: string; last_name: string }[] | null };
    const contactsRel = (r.action_contacts ?? []) as unknown as ActionContactJoin[];
    const flatContacts: { id: string; first_name: string; last_name: string }[] = [];
    for (const rel of contactsRel) {
      if (!rel.contacts) continue;
      if (Array.isArray(rel.contacts)) flatContacts.push(...rel.contacts);
      else flatContacts.push(rel.contacts);
    }
    return {
      id: r.id as string,
      title: r.title as string,
      email_subject: (r.email_subject as string | null) ?? null,
      email_from: (r.email_from as string | null) ?? null,
      email_to: (r.email_to as string[] | null) ?? null,
      email_direction: (r.email_direction as string | null) ?? null,
      email_body_preview: (r.email_body_preview as string | null) ?? null,
      due_date: (r.due_date as string | null) ?? null,
      gmail_thread_id: (r.gmail_thread_id as string | null) ?? null,
      classification_source: (r.classification_source as string | null) ?? null,
      classification_confidence: (r.classification_confidence as number | null) ?? null,
      review_reason: (r.review_reason as string | null) ?? null,
      contacts: flatContacts,
    };
  });
}

export async function getInboxToReviewCount(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("actions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("type", "email")
    .eq("needs_review", true);

  return count ?? 0;
}

// =============================================================================
// Actions de tri
// =============================================================================

export async function assignReviewToDeal(
  actionId: string,
  dealId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  // Vérifier que le dossier appartient au user
  const { data: deal } = await supabase
    .from("deals")
    .select("id")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!deal) return { success: false, error: "Dossier introuvable" };

  const { error } = await supabase
    .from("actions")
    .update({
      deal_id: dealId,
      needs_review: false,
      review_reason: null,
      classification_source: "manual",
      updated_at: new Date().toISOString(),
    })
    .eq("id", actionId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/protected/inbox");
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true };
}

export async function assignReviewToContact(
  actionId: string,
  contactId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  // Vérifier que le contact appartient au user
  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!contact) return { success: false, error: "Contact introuvable" };

  // Liaison via action_contacts (upsert manuel : on supprime puis ré-insère)
  await supabase.from("action_contacts").delete().eq("action_id", actionId);
  const { error: linkErr } = await supabase.from("action_contacts").insert({
    action_id: actionId,
    contact_id: contactId,
    role: null,
    attended: true,
  });
  if (linkErr) return { success: false, error: linkErr.message };

  // On retire le motif de review "no_contact_match" si c'était le seul,
  // sinon on conserve needs_review en true tant qu'un dossier reste à choisir.
  const { data: current } = await supabase
    .from("actions")
    .select("review_reason, deal_id")
    .eq("id", actionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (current?.review_reason === "no_contact_match" && current.deal_id) {
    await supabase
      .from("actions")
      .update({ needs_review: false, review_reason: null, updated_at: new Date().toISOString() })
      .eq("id", actionId)
      .eq("user_id", user.id);
  } else if (current?.review_reason === "no_contact_match" && !current.deal_id) {
    // Encore besoin d'un dossier, mais le motif évolue
    await supabase
      .from("actions")
      .update({ review_reason: "no_deal_match", updated_at: new Date().toISOString() })
      .eq("id", actionId)
      .eq("user_id", user.id);
  }

  revalidatePath("/protected/inbox");
  return { success: true };
}

/**
 * Crée un contact à partir des en-têtes d'un email en boîte de tri, puis le
 * lie à l'action. Le user déclenche l'action manuellement, donc pas de bruit
 * automatique. Si un contact avec le même email existe déjà, on le lie sans
 * en recréer un.
 */
export async function createContactFromInboxEmail(
  actionId: string,
): Promise<{ success: boolean; contact_id?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  // Récupérer l'action et l'email source (selon la direction)
  const { data: action } = await supabase
    .from("actions")
    .select("id, email_direction, email_from, email_to, title, deal_id, review_reason")
    .eq("id", actionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!action) return { success: false, error: "Action introuvable" };

  const direction = (action.email_direction as string | null) ?? "inbound";
  const counterpartRaw = direction === "outbound"
    ? ((action.email_to as string[] | null)?.[0] ?? null)
    : (action.email_from as string | null);
  if (!counterpartRaw) return { success: false, error: "Pas d'adresse email exploitable" };

  // Extraction email + nom : la valeur stockée est déjà juste l'email côté
  // ingest (email_from = parsed.from?.email). Si format "Nom <email>" arrivait
  // tout de même, on l'extrait défensivement.
  const emailMatch = counterpartRaw.match(/([^\s<>,]+@[^\s<>,]+)/);
  const email = (emailMatch?.[1] ?? counterpartRaw).toLowerCase().trim();
  if (!/@/.test(email)) return { success: false, error: "Adresse email invalide" };

  // Le nom n'est pas stocké séparément aujourd'hui ; on déduit un prénom/nom
  // depuis la partie locale de l'email à défaut. L'utilisateur pourra éditer
  // ensuite dans la fiche contact.
  const local = email.split("@")[0];
  const parts = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
  const first_name = parts[0] ?? "Contact";
  const last_name = parts.slice(1).join(" ") || "Email";

  // Si un contact avec cet email existe déjà, on le lie sans recréer
  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("user_id", user.id)
    .ilike("email", email)
    .maybeSingle();

  let contactId: string;
  if (existing?.id) {
    contactId = existing.id as string;
  } else {
    const { data: created, error: createErr } = await supabase
      .from("contacts")
      .insert({
        user_id: user.id,
        first_name,
        last_name,
        email,
        base_status: "to_qualify",
      })
      .select("id")
      .single();
    if (createErr || !created) return { success: false, error: createErr?.message ?? "Erreur création contact" };
    contactId = created.id as string;
  }

  // Lier à l'action via action_contacts (idempotent : on supprime puis ré-insère)
  await supabase.from("action_contacts").delete().eq("action_id", actionId).eq("contact_id", contactId);
  await supabase.from("action_contacts").insert({
    action_id: actionId,
    contact_id: contactId,
    role: null,
    attended: true,
  });

  // Mettre à jour le statut review : si le seul motif était no_contact_match
  // et qu'on a déjà un dossier, l'action sort de la boîte de tri.
  const reviewReason = action.review_reason as string | null;
  const dealId = action.deal_id as string | null;
  if (reviewReason === "no_contact_match" && dealId) {
    await supabase
      .from("actions")
      .update({ needs_review: false, review_reason: null, updated_at: new Date().toISOString() })
      .eq("id", actionId)
      .eq("user_id", user.id);
  } else if (reviewReason === "no_contact_match" && !dealId) {
    // Contact lié, mais dossier toujours à choisir
    await supabase
      .from("actions")
      .update({ review_reason: "no_deal_match", updated_at: new Date().toISOString() })
      .eq("id", actionId)
      .eq("user_id", user.id);
  }

  revalidatePath("/protected/inbox");
  revalidatePath("/protected/contacts");
  return { success: true, contact_id: contactId };
}

export async function dismissReview(
  actionId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase
    .from("actions")
    .update({
      needs_review: false,
      review_reason: null,
      status: "done",
      updated_at: new Date().toISOString(),
    })
    .eq("id", actionId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/protected/inbox");
  return { success: true };
}

// =============================================================================
// Bulk actions
// =============================================================================

export async function bulkDismissReviews(
  actionIds: string[],
): Promise<{ success: boolean; count: number; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, count: 0, error: "Non autorisé" };
  if (actionIds.length === 0) return { success: true, count: 0 };

  const { error, count } = await supabase
    .from("actions")
    .update({
      needs_review: false,
      review_reason: null,
      status: "done",
      updated_at: new Date().toISOString(),
    }, { count: "exact" })
    .in("id", actionIds)
    .eq("user_id", user.id);

  if (error) return { success: false, count: 0, error: error.message };

  revalidatePath("/protected/inbox");
  return { success: true, count: count ?? 0 };
}

export async function bulkAssignReviewsToDeal(
  actionIds: string[],
  dealId: string,
): Promise<{ success: boolean; count: number; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, count: 0, error: "Non autorisé" };
  if (actionIds.length === 0) return { success: true, count: 0 };

  const { data: deal } = await supabase
    .from("deals")
    .select("id")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!deal) return { success: false, count: 0, error: "Dossier introuvable" };

  const { error, count } = await supabase
    .from("actions")
    .update({
      deal_id: dealId,
      needs_review: false,
      review_reason: null,
      classification_source: "manual",
      updated_at: new Date().toISOString(),
    }, { count: "exact" })
    .in("id", actionIds)
    .eq("user_id", user.id);

  if (error) return { success: false, count: 0, error: error.message };

  revalidatePath("/protected/inbox");
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true, count: count ?? 0 };
}

// =============================================================================
// État de la sync
// =============================================================================

export async function getGmailSyncStatus(): Promise<GmailSyncStatus | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("gmail_sync_state")
    .select("is_enabled, last_synced_at, last_run_status, last_run_error, last_run_fetched, last_run_created, last_run_review")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) {
    return {
      is_enabled: true,
      last_synced_at: null,
      last_run_status: null,
      last_run_error: null,
      last_run_fetched: null,
      last_run_created: null,
      last_run_review: null,
    };
  }
  return data as GmailSyncStatus;
}

export async function setGmailSyncEnabled(enabled: boolean): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  // Upsert : crée la ligne si elle n'existe pas
  const { error } = await supabase
    .from("gmail_sync_state")
    .upsert(
      { user_id: user.id, is_enabled: enabled },
      { onConflict: "user_id" },
    );

  if (error) return { success: false, error: error.message };

  revalidatePath("/protected/inbox");
  return { success: true };
}
