"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContactInput {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  sector?: string | null;
  linkedin_url?: string | null;
  base_status?: string;
  last_contact_date?: string | null;
  notes?: string | null;
  notes_internal?: string | null;
  do_not_contact?: boolean;
}

export type ContactActionResult =
  | { success: true; id: string }
  | { success: false; error: string };

// ── Contacts CRUD ─────────────────────────────────────────────────────────────

export async function createContact(data: ContactInput): Promise<ContactActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const first_name = data.first_name?.trim();
  const last_name  = data.last_name?.trim();
  if (!first_name || !last_name) return { success: false, error: "Prénom et nom obligatoires" };

  // Vérifier doublon par email
  if (data.email) {
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", data.email.toLowerCase().trim())
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) return { success: false, error: "Un contact avec cet email existe déjà" };
  }

  const { data: contact, error } = await supabase.from("contacts").insert({
    user_id:           user.id,
    first_name,
    last_name,
    email:             data.email          ? data.email.toLowerCase().trim() : null,
    phone:             data.phone?.trim()  ?? null,
    title:             data.title?.trim()  ?? null,
    sector:            data.sector?.trim() ?? null,
    linkedin_url:      data.linkedin_url?.trim() ?? null,
    base_status:       data.base_status    ?? "to_qualify",
    last_contact_date: data.last_contact_date ?? null,
    notes:             data.notes?.trim()  ?? null,
    notes_internal:    data.notes_internal?.trim() ?? null,
    do_not_contact:    data.do_not_contact ?? false,
  }).select("id").single();

  if (error) return { success: false, error: error.message };
  if (!contact?.id) return { success: false, error: "Erreur création contact" };

  revalidatePath("/protected/contacts");
  return { success: true, id: contact.id };
}

export async function updateContact(id: string, data: Partial<ContactInput>): Promise<ContactActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const payload: Record<string, unknown> = {};
  if (data.first_name      !== undefined) payload.first_name      = data.first_name?.trim()      || null;
  if (data.last_name       !== undefined) payload.last_name       = data.last_name?.trim()       || null;
  if (data.email           !== undefined) payload.email           = data.email ? data.email.toLowerCase().trim() : null;
  if (data.phone           !== undefined) payload.phone           = data.phone?.trim()           || null;
  if (data.title           !== undefined) payload.title           = data.title?.trim()           || null;
  if (data.sector          !== undefined) payload.sector          = data.sector?.trim()          || null;
  if (data.linkedin_url    !== undefined) payload.linkedin_url    = data.linkedin_url?.trim()    || null;
  if (data.base_status     !== undefined) payload.base_status     = data.base_status;
  if (data.last_contact_date !== undefined) payload.last_contact_date = data.last_contact_date  || null;
  if (data.notes           !== undefined) payload.notes           = data.notes?.trim()           || null;
  if (data.notes_internal  !== undefined) payload.notes_internal  = data.notes_internal?.trim() || null;
  if (data.do_not_contact  !== undefined) payload.do_not_contact  = data.do_not_contact;

  const { error } = await supabase.from("contacts")
    .update(payload).eq("id", id).eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/protected/contacts");
  revalidatePath(`/protected/contacts/${id}`);
  return { success: true, id };
}

export async function deleteContact(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase.from("contacts").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/protected/contacts");
  return { success: true };
}

export async function getAllContactsSimple(): Promise<{ id: string; first_name: string; last_name: string; email: string | null }[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email")
    .eq("user_id", user.id)
    .order("last_name");

  return (data ?? []) as { id: string; first_name: string; last_name: string; email: string | null }[];
}

export async function getContactById(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("contacts").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  return data;
}

/**
 * Upsert : retourne un contact existant (par email) ou en crée un nouveau.
 * Utile pour les imports et enrichissements.
 */
export async function upsertContact(data: ContactInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "Non autorisé" };

  const first_name = data.first_name?.trim();
  const last_name  = data.last_name?.trim();
  if (!first_name || !last_name) return { success: false as const, error: "Prénom et nom obligatoires" };

  // Chercher par email si fourni
  if (data.email) {
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", data.email.toLowerCase().trim())
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) return { success: true as const, id: existing.id, created: false };
  }

  const { data: contact, error } = await supabase.from("contacts").insert({
    user_id:      user.id,
    first_name,
    last_name,
    email:        data.email    ? data.email.toLowerCase().trim() : null,
    phone:        data.phone?.trim()  ?? null,
    title:        data.title?.trim()  ?? null,
    sector:       data.sector?.trim() ?? null,
    linkedin_url: data.linkedin_url?.trim() ?? null,
    base_status:  data.base_status ?? "to_qualify",
  }).select("id").single();

  if (error) return { success: false as const, error: error.message };
  revalidatePath("/protected/contacts");
  return { success: true as const, id: contact.id, created: true };
}

// ── Liaison contact ↔ organisation ───────────────────────────────────────────

export async function linkContactToOrganisation(
  contactId: string,
  organisationId: string,
  roleLabel?: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase.from("organization_contacts").upsert(
    { organization_id: organisationId, contact_id: contactId, user_id: user.id, role_label: roleLabel ?? null },
    { onConflict: "organization_id,contact_id" },
  );

  if (error) return { success: false, error: error.message };
  revalidatePath(`/protected/contacts/${contactId}`);
  revalidatePath(`/protected/organisations/${organisationId}`);
  return { success: true };
}

export async function unlinkContactFromOrganisation(contactId: string, organisationId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase.from("organization_contacts")
    .delete()
    .eq("contact_id", contactId)
    .eq("organization_id", organisationId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/protected/contacts/${contactId}`);
  revalidatePath(`/protected/organisations/${organisationId}`);
  return { success: true };
}
