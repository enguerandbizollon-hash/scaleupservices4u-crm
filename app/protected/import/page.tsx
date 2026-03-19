"use client";
import { useState, useRef } from "react";
import { Upload, Download, CheckCircle, AlertCircle, ArrowRight, Loader2, RefreshCw, FileText } from "lucide-react";

type Mode = "contacts" | "organisations" | "dossiers";

const COLUMNS: Record<Mode, { key: string; label: string; required?: boolean; hint?: string }[]> = {
  contacts: [
    { key:"first_name",        label:"Prénom",          required:true },
    { key:"last_name",         label:"Nom",             required:true },
    { key:"email",             label:"Email" },
    { key:"phone",             label:"Téléphone" },
    { key:"title",             label:"Fonction",        hint:"Ex: Partner, CFO" },
    { key:"organisation_name", label:"Organisation" },
    { key:"role_label",        label:"Rôle" },
    { key:"sector",            label:"Secteur" },
    { key:"country",           label:"Pays" },
    { key:"linkedin_url",      label:"LinkedIn" },
    { key:"notes",             label:"Notes" },
  ],
  organisations: [
    { key:"name",              label:"Nom",             required:true },
    { key:"organization_type", label:"Type",            hint:"investor, client, family_office, law_firm, bank, other…" },
    { key:"base_status",       label:"Statut",          hint:"to_qualify, qualified, active, dormant" },
    { key:"sector",            label:"Secteur" },
    { key:"country",           label:"Pays" },
    { key:"website",           label:"Site web" },
    { key:"notes",             label:"Notes" },
  ],
  dossiers: [
    { key:"name",              label:"Nom",             required:true },
    { key:"deal_type",         label:"Type",            required:true, hint:"fundraising, ma_sell, ma_buy, cfo_advisor, recruitment" },
    { key:"deal_status",       label:"Statut",          hint:"active, inactive, closed" },
    { key:"deal_stage",        label:"Étape",           hint:"kickoff, outreach, dd, negotiation, closing…" },
    { key:"priority_level",    label:"Priorité",        hint:"high, medium, low" },
    { key:"organisation_name", label:"Organisation" },
    { key:"sector",            label:"Secteur" },
    { key:"description",       label:"Description" },
  ],
};

const MODES = { contacts:"Contacts", organisations:"Organisations", dossiers:"Dossiers" } as const;
const ICONS = { contacts:"👤", organisations:"🏢", dossiers:"📁" };

function parseCSV(text: string): Record<string,string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h=>h.trim().replace(/^"|"$/g,"").trim());
  return lines.slice(1).filter(l=>l.trim()).map(line=>{
    const vals = line.split(",").map(v=>v.trim().replace(/^"|"$/g,"").trim());
    return Object.fromEntries(headers.map((h,i)=>[h,vals[i]??""]));
  });
}

function autoMap(heads: string[], mode: Mode) {
  const map: Record<string,string> = {};
  const expected = COLUMNS[mode].map(c=>c.key);
  const aliases: Record<string,string[]> = {
    first_name:["prenom","prénom","firstname","first"],
    last_name:["nom","lastname","surname"],
    email:["mail","courriel"],
    phone:["tel","telephone","mobile"],
    title:["fonction","poste","job","position"],
    organisation_name:["organisation","organization","société","company","entreprise","firm"],
    name:["nom","raison_sociale","company","entreprise"],
    website:["site","url","web"],
    country:["pays"],
    sector:["secteur","industry"],
    deal_type:["type","mission_type"],
    deal_status:["statut","status"],
    priority_level:["priorite","priorité","priority"],
  };
  for (const h of heads) {
    const low = h.toLowerCase().replace(/[^a-z0-9]/g,"_");
    const exact = expected.find(k=>k===low||k===h);
    if (exact && !map[exact]) { map[exact]=h; continue; }
    for (const [k,al] of Object.entries(aliases)) {
      if (expected.includes(k) && !map[k] && al.some(a=>low.includes(a))) { map[k]=h; break; }
    }
  }
  return map;
}

