"use client";

import { useState } from "react";
import { Search, Globe, Edit, Plus, X, Loader2, CheckCircle } from "lucide-react";

type Org = {
  id: string; name: string; typeLabel: string; statusLabel: string; status: string;
  sector: string; country: string; website: string | null; notes: string; dealsCount: number;
};

const typeStyle: Record<string, { bg: string; text: string }> = {
  "Client":            { bg:"var(--deal-ma-buy-bg)",       text:"var(--deal-ma-buy-text)" },
  "Prospect client":   { bg:"var(--su-50)",                text:"var(--su-700)" },
  "Investisseur":      { bg:"var(--deal-fundraising-bg)",  text:"var(--deal-fundraising-text)" },
  "Family office":     { bg:"var(--deal-fundraising-bg)",  text:"var(--deal-fundraising-text)" },
  "Repreneur":         { bg:"var(--deal-ma-sell-bg)",      text:"var(--deal-ma-sell-text)" },
  "Cible":             { bg:"var(--deal-recruitment-bg)",  text:"var(--deal-recruitment-text)" },
  "Cabinet juridique": { bg:"var(--deal-cfo-bg)",          text:"var(--deal-cfo-text)" },
};

const statusStyle: Record<string, { bg: string; text: string; label: string }> = {
  active:    { bg:"var(--deal-fundraising-bg)", text:"var(--deal-fundraising-text)", label:"Actif" },
  priority:  { bg:"var(--deal-recruitment-bg)", text:"var(--deal-recruitment-text)", label:"Prioritaire" },
  qualified: { bg:"var(--deal-ma-sell-bg)",     text:"var(--deal-ma-sell-text)",     label:"Qualifié" },
  to_qualify:{ bg:"var(--surface-2)",           text:"var(--text-4)",                label:"À qualifier" },
  dormant:   { bg:"var(--deal-ma-buy-bg)",      text:"var(--deal-ma-buy-text)",      label:"Dormant" },
  inactive:  { bg:"var(--surface-2)",           text:"var(--text-4)",                label:"Inactif" },
  excluded:  { bg:"var(--deal-recruitment-bg)", text:"var(--deal-recruitment-text)", label:"Exclu" },
};

const orgTypes = [
  ["client","Client"],["prospect_client","Prospect client"],["investor","Investisseur"],
  ["buyer","Repreneur"],["target","Cible"],["law_firm","Cabinet juridique"],
  ["bank","Banque"],["advisor","Conseil"],["accounting_firm","Cabinet comptable"],
  ["family_office","Family office"],["corporate","Corporate"],["consulting_firm","Cabinet de conseil"],["other","Autre"],
];

const inp = { width:"100%", borderRadius:9, border:"1px solid var(--border)", background:"var(--surface-2)", padding:"9px 12px", fontSize:13, color:"var(--text-1)", outline:"none", boxSizing:"border-box" } as React.CSSProperties;
const lbl = { display:"block", fontSize:11, fontWeight:700, color:"var(--text-3)", marginBottom:5, letterSpacing:"0.04em" } as React.CSSProperties;

