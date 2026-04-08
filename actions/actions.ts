"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { syncToGCal } from "@/lib/gcal/sync-helper";
import { generateMeetLink } from "@/lib/gcal/meet-generator";
import { generateActionSummary } from "@/lib/ai/action-summary";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ActionInput {
  type: string;
  title: string;
  status?: string;
  priority?: string;
  description?: string;
  notes?: string;
  due_date?: string | null;
  due_time?: string | null;
  is_all_day?: boolean;
  start_datetime?: string | null;
  end_datetime?: string | null;
  duration_minutes?: number | null;
  hard_deadline?: boolean;
  reminder_days?: number[];
  location?: string | null;
  meet_link?: string | null;
  phone_number?: string | null;
  agenda_notes?: string | null;
  gmail_thread_id?: string | null;
  gmail_message_id?: string | null;
  email_subject?: string | null;
  email_direction?: string | null;
  document_url?: string | null;
  deal_id?: string | null;
  organization_id?: string | null;
  mandate_id?: string | null;
  contact_ids?: { id: string; role?: string; attended?: boolean }[];
  organization_ids?: { id: string; role?: string }[];
}

export interface ActionRow {
  id: string;
  user_id: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  description: string | null;
  notes: string | null;
  summary_ai: string | null;
  due_date: string | null;
  due_time: string | null;
  is_all_day: boolean;
  start_datetime: string | null;
  end_datetime: string | null;
  duration_minutes: number | null;
  hard_deadline: boolean;
  location: string | null;
  meet_link: string | null;
  phone_number: string | null;
  agenda_notes: string | null;
  gmail_thread_id: string | null;
  email_subject: string | null;
  email_direction: string | null;
  document_url: string | null;
  deal_id: string | null;
  organization_id: string | null;
  mandate_id: string | null;
  gcal_event_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  deals?: { id: string; name: string; deal_type: string } | null;
  organizations?: { id: string; name: string } | null;
  contacts?: { id: string; first_name: string; last_name: string; phone: string | null }[];
  action_contacts?: { contact_id: string; role: string | null; attended: boolean; contacts: { id: string; first_name: string; last_name: string; phone: string | null } }[];
  action_organizations?: { organization_id: string; role: string | null; organizations: { id: string; name: string } }[];
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getActions(filters?: {
  deal_id?: string;
  organization_id?: string;
  contact_id?: string;
  mandate_id?: string;
  type?: string[];
  status?: string[];
  from?: string;
  to?: string;
}): Promise<ActionRow[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("actions")
    .select(`
      *,
      deals:deal_id(id, name, deal_type),
      organizations:organization_id(id, name),
      action_contacts(contact_id, role, attended, contacts:contact_id(id, first_name, last_name, phone)),
      action_organizations(organization_id, role, organizations:organization_id(id, name))
    `)
    .eq("user_id", user.id)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (filters?.deal_id)         query = query.eq("deal_id", filters.deal_id);
  if (filters?.organization_id) query = query.eq("organization_id", filters.organization_id);
  if (filters?.mandate_id)      query = query.eq("mandate_id", filters.mandate_id);
  if (filters?.type?.length)    query = query.in("type", filters.type);
  if (filters?.status?.length)  query = query.in("status", filters.status);
  if (filters?.from)            query = query.gte("due_date", filters.from);
  if (filters?.to)              query = query.lte("due_date", filters.to);

  // Contact filter : via action_contacts join
  if (filters?.contact_id) {
    const { data: actionIds } = await supabase
      .from("action_contacts")
      .select("action_id")
      .eq("contact_id", filters.contact_id);
    if (actionIds?.length) {
      query = query.in("id", actionIds.map(a => a.action_id));
    } else {
      return [];
    }
  }

  const { data } = await query;
  return (data ?? []) as ActionRow[];
}

// ── CRUD ───────────────────────────────────────────────────────────────────

export async function createAction(input: ActionInput): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };
  if (!input.title?.trim()) return { success: false, error: "Titre requis" };

  const { data: action, error } = await supabase.from("actions").insert({
    user_id:          user.id,
    type:             input.type || "task",
    status:           input.status || "open",
    priority:         input.priority || "medium",
    title:            input.title.trim(),
    description:      input.description ?? null,
    notes:            input.notes ?? null,
    due_date:         input.due_date ?? null,
    due_time:         input.due_time ?? null,
    is_all_day:       input.is_all_day ?? true,
    start_datetime:   input.start_datetime ?? null,
    end_datetime:     input.end_datetime ?? null,
    duration_minutes: input.duration_minutes ?? null,
    hard_deadline:    input.hard_deadline ?? false,
    reminder_days:    input.reminder_days ?? null,
    location:         input.location ?? null,
    meet_link:        input.meet_link ?? null,
    phone_number:     input.phone_number ?? null,
    agenda_notes:     input.agenda_notes ?? null,
    gmail_thread_id:  input.gmail_thread_id ?? null,
    gmail_message_id: input.gmail_message_id ?? null,
    email_subject:    input.email_subject ?? null,
    email_direction:  input.email_direction ?? null,
    document_url:     input.document_url ?? null,
    deal_id:          input.deal_id ?? null,
    organization_id:  input.organization_id ?? null,
    mandate_id:       input.mandate_id ?? null,
  }).select("id").single();

  if (error) return { success: false, error: error.message };

  // Liaison contacts
  if (input.contact_ids?.length) {
    await supabase.from("action_contacts").insert(
      input.contact_ids.map(c => ({
        action_id: action.id, contact_id: c.id, role: c.role ?? null, attended: c.attended ?? true,
      }))
    );
  }

  // Liaison organisations
  if (input.organization_ids?.length) {
    await supabase.from("action_organizations").insert(
      input.organization_ids.map(o => ({
        action_id: action.id, organization_id: o.id, role: o.role ?? null,
      }))
    );
  }

  // Sync GCal (meeting, call, deadline, task — pas note ni email)
  const syncTypes = ["meeting", "call", "deadline", "task", "document_request"];
  if (syncTypes.includes(input.type) && (input.due_date || input.start_datetime)) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const descParts = [input.description, input.agenda_notes, input.meet_link ? `Meet : ${input.meet_link}` : ""].filter(Boolean);

    // Résoudre les emails des participants pour les inclure en tant qu'attendees GCal
    let attendees: { email: string; displayName?: string }[] = [];
    if (input.contact_ids?.length) {
      const { data: contactsData } = await supabase
        .from("contacts")
        .select("id, email, first_name, last_name")
        .in("id", input.contact_ids.map(c => c.id))
        .eq("user_id", user.id);
      attendees = (contactsData ?? [])
        .filter(c => c.email)
        .map(c => ({
          email: c.email as string,
          displayName: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || undefined,
        }));
    }

    syncToGCal({
      action: "create", source_type: "activity", source_id: action.id,
      event: {
        summary: input.title,
        description: descParts.join("\n\n") || undefined,
        start: input.start_datetime ?? input.due_date ?? "",
        end: input.end_datetime ?? input.start_datetime ?? input.due_date ?? "",
        allDay: input.is_all_day ?? !input.start_datetime,
        sourceUrl: input.deal_id ? `${baseUrl}/protected/dossiers/${input.deal_id}` : `${baseUrl}/protected/agenda`,
        attendees,
      },
    });
  }

  revalidatePath("/protected");
  revalidatePath("/protected/agenda");
  revalidatePath("/protected/dossiers");
  revalidatePath("/protected/organisations");
  revalidatePath("/protected/contacts");
  revalidatePath("/protected/mandats");
  if (input.deal_id) revalidatePath(`/protected/dossiers/${input.deal_id}`);
  if (input.organization_id) revalidatePath(`/protected/organisations/${input.organization_id}`);
  return { success: true, id: action.id };
}

