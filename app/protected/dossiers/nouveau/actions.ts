"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function toNullableNumber(value: FormDataEntryValue | null) {
  if (!value) return null;
  const str = String(value).trim().replace(/\s/g, "").replace(",", ".");
  if (!str) return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

function toNullableString(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str ? str : null;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function getRequiredString(formData: FormData, key: string, errorMessage: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(errorMessage);
  return value;
}

async function resolveClientOrganizationId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  userId: string,
) {
  const organizationMode = String(formData.get("organization_mode") ?? "existing").trim();

  if (organizationMode === "existing") {
    const id = String(formData.get("client_organization_id") ?? "").trim();
    if (!id) throw new Error("Merci de sélectionner une organisation existante.");
    return id;
  }

  if (organizationMode === "new") {
    const orgName = getRequiredString(formData, "new_org_name", "Le nom de la nouvelle organisation est obligatoire.");
    const orgType = String(formData.get("new_org_type") ?? "client").trim();
    const orgStatus = String(formData.get("new_org_status") ?? "active").trim();

    const { data: existingOrgs, error: orgCheckError } = await supabase
      .from("organizations").select("id, name").ilike("name", orgName).limit(5);
    if (orgCheckError) throw new Error(orgCheckError.message);

    const exactDuplicate = (existingOrgs ?? []).find(o => normalize(o.name) === normalize(orgName));
    if (exactDuplicate) return exactDuplicate.id;

    const { data: insertedOrg, error: orgInsertError } = await supabase
      .from("organizations")
      .insert({
        name: orgName,
        organization_type: orgType,
        base_status: orgStatus,
        sector: toNullableString(formData.get("new_org_sector")),
        country: toNullableString(formData.get("new_org_country")),
        website: toNullableString(formData.get("new_org_website")),
        notes: toNullableString(formData.get("new_org_notes")),
        user_id: userId,
      })
      .select("id")
      .single();

    if (orgInsertError) throw new Error(orgInsertError.message);
    return insertedOrg.id;
  }

  throw new Error("Mode d'organisation invalide.");
}

async function buildDealPayload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
) {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? "";

  const clientOrganizationId = await resolveClientOrganizationId(supabase, formData, userId);

  return {
    name: getRequiredString(formData, "name", "Le nom du dossier est obligatoire."),
    deal_type: getRequiredString(formData, "deal_type", "Le type est obligatoire."),
    deal_status: getRequiredString(formData, "deal_status", "Le statut est obligatoire."),
    deal_stage: getRequiredString(formData, "deal_stage", "L'étape est obligatoire."),
    priority_level: getRequiredString(formData, "priority_level", "La priorité est obligatoire."),
    client_organization_id: clientOrganizationId,
    sector: toNullableString(formData.get("sector")),
    valuation_amount: toNullableNumber(formData.get("valuation_amount")),
    fundraising_amount: toNullableNumber(formData.get("fundraising_amount")),
    description: toNullableString(formData.get("description")),
    start_date: toNullableString(formData.get("start_date")),
    target_date: toNullableString(formData.get("target_date")),
    user_id: userId,
  };
}

export async function createDealAction(formData: FormData) {
  const supabase = await createClient();
  const payload = await buildDealPayload(supabase, formData);
  const { data: insertedDeal, error } = await supabase.from("deals").insert(payload).select("id").single();
  if (error) throw new Error(`Erreur création dossier: ${error.message}`);
  if (!insertedDeal?.id) throw new Error("Dossier créé sans ID.");
  revalidatePath("/protected/dossiers");
  redirect(`/protected/dossiers/${insertedDeal.id}`);
}

export async function updateDealAction(formData: FormData) {
  const supabase = await createClient();
  const dealId = getRequiredString(formData, "deal_id", "ID dossier obligatoire.");
  const payload = await buildDealPayload(supabase, formData);
  const { data: updatedDeal, error } = await supabase.from("deals").update(payload).eq("id", dealId).select("id").maybeSingle();
  if (error) throw new Error(`Erreur mise à jour: ${error.message}`);
  if (!updatedDeal) throw new Error("Aucun dossier mis à jour. Vérifie la RLS UPDATE.");
  revalidatePath("/protected/dossiers");
  revalidatePath(`/protected/dossiers/${dealId}`);
  redirect(`/protected/dossiers/${dealId}`);
}
