"use client";

import { useState } from "react";
import { X, Send, Loader2, CheckCircle } from "lucide-react";

export function EmailCompose({ to, name, onClose }: { to: string; name: string; onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle"|"sending"|"sent"|"error">("idle");
  const [error, setError] = useState("");

  async function send() {
    if (!subject.trim() || !body.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setStatus("error"); return; }
      setStatus("sent");
      setTimeout(onClose, 2000);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      setStatus("error");
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(13,31,53,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "white", borderRadius: 16, padding: 24, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>Envoyer un email</div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>À : {name} &lt;{to}&gt;</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}><X size={18} /></button>
        </div>

        {status === "sent" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--deal-fundraising-text)", padding: "20px 0" }}>
            <CheckCircle size={20} /> Email envoyé avec succès !
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <label className="su-label">Objet</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} className="su-input" placeholder="Objet de l'email" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="su-label">Message</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} className="su-input" rows={8}
                placeholder="Votre message…" style={{ resize: "vertical" }} />
            </div>
            {status === "error" && (
              <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--deal-recruitment-bg)", color: "var(--deal-recruitment-text)", fontSize: 12, marginBottom: 12 }}>
                {error.includes("Non connecté") ? "⚠ Connecte-toi d'abord à Google dans Connecteurs." : error}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={onClose} className="su-btn-secondary" style={{ cursor: "pointer" }}>Annuler</button>
              <button onClick={send} disabled={status === "sending"} className="su-btn-primary"
                style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                {status === "sending" ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {status === "sending" ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