export async function updateAction(id: string, input: Partial<ActionInput>): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const fields: (keyof ActionInput)[] = [
    "type", "status", "priority", "title", "description", "notes",
    "due_date", "due_time", "is_all_day", "start_datetime", "end_datetime",
    "duration_minutes", "hard_deadline", "reminder_days",
    "location", "meet_link", "phone_number", "agenda_notes",
    "gmail_thread_id", "gmail_message_id", "email_subject", "email_direction",
    "document_url",
    "deal_id", "organization_id", "mandate_id",
  ];
  for (const f of fields) {
    if ((input as Record<string, unknown>)[f] !== undefined) payload[f] = (input as Record<string, unknown>)[f];
  }

  const { error } = await supabase.from("actions").update(payload).eq("id", id).eq("user_id", user.id);
  if (error) return { success: false, error: error.message };

  // Re-sync contacts
  if (input.contact_ids !== undefined) {
    await supabase.from("action_contacts").delete().eq("action_id", id);
    if (input.contact_ids.length > 0) {
      await supabase.from("action_contacts").insert(
        input.contact_ids.map(c => ({ action_id: id, contact_id: c.id, role: c.role ?? null, attended: c.attended ?? true }))
      );
    }
  }

  // Re-sync organizations
  if (input.organization_ids !== undefined) {
    await supabase.from("action_organizations").delete().eq("action_id", id);
    if (input.organization_ids.length > 0) {
      await supabase.from("action_organizations").insert(
        input.organization_ids.map(o => ({ action_id: id, organization_id: o.id, role: o.role ?? null }))
      );
    }
  }

  // Sync GCal update
  const effectiveDate = (input.start_datetime ?? input.due_date) as string | undefined;
  if (effectiveDate) {
    // Récupérer les attendees actuels (post re-sync action_contacts) pour
    // les transmettre à l'événement GCal mis à jour
    const { data: contactRows } = await supabase
      .from("action_contacts")
      .select("contacts:contact_id(email, first_name, last_name)")
      .eq("action_id", id);
    type ContactJoin = { email: string | null; first_name: string | null; last_name: string | null };
    const attendees = (contactRows ?? [])
      .map(r => (r as unknown as { contacts: ContactJoin }).contacts)
      .filter((c): c is ContactJoin => !!c?.email)
      .map(c => ({
        email: c.email as string,
        displayName: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || undefined,
      }));

    syncToGCal({
      action: "update", source_type: "activity", source_id: id,
      event: {
        summary: (input.title as string) ?? "",
        start: effectiveDate, end: (input.end_datetime ?? effectiveDate) as string,
        allDay: (input.is_all_day as boolean) ?? !input.start_datetime,
        attendees,
      },
    });
  }

  revalidatePath("/protected");
  revalidatePath("/protected/agenda");
  revalidatePath("/protected/dossiers");
  revalidatePath("/protected/organisations");
  revalidatePath("/protected/contacts");
  revalidatePath("/protected/mandats");
  if (input.deal_id) revalidatePath(`/protected/dossiers/${input.deal_id}`);
  if (input.organization_id) revalidatePath(`/protected/organisations/${input.organization_id}`);
  return { success: true };
}

