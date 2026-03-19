"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function toNullableString(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim(); return s ? s : null;
}

function normalize(v: string) { return v.trim().toLowerCase(); }

export async function addContactToOrgAction(formData: FormData) {
  const supabase = await createClient();
  const orgId = String(formData.get("org_id") ?? "").trim();
  if (!orgId) throw new Error("Organisation manquante.");

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  const mode = String(formData.get("contact_mode") ?? "existing").trim();

  let contactId: string;

  if (mode === "existing") {
    contactId = String(formData.get("contact_id") ?? "").trim();
    if (!contactId) throw new Error("Merci de sélectionner un contact.");

    const { data: existing } = await supabase.from("organization_contacts")
      .select("contact_id").eq("organization_id", orgId).eq("contact_id", contactId).maybeSingle();
    if (existing) throw new Error("Ce contact est déjà lié à cette organisation.");

  } else {
    // Créer un nouveau contact
    const firstName = String(formData.get("first_name") ?? "").trim();
    const lastName = String(formData.get("last_name") ?? "").trim();
    if (!firstName || !lastName) throw new Error("Prénom et nom obligatoires.");

    const email = toNullableString(formData.get("email"));

    // Vérifier doublon email
    if (email) {
      const { data: dupEmail } = await supabase.from("contacts")
        .select("id").ilike("email", email).limit(1).maybeSingle();
      if (dupEmail) throw new Error(`Un contact avec l'email ${email} existe déjà.`);
    }

    const { data: newContact, error: contactError } = await supabase.from("contacts").insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone: toNullableString(formData.get("phone")),
      title: toNullableString(formData.get("title")),
      linkedin_url: toNullableString(formData.get("linkedin_url")),
      base_status: "active",
      user_id: userId,
    }).select("id").single();

    if (contactError) throw new Error(contactError.message);
    contactId = newContact.id;
  }

  const { error } = await supabase.from("organization_contacts").insert({
    organization_id: orgId,
    contact_id: contactId,
    role_label: toNullableString(formData.get("role_label")),
    is_primary: formData.get("is_primary") === "on",
    user_id: userId,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/protected/organisations/${orgId}`);
  revalidatePath("/protected/contacts");
  redirect(`/protected/organisations/${orgId}`);
}