function downloadTemplate(mode: Mode) {
  const cols = COLUMNS[mode];
  const examples: Record<Mode,string> = {
    contacts:"Jean,Dupont,jean@example.com,+33600000000,Partner,Sequoia Capital,Decision maker,VC,France,https://linkedin.com/in/jean,",
    organisations:"Sequoia Capital,investor,to_qualify,VC / PE,USA,https://sequoiacap.com,",
    dossiers:"Redpeaks Série A,fundraising,active,outreach,high,Redpeaks,SaaS,Levée série A",
  };
  const blob = new Blob([cols.map(c=>c.key).join(",")+"\n"+examples[mode]], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"),{href:url,download:`template_${mode}.csv`}).click();
  URL.revokeObjectURL(url);
}

export default function ImportPage() {
  const [mode, setMode] = useState<Mode>("contacts");
  const [rows, setRows] = useState<Record<string,string>[]>([]);
  const [heads, setHeads] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string,string>>({});
  const [step, setStep] = useState<"upload"|"mapping"|"preview"|"done">("upload");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ok:number;errors:string[]}>({ok:0,errors:[]});
  const fileRef = useRef<HTMLInputElement>(null);
  const cols = COLUMNS[mode];

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseCSV(ev.target?.result as string);
      if (!parsed.length) { alert("Fichier vide ou format incorrect."); return; }
      const h = Object.keys(parsed[0]);
      setHeads(h); setRows(parsed); setMapping(autoMap(h,mode)); setStep("mapping");
    };
    reader.readAsText(f,"UTF-8");
  }

  function goPreview() {
    const miss = cols.filter(c=>c.required&&!mapping[c.key]).map(c=>c.label);
    if (miss.length) { alert(`Obligatoires manquantes : ${miss.join(", ")}`); return; }
    setStep("preview");
  }

  async function runImport() {
    setLoading(true); setProgress(0);
    const mapped = rows.map(r=>Object.fromEntries(Object.entries(mapping).map(([k,fh])=>[k,r[fh]??""])));
    let ok=0; const errs:string[]=[];
    for (let i=0;i<mapped.length;i+=50) {
      const batch=mapped.slice(i,i+50);
      const res=await fetch(`/api/import/${mode}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rows:batch})});
      const d=await res.json();
      ok+=d.ok??0; errs.push(...(d.errors??[]));
      setProgress(Math.round(((i+batch.length)/mapped.length)*100));
    }
    setResults({ok,errors:errs}); setLoading(false); setStep("done");
  }

  function reset() {
    setRows([]); setHeads([]); setMapping({}); setStep("upload"); setProgress(0); setResults({ok:0,errors:[]});
    if (fileRef.current) fileRef.current.value="";
  }

  const STEPS = ["upload","mapping","preview","done"];
  const STEP_LABELS = ["Fichier","Colonnes","Aperçu","Résultat"];

  return (
    <div style={{ padding:32, minHeight:"100vh", background:"var(--bg)" }}>
      <div style={{ maxWidth:900, margin:"0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <div className="section-label" style={{ marginBottom:6 }}>DONNÉES</div>
          <h1>Import de données</h1>
          <p style={{ fontSize:13, color:"var(--text-3)", marginTop:6 }}>Importez vos contacts, organisations ou dossiers depuis un fichier CSV.</p>
        </div>

        {/* Mode selector */}
        <div className="card" style={{ padding:20, marginBottom:14, display:"flex", gap:0 }}>
          {(Object.entries(MODES) as [Mode,string][]).map(([m,l]) => (
            <button key={m} onClick={()=>{setMode(m);reset();}}
              style={{ flex:1, padding:"12px 16px", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, borderRadius:9, transition:"all 0.12s",
                background: mode===m ? "var(--su-600)" : "transparent",
                color: mode===m ? "#fff" : "var(--text-3)",
              }}>
              {ICONS[m]} {l}
            </button>
          ))}
        </div>

        {/* Steps indicator */}
        <div style={{ display:"flex", alignItems:"center", gap:0, marginBottom:20 }}>
          {STEP_LABELS.map((l,i) => {
            const cur = STEPS.indexOf(step); const done = i<cur; const active = i===cur;
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11.5, fontWeight:600,
                  color: active?"var(--su-600)":done?"var(--fund-tx)":"var(--text-5)",
                  padding:"6px 10px", borderRadius:7,
                  background: active?"var(--su-50)":done?"var(--fund-bg)":"transparent",
                  border: `1px solid ${active?"var(--su-200)":done?"var(--fund-dot)20":"transparent"}`,
                }}>
                  {done ? <CheckCircle size={12}/> : <span style={{ width:16, height:16, borderRadius:"50%", background:active?"var(--su-600)":"var(--border)", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:9, color:active?"#fff":"var(--text-4)", fontWeight:700 }}>{i+1}</span>}
                  {l}
                </div>
                {i<3 && <div style={{ flex:1, height:1, background:"var(--border)", margin:"0 4px" }}/>}
              </div>
            );
          })}
        </div>

        {/* STEP 1 — Upload */}
        {step==="upload" && (
          <div className="card" style={{ padding:28 }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20, gap:16, flexWrap:"wrap" }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--text-1)", marginBottom:10 }}>Colonnes attendues</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {cols.map(c=>(
                    <span key={c.key} style={{ fontSize:11, padding:"3px 9px", borderRadius:6,
                      background:c.required?"var(--su-50)":"var(--surface-3)",
                      color:c.required?"var(--su-600)":"var(--text-4)",
                      border:`1px solid ${c.required?"var(--su-200)":"var(--border)"}`,
                      fontWeight:c.required?700:400,
                    }}>
                      {c.label}{c.required?" *":""}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={()=>downloadTemplate(mode)} className="btn btn-secondary btn-sm">
                <Download size={12}/> Télécharger template
              </button>
            </div>

            <div onClick={()=>fileRef.current?.click()}
              style={{ border:"2px dashed var(--border-2)", borderRadius:12, padding:"52px 32px", textAlign:"center", cursor:"pointer", background:"var(--surface-2)", transition:"border-color 0.12s, background 0.12s" }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--su-300)";(e.currentTarget as HTMLElement).style.background="var(--su-20)"}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border-2)";(e.currentTarget as HTMLElement).style.background="var(--surface-2)"}}>
              <Upload size={28} color="var(--su-300)" style={{ margin:"0 auto 14px",display:"block" }}/>
              <div style={{ fontSize:14, fontWeight:600, color:"var(--text-2)", marginBottom:4 }}>Cliquer pour choisir un fichier CSV</div>
              <div style={{ fontSize:12, color:"var(--text-5)" }}>Encodage UTF-8, séparateur virgule</div>
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display:"none" }}/>
          </div>
        )}

        {/* STEP 2 — Mapping */}
        {step==="mapping" && (
          <div className="card" style={{ padding:28 }}>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:15, fontWeight:700, color:"var(--text-1)", marginBottom:4 }}>Correspondance des colonnes</div>
              <p style={{ fontSize:12.5, color:"var(--text-3)" }}>{rows.length} ligne{rows.length>1?"s":""} détectée{rows.length>1?"s":""}. Associe chaque champ CRM à la colonne de ton fichier.</p>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:24 }}>
              {cols.map(col=>(
                <div key={col.key}>
                  <label className="lbl" style={{ color:col.required&&!mapping[col.key]?"var(--rec-tx)":"var(--text-4)" }}>
                    {col.label}{col.required?" *":""}
                  </label>
                  {col.hint && <div style={{ fontSize:10, color:"var(--text-5)", marginBottom:4 }}>{col.hint}</div>}
                  <select className="inp" value={mapping[col.key]??""} onChange={e=>setMapping(p=>({...p,[col.key]:e.target.value}))}
                    style={{ borderColor:col.required&&!mapping[col.key]?"var(--rec-dot)":"var(--border)" }}>
                    <option value="">— Ignorer —</option>
                    {heads.map(h=><option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
              <button className="btn btn-secondary" onClick={reset}>Recommencer</button>
              <button className="btn btn-primary" onClick={goPreview}>Aperçu <ArrowRight size={13}/></button>
            </div>
          </div>
        )}

        {/* STEP 3 — Preview */}
        {step==="preview" && (
          <div className="card" style={{ padding:28 }}>
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:15, fontWeight:700, color:"var(--text-1)", marginBottom:4 }}>{rows.length} ligne{rows.length>1?"s":""} à importer</div>
              <p style={{ fontSize:12.5, color:"var(--text-3)" }}>Vérifie les 5 premières lignes avant de lancer l'import.</p>
            </div>
            <div style={{ overflowX:"auto", marginBottom:24, borderRadius:10, border:"1px solid var(--border)" }}>
              <table style={{ width:"100%", fontSize:11.5, borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"var(--surface-2)" }}>
                    {cols.filter(c=>mapping[c.key]).map(c=>(
                      <th key={c.key} style={{ padding:"9px 12px", textAlign:"left", color:"var(--text-4)", fontWeight:700, borderBottom:"1px solid var(--border)", whiteSpace:"nowrap", fontSize:10.5, letterSpacing:"0.04em", textTransform:"uppercase" }}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0,5).map((row,i)=>(
                    <tr key={i} style={{ borderBottom:"1px solid var(--border)", background:i%2===0?"var(--surface)":"var(--surface-2)" }}>
                      {cols.filter(c=>mapping[c.key]).map(c=>(
                        <td key={c.key} style={{ padding:"9px 12px", color:"var(--text-2)", maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {row[mapping[c.key]]||<span style={{ color:"var(--text-5)", fontStyle:"italic" }}>vide</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {loading ? (
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <Loader2 size={15} className="animate-spin" style={{ color:"var(--su-500)" }}/>
                  <span style={{ fontSize:13, color:"var(--text-2)", fontWeight:500 }}>Import en cours… {progress}%</span>
                </div>
                <div style={{ height:5, borderRadius:10, background:"var(--border)" }}>
                  <div style={{ height:"100%", borderRadius:10, background:"var(--su-500)", width:`${progress}%`, transition:"width 0.3s ease" }}/>
                </div>
              </div>
            ) : (
              <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
                <button className="btn btn-secondary" onClick={()=>setStep("mapping")}>← Modifier</button>
                <button className="btn btn-primary" onClick={runImport}>Importer {rows.length} ligne{rows.length>1?"s":""}</button>
              </div>
            )}
          </div>
        )}

        {/* STEP 4 — Done */}
        {step==="done" && (
          <div className="card" style={{ padding:32 }}>
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
              <div style={{ width:48, height:48, borderRadius:14, background:"var(--fund-bg)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <CheckCircle size={24} color="var(--fund-tx)"/>
              </div>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:"var(--text-1)" }}>Import terminé</div>
                <div style={{ fontSize:13, color:"var(--fund-tx)", fontWeight:600, marginTop:2 }}>
                  {results.ok} ligne{results.ok>1?"s":""} importée{results.ok>1?"s":""} avec succès
                </div>
              </div>
            </div>

            {results.errors.length > 0 && (
              <div style={{ marginBottom:20, padding:"14px 16px", borderRadius:10, background:"var(--rec-bg)", border:"1px solid var(--rec-dot)20" }}>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--rec-tx)", marginBottom:8, display:"flex", alignItems:"center", gap:5 }}>
                  <AlertCircle size={13}/> {results.errors.length} erreur{results.errors.length>1?"s":""}
                </div>
                <div style={{ maxHeight:180, overflowY:"auto", display:"flex", flexDirection:"column", gap:3 }}>
                  {results.errors.map((e,i)=><div key={i} style={{ fontSize:11.5, color:"var(--rec-tx)" }}>• {e}</div>)}
                </div>
              </div>
            )}

            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-secondary" onClick={reset}><RefreshCw size={13}/>Nouvel import</button>
              <a href={`/protected/${mode}`} className="btn btn-primary">Voir les {MODES[mode].toLowerCase()} <ArrowRight size={13}/></a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
