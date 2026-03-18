"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function toNullableString(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str ? str : null;
}

export async function createEventAction(formData: FormData) {
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Le titre est obligatoire.");

  const dealId = toNullableString(formData.get("deal_id"));
  if (!dealId) throw new Error("Le dossier est obligatoire.");

  const payload = {
    title,
    deal_id: dealId,
    event_type: String(formData.get("event_type") ?? "meeting").trim(),
    starts_at: toNullableString(formData.get("starts_at")),
    ends_at: toNullableString(formData.get("ends_at")),
    location: toNullableString(formData.get("location")),
    meet_link: toNullableString(formData.get("meet_link")),
    description: toNullableString(formData.get("description")),
    status: "scheduled",
  };

  const { error } = await supabase.from("agenda_events").insert(payload);
  if (error) throw new Error(error.message);

  revalidatePath("/protected/agenda");
  redirect("/protected/agenda");
}
