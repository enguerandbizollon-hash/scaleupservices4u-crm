"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function toNullableString(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim(); return s ? s : null;
}

export async function updateDocumentAction(formData: FormData) {
  const supabase = await createClient();
  const docId = String(formData.get("doc_id") ?? "").trim();
  const dealId = String(formData.get("deal_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!name || !docId) throw new Error("Nom obligatoire.");

  const { error } = await supabase.from("deal_documents").update({
    name,
    document_type: toNullableString(formData.get("document_type")),
    document_status: String(formData.get("document_status") ?? "received").trim(),
    document_url: toNullableString(formData.get("document_url")),
    version_label: toNullableString(formData.get("version_label")),
    note: toNullableString(formData.get("note")),
  }).eq("id", docId);

  if (error) throw new Error(error.message);
  revalidatePath(`/protected/dossiers/${dealId}`);
  redirect(`/protected/dossiers/${dealId}`);
}

export async function deleteDocumentAction(formData: FormData) {
  const supabase = await createClient();
  const docId = String(formData.get("doc_id") ?? "").trim();
  const dealId = String(formData.get("deal_id") ?? "").trim();
  const { error } = await supabase.from("deal_documents").delete().eq("id", docId);
  if (error) throw new Error(error.message);
  revalidatePath(`/protected/dossiers/${dealId}`);
  redirect(`/protected/dossiers/${dealId}`);
}
