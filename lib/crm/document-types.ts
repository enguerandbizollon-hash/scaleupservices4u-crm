// Types et constantes partagés pour les documents (ma_documents).
// Fichier séparé de actions/documents.ts qui est en "use server" et ne peut
// exporter que des async functions — toutes les constantes/types vivent ici.

export const DOCUMENT_TYPES = [
  "bilan", "pl", "business_plan", "organigramme", "teaser",
  "nda", "im", "dataroom", "cv", "presentation", "rapport", "autre",
] as const;

export type DocumentType = typeof DOCUMENT_TYPES[number];
export type DocumentCategory = "entreprise" | "operation";
export type DocumentStatus = "draft" | "review" | "final";

// Mapping type → catégorie par défaut
export const TYPE_TO_CATEGORY: Record<DocumentType, DocumentCategory> = {
  bilan: "entreprise",
  pl: "entreprise",
  business_plan: "entreprise",
  organigramme: "entreprise",
  presentation: "entreprise",
  rapport: "entreprise",
  teaser: "operation",
  nda: "operation",
  im: "operation",
  dataroom: "operation",
  cv: "operation",  // CV candidat — opération recrutement
  autre: "operation",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  bilan: "Bilan",
  pl: "Compte de résultat (P&L)",
  business_plan: "Business plan",
  organigramme: "Organigramme",
  teaser: "Teaser",
  nda: "NDA",
  im: "Information memorandum (IM)",
  dataroom: "Dataroom",
  cv: "CV",
  presentation: "Présentation",
  rapport: "Rapport",
  autre: "Autre",
};

// ── Shapes partagées entre Server Actions et UI ──────────────────────────────

export interface DealDocumentRow {
  id: string;
  deal_id: string | null;
  document_type: string | null;
  category: string | null;
  document_status: string | null;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  storage_path: string | null;
  fiscal_year: number | null;
  is_confidential: boolean;
  current_version_number: number;
  created_at: string;
}

export interface CreateDocumentInput {
  deal_id: string;
  document_type: DocumentType;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  file_url: string;
  fiscal_year?: number | null;
  document_status?: DocumentStatus;
  is_confidential?: boolean;
}

export interface ReplaceDocumentInput {
  doc_id: string;
  new_storage_path: string;
  new_file_url: string;
  new_file_name: string;
  new_file_size: number;
  new_mime_type: string;
  upload_notes?: string;
}

export interface UpdateDocumentMetaInput {
  doc_id: string;
  document_type?: DocumentType;
  document_status?: DocumentStatus;
  is_confidential?: boolean;
  fiscal_year?: number | null;
}
