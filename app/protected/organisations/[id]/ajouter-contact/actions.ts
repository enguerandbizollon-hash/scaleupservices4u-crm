"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function toNullableString(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim(); return s ? s : null;
}

export async function addContactToOrgAction(formData: FormData) {
  const supabase = await createClient();
  const orgId = String(formData.get("org_id") ?? "").trim();
  const contactId = String(formData.get("contact_id") ?? "").trim();
  if (!orgId || !contactId) throw new Error("Organisation et contact obligatoires.");
  const { data: { user } } = await supabase.auth.getUser();

  // Vérifier doublon
  const { data: existing } = await supabase.from("organization_contacts")
    .select("contact_id").eq("organization_id", orgId).eq("contact_id", contactId).maybeSingle();
  if (existing) throw new Error("Ce contact est déjà lié à cette organisation.");

  const { error } = await supabase.from("organization_contacts").insert({
    organization_id: orgId, contact_id: contactId,
    role_label: toNullableString(formData.get("role_label")),
    is_primary: formData.get("is_primary") === "on",
    user_id: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/protected/organisations/${orgId}`);
  redirect(`/protected/organisations/${orgId}`);
}
