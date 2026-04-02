"use client";

import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { importOrganisations, type ImportReport } from "@/actions/import/organisations";
import { importContacts } from "@/actions/import/contacts";
import { importCandidates } from "@/actions/import/candidates";

// ── CSV parser (RFC 4180) ────────────────────────────────────────────────────
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[][] = [];
  let cur = "", inQ = false, fields: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inQ) {
      if (c === '"' && n === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { fields.push(cur); cur = ""; }
      else if (c === ';') { fields.push(cur); cur = ""; } // support semicolon separator
      else if (c === '\n' || (c === '\r' && n === '\n')) {
        if (c === '\r') i++;
        fields.push(cur); cur = "";
        if (fields.some(f => f.trim())) lines.push(fields);
        fields = [];
      } else cur += c;
    }
  }
  if (cur || fields.length) { fields.push(cur); if (fields.some(f => f.trim())) lines.push(fields); }
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].map(h => h.trim().toLowerCase());
  const rows = lines.slice(1).map(l => {
    const r: Record<string, string> = {};
    headers.forEach((h, i) => { r[h] = (l[i] ?? "").trim(); });
    return r;
  }).filter(r => Object.values(r).some(v => v));
  return { headers, rows };
}

// ── Types ────────────────────────────────────────────────────────────────────
type Mode = "organisations" | "contacts" | "candidats" | "dossier";
type Step = "idle" | "loading" | "done";

interface FileState {
  file: File | null;
  rows: Record<string, string>[];
  headers: string[];
  error: string;
}
const EMPTY: FileState = { file: null, rows: [], headers: [], error: "" };

// ── Colonnes attendues par mode ───────────────────────────────────────────────
const COLUMNS: Record<string, { required: string[]; optional: string[] }> = {
  organisations: {
    required: ["name"],
    optional: ["organization_type","base_status","sector","location","website",
               "investment_ticket","investment_stage","investor_thesis",
               "founded_year","employee_count","description","notes"],
  },
  contacts: {
    required: ["first_name","last_name"],
    optional: ["email","phone","title","linkedin_url","base_status",
               "last_contact_date","organisation_name","role_label","sector","country","notes"],
  },
  candidats: {
    required: ["first_name","last_name"],
    optional: ["email","phone","linkedin_url","current_title","current_company",
               "location","seniority_level","remote_preference",
               "desired_salary_min","desired_salary_max","global_status",
               "notes_shareable","notes_internal"],
  },
};

