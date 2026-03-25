"use client";
import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Trash2 } from "lucide-react";

type Step = "setup" | "uploading" | "done";

interface FileState {
  file: File | null;
  rows: Record<string, string>[];
  headers: string[];
  error: string;
}

interface Result {
  deal_id: string;
  ok_orgs: number;
  ok_contacts: number;
  ok_links: number;
  errors: { type: string; idx: number; err: string }[];
}

// Parser CSV robuste (RFC 4180)
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
    headers.forEach((h, i) => r[h] = (l[i] ?? "").trim());
    return r;
  }).filter(r => Object.values(r).some(v => v));
  return { headers, rows };
}

function FileDrop({
  label, accept, state, onLoad, onClear
}: {
  label: string; accept: string;
  state: FileState;
  onLoad: (s: FileState) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      onLoad({ file, rows: [], headers: [], error: "Fichier CSV requis" });
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

  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", marginBottom: 8, letterSpacing: ".04em", textTransform: "uppercase" }}>{label}</div>
      {state.file ? (
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", background: state.error ? "var(--rec-bg)" : "var(--fund-bg)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={15} color={state.error ? "var(--rec-tx)" : "var(--fund-tx)"}/>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{state.file.name}</div>
                {state.error
                  ? <div style={{ fontSize: 11.5, color: "var(--rec-tx)" }}>{state.error}</div>
                  : <div style={{ fontSize: 11.5, color: "var(--fund-tx)" }}>{state.rows.length} lignes · {state.headers.length} colonnes</div>
                }
              </div>
            </div>
            <button onClick={onClear} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-4)", padding: 4 }}>
              <Trash2 size={13}/>
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => ref.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          style={{
            border: "2px dashed var(--border)", borderRadius: 12, padding: "28px 20px",
            textAlign: "center", cursor: "pointer", transition: "border-color .15s",
            background: "var(--surface-2)",
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--border-2)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"}
        >
          <Upload size={20} color="var(--text-4)" style={{ marginBottom: 8 }}/>
          <div style={{ fontSize: 13, color: "var(--text-3)" }}>Glisser-déposer ou cliquer</div>
          <div style={{ fontSize: 11.5, color: "var(--text-5)", marginTop: 4 }}>Format CSV requis</div>
          <input ref={ref} type="file" accept={accept} style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}/>
        </div>
      )}
    </div>
  );
}

const EMPTY_FILE: FileState = { file: null, rows: [], headers: [], error: "" };

