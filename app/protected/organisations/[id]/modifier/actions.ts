"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function toNullableString(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str ? str : null;
}

export async function updateOrganizationAction(formData: FormData) {
  const supabase = await createClient();

  const orgId = String(formData.get("org_id") ?? "").trim();
  if (!orgId) throw new Error("Identifiant organisation manquant.");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Le nom est obligatoire.");

  const payload = {
    name,
    organization_type: String(formData.get("organization_type") ?? "").trim(),
    base_status: String(formData.get("base_status") ?? "active").trim(),
    sector: toNullableString(formData.get("sector")),
    country: toNullableString(formData.get("country")),
    website: toNullableString(formData.get("website")),
    notes: toNullableString(formData.get("notes")),
  };

  const { data: updated, error } = await supabase
    .from("organizations")
    .update(payload)
    .eq("id", orgId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Erreur mise à jour: ${error.message}`);
  if (!updated) throw new Error("Aucune organisation mise à jour. Vérifie la policy RLS UPDATE.");

  revalidatePath("/protected/organisations");
  redirect("/protected/organisations");
}
