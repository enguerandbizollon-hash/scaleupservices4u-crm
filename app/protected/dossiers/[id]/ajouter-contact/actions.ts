"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function toNullableString(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim(); return s ? s : null;
}

export async function addContactToDealAction(formData: FormData) {
  const supabase = await createClient();
  const dealId = String(formData.get("deal_id") ?? "").trim();
  const contactId = String(formData.get("contact_id") ?? "").trim();
  if (!dealId || !contactId) throw new Error("Dossier et contact obligatoires.");
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("deal_contacts").insert({
    deal_id: dealId,
    contact_id: contactId,
    role_in_deal: toNullableString(formData.get("role_in_deal")),
    status_in_deal: toNullableString(formData.get("status_in_deal")),
    user_id: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/protected/dossiers/${dealId}`);
  redirect(`/protected/dossiers/${dealId}`);
}