// ── FileDrop ─────────────────────────────────────────────────────────────────
function FileDrop({ state, onLoad, onClear }: {
  state: FileState;
  onLoad: (s: FileState) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.match(/\.(csv|txt)$/i)) {
      onLoad({ file, rows: [], headers: [], error: "Fichier CSV requis (.csv)" });
      return;
    }
    const text = await file.text();
    const { headers, rows } = parseCSV(text);
    if (!rows.length) {
      onLoad({ file, rows: [], headers: [], error: "Fichier vide ou mal formaté" });
      return;
    }
    onLoad({ file, rows, headers, error: "" });
  }

  if (state.file) {
    return (
      <div style={{
        border: `1px solid ${state.error ? "#FCA5A5" : "#6EE7B7"}`,
        borderRadius: 12, padding: "14px 16px",
        background: state.error ? "#FEF2F2" : "#ECFDF5",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FileText size={16} color={state.error ? "#DC2626" : "#059669"} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{state.file.name}</div>
            {state.error
              ? <div style={{ fontSize: 12, color: "#DC2626" }}>{state.error}</div>
              : <div style={{ fontSize: 12, color: "#059669" }}>{state.rows.length} lignes · {state.headers.length} colonnes détectées</div>
            }
          </div>
        </div>
        <button onClick={onClear} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-4)", padding: 4 }}>
          <Trash2 size={13} />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      style={{
        border: "2px dashed var(--border)", borderRadius: 12, padding: "32px 20px",
        textAlign: "center", cursor: "pointer", background: "var(--surface-2)",
      }}
    >
      <Upload size={22} color="var(--text-4)" style={{ marginBottom: 10 }} />
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-3)" }}>Glisser-déposer ou cliquer</div>
      <div style={{ fontSize: 11.5, color: "var(--text-5)", marginTop: 4 }}>CSV uniquement — séparateur virgule ou point-virgule</div>
      <input ref={ref} type="file" accept=".csv,.txt" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

// ── Preview table ─────────────────────────────────────────────────────────────
function PreviewTable({ headers, rows }: { headers: string[]; rows: Record<string, string>[] }) {
  const preview = rows.slice(0, 5);
  return (
    <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border)", marginTop: 14 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
        <thead>
          <tr style={{ background: "var(--surface-2)" }}>
            {headers.map(h => (
              <th key={h} style={{
                padding: "7px 10px", textAlign: "left",
                fontWeight: 700, color: "var(--text-4)",
                borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
              {headers.map(h => (
                <td key={h} style={{
                  padding: "6px 10px", color: "var(--text-2)",
                  maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {row[h] || <span style={{ color: "var(--text-5)" }}>—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 5 && (
        <div style={{ padding: "6px 12px", fontSize: 11, color: "var(--text-5)", background: "var(--surface-2)", borderTop: "1px solid var(--border)" }}>
          … et {rows.length - 5} ligne{rows.length - 5 > 1 ? "s" : ""} supplémentaire{rows.length - 5 > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

// ── Report ────────────────────────────────────────────────────────────────────
function ReportBlock({ report, onReset }: { report: ImportReport; onReset: () => void }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 28, background: "var(--surface)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <CheckCircle size={22} color="#059669" />
        <span style={{ fontSize: 17, fontWeight: 700, color: "var(--text-1)" }}>Import terminé</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: report.errors.length > 0 ? 16 : 24 }}>
        {[
          { label: "Créés",   val: report.created, color: "#059669" },
          { label: "Mis à jour", val: report.updated, color: "#3B82F6" },
          { label: "Erreurs", val: report.errors.length, color: report.errors.length > 0 ? "#DC2626" : "#9CA3AF" },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ textAlign: "center", padding: "16px 12px", background: "var(--surface-2)", borderRadius: 10 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color }}>{val}</div>
            <div style={{ fontSize: 12, color: "var(--text-4)", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
      {report.errors.length > 0 && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#DC2626", marginBottom: 6 }}>
            {report.errors.length} ligne{report.errors.length > 1 ? "s" : ""} ignorée{report.errors.length > 1 ? "s" : ""}
          </div>
          {report.errors.slice(0, 8).map((e, i) => (
            <div key={i} style={{ fontSize: 11.5, color: "#991B1B", marginBottom: 2 }}>
              • Ligne {e.row} : {e.message}
            </div>
          ))}
          {report.errors.length > 8 && (
            <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>… et {report.errors.length - 8} autres erreurs</div>
          )}
        </div>
      )}
      <button onClick={onReset} style={{
        padding: "9px 20px", background: "var(--text-1)", color: "var(--bg)",
        border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
      }}>
        Nouvel import
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const MODES: { key: Mode; label: string; color: string }[] = [
  { key: "organisations", label: "Organisations", color: "#D97706" },
  { key: "contacts",      label: "Contacts",      color: "#A8306A" },
  { key: "candidats",     label: "Candidats",     color: "#0891B2" },
  { key: "dossier",       label: "Dossier complet", color: "#15A348" },
];

export default function ImportPage() {
  const [mode, setMode]     = useState<Mode>("organisations");
  const [file, setFile]     = useState<FileState>(EMPTY);
  const [step, setStep]     = useState<Step>("idle");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [err, setErr]       = useState("");

  // Dossier complet (mode legacy)
  const [dealName, setDealName]   = useState("");
  const [orgsFile, setOrgsFile]   = useState<FileState>(EMPTY);
  const [consFile, setConsFile]   = useState<FileState>(EMPTY);

  function resetMode() {
    setFile(EMPTY); setStep("idle"); setReport(null); setErr("");
  }

  function switchMode(m: Mode) {
    setMode(m); resetMode();
    setDealName(""); setOrgsFile(EMPTY); setConsFile(EMPTY);
  }

  async function handleImport() {
    if (!file.rows.length) return;
    setStep("loading"); setErr("");
    try {
      let r: ImportReport;
      if (mode === "organisations") r = await importOrganisations(file.rows);
      else if (mode === "contacts") r = await importContacts(file.rows);
      else r = await importCandidates(file.rows);
      setReport(r);
      setStep("done");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erreur inconnue");
      setStep("idle");
    }
  }

  // Dossier complet
  const canDossier = dealName.trim() && (orgsFile.rows.length > 0 || consFile.rows.length > 0) && !orgsFile.error && !consFile.error;
  const [dossierStep, setDossierStep]   = useState<Step>("idle");
  const [dossierReport, setDossierReport] = useState<{ ok_orgs: number; ok_contacts: number; ok_links: number; errors: { type: string; idx: number; err: string }[] } | null>(null);
  const [dossierErr, setDossierErr]     = useState("");

  async function handleDossierImport() {
    if (!canDossier) return;
    setDossierStep("loading"); setDossierErr("");
    try {
      const res = await fetch("/api/import/deal-dataset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal_name: dealName.trim(), orgs: orgsFile.rows, contacts: consFile.rows }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setDossierErr(data.error ?? "Erreur inconnue"); setDossierStep("idle"); return; }
      setDossierReport(data);
      setDossierStep("done");
    } catch (e: unknown) {
      setDossierErr(e instanceof Error ? e.message : "Erreur inconnue");
      setDossierStep("idle");
    }
  }

  const cols = mode !== "dossier" ? COLUMNS[mode] : null;

  return (
    <div style={{ padding: "28px 24px", minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text-1)" }}>Import CSV</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-4)" }}>
            Import global — organisations, contacts, candidats ou dossier complet.
          </p>
        </div>

        {/* Tabs mode */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
          {MODES.map(m => (
            <button
              key={m.key}
              onClick={() => switchMode(m.key)}
              style={{
                padding: "8px 16px", border: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: 700, borderRadius: "8px 8px 0 0",
                background: mode === m.key ? "var(--surface)" : "transparent",
                color: mode === m.key ? m.color : "var(--text-4)",
                borderBottom: mode === m.key ? `2px solid ${m.color}` : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* ── Mode dossier complet ──────────────────────────────────────── */}
        {mode === "dossier" && (
          dossierStep === "done" && dossierReport ? (
            <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 28, background: "var(--surface)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <CheckCircle size={22} color="#059669" />
                <span style={{ fontSize: 17, fontWeight: 700, color: "var(--text-1)" }}>Import terminé</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "Organisations", val: dossierReport.ok_orgs,      color: "#D97706" },
                  { label: "Contacts",      val: dossierReport.ok_contacts,   color: "#A8306A" },
                  { label: "Liens créés",   val: dossierReport.ok_links,      color: "#15A348" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ textAlign: "center", padding: "16px 12px", background: "var(--surface-2)", borderRadius: 10 }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color }}>{val}</div>
                    <div style={{ fontSize: 12, color: "var(--text-4)", marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
              {dossierReport.errors.length > 0 && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                  {dossierReport.errors.slice(0, 5).map((e, i) => (
                    <div key={i} style={{ fontSize: 11.5, color: "#991B1B" }}>• [{e.type}] ligne {e.idx} : {e.err}</div>
                  ))}
                </div>
              )}
              <button onClick={() => { setDossierStep("idle"); setDossierReport(null); setDealName(""); setOrgsFile(EMPTY); setConsFile(EMPTY); }} style={{
                padding: "9px 20px", background: "var(--text-1)", color: "var(--bg)",
                border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}>Nouvel import</button>
            </div>
          ) : (
            <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 28, background: "var(--surface)" }}>
              <div style={{ marginBottom: 22 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em" }}>
                  Nom du dossier *
                </label>
                <input value={dealName} onChange={e => setDealName(e.target.value)}
                  placeholder="ex: Redpeaks, Hello Justice Capital 1…"
                  style={{ display: "block", width: "100%", marginTop: 8, padding: "10px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface-2)", color: "var(--text-1)", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                <div style={{ fontSize: 11.5, color: "var(--text-5)", marginTop: 5 }}>Doit correspondre à la colonne deal_name dans les CSV. Le dossier est créé automatiquement.</div>
              </div>
              <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-4)", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".05em" }}>Organisations</div>
                  <FileDrop state={orgsFile} onLoad={setOrgsFile} onClear={() => setOrgsFile(EMPTY)} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-4)", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".05em" }}>Contacts</div>
                  <FileDrop state={consFile} onLoad={setConsFile} onClear={() => setConsFile(EMPTY)} />
                </div>
              </div>
              {dossierErr && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#FEF2F2", borderRadius: 9, marginBottom: 16, fontSize: 13, color: "#DC2626" }}>
                  <AlertCircle size={14} /> {dossierErr}
                </div>
              )}
              <button onClick={handleDossierImport} disabled={!canDossier || dossierStep === "loading"} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "11px 24px", borderRadius: 10, border: "none",
                background: canDossier ? "#15A348" : "var(--surface-3)",
                color: canDossier ? "#fff" : "var(--text-5)",
                fontSize: 14, fontWeight: 700, cursor: canDossier ? "pointer" : "default", fontFamily: "inherit",
              }}>
                {dossierStep === "loading" ? <><Loader2 size={14} className="animate-spin" /> Import en cours…</> : <><Upload size={14} /> Lancer l'import</>}
              </button>
            </div>
          )
        )}

        {/* ── Modes simples ─────────────────────────────────────────────── */}
        {mode !== "dossier" && (
          step === "done" && report ? (
            <ReportBlock report={report} onReset={resetMode} />
          ) : (
            <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 28, background: "var(--surface)" }}>

              {/* Upload */}
              <div style={{ marginBottom: 20 }}>
                <FileDrop state={file} onLoad={setFile} onClear={() => setFile(EMPTY)} />
              </div>

              {/* Preview */}
              {file.rows.length > 0 && !file.error && (
                <PreviewTable headers={file.headers} rows={file.rows} />
              )}

              {/* Colonnes attendues */}
              {cols && (
                <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "12px 14px", marginTop: 16, fontSize: 12, color: "var(--text-4)" }}>
                  <div style={{ fontWeight: 700, color: "var(--text-3)", marginBottom: 6 }}>Colonnes attendues</div>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: "#DC2626" }}>Obligatoires : </span>
                    {cols.required.map(c => (
                      <span key={c} style={{
                        display: "inline-block", margin: "2px 4px 2px 0",
                        padding: "1px 7px", borderRadius: 5,
                        background: file.headers.includes(c) ? "#D1FAE5" : "#FEE2E2",
                        color: file.headers.includes(c) ? "#065F46" : "#991B1B",
                        fontWeight: 600, fontSize: 11,
                      }}>{c}</span>
                    ))}
                  </div>
                  <div>
                    <span style={{ fontWeight: 700 }}>Optionnelles : </span>
                    {cols.optional.map(c => (
                      <span key={c} style={{
                        display: "inline-block", margin: "2px 4px 2px 0",
                        padding: "1px 7px", borderRadius: 5,
                        background: file.headers.includes(c) ? "#DBEAFE" : "var(--surface-3)",
                        color: file.headers.includes(c) ? "#1D4ED8" : "var(--text-5)",
                        fontWeight: 600, fontSize: 11,
                      }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {err && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#FEF2F2", borderRadius: 9, marginTop: 16, fontSize: 13, color: "#DC2626" }}>
                  <AlertCircle size={14} /> {err}
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={!file.rows.length || !!file.error || step === "loading"}
                style={{
                  display: "flex", alignItems: "center", gap: 8, marginTop: 20,
                  padding: "11px 24px", borderRadius: 10, border: "none",
                  background: file.rows.length && !file.error ? MODES.find(m => m.key === mode)!.color : "var(--surface-3)",
                  color: file.rows.length && !file.error ? "#fff" : "var(--text-5)",
                  fontSize: 14, fontWeight: 700,
                  cursor: file.rows.length && !file.error ? "pointer" : "default",
                  fontFamily: "inherit",
                }}
              >
                {step === "loading"
                  ? <><Loader2 size={14} className="animate-spin" /> Import en cours…</>
                  : <><Upload size={14} /> Importer {file.rows.length > 0 ? `${file.rows.length} lignes` : ""}</>
                }
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
