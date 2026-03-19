"use client";

import { useState } from "react";
import { HardDrive, Loader2, Search, Check, Plus, CheckCircle, ExternalLink, FileText, FileSpreadsheet, FilePresentation } from "lucide-react";

type DriveFile = {
  id: string; name: string; mimeType: string; modifiedTime: string;
  url: string; icon: string | null; size: string | null; type: string;
};

type Deal = { id: string; name: string };

function fileIcon(mime: string) {
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "📊";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "📑";
  if (mime.includes("document") || mime.includes("word")) return "📄";
  if (mime.includes("pdf")) return "📕";
  if (mime.includes("image")) return "🖼";
  return "📁";
}

function fmtDate(v: string) {
  try { return new Date(v).toLocaleDateString("fr-FR", { day:"numeric", month:"short", year:"numeric" }); }
  catch { return v; }
}

export function DriveImport({ deals, defaultDealId }: { deals: Deal[]; defaultDealId?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetDeal, setTargetDeal] = useState(defaultDealId ?? "");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);

  async function loadFiles(q = "") {
    setLoading(true);
    const url = q ? `/api/gdrive/list?q=${encodeURIComponent(q)}` : "/api/gdrive/list";
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) { setLoading(false); return; }
    setFiles(data.files ?? []);
    setLoaded(true);
    setLoading(false);
    setSelected(new Set());
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === files.length) setSelected(new Set());
    else setSelected(new Set(files.map(f => f.id)));
  }

  async function importSelected() {
    if (!targetDeal) { alert("Sélectionne un dossier."); return; }
    const toImport = files.filter(f => selected.has(f.id));
    if (!toImport.length) return;
    setImporting(true);
    const res = await fetch("/api/gdrive/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: toImport, deal_id: targetDeal }),
    });
    const data = await res.json();
    setResult(data);
    setImporting(false);
    setSelected(new Set());
  }

  return (
    <div style={{ borderRadius:12, border:"1px solid var(--border)", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"14px 18px", background:"var(--surface-2)", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.08em", color:"var(--text-3)", display:"flex", alignItems:"center", gap:6 }}>
          <HardDrive size={13}/> IMPORTER DEPUIS GOOGLE DRIVE
        </div>
        {!loaded ? (
          <button onClick={() => loadFiles()} disabled={loading}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:8, border:"none", background:"var(--su-700)", color:"white", fontSize:12, fontWeight:600, cursor:"pointer" }}>
            {loading ? <Loader2 size={12} style={{ animation:"spin 1s linear infinite" }}/> : <HardDrive size={12}/>}
            {loading ? "Chargement…" : "Voir mes fichiers Drive"}
          </button>
        ) : (
          <span style={{ fontSize:11, color:"var(--text-4)" }}>{files.length} fichier{files.length>1?"s":""} récents</span>
        )}
      </div>

      {loaded && (
        <div style={{ padding:"16px 18px" }}>
          {/* Barre de recherche */}
          <div style={{ display:"flex", gap:8, marginBottom:14 }}>
            <div style={{ flex:1, position:"relative" }}>
              <Search size={13} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--text-4)" }}/>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&loadFiles(search)}
                placeholder="Rechercher dans Drive…"
                style={{ width:"100%", borderRadius:9, border:"1px solid var(--border)", background:"var(--surface-2)", padding:"8px 12px 8px 30px", fontSize:12, color:"var(--text-1)", outline:"none", boxSizing:"border-box" }}
              />
            </div>
            <button onClick={() => loadFiles(search)} disabled={loading}
              style={{ padding:"8px 14px", borderRadius:9, border:"1px solid var(--border)", background:"white", color:"var(--text-2)", fontSize:12, fontWeight:600, cursor:"pointer" }}>
              {loading ? <Loader2 size={12} style={{ animation:"spin 1s linear infinite" }}/> : "Chercher"}
            </button>
          </div>

          {/* Contrôles sélection + dossier */}
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12, flexWrap:"wrap" }}>
            <button onClick={toggleAll} style={{ fontSize:11, fontWeight:600, color:"var(--su-600)", background:"none", border:"none", cursor:"pointer", padding:0 }}>
              {selected.size === files.length ? "Tout désélectionner" : "Tout sélectionner"}
            </button>
            <span style={{ fontSize:11, color:"var(--text-4)" }}>{selected.size} sélectionné{selected.size>1?"s":""}</span>
            <select value={targetDeal} onChange={e=>setTargetDeal(e.target.value)}
              style={{ flex:1, minWidth:200, borderRadius:8, border:"1px solid var(--border)", background:"var(--surface-2)", padding:"7px 10px", fontSize:12, color:"var(--text-1)", outline:"none" }}>
              <option value="">Choisir un dossier *</option>
              {deals.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button onClick={importSelected} disabled={importing || selected.size===0 || !targetDeal}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:8, border:"none", background: (selected.size===0||!targetDeal)?"var(--border)":"var(--su-700)", color: (selected.size===0||!targetDeal)?"var(--text-4)":"white", fontSize:12, fontWeight:600, cursor: (selected.size===0||!targetDeal)?"not-allowed":"pointer" }}>
              {importing ? <Loader2 size={12} style={{ animation:"spin 1s linear infinite" }}/> : <Plus size={12}/>}
              {importing ? "Import…" : `Importer ${selected.size}`}
            </button>
          </div>

          {/* Liste fichiers */}
          <div style={{ display:"flex", flexDirection:"column", gap:5, maxHeight:340, overflowY:"auto" }}>
            {files.map(f => (
              <div key={f.id} onClick={()=>toggle(f.id)}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", borderRadius:9, border:`1px solid ${selected.has(f.id)?"var(--su-400)":"var(--border)"}`, background: selected.has(f.id)?"var(--su-50)":"var(--surface)", cursor:"pointer" }}>
                {/* Checkbox */}
                <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${selected.has(f.id)?"var(--su-600)":"var(--border-2)"}`, background: selected.has(f.id)?"var(--su-600)":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {selected.has(f.id) && <Check size={11} color="white"/>}
                </div>
                {/* Icône */}
                <span style={{ fontSize:18, flexShrink:0 }}>{fileIcon(f.mimeType)}</span>
                {/* Infos */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--text-1)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{f.name}</div>
                  <div style={{ fontSize:11, color:"var(--text-4)", marginTop:1 }}>
                    {fmtDate(f.modifiedTime)}{f.size ? ` · ${f.size}` : ""}
                  </div>
                </div>
                {/* Lien ouvrir */}
                <a href={f.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                  style={{ display:"flex", alignItems:"center", justifyContent:"center", width:28, height:28, borderRadius:7, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--su-600)", flexShrink:0 }}>
                  <ExternalLink size={12}/>
                </a>
              </div>
            ))}
            {files.length===0 && <p style={{ fontSize:12, color:"var(--text-4)", textAlign:"center", padding:"24px 0" }}>Aucun fichier trouvé.</p>}
          </div>

          {/* Résultat */}
          {result && (
            <div style={{ marginTop:12, padding:"10px 14px", borderRadius:9, background: result.errors.length?"var(--deal-ma-sell-bg)":"var(--deal-fundraising-bg)" }}>
              <div style={{ fontWeight:700, color:"var(--deal-fundraising-text)", fontSize:12 }}>
                <CheckCircle size={13} style={{ display:"inline", marginRight:5 }}/>
                {result.imported} fichier{result.imported>1?"s":""} ajouté{result.imported>1?"s":""} aux documents du dossier
              </div>
              {result.errors.map((e,i)=><div key={i} style={{ fontSize:11, color:"var(--deal-ma-sell-text)", marginTop:3 }}>• {e}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
