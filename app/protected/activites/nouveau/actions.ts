"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function toNullableString(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str ? str : null;
}

export async function createActivityAction(formData: FormData) {
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const activityType = String(formData.get("activity_type") ?? "note").trim();
  const dealId = toNullableString(formData.get("deal_id"));

  if (!title) throw new Error("Le titre est obligatoire.");
  if (!dealId) throw new Error("Le dossier est obligatoire.");

  const { data: { user } } = await supabase.auth.getUser();

  const today = new Date().toISOString().split("T")[0];

  const { error } = await supabase.from("activities").insert({
    title,
    activity_type: activityType,
    deal_id: dealId,
    contact_id: toNullableString(formData.get("contact_id")),
    organization_id: toNullableString(formData.get("organization_id")),
    summary: toNullableString(formData.get("summary")),
    activity_date: toNullableString(formData.get("activity_date")) ?? today,
    source: "manual",
    user_id: user?.id ?? null,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/protected/activites");
  if (dealId) revalidatePath(`/protected/dossiers/${dealId}`);
  redirect("/protected/activites");
}
