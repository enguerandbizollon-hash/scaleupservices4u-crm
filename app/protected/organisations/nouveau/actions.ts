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

export async function createOrganizationAction(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const organizationType = String(formData.get("organization_type") ?? "").trim();
  const baseStatus = String(formData.get("base_status") ?? "").trim();

  if (!name) {
    throw new Error("Le nom de l’organisation est obligatoire.");
  }

  if (!organizationType || !baseStatus) {
    throw new Error("Merci de renseigner les champs obligatoires.");
  }

  const normalizedName = normalize(name);

  const { data: existingOrg, error: checkError } = await supabase
    .from("organizations")
    .select("id,name")
    .ilike("name", name)
    .limit(5);

  if (checkError) {
    throw new Error(checkError.message);
  }

  const exactDuplicate = (existingOrg ?? []).find(
    (org) => normalize(org.name) === normalizedName
  );

  if (exactDuplicate) {
    throw new Error("Une organisation avec ce nom existe déjà.");
  }

  const payload = {
    name,
    organization_type: organizationType,
    base_status: baseStatus,
    sector: toNullableString(formData.get("sector")),
    country: toNullableString(formData.get("country")),
    website: toNullableString(formData.get("website")),
    notes: toNullableString(formData.get("notes")),
  };

  const { error } = await supabase.from("organizations").insert(payload);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/protected/organisations");
}