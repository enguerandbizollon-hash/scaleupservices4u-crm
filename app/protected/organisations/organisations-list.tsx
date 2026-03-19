"use client";

import { useState } from "react";
import { Search, Globe, Edit, Plus } from "lucide-react";

type Org = {
  id: string; name: string; typeLabel: string; statusLabel: string; status: string;
  sector: string; country: string; website: string | null; notes: string; dealsCount: number;
};

const typeStyle: Record<string, { bg: string; text: string }> = {
  "Client":           { bg:"var(--deal-ma-buy-bg)",       text:"var(--deal-ma-buy-text)" },
  "Prospect client":  { bg:"var(--su-50)",                text:"var(--su-700)" },
  "Investisseur":     { bg:"var(--deal-fundraising-bg)",  text:"var(--deal-fundraising-text)" },
  "Family office":    { bg:"var(--deal-fundraising-bg)",  text:"var(--deal-fundraising-text)" },
  "Repreneur":        { bg:"var(--deal-ma-sell-bg)",      text:"var(--deal-ma-sell-text)" },
  "Cible":            { bg:"var(--deal-recruitment-bg)",  text:"var(--deal-recruitment-text)" },
  "Cabinet juridique":{ bg:"var(--deal-cfo-bg)",          text:"var(--deal-cfo-text)" },
  "Banque":           { bg:"var(--surface-2)",            text:"var(--text-2)" },
  "Conseil":          { bg:"var(--deal-ma-buy-bg)",       text:"var(--deal-ma-buy-text)" },
  "Cabinet comptable":{ bg:"var(--deal-cfo-bg)",          text:"var(--deal-cfo-text)" },
  "Corporate":        { bg:"var(--surface-2)",            text:"var(--text-3)" },
  "Autre":            { bg:"var(--surface-2)",            text:"var(--text-3)" },
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

export function OrganisationsList({ orgs, stats }: { orgs: Org[]; stats: { total: number } }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const types = [...new Set(orgs.map(o => o.typeLabel))].sort();

  const filtered = orgs.filter(o => {
    const s = search.toLowerCase();
    const matchSearch = !s || o.name.toLowerCase().includes(s) || o.sector.toLowerCase().includes(s) || o.country.toLowerCase().includes(s);
    const matchType = typeFilter === "all" || o.typeLabel === typeFilter;
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  return (
    <div style={{ padding:32, minHeight:"100vh", background:"var(--bg)" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", color:"var(--su-600)", marginBottom:4 }}>MODULE CRM</div>
          <h1 style={{ fontSize:28, fontWeight:700, color:"var(--text-1)", margin:0, letterSpacing:"-0.02em" }}>Organisations</h1>
          <p style={{ fontSize:13, color:"var(--text-3)", marginTop:4 }}>{stats.total} organisations</p>
        </div>
        <a href="/protected/organisations/nouveau"
          style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"9px 20px", borderRadius:10, background:"var(--su-700)", color:"white", textDecoration:"none", fontSize:13, fontWeight:600 }}>
          <Plus size={14}/> Nouvelle organisation
        </a>
      </div>

      {/* Filtres */}
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        <div style={{ position:"relative", flex:1, minWidth:220 }}>
          <Search size={14} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"var(--text-4)" }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Rechercher nom, secteur, pays…"
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

      <p style={{ fontSize:12, color:"var(--text-4)", marginBottom:12 }}>{filtered.length} résultat{filtered.length>1?"s":""}</p>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div style={{ borderRadius:16, border:"2px dashed var(--border)", padding:48, textAlign:"center" }}>
          <p style={{ fontSize:13, color:"var(--text-4)" }}>Aucune organisation trouvée.</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {filtered.map(org => {
            const ts = typeStyle[org.typeLabel] ?? { bg:"var(--surface-2)", text:"var(--text-3)" };
            const ss = statusStyle[org.status] ?? statusStyle.to_qualify;
            return (
              <div key={org.id} className="su-card" style={{ padding:"14px 18px", display:"flex", alignItems:"center", gap:14 }}>
                {/* Initial */}
                <div style={{ width:36, height:36, borderRadius:10, background:ts.bg, border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:ts.text, flexShrink:0 }}>
                  {org.name.charAt(0).toUpperCase()}
                </div>

                {/* Infos */}
                <a href={`/protected/organisations/${org.id}`} style={{ flex:1, minWidth:0, textDecoration:"none" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <span style={{ fontSize:14, fontWeight:700, color:"var(--text-1)" }}>{org.name}</span>
                    <span style={{ fontSize:11, fontWeight:600, borderRadius:6, padding:"2px 8px", background:ts.bg, color:ts.text }}>{org.typeLabel}</span>
                    <span style={{ fontSize:11, fontWeight:600, borderRadius:6, padding:"2px 8px", background:ss.bg, color:ss.text }}>{ss.label}</span>
                  </div>
                  <div style={{ fontSize:12, color:"var(--text-3)", marginTop:2 }}>
                    {org.sector && org.sector !== "N/A" && <span>{org.sector}</span>}
                    {org.sector && org.sector !== "N/A" && org.country && org.country !== "N/A" && <span style={{ margin:"0 5px", color:"var(--border-2)" }}>·</span>}
                    {org.country && org.country !== "N/A" && <span>📍 {org.country}</span>}
                    {org.dealsCount > 0 && <span style={{ marginLeft:8, color:"var(--su-600)", fontWeight:500 }}>· {org.dealsCount} dossier{org.dealsCount>1?"s":""}</span>}
                  </div>
                </a>

                {/* Actions */}
                <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                  {org.website && (
                    <a href={org.website} target="_blank" rel="noreferrer"
                      style={{ display:"flex", alignItems:"center", justifyContent:"center", width:30, height:30, borderRadius:8, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--su-600)" }}>
                      <Globe size={13}/>
                    </a>
                  )}
                  <a href={`/protected/organisations/${org.id}/modifier`}
                    style={{ display:"flex", alignItems:"center", justifyContent:"center", width:30, height:30, borderRadius:8, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text-3)" }}>
                    <Edit size={13}/>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
