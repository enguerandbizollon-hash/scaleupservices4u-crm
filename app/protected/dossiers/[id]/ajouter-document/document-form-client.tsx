"use client";

import { useState } from "react";
import { addDocumentAction } from "./actions";
import { DrivePicker } from "../drive-picker";
import { ExternalLink } from "lucide-react";

const inputCls = "su-input";
const labelCls = "su-label";

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
      <div className="su-card" style={{ padding: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          <div>
            <label className={labelCls}>Nom du document *</label>
            <input name="name" required value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex. Teaser Redpeaks v2" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Lien Google Drive</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input name="document_url" value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://drive.google.com/…" className={inputCls} style={{ flex: 1 }} />
              {url && <a href={url} target="_blank" rel="noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 9, background: "var(--su-50)", color: "var(--su-600)", flexShrink: 0 }}>
                <ExternalLink size={14} />
              </a>}
            </div>
            <div style={{ marginTop: 8 }}>
              <DrivePicker onSelect={handleDriveSelect} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className={labelCls}>Type</label>
              <select name="document_type" className={inputCls}>
                <option value="pitch_deck">Pitch deck</option>
                <option value="teaser">Teaser</option>
                <option value="im">IM</option>
                <option value="financial_model">Modèle financier</option>
                <option value="nda">NDA</option>
                <option value="legal">Juridique</option>
                <option value="finance">Finance</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Statut</label>
              <select name="document_status" defaultValue="received" className={inputCls}>
                <option value="requested">Demandé</option>
                <option value="received">Reçu</option>
                <option value="modeled">Modélisé</option>
                <option value="finalized">Finalisé</option>
                <option value="archived">Archivé</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Version</label>
            <input name="version_label" placeholder="Ex. v1, v2, final" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Note</label>
            <textarea name="note" rows={2} className={inputCls} style={{ resize: "none" }} />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
        <button type="button" onClick={() => history.back()} className="su-btn-secondary" style={{ cursor: "pointer" }}>Annuler</button>
        <button type="submit" className="su-btn-primary" style={{ cursor: "pointer" }}>Ajouter</button>
      </div>
    </form>
  );
}
