// Helpers Supabase Storage pour le bucket `deal-documents`.
// Convention de path : {user_id}/{deal_id}/{doc_uuid}_{filename}
// RLS côté bucket : auth.uid() doit être le premier segment du path.

import { createClient as createBrowserClient } from "@/lib/supabase/client";

const BUCKET = "deal-documents";

export interface UploadResult {
  success: true;
  path: string;
  size: number;
  mime: string;
}

export interface UploadError {
  success: false;
  error: string;
}

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les diacritiques (accents)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

/**
 * Upload un fichier vers le bucket deal-documents.
 * Retourne le chemin complet à stocker dans ma_documents.storage_path.
 */
export async function uploadDealDocument(
  file: File,
  dealId: string,
): Promise<UploadResult | UploadError> {
  const supabase = createBrowserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const docUuid = crypto.randomUUID();
  const path = `${user.id}/${dealId}/${docUuid}_${sanitizeFilename(file.name)}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) return { success: false, error: error.message };
  return { success: true, path, size: file.size, mime: file.type || "application/octet-stream" };
}

/**
 * Génère une URL signée temporaire pour télécharger un document.
 * Valide 1 heure par défaut.
 */
export async function getDocumentSignedUrl(
  path: string,
  expiresInSeconds: number = 3600,
): Promise<{ url: string } | { error: string }> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) return { error: error?.message ?? "URL signée indisponible" };
  return { url: data.signedUrl };
}

/**
 * Supprime un fichier du bucket. Utilisé lors du delete hard d'un document.
 */
export async function deleteDealDocumentFile(path: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createBrowserClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
