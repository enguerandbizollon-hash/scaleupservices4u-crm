"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  TYPE_TO_CATEGORY,
  type DealDocumentRow,
  type CreateDocumentInput,
  type ReplaceDocumentInput,
  type UpdateDocumentMetaInput,
  type DocumentType,
} from "@/lib/crm/document-types";

// ═══════════════════════════════════════════════════════════════════════════
// Lecture
// ═══════════════════════════════════════════════════════════════════════════

export async function listDealDocuments(dealId: string): Promise<DealDocumentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ma_documents")
    .select("id,deal_id,document_type,category,document_status,file_url,file_name,file_size,mime_type,storage_path,fiscal_year,is_confidential,current_version_number,created_at")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });
  return (data ?? []) as DealDocumentRow[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Création — le fichier a déjà été uploadé côté client vers Storage
// ═══════════════════════════════════════════════════════════════════════════

export async function createDealDocument(
  input: CreateDocumentInput,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const category = TYPE_TO_CATEGORY[input.document_type] ?? "operation";

  const { data, error } = await supabase.from("ma_documents").insert({
    user_id: user.id,
    deal_id: input.deal_id,
    document_type: input.document_type,
    category,
    document_status: input.document_status ?? "final",
    file_url: input.file_url,
    file_name: input.file_name,
    file_size: input.file_size,
    mime_type: input.mime_type,
    storage_path: input.storage_path,
    fiscal_year: input.fiscal_year ?? null,
    is_confidential: input.is_confidential ?? true,
    current_version_number: 1,
    source: "manual",
  }).select("id").single();

  if (error) return { success: false, error: error.message };

  revalidatePath(`/protected/dossiers/${input.deal_id}`);
  return { success: true, id: data.id };
}

// ═══════════════════════════════════════════════════════════════════════════
// Remplacement — versioning : ancienne version archivée, nouvelle devient
// la version courante. storage_path mis à jour, current_version_number++.
// ═══════════════════════════════════════════════════════════════════════════

export async function replaceDealDocument(
  input: ReplaceDocumentInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  // 1. Lire le document actuel
  const { data: current, error: readErr } = await supabase
    .from("ma_documents")
    .select("id,deal_id,storage_path,file_url,file_name,file_size,current_version_number")
    .eq("id", input.doc_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (readErr) return { success: false, error: readErr.message };
  if (!current) return { success: false, error: "Document introuvable" };

  // 2. Archiver l'ancienne version dans document_versions
  const nextVersion = (current.current_version_number ?? 1) + 1;
  await supabase.from("document_versions").insert({
    user_id: user.id,
    document_id: current.id,
    version_number: current.current_version_number ?? 1,
    file_url: current.file_url,
    file_name: current.file_name,
    file_size: current.file_size,
    uploaded_by: user.id,
    upload_notes: input.upload_notes ?? null,
    is_current: false,
  });

  // 3. Mettre à jour ma_documents avec la nouvelle version courante
  const { error: updateErr } = await supabase
    .from("ma_documents")
    .update({
      storage_path: input.new_storage_path,
      file_url: input.new_file_url,
      file_name: input.new_file_name,
      file_size: input.new_file_size,
      mime_type: input.new_mime_type,
      current_version_number: nextVersion,
    })
    .eq("id", input.doc_id)
    .eq("user_id", user.id);

  if (updateErr) return { success: false, error: updateErr.message };

  if (current.deal_id) revalidatePath(`/protected/dossiers/${current.deal_id}`);
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// Suppression — soft delete : on enlève la ligne ma_documents.
// Le fichier Storage n'est PAS supprimé (conservation pour audit/historique).
// ═══════════════════════════════════════════════════════════════════════════

export async function deleteDealDocument(
  docId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const { data: doc } = await supabase
    .from("ma_documents")
    .select("deal_id")
    .eq("id", docId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("ma_documents")
    .delete()
    .eq("id", docId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  if (doc?.deal_id) revalidatePath(`/protected/dossiers/${doc.deal_id}`);
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// Mise à jour metadata (statut, confidentialité, type, année)
// ═══════════════════════════════════════════════════════════════════════════

export async function updateDealDocumentMeta(
  input: UpdateDocumentMetaInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const patch: Record<string, unknown> = {};
  if (input.document_type !== undefined) {
    const dt = input.document_type as DocumentType;
    patch.document_type = dt;
    patch.category = TYPE_TO_CATEGORY[dt];
  }
  if (input.document_status !== undefined) patch.document_status = input.document_status;
  if (input.is_confidential !== undefined) patch.is_confidential = input.is_confidential;
  if (input.fiscal_year !== undefined) patch.fiscal_year = input.fiscal_year;

  const { data: doc, error } = await supabase
    .from("ma_documents")
    .update(patch)
    .eq("id", input.doc_id)
    .eq("user_id", user.id)
    .select("deal_id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };

  if (doc?.deal_id) revalidatePath(`/protected/dossiers/${doc.deal_id}`);
  return { success: true };
}
