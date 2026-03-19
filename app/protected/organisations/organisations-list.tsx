"use client";
import { useState } from "react";
import { Search, Globe, Edit2, Plus, X, Loader2, CheckCircle, ExternalLink, Building2 } from "lucide-react";

type Org = {
  id: string; name: string; typeLabel: string; typeKey: string; statusLabel: string; status: string;
  sector: string; country: string; website: string | null; notes: string; dealsCount: number;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  active:     { label:"Actif",       cls:"st-active" },
  priority:   { label:"Prioritaire", cls:"st-priority" },
  qualified:  { label:"Qualifié",    cls:"st-qualified" },
  to_qualify: { label:"À qualifier", cls:"st-to_qualify" },
  dormant:    { label:"Dormant",     cls:"st-dormant" },
  inactive:   { label:"Inactif",     cls:"st-inactive" },
  excluded:   { label:"Exclu",       cls:"st-excluded" },
};

const ORG_TYPES = [
  ["client","Client"],["prospect_client","Prospect client"],["investor","Investisseur"],
  ["buyer","Repreneur"],["target","Cible"],["law_firm","Cabinet juridique"],
  ["bank","Banque"],["advisor","Conseil"],["accounting_firm","Cabinet comptable"],
  ["family_office","Family office"],["corporate","Corporate"],
  ["consulting_firm","Cabinet de conseil"],["other","Autre"],
];

// Couleur accent par type
const typeAccent: Record<string, string> = {
  investor:       "var(--su-600)",
  family_office:  "var(--fund-tx)",
  client:         "var(--buy-tx)",
  prospect_client:"var(--su-500)",
  buyer:          "var(--sell-tx)",
  target:         "var(--rec-tx)",
  law_firm:       "var(--cfo-tx)",
  bank:           "var(--text-3)",
  corporate:      "var(--text-3)",
};

function getAccent(typeKey: string) { return typeAccent[typeKey] ?? "var(--text-3)"; }

function OrgCard({ org, onEdit }: { org: Org; onEdit: () => void }) {
  const st = STATUS[org.status] ?? STATUS.to_qualify;
  const accent = getAccent(org.typeKey);
  const isInvestor = ["investor","family_office","corporate"].includes(org.typeKey);

  // Extraire ticket et secteur d'investissement depuis notes
  let ticket = ""; let investSector = "";
  if (org.notes) {
    const ticketMatch = org.notes.match(/Ticket[:\s]+([^\n|]+)/i);
    const sectorMatch = org.notes.match(/Profil[:\s]+([^\n|]+)/i);
    if (ticketMatch) ticket = ticketMatch[1].trim();
    if (sectorMatch) investSector = sectorMatch[1].trim();
  }

  return (
    <div className="card" style={{ padding:0, overflow:"hidden", display:"flex", flexDirection:"column", transition:"box-shadow 0.15s, transform 0.15s" }}
      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.transform="translateY(-2px)";(e.currentTarget as HTMLElement).style.boxShadow="var(--shadow-md)"}}
      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform="";(e.currentTarget as HTMLElement).style.boxShadow="var(--shadow-sm)"}}>

      {/* Accent bar */}
      <div style={{ height:3, background:accent, borderRadius:"14px 14px 0 0" }}/>

      <div style={{ padding:"16px 18px", flex:1, display:"flex", flexDirection:"column", gap:10 }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
          <div style={{ minWidth:0 }}>
            <a href={`/protected/organisations/${org.id}`} style={{ fontSize:14, fontWeight:700, color:"var(--text-1)", lineHeight:1.3, display:"block", marginBottom:4 }}>
              {org.name}
            </a>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
              <span style={{ fontSize:11, fontWeight:600, color:accent, background:`${accent}18`, borderRadius:5, padding:"1px 7px" }}>{org.typeLabel}</span>
              <span className={`badge ${st.cls}`} style={{ fontSize:10.5 }}>{st.label}</span>
            </div>
          </div>
          <button className="btn-icon" style={{ flexShrink:0, width:28, height:28 }} onClick={onEdit}><Edit2 size={12}/></button>
        </div>

        {/* Divider */}
        <div className="divider"/>

        {/* Infos */}
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {isInvestor && ticket && (
            <InfoRow icon="💰" label="Ticket" value={ticket}/>
          )}
          {isInvestor && investSector && (
            <InfoRow icon="🎯" label="Profil" value={investSector.length > 40 ? investSector.slice(0,40)+"…" : investSector}/>
          )}
          {org.sector && !isInvestor && (
            <InfoRow icon="🏭" label="Secteur" value={org.sector}/>
          )}
          {org.sector && isInvestor && !investSector && (
            <InfoRow icon="🏭" label="Secteur" value={org.sector}/>
          )}
          {org.country && <InfoRow icon="📍" label="Pays" value={org.country}/>}
          {org.dealsCount > 0 && (
            <InfoRow icon="📁" label="Dossiers" value={`${org.dealsCount} dossier${org.dealsCount>1?"s":""}`}/>
          )}
        </div>
      </div>

      {/* Footer */}
      {org.website && (
        <div style={{ padding:"10px 18px", borderTop:"1px solid var(--border)", background:"var(--surface-2)" }}>
          <a href={org.website} target="_blank" rel="noreferrer"
            style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"var(--su-500)", fontWeight:500 }}>
            <Globe size={11}/>
            <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {org.website.replace(/^https?:\/\/(www\.)?/,"")}
            </span>
            <ExternalLink size={9} style={{ flexShrink:0 }}/>
          </a>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display:"flex", alignItems:"baseline", gap:6, fontSize:12 }}>
      <span>{icon}</span>
      <span style={{ color:"var(--text-4)", minWidth:50, flexShrink:0 }}>{label}</span>
      <span style={{ color:"var(--text-2)", fontWeight:500, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{value}</span>
    </div>
  );
}

