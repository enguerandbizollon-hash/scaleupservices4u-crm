"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function toNullableString(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str ? str : null;
}

export async function createDocumentAction(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const dealId = toNullableString(formData.get("deal_id"));

  if (!name) throw new Error("Le nom du document est obligatoire.");
  if (!dealId) throw new Error("Le dossier est obligatoire.");

  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("deal_documents").insert({
    name,
    deal_id: dealId,
    document_type: toNullableString(formData.get("document_type")),
    document_status: String(formData.get("document_status") ?? "received").trim(),
    document_url: toNullableString(formData.get("document_url")),
    version_label: toNullableString(formData.get("version_label")),
    note: toNullableString(formData.get("note")),
    user_id: user?.id ?? null,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/protected/documents");
  revalidatePath(`/protected/dossiers/${dealId}`);
  redirect("/protected/documents");
}
