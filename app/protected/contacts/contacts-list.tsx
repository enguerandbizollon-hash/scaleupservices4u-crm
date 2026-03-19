"use client";

import { useState } from "react";
import { Search, Mail, Linkedin, Edit, Phone, Plus } from "lucide-react";

type Contact = {
  id: string; fullName: string; title: string; email: string; phone: string;
  linkedinUrl: string | null; sector: string; ticket: string;
  organisation: string; status: string; notes: string;
};

const statusStyle: Record<string, { bg: string; text: string; label: string }> = {
  active:    { bg:"var(--deal-fundraising-bg)",  text:"var(--deal-fundraising-text)",  label:"Actif" },
  priority:  { bg:"var(--deal-recruitment-bg)",  text:"var(--deal-recruitment-text)",  label:"Prioritaire" },
  qualified: { bg:"var(--deal-ma-sell-bg)",       text:"var(--deal-ma-sell-text)",      label:"Qualifié" },
  to_qualify:{ bg:"var(--surface-2)",             text:"var(--text-4)",                 label:"À qualifier" },
  dormant:   { bg:"var(--deal-ma-buy-bg)",        text:"var(--deal-ma-buy-text)",       label:"Dormant" },
  inactive:  { bg:"var(--surface-2)",             text:"var(--text-4)",                 label:"Inactif" },
  excluded:  { bg:"var(--deal-recruitment-bg)",   text:"var(--deal-recruitment-text)",  label:"Exclu" },
};

export function ContactsList({ contacts, stats }: { contacts: Contact[]; stats: { total: number; active: number } }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = contacts.filter(c => {
    const s = search.toLowerCase();
    const matchSearch = !s || c.fullName.toLowerCase().includes(s) || c.email.toLowerCase().includes(s) || c.organisation.toLowerCase().includes(s) || c.sector.toLowerCase().includes(s);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div style={{ padding:32, minHeight:"100vh", background:"var(--bg)" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", color:"var(--su-600)", marginBottom:4 }}>MODULE CRM</div>
          <h1 style={{ fontSize:28, fontWeight:700, color:"var(--text-1)", margin:0, letterSpacing:"-0.02em" }}>Contacts</h1>
          <p style={{ fontSize:13, color:"var(--text-3)", marginTop:4 }}>{stats.total} contacts · {stats.active} actifs</p>
        </div>
        <a href="/protected/contacts/nouveau"
          style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"9px 20px", borderRadius:10, background:"var(--su-700)", color:"white", textDecoration:"none", fontSize:13, fontWeight:600 }}>
          <Plus size={14}/> Nouveau contact
        </a>
      </div>

      {/* Filtres */}
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        <div style={{ position:"relative", flex:1, minWidth:220 }}>
          <Search size={14} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"var(--text-4)" }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Rechercher nom, email, organisation…"
            style={{ width:"100%", borderRadius:10, border:"1px solid var(--border)", background:"var(--surface)", padding:"9px 12px 9px 36px", fontSize:13, color:"var(--text-1)", outline:"none", boxSizing:"border-box" }}/>
        </div>
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
          <p style={{ fontSize:13, color:"var(--text-4)" }}>Aucun contact trouvé.</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {filtered.map(c => {
            const ss = statusStyle[c.status] ?? statusStyle.to_qualify;
            return (
              <div key={c.id} className="su-card" style={{ padding:"14px 18px", display:"flex", alignItems:"center", gap:14 }}>
                {/* Avatar initial */}
                <div style={{ width:36, height:36, borderRadius:10, background:"var(--su-50)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"var(--su-700)", flexShrink:0 }}>
                  {c.fullName.charAt(0).toUpperCase()}
                </div>

                {/* Infos */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <span style={{ fontSize:14, fontWeight:700, color:"var(--text-1)" }}>{c.fullName}</span>
                    <span style={{ fontSize:11, fontWeight:600, borderRadius:6, padding:"2px 8px", background:ss.bg, color:ss.text }}>{ss.label}</span>
                  </div>
                  <div style={{ fontSize:12, color:"var(--text-3)", marginTop:2 }}>
                    {c.title && <span>{c.title}</span>}
                    {c.title && c.organisation && <span style={{ margin:"0 5px", color:"var(--border-2)" }}>·</span>}
                    {c.organisation && <span style={{ color:"var(--su-600)", fontWeight:500 }}>{c.organisation}</span>}
                    {c.sector && c.sector !== "N/A" && <span style={{ margin:"0 5px", color:"var(--border-2)" }}>·</span>}
                    {c.sector && c.sector !== "N/A" && <span>{c.sector}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                  {c.email && (
                    <a href={`mailto:${c.email}`} title={c.email}
                      style={{ display:"flex", alignItems:"center", justifyContent:"center", width:30, height:30, borderRadius:8, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--su-600)" }}>
                      <Mail size={13}/>
                    </a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone}`} title={c.phone}
                      style={{ display:"flex", alignItems:"center", justifyContent:"center", width:30, height:30, borderRadius:8, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--deal-fundraising-dot)" }}>
                      <Phone size={13}/>
                    </a>
                  )}
                  {c.linkedinUrl && (
                    <a href={c.linkedinUrl} target="_blank" rel="noreferrer"
                      style={{ display:"flex", alignItems:"center", justifyContent:"center", width:30, height:30, borderRadius:8, border:"1px solid var(--border)", background:"var(--surface)", color:"#0A66C2" }}>
                      <Linkedin size={13}/>
                    </a>
                  )}
                  <a href={`/protected/contacts/${c.id}/modifier`}
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