export default function ImportPage() {
  const [dealName, setDealName]   = useState("");
  const [orgsFile, setOrgsFile]   = useState<FileState>(EMPTY_FILE);
  const [consFile, setConsFile]   = useState<FileState>(EMPTY_FILE);
  const [step, setStep]           = useState<Step>("setup");
  const [result, setResult]       = useState<Result | null>(null);
  const [err, setErr]             = useState("");

  const canImport = dealName.trim() && (orgsFile.rows.length > 0 || consFile.rows.length > 0) && !orgsFile.error && !consFile.error;

  async function handleImport() {
    if (!canImport) return;
    setStep("uploading");
    setErr("");
    try {
      const res = await fetch("/api/import/deal-dataset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deal_name: dealName.trim(),
          orgs:      orgsFile.rows,
          contacts:  consFile.rows,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setErr(data.error ?? "Erreur inconnue"); setStep("setup"); return; }
      setResult(data);
      setStep("done");
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setErr(errorMessage);
      setStep("setup");
    }
  }

  function reset() {
    setDealName(""); setOrgsFile(EMPTY_FILE); setConsFile(EMPTY_FILE);
    setStep("setup"); setResult(null); setErr("");
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>Import dossier</h1>
        <p style={{ fontSize: 13.5, color: "var(--text-4)", margin: "6px 0 0" }}>
          Organisations + contacts importés en une seule transaction. Tous les liens sont créés automatiquement.
        </p>
      </div>

      {step === "done" && result ? (
        <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 28, background: "var(--surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <CheckCircle size={22} color="var(--fund-tx)"/>
            <span style={{ fontSize: 17, fontWeight: 600, color: "var(--text-1)" }}>Import terminé</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Organisations", val: result.ok_orgs, color: "#3468B0" },
              { label: "Contacts", val: result.ok_contacts, color: "#A8306A" },
              { label: "Liens créés", val: result.ok_links, color: "#15A348" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ textAlign: "center", padding: "16px 12px", background: "var(--surface-2)", borderRadius: 10 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color }}>{val}</div>
                <div style={{ fontSize: 12, color: "var(--text-4)", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
          {result.errors.length > 0 && (
            <div style={{ background: "var(--sell-bg)", border: "1px solid var(--sell-brd)", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--sell-tx)", marginBottom: 6 }}>
                {result.errors.length} ligne{result.errors.length > 1 ? "s" : ""} ignorée{result.errors.length > 1 ? "s" : ""}
              </div>
              {result.errors.slice(0, 5).map((e, i) => (
                <div key={i} style={{ fontSize: 11.5, color: "var(--sell-tx)" }}>
                  • [{e.type}] ligne {e.idx} : {e.err}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <a href={`/protected`} style={{
              padding: "9px 18px", background: "var(--accent)", color: "#fff",
              borderRadius: 9, fontSize: 13.5, fontWeight: 600, textDecoration: "none",
            }}>Voir le dashboard</a>
            <button onClick={reset} style={{
              padding: "9px 18px", background: "var(--surface-2)", color: "var(--text-2)",
              border: "1px solid var(--border)", borderRadius: 9, fontSize: 13.5, cursor: "pointer",
            }}>Nouvel import</button>
          </div>
        </div>
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 28, background: "var(--surface)" }}>
          {/* Nom du dossier */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", letterSpacing: ".04em", textTransform: "uppercase" }}>
              Nom du dossier
            </label>
            <input
              value={dealName}
              onChange={e => setDealName(e.target.value)}
              placeholder="ex: Redpeaks, Hello Justice Capital 1…"
              style={{
                display: "block", width: "100%", marginTop: 8,
                padding: "10px 14px", border: "1px solid var(--border)",
                borderRadius: 10, background: "var(--surface-2)",
                color: "var(--text-1)", fontSize: 14, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box",
              }}
            />
            <div style={{ fontSize: 11.5, color: "var(--text-5)", marginTop: 5 }}>
              Doit correspondre exactement au nom dans les CSV (colonne deal_name).
              Le dossier est créé automatiquement s'il n'existe pas.
            </div>
          </div>

          {/* Upload fichiers */}
          <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
            <FileDrop
              label="Organisations (optionnel)"
              accept=".csv"
              state={orgsFile}
              onLoad={setOrgsFile}
              onClear={() => setOrgsFile(EMPTY_FILE)}
            />
            <FileDrop
              label="Contacts (optionnel)"
              accept=".csv"
              state={consFile}
              onLoad={setConsFile}
              onClear={() => setConsFile(EMPTY_FILE)}
            />
          </div>

          {/* Colonnes attendues */}
          <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "12px 14px", marginBottom: 20, fontSize: 11.5, color: "var(--text-4)" }}>
            <div style={{ marginBottom: 4, fontWeight: 600, color: "var(--text-3)" }}>Colonnes attendues</div>
            <div><strong>Organisations :</strong> name · organization_type · base_status · sector · location · website · investment_ticket · investment_stage · deal_name · contact_date · description</div>
            <div style={{ marginTop: 4 }}><strong>Contacts :</strong> first_name · last_name · email · phone · title · organisation_name · role_label · sector · country · linkedin_url · base_status · last_contact_date</div>
          </div>

          {err && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--rec-bg)", borderRadius: 9, marginBottom: 16, fontSize: 13, color: "var(--rec-tx)" }}>
              <AlertCircle size={14}/> {err}
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={!canImport || step === "uploading"}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "11px 24px", borderRadius: 10, border: "none",
              background: canImport ? "var(--accent)" : "var(--surface-3)",
              color: canImport ? "#fff" : "var(--text-5)",
              fontSize: 14, fontWeight: 600, cursor: canImport ? "pointer" : "default",
              fontFamily: "inherit",
            }}
          >
            {step === "uploading"
              ? <><Loader2 size={14} className="animate-spin"/> Import en cours…</>
              : <><Upload size={14}/> Lancer l'import</>
            }
          </button>
        </div>
      )}
    </div>
  );
}
