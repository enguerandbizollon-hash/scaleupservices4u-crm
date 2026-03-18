"use server";

import { redirect } from "next/navigation";
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

export async function createDealAction(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const dealType = String(formData.get("deal_type") ?? "").trim();
  const dealStatus = String(formData.get("deal_status") ?? "").trim();
  const dealStage = String(formData.get("deal_stage") ?? "").trim();
  const priorityLevel = String(formData.get("priority_level") ?? "").trim();
  const clientOrganizationId = String(
    formData.get("client_organization_id") ?? ""
  ).trim();

  if (!name) {
    throw new Error("Le nom du dossier est obligatoire.");
  }

  if (!dealType || !dealStatus || !dealStage || !priorityLevel) {
    throw new Error("Merci de renseigner les champs obligatoires du dossier.");
  }

  if (!clientOrganizationId) {
    throw new Error("Merci de sélectionner une organisation liée.");
  }

  const payload = {
    name,
    deal_type: dealType,
    deal_status: dealStatus,
    deal_stage: dealStage,
    priority_level: priorityLevel,
    client_organization_id: clientOrganizationId,
    sector: toNullableString(formData.get("sector")),
    valuation_amount: toNullableNumber(formData.get("valuation_amount")),
    fundraising_amount: toNullableNumber(formData.get("fundraising_amount")),
    description: toNullableString(formData.get("description")),
    start_date: toNullableString(formData.get("start_date")),
    target_date: toNullableString(formData.get("target_date")),
  };

  const { error } = await supabase.from("deals").insert(payload);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/protected/dossiers");
}