"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Download, CheckCircle, XCircle, AlertCircle, ArrowRight, Loader2, FileText, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";

type Mode = "contacts" | "organisations" | "dossiers";

// ── Colonnes attendues par mode ──────────────────────────────────
const COLUMNS: Record<Mode, { key: string; label: string; required?: boolean; hint?: string }[]> = {
  contacts: [
    { key: "first_name",        label: "Prénom",         required: true },
    { key: "last_name",         label: "Nom",            required: true },
    { key: "email",             label: "Email" },
    { key: "phone",             label: "Téléphone" },
    { key: "title",             label: "Fonction",       hint: "Ex: Partner, CFO" },
    { key: "organisation_name", label: "Organisation",   hint: "Nom exact ou nouveau" },
    { key: "role_label",        label: "Rôle dans l'org" },
    { key: "sector",            label: "Secteur" },
    { key: "country",           label: "Pays" },
    { key: "linkedin_url",      label: "LinkedIn" },
    { key: "notes",             label: "Notes" },
  ],
  organisations: [
    { key: "name",              label: "Nom",            required: true },
    { key: "organization_type", label: "Type",           hint: "client, investor, law_firm, bank, advisor, family_office, corporate, other" },
    { key: "base_status",       label: "Statut",         hint: "to_qualify, qualified, active, dormant" },
    { key: "sector",            label: "Secteur" },
    { key: "country",           label: "Pays" },
    { key: "website",           label: "Site web" },
    { key: "notes",             label: "Notes" },
  ],
  dossiers: [
    { key: "name",              label: "Nom",            required: true },
    { key: "deal_type",         label: "Type",           required: true, hint: "fundraising, ma_sell, ma_buy, cfo_advisor, recruitment" },
    { key: "deal_status",       label: "Statut",         hint: "active, inactive, closed" },
    { key: "deal_stage",        label: "Étape",          hint: "kickoff, preparation, outreach, management_meetings, dd, negotiation, closing" },
    { key: "priority_level",    label: "Priorité",       hint: "high, medium, low" },
    { key: "organisation_name", label: "Organisation",   hint: "Doit exister dans le CRM" },
    { key: "sector",            label: "Secteur" },
    { key: "description",       label: "Description" },
  ],
};

const MODE_LABELS: Record<Mode, string> = {
  contacts: "Contacts", organisations: "Organisations", dossiers: "Dossiers",
};

const MODE_ICONS: Record<Mode, string> = {
  contacts: "👤", organisations: "🏢", dossiers: "📁",
};

// ── Télécharger template Excel ───────────────────────────────────
function downloadTemplate(mode: Mode) {
  const cols = COLUMNS[mode];
  const headers = cols.map(c => c.key);
  const example: Record<string, string> = {};

  if (mode === "contacts") {
    Object.assign(example, { first_name:"Jean", last_name:"Dupont", email:"jean@example.com", phone:"+33 6 00 00 00 00", title:"Partner", organisation_name:"Sequoia Capital", role_label:"Decision maker", sector:"VC", country:"France", linkedin_url:"https://linkedin.com/in/jean", notes:"" });
  } else if (mode === "organisations") {
    Object.assign(example, { name:"Sequoia Capital", organization_type:"investor", base_status:"to_qualify", sector:"VC / PE", country:"USA", website:"https://sequoiacap.com", notes:"" });
  } else {
    Object.assign(example, { name:"Redpeaks Série A", deal_type:"fundraising", deal_status:"active", deal_stage:"outreach", priority_level:"high", organisation_name:"Redpeaks", sector:"SaaS", description:"Levée série A 3M€" });
  }

  const ws = XLSX.utils.aoa_to_sheet([
    headers,
    headers.map(h => example[h] ?? ""),
  ]);

  // Largeur colonnes
  ws["!cols"] = headers.map(() => ({ wch: 22 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, MODE_LABELS[mode]);
  XLSX.writeFile(wb, `template_${mode}.xlsx`);
}

// ── Parser fichier ───────────────────────────────────────────────
function parseFile(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (file.name.endsWith(".csv") || file.type === "text/csv") {
          // CSV
          const text = data as string;
          const lines = text.trim().split(/\r?\n/);
          if (lines.length < 2) { resolve([]); return; }
          const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").trim());
          const rows = lines.slice(1).filter(l => l.trim()).map(line => {
            const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, "").trim());
            return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
          });
          resolve(rows);
        } else {
          // Excel
          const wb = XLSX.read(data, { type: "binary" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
          resolve(rows.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, String(v)]))));
        }
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    if (file.name.endsWith(".csv") || file.type === "text/csv") {
      reader.readAsText(file, "UTF-8");
    } else {
      reader.readAsBinaryString(file);
    }
  });
}

