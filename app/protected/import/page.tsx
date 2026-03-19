"use client";

import { useState, useRef } from "react";
import { Upload, Download, CheckCircle, AlertCircle, ArrowRight, Loader2, RefreshCw } from "lucide-react";

type Mode = "contacts" | "organisations" | "dossiers";

const COLUMNS: Record<Mode, { key: string; label: string; required?: boolean; hint?: string }[]> = {
  contacts: [
    { key: "first_name",        label: "Prénom",          required: true },
    { key: "last_name",         label: "Nom",             required: true },
    { key: "email",             label: "Email" },
    { key: "phone",             label: "Téléphone" },
    { key: "title",             label: "Fonction",        hint: "Ex: Partner, CFO" },
    { key: "organisation_name", label: "Organisation" },
    { key: "role_label",        label: "Rôle" },
    { key: "sector",            label: "Secteur" },
    { key: "country",           label: "Pays" },
    { key: "linkedin_url",      label: "LinkedIn" },
    { key: "notes",             label: "Notes" },
  ],
  organisations: [
    { key: "name",              label: "Nom",             required: true },
    { key: "organization_type", label: "Type",            hint: "client, investor, law_firm, bank, advisor, family_office, other" },
    { key: "base_status",       label: "Statut",          hint: "to_qualify, qualified, active, dormant" },
    { key: "sector",            label: "Secteur" },
    { key: "country",           label: "Pays" },
    { key: "website",           label: "Site web" },
    { key: "notes",             label: "Notes" },
  ],
  dossiers: [
    { key: "name",              label: "Nom",             required: true },
    { key: "deal_type",         label: "Type",            required: true, hint: "fundraising, ma_sell, ma_buy, cfo_advisor, recruitment" },
    { key: "deal_status",       label: "Statut",          hint: "active, inactive, closed" },
    { key: "deal_stage",        label: "Étape",           hint: "kickoff, preparation, outreach, dd, negotiation, closing" },
    { key: "priority_level",    label: "Priorité",        hint: "high, medium, low" },
    { key: "organisation_name", label: "Organisation" },
    { key: "sector",            label: "Secteur" },
    { key: "description",       label: "Description" },
  ],
};

const MODE_LABELS: Record<Mode, string> = { contacts:"Contacts", organisations:"Organisations", dossiers:"Dossiers" };
const MODE_ICONS: Record<Mode, string> = { contacts:"👤", organisations:"🏢", dossiers:"📁" };

