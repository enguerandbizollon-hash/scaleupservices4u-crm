"use server";

/**
 * actions/ai/extract-document.ts — Server Action analyse IA d'un document.
 *
 * Pipeline :
 *   1. Lit `ma_documents` pour récupérer storage_path + métadonnées
 *   2. Télécharge le PDF depuis Supabase Storage (bucket: deal-documents)
 *   3. Appelle `extractDataFromPdf` (Claude Sonnet 4 tool_use)
 *   4. Persiste dans `ma_documents` : ai_extracted_data, ai_summary,
 *      ai_processed_at, ai_confidence_score
 *   5. Si financial_years extraites : upsert dans `financial_data`
 *      (1 row par (deal_id, fiscal_year)), source = 'ai'
 *
 * RLS : utilise createClient() SSR — le user n'extrait que ses propres docs.
 * Storage : URL signée pour éviter d'exposer publiquement.
 */

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  extractDataFromPdf,
  type ExtractedFinancialYear,
} from "@/lib/ai/document-extraction";

// Doit rester aligné sur BUCKET de lib/storage/documents.ts (lieu d'upload)
const STORAGE_BUCKET = "deal-documents";

export interface ExtractDocumentResponse {
  success: boolean;
  summary?: string;
  confidence?: number;
  years_imported?: number;
  inconsistencies?: string[];
  error?: string;
}

export async function extractDocumentAction(
  documentId: string,
): Promise<ExtractDocumentResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  // 1. Charger le document (RLS appliquée)
  const { data: doc, error: docErr } = await supabase
    .from("ma_documents")
    .select("id, deal_id, organization_id, document_type, file_name, storage_path, mime_type, fiscal_year")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (docErr || !doc) {
    return { success: false, error: docErr?.message ?? "Document introuvable" };
  }

  if (doc.mime_type && doc.mime_type !== "application/pdf") {
    return { success: false, error: "Seuls les PDF sont analysés (mime_type actuel : " + doc.mime_type + ")" };
  }

  if (!doc.storage_path) {
    return { success: false, error: "storage_path manquant sur le document" };
  }

  // 2. Télécharger le PDF depuis Supabase Storage
  const { data: blob, error: dlErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(doc.storage_path);

  if (dlErr || !blob) {
    return { success: false, error: dlErr?.message ?? "Téléchargement Storage échoué" };
  }

  const buffer = Buffer.from(await blob.arrayBuffer());

  // 3. Extraction IA
  const ctxHint = `Document type déclaré : ${doc.document_type ?? "inconnu"}. Fichier : ${doc.file_name ?? ""}.`;
  const extracted = await extractDataFromPdf({ pdfBuffer: buffer, contextHint: ctxHint });

  if (!extracted.ok || !extracted.data) {
    // On marque quand même la tentative dans ai_processed_at pour traçabilité
    await supabase.from("ma_documents").update({
      ai_processed_at: new Date().toISOString(),
      ai_summary: `Extraction échouée : ${extracted.error ?? "inconnu"}`,
    }).eq("id", documentId).eq("user_id", user.id);
    return { success: false, error: extracted.error ?? "Extraction IA échouée" };
  }

  const insights = extracted.data;

  // 4. Persistance sur ma_documents
  await supabase.from("ma_documents").update({
    ai_extracted_data: insights as unknown as Record<string, unknown>,
    ai_summary: insights.summary,
    ai_processed_at: new Date().toISOString(),
    ai_confidence_score: insights.confidence,
  }).eq("id", documentId).eq("user_id", user.id);

  // 5. Upsert dans financial_data pour chaque exercice (seulement si rattaché à un deal)
  let yearsImported = 0;
  if (doc.deal_id) {
    for (const year of insights.financial_years) {
      const imported = await upsertFinancialYear({
        userId: user.id,
        dealId: doc.deal_id,
        organizationId: doc.organization_id,
        year,
        sourceDocId: documentId,
        confidence: insights.confidence,
      });
      if (imported) yearsImported++;
    }
  }

  if (doc.deal_id) revalidatePath(`/protected/dossiers/${doc.deal_id}`);
  if (doc.organization_id) revalidatePath(`/protected/organisations/${doc.organization_id}`);

  return {
    success: true,
    summary: insights.summary,
    confidence: insights.confidence,
    years_imported: yearsImported,
    inconsistencies: insights.inconsistencies,
  };
}

// ── Upsert financial_data ────────────────────────────────────────────────────

async function upsertFinancialYear(params: {
  userId: string;
  dealId: string;
  organizationId: string | null;
  year: ExtractedFinancialYear;
  sourceDocId: string;
  confidence: number;
}): Promise<boolean> {
  const supabase = await createClient();

  // On n'enregistre que si on a au moins une métrique exploitable
  const hasMetric =
    params.year.revenue != null ||
    params.year.ebitda != null ||
    params.year.arr != null ||
    params.year.net_debt != null ||
    params.year.headcount != null;
  if (!hasMetric) return false;

  // Chercher la ligne existante (deal_id, fiscal_year)
  const { data: existing } = await supabase
    .from("financial_data")
    .select("id")
    .eq("user_id", params.userId)
    .eq("deal_id", params.dealId)
    .eq("fiscal_year", params.year.fiscal_year)
    .maybeSingle();

  // Ne JAMAIS écraser une valeur déjà saisie manuellement : on n'envoie
  // que les colonnes que l'IA a remplies. Si existing a déjà une valeur
  // non-null, on garde la sienne (UPDATE avec COALESCE côté Postgres).
  // Stratégie pragmatique côté code : on lit l'existant, on ne push que
  // les champs où l'existant est null.
  const payload: Record<string, unknown> = {
    user_id: params.userId,
    deal_id: params.dealId,
    organization_id: params.organizationId,
    fiscal_year: params.year.fiscal_year,
    period_type: "annual",
    currency: params.year.currency ?? "EUR",
    source: "ai",
    external_id: params.sourceDocId,
    ai_extracted: true,
    ai_confidence_score: params.confidence,
    imported_at: new Date().toISOString(),
  };

  const numericFields: (keyof ExtractedFinancialYear)[] = [
    "revenue", "gross_profit", "gross_margin", "ebitda", "ebitda_margin",
    "ebit", "net_income", "total_assets", "net_debt", "equity", "cash",
    "revenue_growth", "ebitda_growth", "headcount",
    "arr", "mrr", "nrr", "churn_rate", "ltv", "cac",
    "addback_owner_compensation", "addback_exceptional_charges",
    "addback_property_rent", "addback_one_off_fees", "addback_other",
  ];
  const textFields: (keyof ExtractedFinancialYear)[] = ["addback_notes"];

  if (existing) {
    // Update : ne push QUE les champs vides en base
    const allFields = [...numericFields, ...textFields];
    const { data: current } = await supabase
      .from("financial_data")
      .select(allFields.join(","))
      .eq("id", existing.id)
      .maybeSingle();
    if (!current) return false;
    for (const f of allFields) {
      const cur = (current as unknown as Record<string, unknown>)[f];
      const newVal = params.year[f];
      if ((cur === null || cur === undefined) && newVal != null) {
        payload[f] = newVal;
      }
    }
    await supabase.from("financial_data").update(payload).eq("id", existing.id);
  } else {
    // Insert : on push tout ce qui est défini
    for (const f of [...numericFields, ...textFields]) {
      const v = params.year[f];
      if (v != null) payload[f] = v;
    }
    await supabase.from("financial_data").insert(payload);
  }

  return true;
}
