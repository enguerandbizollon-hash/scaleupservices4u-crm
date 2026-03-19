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

  if (!firstName || !lastName) throw new Error("Le prénom et le nom sont obligatoires.");

  const email = emailRaw || null;

  if (email) {
    const { data: existingContacts, error: checkError } = await supabase
      .from("contacts").select("id,email").ilike("email", email).limit(5);
    if (checkError) throw new Error(checkError.message);
    const dup = (existingContacts ?? []).find(c => c.email && normalize(c.email) === normalize(email));
    if (dup) throw new Error("Un contact avec cet email existe déjà.");
  }

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  const { data: insertedContact, error: insertError } = await supabase
    .from("contacts")
    .insert({
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
      user_id: userId,
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);

  // Gestion organisation
  const orgMode = String(formData.get("organization_mode") ?? "none").trim();
  let finalOrgId: string | null = null;

  if (orgMode === "existing") {
    finalOrgId = toNullableString(formData.get("organization_id"));
  }

  if (orgMode === "new") {
    const orgName = String(formData.get("new_org_name") ?? "").trim();
    if (orgName) {
      // Vérifier doublon
      const { data: existing } = await supabase.from("organizations")
        .select("id, name").ilike("name", orgName).limit(5);
      const dup = (existing ?? []).find(o => normalize(o.name) === normalize(orgName));

      if (dup) {
        finalOrgId = dup.id;
      } else {
        const { data: newOrg, error: orgError } = await supabase.from("organizations").insert({
          name: orgName,
          organization_type: String(formData.get("new_org_type") ?? "other").trim(),
          base_status: "active",
          country: toNullableString(formData.get("new_org_country")),
          website: toNullableString(formData.get("new_org_website")),
          sector: toNullableString(formData.get("new_org_sector")),
          user_id: userId,
        }).select("id").single();
        if (orgError) throw new Error(orgError.message);
        finalOrgId = newOrg.id;
      }
    }
  }

  if (finalOrgId) {
    const { error: relationError } = await supabase.from("organization_contacts").insert({
      organization_id: finalOrgId,
      contact_id: insertedContact.id,
      role_label: toNullableString(formData.get("role_label")),
      is_primary: formData.get("is_primary") === "on",
      user_id: userId,
    });
    if (relationError) throw new Error(relationError.message);
  }

  redirect("/protected/contacts");
}