function EditOrgModal({ org, onClose, onSaved }: { org: Org; onClose: () => void; onSaved: (updated: Partial<Org>) => void }) {
  const [form, setForm] = useState({
    name: org.name,
    organization_type: Object.entries({ client:"Client", prospect_client:"Prospect client", investor:"Investisseur", buyer:"Repreneur", target:"Cible", law_firm:"Cabinet juridique", bank:"Banque", advisor:"Conseil", accounting_firm:"Cabinet comptable", family_office:"Family office", corporate:"Corporate", consulting_firm:"Cabinet de conseil", other:"Autre" }).find(([,v]) => v === org.typeLabel)?.[0] ?? "other",
    base_status: org.status,
    sector: org.sector,
    country: org.country,
    website: org.website ?? "",
    notes: org.notes,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true); setError("");
    const res = await fetch(`/api/organisations/${org.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Erreur"); setSaving(false); return; }
    setSaved(true);
    onSaved({ name: form.name, sector: form.sector, country: form.country, website: form.website || null, notes: form.notes, status: form.base_status });
    setTimeout(onClose, 800);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(13,31,53,0.55)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={onClose}>
      <div style={{ background:"white", borderRadius:18, padding:28, width:"100%", maxWidth:520, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 80px rgba(0,0,0,0.2)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <h2 style={{ fontSize:18, fontWeight:700, color:"var(--text-1)", margin:0 }}>Modifier l'organisation</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-3)", padding:4 }}><X size={18}/></button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={lbl}>NOM *</label>
            <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} style={inp}/>
          </div>
          <div>
            <label style={lbl}>TYPE</label>
            <select value={form.organization_type} onChange={e=>setForm(p=>({...p,organization_type:e.target.value}))} style={{ ...inp, background:"var(--surface-2)" }}>
              {orgTypes.map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>STATUT</label>
            <select value={form.base_status} onChange={e=>setForm(p=>({...p,base_status:e.target.value}))} style={{ ...inp, background:"var(--surface-2)" }}>
              {Object.entries(statusStyle).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>SECTEUR</label>
            <input value={form.sector} onChange={e=>setForm(p=>({...p,sector:e.target.value}))} style={inp}/>
          </div>
          <div>
            <label style={lbl}>PAYS</label>
            <input value={form.country} onChange={e=>setForm(p=>({...p,country:e.target.value}))} style={inp}/>
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={lbl}>SITE WEB</label>
            <input value={form.website} onChange={e=>setForm(p=>({...p,website:e.target.value}))} placeholder="https://…" style={inp}/>
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={lbl}>NOTES</label>
            <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} rows={3} style={{ ...inp, resize:"none" }}/>
          </div>
        </div>
        {error && <p style={{ fontSize:12, color:"var(--deal-recruitment-text)", marginTop:10 }}>{error}</p>}
        <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ padding:"9px 18px", borderRadius:9, border:"1px solid var(--border)", background:"white", color:"var(--text-2)", fontSize:13, cursor:"pointer" }}>Annuler</button>
          <button onClick={save} disabled={saving||saved} style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 22px", borderRadius:9, background:saved?"var(--deal-fundraising-dot)":"var(--su-700)", color:"white", fontSize:13, fontWeight:600, cursor:"pointer", border:"none" }}>
            {saving?<Loader2 size={14} style={{ animation:"spin 1s linear infinite" }}/>:saved?<CheckCircle size={14}/>:null}
            {saving?"Enregistrement…":saved?"Enregistré !":"Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrganisationsList({ orgs: initial, stats }: { orgs: Org[]; stats: { total: number } }) {
  const [orgs, setOrgs] = useState(initial);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<Org | null>(null);

  const types = [...new Set(orgs.map(o => o.typeLabel))].sort();

  const filtered = orgs.filter(o => {
    const s = search.toLowerCase();
    const matchSearch = !s || o.name.toLowerCase().includes(s) || o.sector.toLowerCase().includes(s) || o.country.toLowerCase().includes(s);
    const matchType = typeFilter === "all" || o.typeLabel === typeFilter;
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  function handleSaved(id: string, updated: Partial<Org>) {
    setOrgs(prev => prev.map(o => o.id === id ? { ...o, ...updated } : o));
  }

  return (
    <div style={{ padding:32, minHeight:"100vh", background:"var(--bg)" }}>
      {editing && (
        <EditOrgModal org={editing} onClose={() => setEditing(null)} onSaved={upd => handleSaved(editing.id, upd)} />
      )}

      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", color:"var(--su-600)", marginBottom:4 }}>MODULE CRM</div>
          <h1 style={{ fontSize:28, fontWeight:700, color:"var(--text-1)", margin:0, letterSpacing:"-0.02em" }}>Organisations</h1>
          <p style={{ fontSize:13, color:"var(--text-3)", marginTop:4 }}>{stats.total} organisations</p>
        </div>
        <a href="/protected/organisations/nouveau" style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"9px 20px", borderRadius:10, background:"var(--su-700)", color:"white", textDecoration:"none", fontSize:13, fontWeight:600 }}>
          <Plus size={14}/> Nouvelle organisation
        </a>
      </div>

      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <div style={{ position:"relative", flex:1, minWidth:220 }}>
          <Search size={14} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"var(--text-4)" }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher nom, secteur, pays…"
            style={{ width:"100%", borderRadius:10, border:"1px solid var(--border)", background:"var(--surface)", padding:"9px 12px 9px 36px", fontSize:13, color:"var(--text-1)", outline:"none", boxSizing:"border-box" }}/>
        </div>
        <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}
          style={{ borderRadius:10, border:"1px solid var(--border)", background:"var(--surface)", padding:"9px 14px", fontSize:13, color:"var(--text-1)", outline:"none" }}>
          <option value="all">Tous les types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          style={{ borderRadius:10, border:"1px solid var(--border)", background:"var(--surface)", padding:"9px 14px", fontSize:13, color:"var(--text-1)", outline:"none" }}>
          <option value="all">Tous les statuts</option>
          {Object.entries(statusStyle).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <p style={{ fontSize:12, color:"var(--text-4)", marginBottom:10 }}>{filtered.length} résultat{filtered.length>1?"s":""}</p>

      {filtered.length === 0 ? (
        <div style={{ borderRadius:16, border:"2px dashed var(--border)", padding:48, textAlign:"center" }}>
          <p style={{ fontSize:13, color:"var(--text-4)" }}>Aucune organisation trouvée.</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {filtered.map(org => {
            const ts = typeStyle[org.typeLabel] ?? { bg:"var(--surface-2)", text:"var(--text-3)" };
            const ss = statusStyle[org.status] ?? statusStyle.to_qualify;
            return (
              <div key={org.id} className="su-card" style={{ padding:"11px 16px", display:"flex", alignItems:"center", gap:12 }}>
                <a href={`/protected/organisations/${org.id}`} style={{ flex:1, minWidth:0, textDecoration:"none" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                    <span style={{ fontSize:14, fontWeight:700, color:"var(--text-1)" }}>{org.name}</span>
                    <span style={{ fontSize:11, fontWeight:600, borderRadius:6, padding:"2px 7px", background:ts.bg, color:ts.text }}>{org.typeLabel}</span>
                    <span style={{ fontSize:11, fontWeight:600, borderRadius:6, padding:"2px 7px", background:ss.bg, color:ss.text }}>{ss.label}</span>
                  </div>
                  <div style={{ fontSize:12, color:"var(--text-3)", marginTop:1 }}>
                    {org.sector && <span>{org.sector}</span>}
                    {org.sector && org.country && <span style={{ margin:"0 4px", color:"var(--border-2)" }}>·</span>}
                    {org.country && <span>📍 {org.country}</span>}
                    {org.dealsCount > 0 && <span style={{ marginLeft:8, color:"var(--su-600)", fontWeight:500 }}>· {org.dealsCount} dossier{org.dealsCount>1?"s":""}</span>}
                  </div>
                </a>
                <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
                  {org.website && (
                    <a href={org.website} target="_blank" rel="noreferrer"
                      style={{ display:"flex", alignItems:"center", justifyContent:"center", width:28, height:28, borderRadius:7, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--su-600)" }}>
                      <Globe size={12}/>
                    </a>
                  )}
                  <button onClick={() => setEditing(org)}
                    style={{ display:"flex", alignItems:"center", justifyContent:"center", width:28, height:28, borderRadius:7, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text-3)", cursor:"pointer" }}>
                    <Edit size={12}/>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
