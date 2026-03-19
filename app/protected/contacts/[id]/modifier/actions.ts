"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function toNullableString(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str ? str : null;
}

export async function updateContactAction(formData: FormData) {
  const supabase = await createClient();

  const contactId = String(formData.get("contact_id") ?? "").trim();
  if (!contactId) throw new Error("Identifiant contact manquant.");

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  if (!firstName || !lastName) throw new Error("Le prénom et le nom sont obligatoires.");

  const payload = {
    first_name: firstName,
    last_name: lastName,
    email: toNullableString(formData.get("email")),
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
  };

  const { data: updatedContact, error } = await supabase
    .from("contacts")
    .update(payload)
    .eq("id", contactId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Erreur mise à jour contact: ${error.message}`);
  if (!updatedContact) throw new Error("Aucun contact mis à jour. Vérifie la policy RLS UPDATE sur contacts.");

  const { data: { user } } = await supabase.auth.getUser();
  const organizationId = String(formData.get("organization_id") ?? "").trim();

  if (organizationId) {
    const { data: existing } = await supabase
      .from("organization_contacts")
      .select("contact_id")
      .eq("contact_id", contactId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!existing) {
      await supabase.from("organization_contacts").insert({
        organization_id: organizationId,
        contact_id: contactId,
        role_label: toNullableString(formData.get("role_label")),
        is_primary: formData.get("is_primary") === "on",
        user_id: user?.id ?? null,
      });
    }
  }

  revalidatePath("/protected/contacts");
  redirect("/protected/contacts");
}
