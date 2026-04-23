"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, FileText, Download, Trash2, RefreshCw, Eye, EyeOff, Pencil } from "lucide-react";
import {
  listDealDocuments,
  createDealDocument,
  replaceDealDocument,
  deleteDealDocument,
  updateDealDocumentMeta,
} from "@/actions/documents";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  TYPE_TO_CATEGORY,
  type DealDocumentRow,
  type DocumentType,
  type DocumentStatus,
} from "@/lib/crm/document-types";
import {
  uploadDealDocument,
  getDocumentSignedUrl,
} from "@/lib/storage/documents";

// ── Types locaux ─────────────────────────────────────────────────────────────

interface Props {
  dealId: string;
  dealName: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  entreprise: "Documents entreprise",
  operation: "Documents opération",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  review: "À revoir",
  final: "Final",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

// ── Composant principal ──────────────────────────────────────────────────────

export function DocumentsTab({ dealId, dealName }: Props) {
  const [docs, setDocs] = useState<DealDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newDocType, setNewDocType] = useState<DocumentType>("bilan");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    const list = await listDealDocuments(dealId);
    setDocs(list);
    setLoading(false);
  }, [dealId]);

  useEffect(() => { void loadDocs(); }, [loadDocs]);

  // ── Upload nouveau document ───────────────────────────────────────────────
  async function handleUpload(file: File, docType: DocumentType) {
    setError(null);
    if (file.size > 50 * 1024 * 1024) {
      setError("Fichier trop lourd — 50 MB max.");
      return;
    }
    setUploading(true);
    const upRes = await uploadDealDocument(file, dealId);
    if (!upRes.success) {
      setError(`Upload échoué : ${upRes.error}`);
      setUploading(false);
      return;
    }
    const createRes = await createDealDocument({
      deal_id: dealId,
      document_type: docType,
      file_name: file.name,
      file_size: upRes.size,
      mime_type: upRes.mime,
      storage_path: upRes.path,
      file_url: upRes.path, // on stocke le path, le signed URL est généré à la demande
    });
    setUploading(false);
    if (!createRes.success) {
      setError(`Erreur création : ${createRes.error}`);
      return;
    }
    await loadDocs();
  }

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleUpload(file, newDocType);
    e.target.value = ""; // reset
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleUpload(file, newDocType);
  }

  // ── Remplacement ──────────────────────────────────────────────────────────
  async function onReplacePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !replaceTargetId) return;
    if (file.size > 50 * 1024 * 1024) {
      setError("Fichier trop lourd — 50 MB max.");
      e.target.value = "";
      return;
    }
    setUploading(true);
    setError(null);
    const upRes = await uploadDealDocument(file, dealId);
    if (!upRes.success) {
      setError(`Upload échoué : ${upRes.error}`);
      setUploading(false);
      e.target.value = "";
      return;
    }
    const res = await replaceDealDocument({
      doc_id: replaceTargetId,
      new_storage_path: upRes.path,
      new_file_url: upRes.path,
      new_file_name: file.name,
      new_file_size: upRes.size,
      new_mime_type: upRes.mime,
    });
    setUploading(false);
    setReplaceTargetId(null);
    e.target.value = "";
    if (!res.success) {
      setError(`Erreur remplacement : ${res.error}`);
      return;
    }
    await loadDocs();
  }

  // ── Download ──────────────────────────────────────────────────────────────
  async function handleDownload(path: string | null) {
    if (!path) return;
    const res = await getDocumentSignedUrl(path, 3600);
    if ("error" in res) { setError(res.error); return; }
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  // ── Suppression ───────────────────────────────────────────────────────────
  async function handleDelete(docId: string) {
    if (!confirm("Supprimer ce document ?")) return;
    const res = await deleteDealDocument(docId);
    if (!res.success) { setError(res.error); return; }
    await loadDocs();
  }

  // ── Edit metadata ─────────────────────────────────────────────────────────
  async function handleUpdateType(docId: string, newType: DocumentType) {
    const res = await updateDealDocumentMeta({ doc_id: docId, document_type: newType });
    if (!res.success) { setError(res.error); return; }
    await loadDocs();
  }

  async function handleUpdateStatus(docId: string, newStatus: DocumentStatus) {
    const res = await updateDealDocumentMeta({ doc_id: docId, document_status: newStatus });
    if (!res.success) { setError(res.error); return; }
    await loadDocs();
  }

  async function handleToggleConfidential(docId: string, current: boolean) {
    const res = await updateDealDocumentMeta({ doc_id: docId, is_confidential: !current });
    if (!res.success) { setError(res.error); return; }
    await loadDocs();
  }

  async function handleRename(docId: string, newName: string) {
    const res = await updateDealDocumentMeta({ doc_id: docId, file_name: newName });
    if (!res.success) { setError(res.error); return; }
    await loadDocs();
  }

  // ── Groupement par catégorie ──────────────────────────────────────────────
  const { entreprise, operation } = useMemo(() => {
    const e: DealDocumentRow[] = [];
    const o: DealDocumentRow[] = [];
    for (const d of docs) {
      const cat = d.category ?? (d.document_type ? TYPE_TO_CATEGORY[d.document_type as DocumentType] : "operation");
      if (cat === "entreprise") e.push(d);
      else o.push(d);
    }
    return { entreprise: e, operation: o };
  }, [docs]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>Documents — {dealName}</h2>
          <div style={{ fontSize: 12, color: "var(--text-5)", marginTop: 3 }}>
            {docs.length} document{docs.length > 1 ? "s" : ""} · 50 MB max par fichier
          </div>
        </div>
        <button type="button" onClick={() => void loadDocs()}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface-2)", color: "var(--text-3)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          <RefreshCw size={11}/> Actualiser
        </button>
      </div>

      {/* Zone upload drag & drop */}
      <div
        onDragOver={e => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragActive ? "var(--su-500, #1a56db)" : "var(--border)"}`,
          background: dragActive ? "rgba(26, 86, 219, 0.05)" : "var(--surface-2)",
          borderRadius: 12, padding: "20px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        }}
      >
        <Upload size={24} color="var(--text-4)"/>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)" }}>
            Glisse un fichier ici, ou clique pour choisir
          </div>
          <div style={{ fontSize: 12, color: "var(--text-5)", marginTop: 3 }}>
            Type par défaut : {DOCUMENT_TYPE_LABELS[newDocType]}
          </div>
        </div>
        <select value={newDocType} onChange={e => setNewDocType(e.target.value as DocumentType)}
          style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "var(--surface)", color: "var(--text-1)", fontFamily: "inherit" }}>
          {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>)}
        </select>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
          style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: "var(--su-500, #1a56db)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.6 : 1, fontFamily: "inherit" }}>
          {uploading ? "Upload…" : "Choisir un fichier"}
        </button>
        <input ref={fileInputRef} type="file" onChange={onFilePick} style={{ display: "none" }} />
      </div>

      {/* Input caché pour replace */}
      <input ref={replaceInputRef} type="file" onChange={onReplacePick} style={{ display: "none" }} />

      {/* Erreur */}
      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fee2e2", color: "#b91c1c", fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {/* Catégories */}
      {loading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-5)", fontSize: 13 }}>Chargement…</div>
      ) : (
        <>
          <CategorySection title={CATEGORY_LABELS.entreprise} docs={entreprise}
            onDownload={handleDownload} onDelete={handleDelete}
            onReplace={(id) => { setReplaceTargetId(id); replaceInputRef.current?.click(); }}
            onUpdateType={handleUpdateType}
            onUpdateStatus={handleUpdateStatus}
            onToggleConfidential={handleToggleConfidential}
            onRename={handleRename}
          />
          <CategorySection title={CATEGORY_LABELS.operation} docs={operation}
            onDownload={handleDownload} onDelete={handleDelete}
            onReplace={(id) => { setReplaceTargetId(id); replaceInputRef.current?.click(); }}
            onUpdateType={handleUpdateType}
            onUpdateStatus={handleUpdateStatus}
            onToggleConfidential={handleToggleConfidential}
            onRename={handleRename}
          />
        </>
      )}
    </div>
  );
}

// ── Sous-composant : section par catégorie ─────────────────────────────────

function CategorySection({
  title, docs, onDownload, onDelete, onReplace, onUpdateType, onUpdateStatus, onToggleConfidential, onRename,
}: {
  title: string;
  docs: DealDocumentRow[];
  onDownload: (path: string | null) => void;
  onDelete: (id: string) => void;
  onReplace: (id: string) => void;
  onUpdateType: (id: string, newType: DocumentType) => void;
  onUpdateStatus: (id: string, newStatus: DocumentStatus) => void;
  onToggleConfidential: (id: string, current: boolean) => void;
  onRename: (id: string, newName: string) => void;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
        {title} ({docs.length})
      </div>
      {docs.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--text-5)", fontStyle: "italic", padding: "12px 4px" }}>
          Aucun document dans cette catégorie.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {docs.map(d => (
            <DocRow key={d.id} doc={d}
              onDownload={onDownload} onDelete={onDelete} onReplace={onReplace}
              onUpdateType={onUpdateType} onUpdateStatus={onUpdateStatus}
              onToggleConfidential={onToggleConfidential}
              onRename={onRename}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sous-composant : ligne document ─────────────────────────────────────────

function DocRow({
  doc, onDownload, onDelete, onReplace, onUpdateType, onUpdateStatus, onToggleConfidential, onRename,
}: {
  doc: DealDocumentRow;
  onDownload: (path: string | null) => void;
  onDelete: (id: string) => void;
  onReplace: (id: string) => void;
  onUpdateType: (id: string, newType: DocumentType) => void;
  onUpdateStatus: (id: string, newStatus: DocumentStatus) => void;
  onToggleConfidential: (id: string, current: boolean) => void;
  onRename: (id: string, newName: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(doc.file_name ?? "");

  function commitRename() {
    const trimmed = draftName.trim();
    if (trimmed.length > 0 && trimmed !== doc.file_name) {
      onRename(doc.id, trimmed);
    }
    setRenaming(false);
  }

  function cancelRename() {
    setDraftName(doc.file_name ?? "");
    setRenaming(false);
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 14px", border: "1px solid var(--border)", borderRadius: 10,
      background: "var(--surface)",
    }}>
      <FileText size={16} color="var(--text-4)" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-1)", display: "flex", alignItems: "center", gap: 6 }}>
          {renaming ? (
            <input
              type="text"
              autoFocus
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === "Enter") commitRename();
                else if (e.key === "Escape") cancelRename();
              }}
              style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, padding: "3px 6px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface-2)", color: "var(--text-1)", fontFamily: "inherit", outline: "none" }}
            />
          ) : (
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {doc.file_name ?? "Sans nom"}
            </span>
          )}
          {doc.current_version_number > 1 && !renaming && (
            <span style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 4, background: "var(--surface-3)", color: "var(--text-5)", fontWeight: 600, flexShrink: 0 }}>
              v{doc.current_version_number}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-5)", marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={doc.document_type ?? "autre"} onChange={e => onUpdateType(doc.id, e.target.value as DocumentType)}
            title="Type de document"
            style={{ fontSize: 11, padding: "1px 4px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface-2)", color: "var(--text-3)", fontFamily: "inherit", cursor: "pointer" }}>
            {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>)}
          </select>
          <span>·</span>
          <select value={doc.document_status ?? "final"} onChange={e => onUpdateStatus(doc.id, e.target.value as DocumentStatus)}
            title="Statut"
            style={{ fontSize: 11, padding: "1px 4px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface-2)", color: "var(--text-3)", fontFamily: "inherit", cursor: "pointer" }}>
            <option value="draft">{STATUS_LABELS.draft}</option>
            <option value="review">{STATUS_LABELS.review}</option>
            <option value="final">{STATUS_LABELS.final}</option>
          </select>
          <span>·</span>
          <span>{fmtSize(doc.file_size)}</span>
          <span>·</span>
          <span>{fmtDate(doc.created_at)}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
        <button type="button" onClick={() => onToggleConfidential(doc.id, doc.is_confidential)}
          title={doc.is_confidential ? "Confidentiel — non partagé en rapport client" : "Partageable"}
          style={{ padding: 4, border: "1px solid var(--border)", borderRadius: 6, background: doc.is_confidential ? "var(--surface-2)" : "#D1FAE5", color: doc.is_confidential ? "var(--text-5)" : "#065F46", cursor: "pointer", display: "flex", alignItems: "center" }}>
          {doc.is_confidential ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
        <button type="button" onClick={() => { setDraftName(doc.file_name ?? ""); setRenaming(true); }}
          title="Renommer"
          style={{ padding: 4, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface-2)", color: "var(--text-5)", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <Pencil size={12} />
        </button>
        <button type="button" onClick={() => onDownload(doc.storage_path)} title="Télécharger"
          style={{ padding: 4, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface-2)", color: "var(--text-3)", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <Download size={12} />
        </button>
        <button type="button" onClick={() => onReplace(doc.id)} title="Remplacer par une nouvelle version"
          style={{ padding: 4, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface-2)", color: "var(--text-3)", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <Upload size={12} />
        </button>
        <button type="button" onClick={() => onDelete(doc.id)} title="Supprimer"
          style={{ padding: 4, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface-2)", color: "var(--rec-tx, #B91C1C)", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
