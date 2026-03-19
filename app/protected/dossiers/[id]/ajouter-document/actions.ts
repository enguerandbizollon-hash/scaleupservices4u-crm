"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function toNullableString(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim(); return s ? s : null;
}

export async function addDocumentAction(formData: FormData) {
  const supabase = await createClient();
  const dealId = String(formData.get("deal_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!name || !dealId) throw new Error("Nom et dossier obligatoires.");
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("deal_documents").insert({
    deal_id: dealId,
    name,
    document_type: toNullableString(formData.get("document_type")),
    document_status: String(formData.get("document_status") ?? "received").trim(),
    document_url: toNullableString(formData.get("document_url")),
    version_label: toNullableString(formData.get("version_label")),
    note: toNullableString(formData.get("note")),
    user_id: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/protected/dossiers/${dealId}`);
  redirect(`/protected/dossiers/${dealId}`);
}

export async function deleteDocumentAction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  const dealId = String(formData.get("deal_id") ?? "").trim();
  if (!id) throw new Error("ID manquant.");
  const { error } = await supabase.from("deal_documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/protected/dossiers/${dealId}`);
  redirect(`/protected/dossiers/${dealId}`);
}
