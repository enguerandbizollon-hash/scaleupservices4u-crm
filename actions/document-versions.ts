"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface DocumentVersionInput {
  document_id: string;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  upload_notes?: string | null;
}

/**
 * Ajoute une nouvelle version à un document existant.
 * L'ancienne version courante passe is_current=false.
 * La nouvelle passe is_current=true, version_number++.
 */
export async function addDocumentVersion(
  dealId: string,
  data: DocumentVersionInput,
): Promise<{ success: boolean; error?: string; version_number?: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  // Récupérer le current_version_number du document
  const { data: doc } = await supabase
    .from("deal_documents")
    .select("id, current_version_number")
    .eq("id", data.document_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!doc) return { success: false, error: "Document introuvable" };

  const newVersion = (doc.current_version_number ?? 0) + 1;

  // Marquer toutes les versions existantes comme non-courantes
  await supabase
    .from("document_versions")
    .update({ is_current: false })
    .eq("document_id", data.document_id)
    .eq("user_id", user.id);

  // Créer la nouvelle version
  const { error: vErr } = await supabase.from("document_versions").insert({
    user_id: user.id,
    document_id: data.document_id,
    version_number: newVersion,
    file_url: data.file_url ?? null,
    file_name: data.file_name ?? null,
    file_size: data.file_size ?? null,
    uploaded_by: user.id,
    upload_notes: data.upload_notes ?? null,
    is_current: true,
  });

  if (vErr) return { success: false, error: vErr.message };

  // Mettre à jour le document parent
  const updatePayload: Record<string, unknown> = {
    current_version_number: newVersion,
  };
  if (data.file_url) updatePayload.document_url = data.file_url;
  if (data.file_name) updatePayload.name = data.file_name;

  await supabase
    .from("deal_documents")
    .update(updatePayload)
    .eq("id", data.document_id)
    .eq("user_id", user.id);

  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true, version_number: newVersion };
}

/**
 * Récupère l'historique des versions d'un document.
 */
export async function getDocumentVersions(documentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("document_versions")
    .select("id, version_number, file_url, file_name, file_size, upload_notes, is_current, created_at")
    .eq("document_id", documentId)
    .eq("user_id", user.id)
    .order("version_number", { ascending: false });

  return data ?? [];
}

/**
 * Restaure une version antérieure comme version courante.
 */
export async function restoreDocumentVersion(
  dealId: string,
  documentId: string,
  versionId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  // Récupérer la version à restaurer
  const { data: version } = await supabase
    .from("document_versions")
    .select("version_number, file_url, file_name")
    .eq("id", versionId)
    .eq("document_id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!version) return { success: false, error: "Version introuvable" };

  // Marquer toutes comme non-courantes
  await supabase
    .from("document_versions")
    .update({ is_current: false })
    .eq("document_id", documentId)
    .eq("user_id", user.id);

  // Marquer la version restaurée comme courante
  await supabase
    .from("document_versions")
    .update({ is_current: true })
    .eq("id", versionId)
    .eq("user_id", user.id);

  // Mettre à jour le document parent
  await supabase
    .from("deal_documents")
    .update({
      document_url: version.file_url,
      name: version.file_name,
    })
    .eq("id", documentId)
    .eq("user_id", user.id);

  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true };
}
