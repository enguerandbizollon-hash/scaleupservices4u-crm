"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Mail, Phone, Globe, AlertTriangle, CheckSquare, Activity, ChevronRight, Download } from "lucide-react";
import { StatusDropdown } from "../components/status-dropdown";
import { exportRowsAsCSV } from "@/lib/export/csv";

type Contact = { id:string; first_name:string; last_name:string; title?:string; email?:string; phone?:string; base_status?:string; last_contact_date?:string; role_label?:string; is_primary?:boolean };
type Org = {
  id:string; name:string; typeKey:string; typeLabel:string; status:string;
  sector:string; location:string; website:string|null; notes:string;
  investmentTicket:string; investmentStage:string; description:string;
  contacts: Contact[]; openTasks:number; lastActivity:string|null;
};

const TYPE_COLORS: Record<string, { bg:string; tx:string; border:string }> = {
  investor:       { bg:"var(--fund-bg)", tx:"var(--fund-tx)", border:"var(--fund-mid)" },
  business_angel: { bg:"var(--fund-bg)", tx:"var(--fund-tx)", border:"var(--fund-mid)" },
  family_office:  { bg:"var(--fund-bg)", tx:"var(--fund-tx)", border:"var(--fund-mid)" },
  client:         { bg:"var(--sell-bg)", tx:"var(--sell-tx)", border:"var(--sell-mid)" },
  prospect_client:{ bg:"var(--sell-bg)", tx:"var(--sell-tx)", border:"var(--sell-mid)" },
  target:         { bg:"var(--buy-bg)",  tx:"var(--buy-tx)",  border:"var(--buy-mid)"  },
  buyer:          { bg:"var(--buy-bg)",  tx:"var(--buy-tx)",  border:"var(--buy-mid)"  },
  default:        { bg:"var(--surface-3)", tx:"var(--text-4)", border:"var(--border)" },
};

const STATUS_LABELS: Record<string,{label:string;color:string}> = {
  active:     { label:"Actif",        color:"#16a34a" },
  to_qualify: { label:"Non qualifié", color:"#6B7280" },
  inactive:   { label:"Inactif",      color:"#9CA3AF" },
  // Backward compat (valeurs migrées en BDD)
  qualified:  { label:"Actif",        color:"#16a34a" },
  priority:   { label:"Actif",        color:"#16a34a" },
  dormant:    { label:"Non qualifié", color:"#6B7280" },
  excluded:   { label:"Inactif",      color:"#9CA3AF" },
};

