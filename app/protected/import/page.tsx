"use client";

import { useState, useRef } from "react";
import { Upload, CheckCircle, XCircle, AlertCircle, Download } from "lucide-react";

type Mode = "contacts" | "organisations" | "dossiers";
type Status = "idle"|"parsing"|"importing"|"done"|"error";

const templates: Record<Mode, string[]> = {
  contacts: ["first_name","last_name","email","phone","title","organisation_name","role_label","sector","country","linkedin_url","notes"],
  organisations: ["name","organization_type","base_status","sector","country","website","notes"],
  dossiers: ["name","deal_type","deal_status","deal_stage","priority_level","organisation_name","sector","description"],
};

const modeLabels: Record<Mode, string> = {
  contacts: "Contacts", organisations: "Organisations", dossiers: "Dossiers",
};

function downloadTemplate(mode: Mode) {
  const headers = templates[mode].join(",");
  const blob = new Blob([headers + "\n"], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `template_${mode}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

export default function ImportPage() {
  const [mode, setMode] = useState<Mode>("contacts");
  const [status, setStatus] = useState<Status>("idle");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [results, setResults] = useState<{ok: number; errors: string[]}>({ ok: 0, errors: [] });
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("parsing");
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseCSV(ev.target?.result as string);
      setRows(parsed);
      setStatus("idle");
    };
    reader.readAsText(file, "UTF-8");
  }

  async function handleImport() {
    if (!rows.length) return;
    setStatus("importing");
    const res = await fetch(`/api/import/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    setResults({ ok: data.ok ?? 0, errors: data.errors ?? [] });
    setStatus("done");
  }

  return (
    <div style={{ padding: 32, minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--su-600)", marginBottom: 4 }}>IMPORT</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>Importer des données</h1>
          <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 6 }}>Importez vos contacts, organisations ou dossiers depuis un fichier CSV.</p>
        </div>

        {/* Sélecteur mode */}
        <div className="su-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-4)", marginBottom: 12 }}>TYPE D'IMPORT</div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["contacts","organisations","dossiers"] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setRows([]); setStatus("idle"); }}
                style={{
                  padding: "8px 20px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
                  background: mode === m ? "var(--su-700)" : "var(--surface-2)",
                  color: mode === m ? "white" : "var(--text-2)",
                }}>
                {modeLabels[m]}
              </button>
            ))}
          </div>
        </div>

        {/* Template */}
        <div className="su-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 4 }}>Modèle CSV</div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                Colonnes : <span style={{ fontFamily: "monospace", fontSize: 11, background: "var(--surface-2)", padding: "2px 6px", borderRadius: 5 }}>{templates[mode].join(", ")}</span>
              </div>
            </div>
            <button onClick={() => downloadTemplate(mode)} className="su-btn-secondary" style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <Download size={13} /> Télécharger le modèle
            </button>
          </div>
        </div>

        {/* Upload */}
        <div className="su-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-4)", marginBottom: 12 }}>FICHIER CSV</div>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: "2px dashed var(--border-2)", borderRadius: 12, padding: "32px 20px",
              textAlign: "center", cursor: "pointer", background: "var(--surface-2)",
              transition: "all 0.12s",
            }}
          >
            <Upload size={24} color="var(--su-400)" style={{ margin: "0 auto 10px" }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)", marginBottom: 4 }}>
              {rows.length > 0 ? `${rows.length} ligne${rows.length > 1 ? "s" : ""} chargée${rows.length > 1 ? "s" : ""}` : "Cliquer pour choisir un fichier CSV"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-4)" }}>UTF-8, séparateur virgule</div>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: "none" }} />
        </div>

        {/* Aperçu */}
        {rows.length > 0 && status !== "done" && (
          <div className="su-card" style={{ padding: 20, marginBottom: 16, overflow: "auto" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-4)", marginBottom: 12 }}>
              APERÇU ({Math.min(rows.length, 5)} / {rows.length} lignes)
            </div>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  {Object.keys(rows[0]).map(k => (
                    <th key={k} style={{ padding: "6px 10px", textAlign: "left", color: "var(--text-3)", fontWeight: 600, borderBottom: "1px solid var(--border)" }}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    {Object.values(row).map((v, j) => (
                      <td key={j} style={{ padding: "6px 10px", color: "var(--text-2)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v || "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Résultats */}
        {status === "done" && (
          <div className="su-card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <CheckCircle size={20} color="var(--deal-fundraising-dot)" />
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>{results.ok} ligne{results.ok > 1 ? "s" : ""} importée{results.ok > 1 ? "s" : ""} avec succès</span>
            </div>
            {results.errors.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--deal-recruitment-text)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <XCircle size={13} /> {results.errors.length} erreur{results.errors.length > 1 ? "s" : ""}
                </div>
                <div style={{ maxHeight: 160, overflowY: "auto", background: "var(--deal-recruitment-bg)", borderRadius: 9, padding: "10px 14px" }}>
                  {results.errors.map((e, i) => <div key={i} style={{ fontSize: 11, color: "var(--deal-recruitment-text)", marginBottom: 3 }}>• {e}</div>)}
                </div>
              </div>
            )}
            <button onClick={() => { setRows([]); setStatus("idle"); setResults({ ok: 0, errors: [] }); if (fileRef.current) fileRef.current.value = ""; }}
              className="su-btn-secondary" style={{ marginTop: 14, cursor: "pointer" }}>
              Nouvel import
            </button>
          </div>
        )}

        {/* Bouton importer */}
        {rows.length > 0 && status !== "done" && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleImport} disabled={status === "importing"} className="su-btn-primary" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: "11px 24px", fontSize: 13 }}>
              {status === "importing" ? "Import en cours…" : `Importer ${rows.length} ligne${rows.length > 1 ? "s" : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
