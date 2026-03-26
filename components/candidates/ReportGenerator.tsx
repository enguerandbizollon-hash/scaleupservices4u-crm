"use client";

import { useState } from "react";
import { generateReportAction } from "@/actions/candidates";

interface ExistingReport {
  id: string;
  label: string | null;
  token: string;
  expires_at: string;
  created_at: string;
}

interface Props {
  candidateId: string;
  existingReports: ExistingReport[];
  appUrl: string;
}

const fmt = (d: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));

export function ReportGenerator({ candidateId, existingReports, appUrl }: Props) {
  const [reports, setReports]   = useState<ExistingReport[]>(existingReports);
  const [generating, setGenerating] = useState(false);
  const [label, setLabel]       = useState("");
  const [copied, setCopied]     = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("candidate_id", candidateId);
      fd.append("label", label.trim());
      const { token } = await generateReportAction(fd);
      const newReport: ExistingReport = {
        id:         crypto.randomUUID(),
        label:      label.trim() || null,
        token,
        expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      };
      setReports(r => [newReport, ...r]);
      setLabel("");
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setGenerating(false);
  }

  async function copy(token: string) {
    const url = `${appUrl}/rapport/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  const inp = "padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;font-family:inherit;background:var(--surface);color:var(--text-1);outline:none;width:100%";

  return (
    <div>
      {/* Rapports existants */}
      {reports.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 10 }}>
          {reports.map(r => {
            const expired = new Date(r.expires_at) < new Date();
            const url = `${appUrl}/rapport/${r.token}`;
            return (
              <div key={r.token} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: expired ? "var(--surface-3)" : "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)", opacity: expired ? .6 : 1 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>
                    {r.label ?? "Rapport sans titre"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-5)", marginTop: 1 }}>
                    Généré le {fmt(r.created_at)} · {expired ? "Expiré" : `Expire le ${fmt(r.expires_at)}`}
                  </div>
                </div>
                {!expired && (
                  <>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 6, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-3)", textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap" }}
                    >
                      Ouvrir
                    </a>
                    <button
                      onClick={() => copy(r.token)}
                      style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 6, background: copied === r.token ? "#D1FAE5" : "#EEF2FF", border: "none", color: copied === r.token ? "#065F46" : "#3730A3", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                    >
                      {copied === r.token ? "Copié ✓" : "Copier lien"}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Formulaire génération */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          style={{ fontSize: 12.5, padding: "6px 14px", borderRadius: 7, border: "1px dashed var(--border)", background: "var(--surface)", color: "var(--text-3)", cursor: "pointer", fontFamily: "inherit" }}
        >
          + Générer un lien partageable
        </button>
      ) : (
        <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 9, background: "var(--surface-2)", marginTop: 4 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-2)", marginBottom: 8 }}>Nouveau rapport (30 jours)</div>
          <div style={{ marginBottom: 10 }}>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder='Intitulé (ex: "Rapport client Acme – Mars 2026")'
              style={{ cssText: inp } as React.CSSProperties}
            />
          </div>
          {error && (
            <div style={{ fontSize: 12, color: "#991B1B", marginBottom: 8 }}>{error}</div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={generate}
              disabled={generating}
              style={{ flex: 1, padding: "7px 14px", borderRadius: 7, background: "#1a56db", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: generating ? .6 : 1 }}
            >
              {generating ? "Génération…" : "Créer le lien"}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(null); }}
              style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
