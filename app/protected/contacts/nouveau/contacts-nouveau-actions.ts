"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function toNullableString(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str ? str : null;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export async function createContactAction(formData: FormData) {
  const supabase = await createClient();

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const organizationId = String(formData.get("organization_id") ?? "").trim();

  if (!firstName || !lastName) {
    throw new Error("Le prénom et le nom sont obligatoires.");
  }

  const email = emailRaw || null;

  if (email) {
    const normalizedEmail = normalize(email);
    const { data: existingContacts, error: checkError } = await supabase
      .from("contacts")
      .select("id,email")
      .ilike("email", email)
      .limit(5);

    if (checkError) throw new Error(checkError.message);

    const exactDuplicate = (existingContacts ?? []).find(
      (contact) => contact.email && normalize(contact.email) === normalizedEmail
    );

    if (exactDuplicate) {
      throw new Error("Un contact avec cet email existe déjà.");
    }
  }

  const { data: { user } } = await supabase.auth.getUser();

  const payload = {
    first_name: firstName,
    last_name: lastName,
    email,
    phone: toNullableString(formData.get("phone")),
    title: toNullableString(formData.get("title")),
    linkedin_url: toNullableString(formData.get("linkedin_url")),
    sector: toNullableString(formData.get("sector")),
    investment_ticket_label: toNullableString(formData.get("investment_ticket_label")),
    country: toNullableString(formData.get("country")),
    notes: toNullableString(formData.get("notes")),
    base_status: String(formData.get("base_status") ?? "active").trim() || "active",
    first_contact_at: toNullableString(formData.get("first_contact_at")),
    last_contact_at: toNullableString(formData.get("last_contact_at")),
    next_follow_up_at: toNullableString(formData.get("next_follow_up_at")),
    user_id: user?.id ?? null,
  };

  const { data: insertedContact, error: insertError } = await supabase
    .from("contacts")
    .insert(payload)
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);

  if (organizationId) {
    const { error: relationError } = await supabase.from("organization_contacts").insert({
      organization_id: organizationId,
      contact_id: insertedContact.id,
      role_label: toNullableString(formData.get("role_label")),
      is_primary: formData.get("is_primary") === "on",
    });
    if (relationError) throw new Error(relationError.message);
  }

  redirect("/protected/contacts");
}