// ── Mapping automatique des colonnes ────────────────────────────
function autoMap(fileHeaders: string[], mode: Mode): Record<string, string> {
  const mapping: Record<string, string> = {};
  const expected = COLUMNS[mode].map(c => c.key);
  
  for (const fh of fileHeaders) {
    const fhLow = fh.toLowerCase().replace(/[^a-z0-9]/g, "_");
    // Correspondance exacte
    const exact = expected.find(k => k === fhLow || k === fh);
    if (exact) { mapping[exact] = fh; continue; }
    // Correspondances approximatives
    const approx: Record<string, string[]> = {
      first_name: ["prenom","prénom","firstname","first"],
      last_name: ["nom","lastname","last","surname"],
      email: ["mail","e_mail","courriel"],
      phone: ["tel","telephone","téléphone","mobile"],
      title: ["fonction","poste","job","position","role"],
      organisation_name: ["organisation","organization","société","societe","company","entreprise","firm"],
      name: ["nom","raison_sociale","raison sociale","company","entreprise"],
      website: ["site","url","web"],
      country: ["pays","nation"],
      sector: ["secteur","industry","industrie"],
      deal_type: ["type","mission"],
      deal_status: ["statut","status","etat","état"],
      priority_level: ["priorite","priorité","priority"],
    };
    for (const [key, aliases] of Object.entries(approx)) {
      if (expected.includes(key) && !mapping[key] && aliases.some(a => fhLow.includes(a))) {
        mapping[key] = fh;
        break;
      }
    }
  }
  return mapping;
}

// ── Transformer une ligne selon le mapping ───────────────────────
function applyMapping(row: Record<string, string>, mapping: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, fileCol] of Object.entries(mapping)) {
    result[key] = row[fileCol] ?? "";
  }
  return result;
}

