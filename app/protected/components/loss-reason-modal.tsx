"use client";
import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";

const REASONS = [
  { value:"no_response",    label:"Pas de réponse" },
  { value:"no_interest",    label:"Pas d'intérêt" },
  { value:"bad_timing",     label:"Timing mauvais" },
  { value:"out_of_scope",   label:"Hors thèse / périmètre" },
  { value:"valuation",      label:"Valorisation" },
  { value:"competition",    label:"Concurrence" },
  { value:"deal_abandoned", label:"Dossier abandonné" },
  { value:"unreachable",    label:"Contact inaccessible" },
  { value:"other",          label:"Autre" },
];

interface LossReasonModalProps {
  entityType: "deal" | "contact";
  entityName: string;
  entityId:   string;
  onClose:    () => void;
  onConfirm:  (reason: string) => void;
}

export function LossReasonModal({ entityType, entityName, entityId, onClose, onConfirm }: LossReasonModalProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!reason) return;
    setLoading(true);
    onConfirm(reason);
  }

  const label = entityType === "deal" ? "dossier" : "contact";

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"var(--surface)", border:"1px solid var(--border-2)", borderRadius:16, padding:24, width:"100%", maxWidth:400 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
          <AlertTriangle size={16} color="var(--rec-tx)"/>
          <span style={{ fontSize:15, fontWeight:700, color:"var(--text-1)" }}>
            Motif de {entityType === "deal" ? "perte" : "exclusion"}
          </span>
          <button onClick={onClose} style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", color:"var(--text-4)" }}><X size={15}/></button>
        </div>

        <p style={{ fontSize:13, color:"var(--text-3)", marginBottom:16 }}>
          Pourquoi le {label} <strong>{entityName}</strong> est-il {entityType === "deal" ? "perdu" : "exclu"} ?
        </p>

        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:18 }}>
          {REASONS.map(r => (
            <label key={r.value} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius:8, border:`1px solid ${reason === r.value ? "var(--accent,#1a56db)" : "var(--border)"}`, background: reason === r.value ? "rgba(26,86,219,.06)" : "var(--surface-2)", cursor:"pointer" }}>
              <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} style={{ accentColor:"var(--accent,#1a56db)" }}/>
              <span style={{ fontSize:13, color:"var(--text-2)" }}>{r.label}</span>
            </label>
          ))}
        </div>

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ padding:"8px 16px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface-2)", color:"var(--text-3)", cursor:"pointer", fontSize:13, fontFamily:"inherit" }}>Annuler</button>
          <button onClick={handleConfirm} disabled={!reason || loading}
            style={{ padding:"8px 18px", borderRadius:8, border:"none", background:"var(--rec-tx,#dc2626)", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"inherit", opacity: !reason ? .5 : 1 }}>
            {loading ? "…" : "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}