function downloadCSVTemplate(mode: Mode) {
  const cols = COLUMNS[mode];
  const headers = cols.map(c => c.key).join(",");
  const examples: Record<Mode, string> = {
    contacts: "Jean,Dupont,jean@example.com,+33600000000,Partner,Sequoia Capital,Decision maker,VC,France,https://linkedin.com/in/jean,",
    organisations: "Sequoia Capital,investor,to_qualify,VC / PE,USA,https://sequoiacap.com,",
    dossiers: "Redpeaks Série A,fundraising,active,outreach,high,Redpeaks,SaaS,Levée série A 3M€",
  };
  const content = headers + "\n" + examples[mode];
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `template_${mode}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").trim());
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, "").trim());
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

function autoMap(fileHeaders: string[], mode: Mode): Record<string, string> {
  const mapping: Record<string, string> = {};
  const expected = COLUMNS[mode].map(c => c.key);
  const aliases: Record<string, string[]> = {
    first_name: ["prenom","prénom","firstname","first","given_name"],
    last_name: ["nom","lastname","last","surname","family_name"],
    email: ["mail","e_mail","courriel","email_address"],
    phone: ["tel","telephone","téléphone","mobile","phone_number"],
    title: ["fonction","poste","job","position","title","job_title"],
    organisation_name: ["organisation","organization","société","societe","company","entreprise","firm","org"],
    name: ["nom","raison_sociale","raison sociale","company","entreprise","name"],
    website: ["site","url","web","website"],
    country: ["pays","nation","country"],
    sector: ["secteur","industry","industrie","sector"],
    deal_type: ["type","type_mission","mission_type"],
    deal_status: ["statut","status","etat","état"],
    priority_level: ["priorite","priorité","priority"],
  };

  for (const fh of fileHeaders) {
    const fhLow = fh.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const exact = expected.find(k => k === fhLow || k === fh);
    if (exact && !mapping[exact]) { mapping[exact] = fh; continue; }
    for (const [key, al] of Object.entries(aliases)) {
      if (expected.includes(key) && !mapping[key] && al.some(a => fhLow.includes(a))) {
        mapping[key] = fh; break;
      }
    }
  }
  return mapping;
}

export default function ImportPage() {
  const [mode, setMode] = useState<Mode>("contacts");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"upload"|"mapping"|"preview"|"done">("upload");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ ok: number; errors: string[] }>({ ok: 0, errors: [] });
  const fileRef = useRef<HTMLInputElement>(null);
  const cols = COLUMNS[mode];

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (!parsed.length) { alert("Fichier vide ou format incorrect."); return; }
      const headers = Object.keys(parsed[0]);
      setFileHeaders(headers);
      setRows(parsed);
      setMapping(autoMap(headers, mode));
      setStep("mapping");
    };
    reader.readAsText(file, "UTF-8");
  }

  function goPreview() {
    const missing = cols.filter(c => c.required && !mapping[c.key]).map(c => c.label);
    if (missing.length) { alert(`Colonnes obligatoires manquantes : ${missing.join(", ")}`); return; }
    setStep("preview");
  }

  async function runImport() {
    setImporting(true); setProgress(0);
    const mappedRows = rows.map(r => Object.fromEntries(
      Object.entries(mapping).map(([k, fh]) => [k, r[fh] ?? ""])
    ));
    let totalOk = 0; const allErrors: string[] = [];
    const batchSize = 50;
    for (let i = 0; i < mappedRows.length; i += batchSize) {
      const batch = mappedRows.slice(i, i + batchSize);
      const res = await fetch(`/api/import/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: batch }),
      });
      const data = await res.json();
      totalOk += data.ok ?? 0;
      allErrors.push(...(data.errors ?? []));
      setProgress(Math.round(((i + batch.length) / mappedRows.length) * 100));
    }
    setResults({ ok: totalOk, errors: allErrors });
    setImporting(false); setStep("done");
  }

  function reset() {
    setRows([]); setFileHeaders([]); setMapping({});
    setStep("upload"); setProgress(0); setResults({ ok: 0, errors: [] });
    if (fileRef.current) fileRef.current.value = "";
  }

  const steps = ["upload","mapping","preview","done"];
  const stepLabels = ["1. Fichier","2. Colonnes","3. Aperçu","4. Résultat"];

  return (
    <div style={{ padding:32, minHeight:"100vh", background:"var(--bg)" }}>
      <div style={{ maxWidth:860, margin:"0 auto" }}>

        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", color:"var(--su-600)", marginBottom:4 }}>IMPORT</div>
          <h1 style={{ fontSize:28, fontWeight:700, color:"var(--text-1)", margin:0, letterSpacing:"-0.02em" }}>Importer des données</h1>
          <p style={{ fontSize:13, color:"var(--text-3)", marginTop:6 }}>Supporte CSV avec mapping de colonnes automatique.</p>
        </div>

        {/* Étapes */}
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:24, flexWrap:"wrap" }}>
          {stepLabels.map((label, i) => {
            const current = steps.indexOf(step);
            const done = i < current; const active = i === current;
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:12, fontWeight:600, padding:"5px 12px", borderRadius:20, background: active?"var(--su-700)":done?"var(--deal-fundraising-bg)":"var(--surface-2)", color: active?"white":done?"var(--deal-fundraising-text)":"var(--text-4)", border:`1px solid ${active?"var(--su-700)":done?"var(--deal-fundraising-dot)":"var(--border)"}` }}>
                  {done?"✓ ":""}{label}
                </span>
                {i < 3 && <span style={{ fontSize:16, color:"var(--border-2)" }}>›</span>}
              </div>
            );
          })}
        </div>

        {/* Mode */}
        <div className="su-card" style={{ padding:18, marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.08em", color:"var(--text-4)", marginBottom:10 }}>TYPE D'IMPORT</div>
          <div style={{ display:"flex", gap:8 }}>
            {(["contacts","organisations","dossiers"] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); reset(); }}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 18px", borderRadius:9, fontSize:13, fontWeight:600, cursor:"pointer", border:"none", background: mode===m?"var(--su-700)":"var(--surface-2)", color: mode===m?"white":"var(--text-2)" }}>
                {MODE_ICONS[m]} {MODE_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        {/* ÉTAPE 1 */}
        {step === "upload" && (
          <div className="su-card" style={{ padding:24, marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:18, flexWrap:"wrap", gap:12 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--text-1)", marginBottom:8 }}>Colonnes attendues</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {cols.map(c => (
                    <span key={c.key} style={{ fontSize:11, padding:"3px 8px", borderRadius:6, background: c.required?"var(--su-50)":"var(--surface-2)", color: c.required?"var(--su-700)":"var(--text-3)", border:`1px solid ${c.required?"var(--su-200)":"var(--border)"}`, fontWeight: c.required?700:400 }}>
                      {c.label}{c.required?" *":""}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => downloadCSVTemplate(mode)}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9, border:"1px solid var(--border)", background:"white", color:"var(--text-2)", fontSize:12, fontWeight:600, cursor:"pointer", flexShrink:0 }}>
                <Download size={13}/> Télécharger template CSV
              </button>
            </div>
            <div onClick={() => fileRef.current?.click()}
              style={{ border:"2px dashed var(--border-2)", borderRadius:14, padding:"40px 24px", textAlign:"center", cursor:"pointer", background:"var(--surface-2)" }}>
              <Upload size={28} color="var(--su-400)" style={{ margin:"0 auto 12px", display:"block" }}/>
              <div style={{ fontSize:14, fontWeight:600, color:"var(--text-2)", marginBottom:4 }}>Cliquer pour choisir un fichier CSV</div>
              <div style={{ fontSize:12, color:"var(--text-4)" }}>Format CSV, encodage UTF-8</div>
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display:"none" }}/>
          </div>
        )}

        {/* ÉTAPE 2 */}
        {step === "mapping" && (
          <div className="su-card" style={{ padding:24, marginBottom:14 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--text-1)", marginBottom:4 }}>Correspondance des colonnes</div>
            <p style={{ fontSize:12, color:"var(--text-3)", marginBottom:20 }}>{rows.length} ligne{rows.length>1?"s":""} détectée{rows.length>1?"s":""}. Associe chaque colonne CRM à celle de ton fichier.</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
              {cols.map(col => (
                <div key={col.key} style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                  <div style={{ flex:"0 0 150px", paddingTop:2 }}>
                    <div style={{ fontSize:12, fontWeight:700, color: col.required?"var(--su-700)":"var(--text-2)" }}>{col.label}{col.required?" *":""}</div>
                    {col.hint && <div style={{ fontSize:10, color:"var(--text-4)", marginTop:1 }}>{col.hint}</div>}
                  </div>
                  <ArrowRight size={13} color="var(--text-4)" style={{ flexShrink:0, marginTop:4 }}/>
                  <select value={mapping[col.key] ?? ""} onChange={e => setMapping(p => ({...p,[col.key]:e.target.value}))}
                    style={{ flex:1, borderRadius:8, border:`1px solid ${col.required&&!mapping[col.key]?"var(--deal-recruitment-dot)":"var(--border)"}`, background:"var(--surface-2)", padding:"7px 10px", fontSize:12, color:"var(--text-1)", outline:"none" }}>
                    <option value="">— Ignorer —</option>
                    {fileHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button onClick={reset} style={{ padding:"9px 16px", borderRadius:9, border:"1px solid var(--border)", background:"white", color:"var(--text-2)", fontSize:13, cursor:"pointer" }}>Recommencer</button>
              <button onClick={goPreview} style={{ padding:"9px 20px", borderRadius:9, background:"var(--su-700)", color:"white", fontSize:13, fontWeight:600, cursor:"pointer", border:"none" }}>
                Prévisualiser →
              </button>
            </div>
          </div>
        )}

        {/* ÉTAPE 3 */}
        {step === "preview" && (
          <div className="su-card" style={{ padding:24, marginBottom:14 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--text-1)", marginBottom:4 }}>{rows.length} ligne{rows.length>1?"s":""} à importer</div>
            <p style={{ fontSize:12, color:"var(--text-3)", marginBottom:16 }}>Aperçu des 5 premières lignes :</p>
            <div style={{ overflowX:"auto", marginBottom:20 }}>
              <table style={{ width:"100%", fontSize:11, borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"var(--surface-2)" }}>
                    {cols.filter(c => mapping[c.key]).map(c => (
                      <th key={c.key} style={{ padding:"8px 10px", textAlign:"left", color:"var(--text-3)", fontWeight:700, borderBottom:"1px solid var(--border)", whiteSpace:"nowrap" }}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0,5).map((row, i) => (
                    <tr key={i} style={{ borderBottom:"1px solid var(--border)" }}>
                      {cols.filter(c => mapping[c.key]).map(c => (
                        <td key={c.key} style={{ padding:"7px 10px", color:"var(--text-2)", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {row[mapping[c.key]] || <span style={{ color:"var(--text-4)", fontStyle:"italic" }}>vide</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {importing ? (
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <Loader2 size={15} style={{ animation:"spin 1s linear infinite", color:"var(--su-600)" }}/>
                  <span style={{ fontSize:13, color:"var(--text-2)" }}>Import en cours… {progress}%</span>
                </div>
                <div style={{ height:6, borderRadius:3, background:"var(--border)" }}>
                  <div style={{ height:"100%", borderRadius:3, background:"var(--su-600)", width:`${progress}%`, transition:"width 0.3s" }}/>
                </div>
              </div>
            ) : (
              <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
                <button onClick={() => setStep("mapping")} style={{ padding:"9px 16px", borderRadius:9, border:"1px solid var(--border)", background:"white", color:"var(--text-2)", fontSize:13, cursor:"pointer" }}>← Modifier</button>
                <button onClick={runImport} style={{ padding:"9px 22px", borderRadius:9, background:"var(--su-700)", color:"white", fontSize:13, fontWeight:600, cursor:"pointer", border:"none" }}>
                  Importer {rows.length} ligne{rows.length>1?"s":""}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ÉTAPE 4 */}
        {step === "done" && (
          <div className="su-card" style={{ padding:24 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
              <CheckCircle size={28} color="var(--deal-fundraising-dot)"/>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:"var(--text-1)" }}>Import terminé</div>
                <div style={{ fontSize:13, color:"var(--deal-fundraising-text)", fontWeight:600, marginTop:2 }}>
                  {results.ok} ligne{results.ok>1?"s":""} importée{results.ok>1?"s":""} avec succès
                </div>
              </div>
            </div>
            {results.errors.length > 0 && (
              <div style={{ marginBottom:16, padding:"12px 14px", borderRadius:10, background:"var(--deal-recruitment-bg)" }}>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--deal-recruitment-text)", marginBottom:6, display:"flex", alignItems:"center", gap:5 }}>
                  <AlertCircle size={13}/> {results.errors.length} erreur{results.errors.length>1?"s":""}
                </div>
                <div style={{ maxHeight:200, overflowY:"auto" }}>
                  {results.errors.map((e,i) => <div key={i} style={{ fontSize:11, color:"var(--deal-recruitment-text)", marginBottom:2 }}>• {e}</div>)}
                </div>
              </div>
            )}
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={reset} style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 16px", borderRadius:9, border:"1px solid var(--border)", background:"white", color:"var(--text-2)", fontSize:13, cursor:"pointer" }}>
                <RefreshCw size={13}/> Nouvel import
              </button>
              <a href={`/protected/${mode}`} style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 20px", borderRadius:9, background:"var(--su-700)", color:"white", fontSize:13, fontWeight:600, textDecoration:"none" }}>
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