function EditOrgModal({ org, onClose, onSaved }: { org:Org; onClose:()=>void; onSaved:(u:Partial<Org>)=>void }) {
  const [f, setF] = useState({ name:org.name, organization_type:org.typeKey, base_status:org.status, sector:org.sector, country:org.country, website:org.website??"", notes:org.notes });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const set = (k:string) => (e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) => setF(p=>({...p,[k]:e.target.value}));

  async function save() {
    setLoading(true); setErr("");
    const r = await fetch(`/api/organisations/${org.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(f) });
    if (!r.ok) { setErr((await r.json()).error??"Erreur"); setLoading(false); return; }
    setDone(true);
    onSaved({ name:f.name, sector:f.sector, country:f.country, website:f.website||null, notes:f.notes, status:f.base_status });
    setTimeout(onClose, 900);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(9,23,40,0.6)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:20, backdropFilter:"blur(2px)" }} onClick={onClose}>
      <div className="animate-scalein card" style={{ width:"100%", maxWidth:520, maxHeight:"92vh", overflowY:"auto", padding:28, boxShadow:"var(--shadow-xl)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:22 }}>
          <div>
            <div className="section-label" style={{ marginBottom:4 }}>Modifier</div>
            <h2 style={{ fontSize:17, fontWeight:700 }}>{org.name}</h2>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={15}/></button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:13 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <label className="lbl">NOM *</label>
            <input className="inp" value={f.name} onChange={set("name")}/>
          </div>
          <div>
            <label className="lbl">TYPE</label>
            <select className="inp" value={f.organization_type} onChange={set("organization_type")}>
              {ORG_TYPES.map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl">STATUT</label>
            <select className="inp" value={f.base_status} onChange={set("base_status")}>
              {Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl">SECTEUR</label>
            <input className="inp" value={f.sector} onChange={set("sector")}/>
          </div>
          <div>
            <label className="lbl">PAYS</label>
            <input className="inp" value={f.country} onChange={set("country")}/>
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label className="lbl">SITE WEB</label>
            <input className="inp" value={f.website} onChange={set("website")} placeholder="https://…"/>
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label className="lbl">NOTES</label>
            <textarea className="inp" value={f.notes} onChange={set("notes")} rows={4}/>
          </div>
        </div>
        {err && <p style={{ fontSize:12, color:"var(--rec-tx)", marginTop:10 }}>{err}</p>}
        <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:20 }}>
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={save} disabled={loading||done} style={{ minWidth:130, justifyContent:"center" }}>
            {loading && <Loader2 size={14} className="animate-spin"/>}
            {done && <CheckCircle size={14}/>}
            {loading?"Enregistrement…":done?"Enregistré !":"Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrganisationsList({ orgs: init, stats }: { orgs: Org[]; stats:{total:number} }) {
  const [orgs, setOrgs] = useState(init);
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [editing, setEditing] = useState<Org|null>(null);

  const types = [...new Set(orgs.map(o=>o.typeLabel))].sort();

  const filtered = orgs.filter(o => {
    const q = search.toLowerCase();
    return (!q || [o.name,o.sector,o.country,o.notes].some(v=>(v||"").toLowerCase().includes(q)))
      && (typeF==="all" || o.typeLabel===typeF)
      && (statusF==="all" || o.status===statusF);
  });

  return (
    <div style={{ padding:32, minHeight:"100vh", background:"var(--bg)" }}>
      {editing && <EditOrgModal org={editing} onClose={()=>setEditing(null)} onSaved={u=>{ setOrgs(p=>p.map(o=>o.id===editing.id?{...o,...u}:o)); }}/>}

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="section-label" style={{ marginBottom:6 }}>CRM</div>
          <h1>Organisations</h1>
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <span className="stat-pill">{stats.total} total</span>
            <span className="stat-pill">{filtered.length} affichées</span>
          </div>
        </div>
        <a href="/protected/organisations/nouveau" className="btn btn-primary"><Plus size={14}/>Nouvelle organisation</a>
      </div>

      {/* Filtres */}
      <div style={{ display:"flex", gap:8, marginBottom:24, flexWrap:"wrap" }}>
        <div style={{ position:"relative", flex:1, minWidth:240 }}>
          <Search size={13} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"var(--text-4)", pointerEvents:"none" }}/>
          <input className="inp" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nom, secteur, pays, notes…" style={{ paddingLeft:36 }}/>
        </div>
        <select className="inp" value={typeF} onChange={e=>setTypeF(e.target.value)} style={{ width:"auto", minWidth:160 }}>
          <option value="all">Tous les types</option>
          {types.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <select className="inp" value={statusF} onChange={e=>setStatusF(e.target.value)} style={{ width:"auto", minWidth:150 }}>
          <option value="all">Tous les statuts</option>
          {Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Grille */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <Building2 size={32} style={{ opacity:0.3, marginBottom:12 }}/>
          <div style={{ fontWeight:600, color:"var(--text-3)" }}>Aucune organisation trouvée</div>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:14 }}>
          {filtered.map(org => (
            <OrgCard key={org.id} org={org} onEdit={()=>setEditing(org)}/>
          ))}
        </div>
      )}
    </div>
  );
}
