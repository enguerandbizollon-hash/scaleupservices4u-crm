"use server";

/**
 * actions/ai/cadrage.ts — Fiche de cadrage buy-side (Server Actions).
 *
 * extractCadrageAction : télécharge le PDF (ma_documents + Storage), l'IA en
 * extrait les critères (cadrage-engine), le résultat est PROPOSÉ et porté par
 * le dossier (deals.cadrage_content). Rien n'est appliqué à ce stade.
 *
 * applyCadrageToMandate : au geste d'Enguérand, applique le cadrage —
 * critères ma_buy du dossier + une chasse rattachée pré-remplie (une seule
 * « chasse de cadrage » par mandat, réutilisée si déjà là). Propose/dispose.
 */

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { extractCadrageFromPdf, type CadrageContent } from "@/lib/ai/cadrage-engine";
import { cadrageToDealPatch, cadrageToChasseFilters, cadrageChasseName } from "@/lib/crm/cadrage-map";
import { refreshBuyQualificationScore } from "@/actions/screening";

const STORAGE_BUCKET = "deal-documents";

/** PDF du mandat, candidats à l'analyse comme fiche de cadrage. */
export async function listCadrageCandidates(dealId: string): Promise<{ id: string; file_name: string | null }[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("ma_documents")
    .select("id, file_name, mime_type")
    .eq("user_id", user.id)
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });
  return (data ?? [])
    .filter((d) => !d.mime_type || d.mime_type === "application/pdf")
    .map((d) => ({ id: d.id as string, file_name: (d.file_name as string | null) ?? null }));
}

export interface ExtractCadrageResponse {
  success: boolean;
  content?: CadrageContent;
  error?: string;
}

export async function extractCadrageAction(documentId: string): Promise<ExtractCadrageResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const { data: doc } = await supabase
    .from("ma_documents")
    .select("id, deal_id, file_name, storage_path, mime_type")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!doc) return { success: false, error: "Document introuvable" };
  if (!doc.deal_id) return { success: false, error: "Ce document n'est pas rattaché à un mandat." };
  if (doc.mime_type && doc.mime_type !== "application/pdf") {
    return { success: false, error: "Seuls les PDF sont analysés." };
  }
  if (!doc.storage_path) return { success: false, error: "storage_path manquant sur le document." };

  const { data: blob, error: dlErr } = await supabase.storage.from(STORAGE_BUCKET).download(doc.storage_path);
  if (dlErr || !blob) return { success: false, error: dlErr?.message ?? "Téléchargement Storage échoué." };
  const buffer = Buffer.from(await blob.arrayBuffer());

  const res = await extractCadrageFromPdf({
    pdfBuffer: buffer,
    contextHint: `Fiche de cadrage d'un repreneur (buy-side). Fichier : ${doc.file_name ?? ""}.`,
  });
  if (!res.ok || !res.data) return { success: false, error: res.error ?? "Extraction IA échouée." };

  await supabase
    .from("deals")
    .update({
      cadrage_content: res.data as unknown as Record<string, unknown>,
      cadrage_generated_at: new Date().toISOString(),
    })
    .eq("id", doc.deal_id)
    .eq("user_id", user.id);

  // La fiche importée compte dans la qualification : le score persisté suit.
  await refreshBuyQualificationScore(doc.deal_id);

  revalidatePath(`/protected/dossiers/${doc.deal_id}`);
  return { success: true, content: res.data };
}

/**
 * Extraction STATELESS depuis un fichier uploadé, AVANT que le mandat existe
 * (wizard de création). Ne touche ni Storage, ni ma_documents, ni deals :
 * renvoie juste le CadrageContent pour pré-remplir le wizard. Le PDF pourra
 * être re-uploadé proprement en document après création si besoin.
 */
export async function extractCadrageFromUploadAction(formData: FormData): Promise<ExtractCadrageResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { success: false, error: "Aucun fichier fourni." };
  if (file.type && file.type !== "application/pdf") return { success: false, error: "Seuls les PDF sont analysés." };
  if (file.size > 30 * 1024 * 1024) return { success: false, error: "PDF trop volumineux (> 30 Mo)." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const res = await extractCadrageFromPdf({
    pdfBuffer: buffer,
    contextHint: `Fiche de cadrage d'un repreneur (buy-side). Fichier : ${file.name}.`,
  });
  if (!res.ok || !res.data) return { success: false, error: res.error ?? "Extraction IA échouée." };
  return { success: true, content: res.data };
}

export interface ApplyCadrageResponse {
  success: boolean;
  chasse_id?: string;
  fields_written?: number;
  error?: string;
}

export async function applyCadrageToMandate(dealId: string): Promise<ApplyCadrageResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const { data: deal } = await supabase
    .from("deals")
    .select("id, name, deal_type, cadrage_content")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!deal) return { success: false, error: "Mandat introuvable" };
  if (deal.deal_type !== "ma_buy") {
    return { success: false, error: "La fiche de cadrage ne s'applique qu'à un mandat d'acquisition." };
  }
  if (!deal.cadrage_content) return { success: false, error: "Analysez d'abord la fiche de cadrage." };

  const content = deal.cadrage_content as unknown as CadrageContent;
  const patch = cadrageToDealPatch(content);

  // 1. Critères ma_buy du dossier (uniquement ceux présents dans la fiche).
  if (Object.keys(patch).length > 0) {
    await supabase.from("deals").update(patch).eq("id", dealId).eq("user_id", user.id);
    // Les critères comptent dans la qualification : le score persisté suit.
    await refreshBuyQualificationScore(dealId);
  }

  // 2. Chasse rattachée pré-remplie. Une seule « chasse de cadrage » par
  //    mandat : on met à jour celle déjà liée, sinon on en crée une.
  const filters = cadrageToChasseFilters(content);
  const name = cadrageChasseName(content, deal.name);
  const { data: existing } = await supabase
    .from("screening_profiles")
    .select("id")
    .eq("deal_id", dealId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let chasseId: string;
  if (existing) {
    await supabase
      .from("screening_profiles")
      .update({ name, filters, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .eq("user_id", user.id);
    chasseId = existing.id as string;
  } else {
    const { data: created, error } = await supabase
      .from("screening_profiles")
      // watch_enabled : une chasse de mandat naît VEILLÉE (la veille hebdo
      // remonte ses nouvelles cibles vers l'onglet Cibles du mandat).
      .insert({ user_id: user.id, name, filters, deal_id: dealId, watch_enabled: true })
      .select("id")
      .single();
    if (error || !created) return { success: false, error: error?.message ?? "Création de la chasse échouée." };
    chasseId = created.id as string;
  }

  revalidatePath(`/protected/dossiers/${dealId}`);
  revalidatePath("/protected/prospection");
  return { success: true, chasse_id: chasseId, fields_written: Object.keys(patch).length };
}