// ── Composant principal ──────────────────────────────────────────
export default function ImportPage() {
  const [mode, setMode] = useState<Mode>("contacts");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "done">("upload");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ ok: number; errors: string[] }>({ ok: 0, errors: [] });
  const fileRef = useRef<HTMLInputElement>(null);

  const cols = COLUMNS[mode];

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseFile(file);
      if (!parsed.length) return;
      const headers = Object.keys(parsed[0]);
      setFileHeaders(headers);
      setRows(parsed);
      const auto = autoMap(headers, mode);
      setMapping(auto);
      setStep("mapping");
    } catch (err) {
      alert("Erreur lors de la lecture du fichier.");
    }
  }

  function updateMapping(colKey: string, fileCol: string) {
    setMapping(prev => ({ ...prev, [colKey]: fileCol }));
  }

  function goPreview() {
    const required = cols.filter(c => c.required).map(c => c.key);
    const missing = required.filter(k => !mapping[k]);
    if (missing.length) {
      alert(`Colonnes obligatoires non mappées : ${missing.map(k => cols.find(c=>c.key===k)?.label).join(", ")}`);
      return;
    }
    setStep("preview");
  }

  async function runImport() {
    setImporting(true);
    setProgress(0);
    const mappedRows = rows.map(r => applyMapping(r, mapping));
    
    // Import par batch de 50
    const batchSize = 50;
    let totalOk = 0;
    const allErrors: string[] = [];

    for (let i = 0; i < mappedRows.length; i += batchSize) {
      const batch = mappedRows.slice(i, i + batchSize);
      const res = await fetch(`/api/import/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: batch }),
      });
      const data = await res.json();
      totalOk += data.ok ?? 0;
      allErrors.push(...(data.errors ?? []));
      setProgress(Math.round(((i + batch.length) / mappedRows.length) * 100));
    }

    setResults({ ok: totalOk, errors: allErrors });
    setImporting(false);
    setStep("done");
  }

  function reset() {
    setRows([]); setFileHeaders([]); setMapping({});
    setStep("upload"); setProgress(0); setResults({ ok: 0, errors: [] });
    if (fileRef.current) fileRef.current.value = "";
  }

  const previewRows = rows.slice(0, 5).map(r => applyMapping(r, mapping));

  return (
    <div style={{ padding:32, minHeight:"100vh", background:"var(--bg)" }}>
      <div style={{ maxWidth:860, margin:"0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", color:"var(--su-600)", marginBottom:4 }}>IMPORT</div>
          <h1 style={{ fontSize:28, fontWeight:700, color:"var(--text-1)", margin:0, letterSpacing:"-0.02em" }}>Importer des données</h1>
          <p style={{ fontSize:13, color:"var(--text-3)", marginTop:6 }}>Supporte Excel (.xlsx) et CSV. Mapping de colonnes automatique.</p>
        </div>

        {/* Steps */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:24 }}>
          {[
            { id:"upload",  label:"1. Fichier" },
            { id:"mapping", label:"2. Colonnes" },
            { id:"preview", label:"3. Aperçu" },
            { id:"done",    label:"4. Résultat" },
          ].map((s, i) => {
            const steps = ["upload","mapping","preview","done"];
            const current = steps.indexOf(step);
            const idx = steps.indexOf(s.id);
            const done = idx < current;
            const active = idx === current;
            return (
              <div key={s.id} style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:600, background: active?"var(--su-700)":done?"var(--deal-fundraising-bg)":"var(--surface-2)", color: active?"white":done?"var(--deal-fundraising-text)":"var(--text-4)", border:`1px solid ${active?"var(--su-700)":done?"var(--deal-fundraising-text)":"var(--border)"}` }}>
                  {done && <CheckCircle size={12}/>}
                  {s.label}
                </div>
                {i < 3 && <div style={{ width:20, height:1, background:"var(--border)" }}/>}
              </div>
            );
          })}
        </div>

        {/* Sélecteur mode */}
        <div className="su-card" style={{ padding:20, marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.08em", color:"var(--text-4)", marginBottom:12 }}>TYPE D'IMPORT</div>
          <div style={{ display:"flex", gap:8 }}>
            {(["contacts","organisations","dossiers"] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); reset(); }}
                style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 20px", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer", border:"none", background: mode===m?"var(--su-700)":"var(--surface-2)", color: mode===m?"white":"var(--text-2)" }}>
                {MODE_ICONS[m]} {MODE_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        {/* ÉTAPE 1 — Upload */}
        {step === "upload" && (
          <div className="su-card" style={{ padding:24, marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--text-1)", marginBottom:6 }}>Colonnes attendues</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {cols.map(c => (
                    <span key={c.key} style={{ fontSize:11, padding:"3px 8px", borderRadius:6, background: c.required?"var(--su-50)":"var(--surface-2)", color: c.required?"var(--su-700)":"var(--text-3)", border:`1px solid ${c.required?"var(--border-2)":"var(--border)"}`, fontWeight: c.required?700:400 }}>
                      {c.label}{c.required?" *":""}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => downloadTemplate(mode)}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 16px", borderRadius:10, border:"1px solid var(--border)", background:"white", color:"var(--text-2)", fontSize:12, fontWeight:600, cursor:"pointer", flexShrink:0 }}>
                <Download size={13}/> Télécharger template Excel
              </button>
            </div>

            <div onClick={() => fileRef.current?.click()}
              style={{ border:"2px dashed var(--border-2)", borderRadius:14, padding:"40px 24px", textAlign:"center", cursor:"pointer", background:"var(--surface-2)" }}>
              <Upload size={28} color="var(--su-400)" style={{ margin:"0 auto 12px", display:"block" }}/>
              <div style={{ fontSize:14, fontWeight:600, color:"var(--text-2)", marginBottom:4 }}>Glisser-déposer ou cliquer pour choisir</div>
              <div style={{ fontSize:12, color:"var(--text-4)" }}>Excel (.xlsx) ou CSV (.csv) — UTF-8</div>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,text/csv" onChange={handleFile} style={{ display:"none" }}/>
          </div>
        )}

        {/* ÉTAPE 2 — Mapping colonnes */}
        {step === "mapping" && (
          <div className="su-card" style={{ padding:24, marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"var(--text-1)", marginBottom:4 }}>Correspondance des colonnes</div>
            <p style={{ fontSize:12, color:"var(--text-3)", marginBottom:20 }}>
              {rows.length} ligne{rows.length>1?"s":""} détectée{rows.length>1?"s":""}. Vérifie que chaque colonne CRM pointe vers la bonne colonne de ton fichier.
            </p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {cols.map(col => (
                <div key={col.key} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ flex:"0 0 160px" }}>
                    <div style={{ fontSize:12, fontWeight:700, color: col.required?"var(--su-700)":"var(--text-2)" }}>
                      {col.label}{col.required?" *":""}
                    </div>
                    {col.hint && <div style={{ fontSize:10, color:"var(--text-4)" }}>{col.hint}</div>}
                  </div>
                  <ArrowRight size={13} color="var(--text-4)" style={{ flexShrink:0 }}/>
                  <select value={mapping[col.key] ?? ""} onChange={e => updateMapping(col.key, e.target.value)}
                    style={{ flex:1, borderRadius:8, border:`1px solid ${col.required&&!mapping[col.key]?"var(--deal-recruitment-dot)":"var(--border)"}`, background:"var(--surface-2)", padding:"7px 10px", fontSize:12, color:"var(--text-1)", outline:"none" }}>
                    <option value="">— Ignorer —</option>
                    {fileHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:20 }}>
              <button onClick={reset} style={{ padding:"9px 18px", borderRadius:10, border:"1px solid var(--border)", background:"white", color:"var(--text-2)", fontSize:13, fontWeight:500, cursor:"pointer" }}>Recommencer</button>
              <button onClick={goPreview} style={{ padding:"9px 20px", borderRadius:10, background:"var(--su-700)", color:"white", fontSize:13, fontWeight:600, cursor:"pointer", border:"none" }}>
                Prévisualiser →
              </button>
            </div>
          </div>
        )}

        {/* ÉTAPE 3 — Aperçu */}
        {step === "preview" && (
          <div className="su-card" style={{ padding:24, marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"var(--text-1)", marginBottom:4 }}>
              Aperçu — {rows.length} ligne{rows.length>1?"s":""} à importer
            </div>
            <p style={{ fontSize:12, color:"var(--text-3)", marginBottom:16 }}>5 premières lignes :</p>

            <div style={{ overflowX:"auto", marginBottom:20 }}>
              <table style={{ width:"100%", fontSize:11, borderCollapse:"collapse", minWidth:600 }}>
                <thead>
                  <tr style={{ background:"var(--surface-2)" }}>
                    {cols.filter(c => mapping[c.key]).map(c => (
                      <th key={c.key} style={{ padding:"8px 10px", textAlign:"left", color:"var(--text-3)", fontWeight:700, borderBottom:"1px solid var(--border)", whiteSpace:"nowrap" }}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} style={{ borderBottom:"1px solid var(--border)" }}>
                      {cols.filter(c => mapping[c.key]).map(c => (
                        <td key={c.key} style={{ padding:"7px 10px", color:"var(--text-2)", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {row[c.key] || <span style={{ color:"var(--text-4)", fontStyle:"italic" }}>vide</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {importing ? (
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <Loader2 size={16} style={{ animation:"spin 1s linear infinite", color:"var(--su-600)" }}/>
                  <span style={{ fontSize:13, color:"var(--text-2)", fontWeight:500 }}>Import en cours… {progress}%</span>
                </div>
                <div style={{ height:6, borderRadius:3, background:"var(--border)", overflow:"hidden" }}>
                  <div style={{ height:"100%", borderRadius:3, background:"var(--su-600)", width:`${progress}%`, transition:"width 0.3s" }}/>
                </div>
              </div>
            ) : (
              <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
                <button onClick={() => setStep("mapping")} style={{ padding:"9px 18px", borderRadius:10, border:"1px solid var(--border)", background:"white", color:"var(--text-2)", fontSize:13, fontWeight:500, cursor:"pointer" }}>← Modifier</button>
                <button onClick={runImport} style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 22px", borderRadius:10, background:"var(--su-700)", color:"white", fontSize:13, fontWeight:600, cursor:"pointer", border:"none" }}>
                  Importer {rows.length} ligne{rows.length>1?"s":""}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ÉTAPE 4 — Résultat */}
        {step === "done" && (
          <div className="su-card" style={{ padding:24 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:"var(--deal-fundraising-bg)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <CheckCircle size={22} color="var(--deal-fundraising-dot)"/>
              </div>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:"var(--text-1)" }}>Import terminé</div>
                <div style={{ fontSize:13, color:"var(--deal-fundraising-text)", fontWeight:600 }}>
                  {results.ok} ligne{results.ok>1?"s":""} importée{results.ok>1?"s":""} avec succès
                </div>
              </div>
            </div>

            {results.errors.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--deal-recruitment-text)", marginBottom:8, display:"flex", alignItems:"center", gap:5 }}>
                  <AlertCircle size={13}/> {results.errors.length} erreur{results.errors.length>1?"s":""}
                </div>
                <div style={{ maxHeight:200, overflowY:"auto", background:"var(--deal-recruitment-bg)", borderRadius:10, padding:"12px 14px" }}>
                  {results.errors.map((e,i) => <div key={i} style={{ fontSize:11, color:"var(--deal-recruitment-text)", marginBottom:3 }}>• {e}</div>)}
                </div>
              </div>
            )}

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={reset} style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 18px", borderRadius:10, border:"1px solid var(--border)", background:"white", color:"var(--text-2)", fontSize:13, fontWeight:500, cursor:"pointer" }}>
                <RefreshCw size={13}/> Nouvel import
              </button>
              <a href={`/protected/${mode}`} style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 20px", borderRadius:10, background:"var(--su-700)", color:"white", fontSize:13, fontWeight:600, textDecoration:"none" }}>
                Voir les {MODE_LABELS[mode].toLowerCase()} <ArrowRight size={13}/>
              </a>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