function fmtDate(v:string|null) {
  if (!v) return null;
  const days = Math.floor((Date.now()-new Date(v).getTime())/86400000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days}j`;
  return new Date(v).toLocaleDateString("fr-FR",{day:"numeric",month:"short"});
}

export function OrganisationsList({ orgs, stats }: { orgs: Org[]; stats: { total: number } }) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const types = ["all", ...Array.from(new Set(orgs.map(o => o.typeKey)))];

  const filtered = orgs.filter(o => {
    const matchSearch = !search ||
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.sector.toLowerCase().includes(search.toLowerCase()) ||
      o.location.toLowerCase().includes(search.toLowerCase()) ||
      o.contacts.some(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()));
    const matchType   = filterType === "all" || o.typeKey === filterType;
    const matchStatus = filterStatus === "all" || o.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const TYPE_LABELS: Record<string,string> = {
    all:"Tous", client:"Client", prospect_client:"Prospect", investor:"Investisseur",
    business_angel:"Business Angel", buyer:"Repreneur", target:"Cible",
    law_firm:"Cabinet juridique", bank:"Banque", advisor:"Conseil",
    accounting_firm:"Cabinet comptable", family_office:"Family office",
    corporate:"Corporate", consulting_firm:"Conseil strat.", other:"Autre"
  };

  return (
    <div style={{ padding:"28px 24px", minHeight:"100vh", background:"var(--bg)" }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:"var(--text-1)" }}>Organisations</h1>
          <div style={{ fontSize:13, color:"var(--text-5)", marginTop:4 }}>
            {filtered.length} / {stats.total} organisation{stats.total > 1 ? "s" : ""}
            {filtered.some(o=>o.contacts.length>0) && ` · ${filtered.reduce((s,o)=>s+o.contacts.length,0)} contacts`}
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button
            onClick={()=>exportRowsAsCSV("organisations",filtered,[
              { key:"name", label:"Nom" },
              { key:"typeLabel", label:"Type" },
              { key:"status", label:"Statut", format:r=>STATUS_LABELS[r.status]?.label??r.status },
              { key:"sector", label:"Secteur" },
              { key:"location", label:"Localisation" },
              { key:"website", label:"Site web" },
              { key:"investmentTicket", label:"Ticket" },
              { key:"investmentStage", label:"Stade investissement" },
              { key:"contactsCount", label:"Nb contacts", format:r=>r.contacts.length },
              { key:"primaryContact", label:"Contact principal", format:r=>{const p=r.contacts.find(c=>c.is_primary)??r.contacts[0];return p?`${p.first_name} ${p.last_name}`.trim():"";} },
              { key:"primaryEmail", label:"Email principal", format:r=>{const p=r.contacts.find(c=>c.is_primary)??r.contacts[0];return p?.email??"";} },
              { key:"openTasks", label:"Tâches ouvertes" },
              { key:"lastActivity", label:"Dernière activité" },
              { key:"description", label:"Description" },
              { key:"notes", label:"Notes" },
            ])}
            disabled={filtered.length===0}
            title={`Exporter ${filtered.length} organisation${filtered.length>1?"s":""}`}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 14px", borderRadius:9, background:"var(--surface)", color:"var(--text-2)", border:"1px solid var(--border)", cursor: filtered.length===0?"not-allowed":"pointer", opacity: filtered.length===0?.5:1, fontSize:13, fontWeight:600 }}>
            <Download size={14}/> Exporter
          </button>
          <Link href="/protected/organisations/nouveau"
            style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 18px", borderRadius:9, background:"#1a56db", color:"#fff", textDecoration:"none", fontSize:13.5, fontWeight:600 }}>
            <Plus size={14}/> Nouvelle
          </Link>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        {/* Recherche */}
        <div style={{ position:"relative", flex:1, minWidth:220 }}>
          <Search size={13} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--text-5)" }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Rechercher org, contact, secteur…"
            style={{ width:"100%", paddingLeft:30, paddingRight:12, paddingTop:8, paddingBottom:8, border:"1px solid var(--border)", borderRadius:8, background:"var(--surface)", color:"var(--text-1)", fontSize:13.5, fontFamily:"inherit", outline:"none", boxSizing:"border-box" as const }}/>
        </div>
        {/* Filtre type */}
        <select value={filterType} onChange={e=>setFilterType(e.target.value)}
          style={{ padding:"8px 12px", border:"1px solid var(--border)", borderRadius:8, background:"var(--surface)", color:"var(--text-2)", fontSize:13, fontFamily:"inherit", outline:"none" }}>
          {types.map(t => <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>)}
        </select>
        {/* Filtre statut */}
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
          style={{ padding:"8px 12px", border:"1px solid var(--border)", borderRadius:8, background:"var(--surface)", color:"var(--text-2)", fontSize:13, fontFamily:"inherit", outline:"none" }}>
          <option value="all">Tous statuts</option>
          <option value="active">Actif</option>
          <option value="to_qualify">Non qualifié</option>
          <option value="inactive">Inactif</option>
        </select>
      </div>

      {/* Grille */}
      {filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 24px", color:"var(--text-5)", fontSize:14 }}>
          Aucune organisation trouvée
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(340px, 1fr))", gap:12 }}>
          {filtered.map(o => <OrgCard key={o.id} org={o}/>)}
        </div>
      )}
    </div>
  );
}

function OrgCard({ org }: { org: Org }) {
  const tc = TYPE_COLORS[org.typeKey] ?? TYPE_COLORS.default;
  const st = STATUS_LABELS[org.status] ?? { label: org.status, color:"#6B7280" };
  const primaryContact = org.contacts.find(c => c.is_primary) ?? org.contacts[0];
  const otherContacts  = org.contacts.filter(c => c.id !== primaryContact?.id).slice(0, 3);
  const lastAct        = fmtDate(org.lastActivity);
  const isInvestor     = ["investor","business_angel","family_office","corporate","bank"].includes(org.typeKey);

  return (
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden", display:"flex", flexDirection:"column" }}>

      {/* Barre type */}
      <div style={{ height:3, background:tc.tx }}/>

      {/* En-tête */}
      <div style={{ padding:"14px 16px 10px", borderBottom:"1px solid var(--border)" }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:6 }}>
          <Link href={`/protected/organisations/${org.id}`}
            style={{ fontSize:14.5, fontWeight:700, color:"var(--text-1)", textDecoration:"none", flex:1, lineHeight:1.3 }}>
            {org.name}
          </Link>
          <div style={{ display:"flex", gap:6, flexShrink:0, alignItems:"center" }}>
            <span style={{ fontSize:10.5, fontWeight:700, padding:"2px 8px", borderRadius:20, background:tc.bg, color:tc.tx, border:`1px solid ${tc.border}` }}>
              {org.typeLabel}
            </span>
            <span style={{ fontSize:11, fontWeight:600, color:st.color }}>● {st.label}</span>
          </div>
        </div>

        {/* Secteur + localisation */}
        {(org.sector || org.location) && (
          <div style={{ fontSize:12, color:"var(--text-4)", marginBottom:6 }}>
            {org.sector}{org.sector && org.location ? " · " : ""}{org.location}
          </div>
        )}

        {/* Infos investisseur */}
        {isInvestor && (org.investmentTicket || org.investmentStage) && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {org.investmentTicket && (
              <span style={{ fontSize:11.5, padding:"2px 8px", borderRadius:6, background:"var(--fund-bg)", color:"var(--fund-tx)", fontWeight:600 }}>
                🎯 {org.investmentTicket}
              </span>
            )}
            {org.investmentStage && (
              <span style={{ fontSize:11.5, padding:"2px 8px", borderRadius:6, background:"var(--surface-2)", color:"var(--text-3)", border:"1px solid var(--border)" }}>
                {org.investmentStage}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Contacts */}
      {org.contacts.length > 0 && (
        <div style={{ padding:"10px 16px", borderBottom:"1px solid var(--border)" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--text-5)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:8 }}>
            {org.contacts.length} contact{org.contacts.length > 1 ? "s" : ""}
          </div>

          {/* Contact principal */}
          {primaryContact && (
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: otherContacts.length > 0 ? 8 : 0 }}>
              <div style={{ width:28, height:28, borderRadius:8, background:"var(--surface-3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"var(--text-3)", flexShrink:0 }}>
                {primaryContact.first_name?.[0]}{primaryContact.last_name?.[0]}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"var(--text-1)" }}>
                  {primaryContact.first_name} {primaryContact.last_name}
                  {primaryContact.is_primary && <span style={{ fontSize:10, marginLeft:5, color:"var(--fund-tx)", fontWeight:700 }}>★ Principal</span>}
                </div>
                {primaryContact.title && <div style={{ fontSize:11.5, color:"var(--text-5)" }}>{primaryContact.title}</div>}
              </div>
              <div style={{ display:"flex", gap:4 }}>
                {primaryContact.email && (
                  <a href={`mailto:${primaryContact.email}`} style={{ width:24, height:24, borderRadius:6, background:"var(--surface-2)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none", color:"var(--text-4)" }}>
                    <Mail size={11}/>
                  </a>
                )}
                {primaryContact.phone && (
                  <a href={`tel:${primaryContact.phone}`} style={{ width:24, height:24, borderRadius:6, background:"var(--surface-2)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none", color:"var(--text-4)" }}>
                    <Phone size={11}/>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Autres contacts */}
          {otherContacts.length > 0 && (
            <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
              {otherContacts.map(c => (
                <span key={c.id} style={{ fontSize:11.5, padding:"2px 8px", borderRadius:6, background:"var(--surface-2)", border:"1px solid var(--border)", color:"var(--text-3)" }}>
                  {c.first_name} {c.last_name}
                </span>
              ))}
              {org.contacts.length > 4 && (
                <span style={{ fontSize:11.5, padding:"2px 8px", borderRadius:6, background:"var(--surface-2)", color:"var(--text-5)" }}>
                  +{org.contacts.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stats rapides */}
      <div style={{ padding:"10px 16px", display:"flex", gap:14, flexWrap:"wrap", flex:1 }}>
        {org.openTasks > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, color:"var(--text-4)" }}>
            <CheckSquare size={11}/>
            <span>{org.openTasks} tâche{org.openTasks > 1 ? "s" : ""}</span>
          </div>
        )}
        {lastAct && (
          <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, color:"var(--text-4)" }}>
            <Activity size={11}/>
            <span>{lastAct}</span>
          </div>
        )}
        {org.website && (
          <a href={org.website} target="_blank" rel="noreferrer"
            style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, color:"var(--text-4)", textDecoration:"none", marginLeft:"auto" }}>
            <Globe size={11}/> Site
          </a>
        )}
      </div>

      {/* Footer lien fiche */}
      <Link href={`/protected/organisations/${org.id}`}
        style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 16px", borderTop:"1px solid var(--border)", textDecoration:"none", color:"var(--text-4)", fontSize:12.5, fontWeight:600 }}>
        <span>Voir la fiche</span>
        <ChevronRight size={13}/>
      </Link>
    </div>
  );
}
