"use client";

import { useState } from "react";
import { addDocumentAction } from "./actions";
import { DrivePicker } from "../drive-picker";
import { ExternalLink, FileText, Link as LinkIcon, Tag, CheckSquare, Hash, StickyNote } from "lucide-react";

export function DocumentFormClient({ dealId }: { dealId: string }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");

  function handleDriveSelect(driveUrl: string, driveName: string) {
    setUrl(driveUrl);
    setName(prev => prev || driveName);
  }

  return (
    <form action={addDocumentAction}>
      <input type="hidden" name="deal_id" value={dealId} />

      {/* Section principale */}
      <div className="su-card" style={{ overflow: "hidden", marginBottom: 12 }}>
        {/* Header section */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={14} color="var(--su-600)" />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-3)" }}>DOCUMENT</span>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Nom */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-3)", marginBottom: 6 }}>
              NOM DU DOCUMENT *
            </label>
            <input
              name="name" required
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex. Teaser Redpeaks v2"
              style={{
                width: "100%", borderRadius: 10, border: "1px solid var(--border)",
                background: "var(--surface-2)", padding: "10px 14px", fontSize: 14,
                color: "var(--text-1)", outline: "none", boxSizing: "border-box"
              }}
            />
          </div>

          {/* Lien Google Drive */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-3)", marginBottom: 6 }}>
              LIEN GOOGLE DRIVE
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <LinkIcon size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-4)" }} />
                <input
                  name="document_url"
                  value={url} onChange={e => setUrl(e.target.value)}
                  placeholder="https://drive.google.com/…"
                  style={{
                    width: "100%", borderRadius: 10, border: "1px solid var(--border)",
                    background: "var(--surface-2)", padding: "10px 14px 10px 34px",
                    fontSize: 13, color: "var(--text-1)", outline: "none", boxSizing: "border-box"
                  }}
                />
              </div>
              {url && (
                <a href={url} target="_blank" rel="noreferrer"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, background: "var(--su-50)", color: "var(--su-600)", flexShrink: 0, border: "1px solid var(--border)" }}>
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
            <DrivePicker onSelect={handleDriveSelect} />
          </div>

          {/* Type + Statut */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-3)", marginBottom: 6 }}>
                TYPE
              </label>
              <select name="document_type"
                style={{ width: "100%", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", padding: "10px 14px", fontSize: 13, color: "var(--text-1)", outline: "none" }}>
                <option value="pitch_deck">Pitch deck</option>
                <option value="teaser">Teaser</option>
                <option value="im">Information Memorandum</option>
                <option value="financial_model">Modèle financier</option>
                <option value="nda">NDA</option>
                <option value="legal">Juridique</option>
                <option value="finance">Finance</option>
                <option value="hr">RH</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-3)", marginBottom: 6 }}>
                STATUT
              </label>
              <select name="document_status" defaultValue="received"
                style={{ width: "100%", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", padding: "10px 14px", fontSize: 13, color: "var(--text-1)", outline: "none" }}>
                <option value="requested">Demandé</option>
                <option value="received">Reçu</option>
                <option value="modeled">Modélisé</option>
                <option value="finalized">Finalisé</option>
                <option value="archived">Archivé</option>
              </select>
            </div>
          </div>

          {/* Version + Note */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-3)", marginBottom: 6 }}>
                VERSION
              </label>
              <input name="version_label" placeholder="v1, v2, final…"
                style={{ width: "100%", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", padding: "10px 14px", fontSize: 13, color: "var(--text-1)", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-3)", marginBottom: 6 }}>
                NOTE
              </label>
              <textarea name="note" rows={2}
                style={{ width: "100%", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", padding: "10px 14px", fontSize: 13, color: "var(--text-1)", outline: "none", resize: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button type="button" onClick={() => history.back()}
          style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          Annuler
        </button>
        <button type="submit"
          style={{ padding: "10px 24px", borderRadius: 10, background: "var(--su-700)", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none" }}>
          Ajouter le document
        </button>
      </div>
    </form>
  );
}