export async function deleteAction(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  // Récupérer les liens parents avant suppression pour cibler les revalidations
  const { data: existing } = await supabase
    .from("actions")
    .select("deal_id, organization_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  // Sync GCal delete
  syncToGCal({
    action: "delete", source_type: "activity", source_id: id,
    event: { summary: "", start: "", end: "", allDay: true },
  });

  const { error } = await supabase.from("actions").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/protected");
  revalidatePath("/protected/agenda");
  revalidatePath("/protected/dossiers");
  revalidatePath("/protected/organisations");
  revalidatePath("/protected/contacts");
  revalidatePath("/protected/mandats");
  if (existing?.deal_id) revalidatePath(`/protected/dossiers/${existing.deal_id}`);
  if (existing?.organization_id) revalidatePath(`/protected/organisations/${existing.organization_id}`);
  return { success: true };
}

export async function completeAction(id: string, notes?: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  // Déterminer le statut de completion selon le type + lire les liens parents
  const { data: action } = await supabase.from("actions").select("type, deal_id, organization_id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!action) return { success: false, error: "Action introuvable" };

  const completedStatus: Record<string, string> = {
    task: "done", call: "completed", meeting: "completed",
    deadline: "met", document_request: "done", note: "done", email: "sent",
  };

  const payload: Record<string, unknown> = {
    status: completedStatus[action.type] ?? "done",
    updated_at: new Date().toISOString(),
  };
  if (notes) payload.notes = notes;

  const { error } = await supabase.from("actions").update(payload).eq("id", id).eq("user_id", user.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/protected");
  revalidatePath("/protected/agenda");
  revalidatePath("/protected/dossiers");
  revalidatePath("/protected/organisations");
  revalidatePath("/protected/contacts");
  revalidatePath("/protected/mandats");
  if (action.deal_id) revalidatePath(`/protected/dossiers/${action.deal_id}`);
  if (action.organization_id) revalidatePath(`/protected/organisations/${action.organization_id}`);
  return { success: true };
}

// ── Google Meet ───────────────────────────────────────────────────────────────

export async function generateMeetLinkAction(
  startDatetime?: string,
  durationMinutes?: number,
): Promise<{ success: boolean; meet_link?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const link = await generateMeetLink(user.id, startDatetime, durationMinutes);
  if (!link) return { success: false, error: "Impossible de générer le lien Meet. Vérifiez la connexion Google Calendar." };
  return { success: true, meet_link: link };
}

// ── Résumé IA ─────────────────────────────────────────────────────────────────

export async function generateActionSummaryAction(actionId: string): Promise<{ success: boolean; summary?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { data: action } = await supabase
    .from("actions")
    .select(`
      *,
      action_contacts(contact_id, role, contacts:contact_id(first_name, last_name)),
      action_organizations(organization_id, role, organizations:organization_id(name))
    `)
    .eq("id", actionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!action) return { success: false, error: "Action introuvable" };

  const summary = await generateActionSummary({
    type: action.type,
    title: action.title,
    start_datetime: action.start_datetime,
    due_date: action.due_date,
    notes: action.notes,
    contacts: (action.action_contacts ?? []).map((c: { contacts: { first_name: string; last_name: string }; role: string | null }) => ({
      name: `${c.contacts.first_name} ${c.contacts.last_name}`,
      role: c.role ?? undefined,
    })),
    organizations: (action.action_organizations ?? []).map((o: { organizations: { name: string }; role: string | null }) => ({
      name: o.organizations.name,
      role: o.role ?? undefined,
    })),
  });

  if (!summary) return { success: false, error: "Erreur lors de la génération du résumé IA" };

  await supabase.from("actions").update({ summary_ai: summary, updated_at: new Date().toISOString() }).eq("id", actionId);

  revalidatePath("/protected/agenda");
  return { success: true, summary };
}
