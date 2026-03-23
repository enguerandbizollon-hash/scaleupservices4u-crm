"use client";
import { useState } from "react";
import { StatusDropdown } from "../components/status-dropdown";
import { EnrichButton } from "../components/enrich-button";
import { FieldDropdown } from "../components/field-dropdown";
import { Search, Globe, Edit2, Plus, X, Loader2, CheckCircle, ExternalLink, ArrowRight } from "lucide-react";

type Org = { id:string; name:string; typeKey:string; typeLabel:string; status:string; sector:string; location:string; website:string|null; notes:string; dealsCount:number; investmentTicket:string; investmentStage:string; description:string; };

const STATUS: Record<string,{label:string;bg:string;tx:string}> = {
  rencontre:   {label:"Rencontré",   bg:"var(--os-rencontre-bg)",   tx:"var(--os-rencontre-tx)"},
  arencontrer: {label:"À rencontrer",bg:"var(--os-arencontrer-bg)", tx:"var(--os-arencontrer-tx)"},
  contacte:    {label:"Contacté",    bg:"var(--os-contacte-bg)",    tx:"var(--os-contacte-tx)"},
  arelancer:   {label:"À relancer",  bg:"var(--os-arelancer-bg)",   tx:"var(--os-arelancer-tx)"},
  to_qualify:  {label:"À qualifier", bg:"var(--os-qualify-bg)",     tx:"var(--os-qualify-tx)"},
  qualified:   {label:"Qualifié",    bg:"var(--os-rencontre-bg)",   tx:"var(--os-rencontre-tx)"},
  active:      {label:"Actif",       bg:"var(--os-rencontre-bg)",   tx:"var(--os-rencontre-tx)"},
  dormant:     {label:"Dormant",     bg:"var(--os-arencontrer-bg)", tx:"var(--os-arencontrer-tx)"},
  excluded:    {label:"Exclu",       bg:"var(--os-excluded-bg)",    tx:"var(--os-excluded-tx)"},
};

const ORG_TYPES=[["client","Client"],["prospect_client","Prospect client"],["investor","Investisseur"],["buyer","Repreneur"],["target","Cible"],["law_firm","Cabinet juridique"],["bank","Banque"],["advisor","Conseil"],["accounting_firm","Cabinet comptable"],["family_office","Family office"],["corporate","Corporate"],["consulting_firm","Cabinet de conseil"],["other","Autre"]];
const ORG_STATUSES=[["rencontre","Rencontré"],["arencontrer","À rencontrer"],["contacte","Contacté"],["arelancer","À relancer"],["to_qualify","À qualifier"],["qualified","Qualifié"],["dormant","Dormant"],["excluded","Exclu"]];
const SECTORS=["Généraliste","Technologie / SaaS","Intelligence Artificielle","Fintech / Insurtech","Santé / Medtech","Industrie / Manufacturing","Énergie / CleanTech","Immobilier","Distribution / Retail","Médias / Entertainment","Transport / Logistique","Agroalimentaire","Éducation / EdTech","Défense / Sécurité","Tourisme / Hospitality","Services B2B","Conseil / Advisory","Juridique","Finance / Investissement","Ressources Humaines","Luxe / Premium","Construction / BTP","Télécommunications","Agriculture / AgriTech","Chimie / Matériaux","Aérospatial","Environnement","Sport / Loisirs","Bien-être / Beauté","Cybersécurité","Autre"];
const TICKETS=["< 50k€","50k – 200k€","200k – 500k€","500k – 1M€","1M – 3M€","3M – 10M€","> 10M€"];
const STAGES=["Pre-seed","Seed","Série A","Série B","Growth","PE / LBO","Restructuring"];

const TYPE_ACCENT: Record<string,{dot:string;bg:string}> = {
  investor:       {dot:"#2355B0",bg:"#E8F0FC"},
  family_office:  {dot:"#0D5C2A",bg:"#E8F8ED"},
  client:         {dot:"#193A82",bg:"#EAF0FC"},
  prospect_client:{dot:"#245090",bg:"#E8EFFA"},
  buyer:          {dot:"#864E00",bg:"#FFF7E6"},
  target:         {dot:"#921A1A",bg:"#FEF0F0"},
  law_firm:       {dot:"#4E1A9E",bg:"#F2EDFC"},
  bank:           {dot:"#42607E",bg:"#EDF2F7"},
  corporate:      {dot:"#42607E",bg:"#EDF2F7"},
};

function OrgCard({org,onEdit}:{org:Org;onEdit:()=>void}) {
  const st=STATUS[org.status]??STATUS.to_qualify;
  const acc=TYPE_ACCENT[org.typeKey]??{dot:"#6F90A8",bg:"#EDF2F7"};
  const isInvestor=["investor","family_office"].includes(org.typeKey);
  return (
    <a href={`/protected/organisations/${org.id}`} style={{display:"block",textDecoration:"none"}}>
      <div className="card" style={{overflow:"hidden",display:"flex",flexDirection:"column",transition:"transform .14s,box-shadow .14s",cursor:"pointer"}}
        onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.transform="translateY(-2px)";el.style.boxShadow="var(--shadow-md)"}}
        onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.transform="";el.style.boxShadow="var(--shadow-sm)"}}>
        <div style={{height:3,background:acc.dot}}/>
        <div style={{padding:"15px 16px",flex:1}}>
          {/* Header */}
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10,gap:6}}>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:13.5,fontWeight:700,color:"var(--text-1)",marginBottom:5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{org.name}</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                <span style={{fontSize:10.5,fontWeight:700,color:acc.dot,background:acc.bg,borderRadius:5,padding:"2px 7px"}}>{org.typeLabel}</span>
                <span style={{fontSize:10.5,fontWeight:600,borderRadius:5,padding:"2px 7px",background:st.bg,color:st.tx}}>{st.label}</span>
              </div>
            </div>
            <button className="btn-icon" style={{width:26,height:26,flexShrink:0}} onClick={e=>{e.preventDefault();e.stopPropagation();onEdit()}}><Edit2 size={11}/></button>
          </div>
          <div className="divider" style={{marginBottom:10}}/>
          {/* Infos — dropdowns inline */}
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            <FieldDropdown id={org.id} value={org.sector} field="sector"/>
            {isInvestor&&<>
              <FieldDropdown id={org.id} value={org.investmentTicket} field="investment_ticket"/>
              <FieldDropdown id={org.id} value={org.investmentStage}  field="investment_stage"/>
            </>}
            {org.location&&<Row icon="📍" v={org.location}/>}
            {org.dealsCount>0&&<Row icon="📁" v={`${org.dealsCount} dossier${org.dealsCount>1?"s":""}`} tx="var(--su-500)"/>}
            {org.description&&<div style={{fontSize:11,color:"var(--text-4)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical" as any}}>{org.description}</div>}
          </div>
        </div>
        {org.website&&(
          <div style={{padding:"8px 16px",borderTop:"1px solid var(--border)",background:"var(--surface-2)"}}>
            <span style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"var(--su-500)",fontWeight:500}}>
              <Globe size={10}/>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{org.website.replace(/^https?:\/\/(www\.)?/,"")}</span>
              <ExternalLink size={9} style={{flexShrink:0}}/>
            </span>
          </div>
        )}
      </div>
    </a>
  );
}

function Row({icon,v,tx}:{icon:string;v:string;tx?:string}) {
  return <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11.5}}><span>{icon}</span><span style={{color:tx??"var(--text-2)",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</span></div>;
}

function EditOrgModal({org,onClose,onSaved}:{org:Org;onClose:()=>void;onSaved:(u:Partial<Org>)=>void}) {
  const [f,setF]=useState({name:org.name,organization_type:org.typeKey,base_status:org.status,sector:org.sector,location:org.location,website:org.website??"",investment_ticket:org.investmentTicket,investment_stage:org.investmentStage,description:org.description,notes:org.notes});
  const [loading,setLoading]=useState(false); const [done,setDone]=useState(false); const [err,setErr]=useState("");
  const set=(k:string)=>(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>setF(p=>({...p,[k]:e.target.value}));
  async function save(){
    setLoading(true);setErr("");
    const r=await fetch(`/api/organisations/${org.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(f)});
    if(!r.ok){setErr((await r.json()).error??"Erreur");setLoading(false);return;}
    setDone(true);
    onSaved({name:f.name,sector:f.sector,location:f.location,website:f.website||null,investmentTicket:f.investment_ticket,investmentStage:f.investment_stage,description:f.description,notes:f.notes,status:f.base_status});
    setTimeout(onClose,900);
  }
  const isInvestor=["investor","family_office"].includes(f.organization_type);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(9,22,40,.6)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(3px)"}} onClick={onClose}>
      <div className="animate-scalein card" style={{width:"100%",maxWidth:560,maxHeight:"92vh",overflowY:"auto",padding:28,boxShadow:"var(--shadow-xl)"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22}}>
          <div><div className="section-label" style={{marginBottom:4}}>Modifier organisation</div><h2 style={{fontSize:17,fontWeight:700}}>{org.name}</h2></div>
          <button className="btn-icon" onClick={onClose}><X size={15}/></button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:13}}>
          <div style={{gridColumn:"1/-1"}}><label className="lbl">NOM *</label><input className="inp" value={f.name} onChange={set("name")}/></div>
          <div><label className="lbl">TYPE</label>
            <select className="inp" value={f.organization_type} onChange={set("organization_type")}>
              {ORG_TYPES.map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div><label className="lbl">STATUT</label>
            <select className="inp" value={f.base_status} onChange={set("base_status")}>
              {ORG_STATUSES.map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div><label className="lbl">SECTEUR</label>
            <select className="inp" value={f.sector} onChange={set("sector")}>
              <option value="">— Choisir —</option>
              {SECTORS.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><label className="lbl">LOCALISATION</label><input className="inp" value={f.location} onChange={set("location")} placeholder="Paris (FR), Londres (UK)…"/></div>
          {isInvestor&&<>
            <div><label className="lbl">TICKET D'INVESTISSEMENT</label>
              <select className="inp" value={f.investment_ticket} onChange={set("investment_ticket")}>
                <option value="">— Choisir —</option>
                {TICKETS.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="lbl">STADE D'INVESTISSEMENT</label>
              <select className="inp" value={f.investment_stage} onChange={set("investment_stage")}>
                <option value="">— Choisir —</option>
                {STAGES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </>}
          <div style={{gridColumn:"1/-1"}}><label className="lbl">SITE WEB</label><input className="inp" value={f.website} onChange={set("website")} placeholder="https://…"/></div>
          <div style={{gridColumn:"1/-1"}}><label className="lbl">DESCRIPTION</label><textarea className="inp" value={f.description} onChange={set("description")} rows={2}/></div>
          <div style={{gridColumn:"1/-1"}}><label className="lbl">NOTES</label><textarea className="inp" value={f.notes} onChange={set("notes")} rows={3}/></div>
        </div>
        {err&&<p style={{fontSize:12,color:"var(--rec-tx)",marginTop:10}}>{err}</p>}
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={save} disabled={loading||done} style={{minWidth:128,justifyContent:"center"}}>
            {loading&&<Loader2 size={14} className="animate-spin"/>}{done&&<CheckCircle size={14}/>}
            {loading?"Enregistrement…":done?"Enregistré !":"Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrganisationsList({orgs:init,stats}:{orgs:Org[];stats:{total:number}}) {
  const [orgs,setOrgs]=useState(init);
  const [search,setSearch]=useState(""); const [typeF,setTypeF]=useState("all"); const [statusF,setStatusF]=useState("all"); const [editing,setEditing]=useState<Org|null>(null);
  const types=[...new Set(orgs.map(o=>o.typeLabel))].sort();
  const filtered=orgs.filter(o=>{
    const q=search.toLowerCase();
    return(!q||[o.name,o.sector,o.location,o.notes,o.description].some(v=>(v||"").toLowerCase().includes(q)))&&(typeF==="all"||o.typeLabel===typeF)&&(statusF==="all"||o.status===statusF);
  });
  return (
    <div style={{padding:32,minHeight:"100vh",background:"var(--bg)"}}>
      {editing&&<EditOrgModal org={editing} onClose={()=>setEditing(null)} onSaved={u=>{setOrgs(p=>p.map(o=>o.id===editing.id?{...o,...u}:o));}}/>}
      <div className="page-header">
        <div>
          <div className="section-label" style={{marginBottom:6}}>CRM</div>
          <h1 style={{margin:0}}>Organisations</h1>
          <div style={{fontSize:13,color:"var(--text-4)",marginTop:4}}>{stats.total} organisations · {filtered.length} affichées</div>
        </div>
        <a href="/protected/organisations/nouveau" className="btn btn-primary"><Plus size={14}/>Nouvelle organisation</a>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        <div style={{position:"relative",flex:1,minWidth:240}}>
          <Search size={13} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"var(--text-4)",pointerEvents:"none"}}/>
          <input className="inp" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nom, secteur, localisation…" style={{paddingLeft:36}}/>
        </div>
        <select className="inp" value={typeF} onChange={e=>setTypeF(e.target.value)} style={{width:"auto",minWidth:160}}>
          <option value="all">Tous les types</option>
          {types.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <select className="inp" value={statusF} onChange={e=>setStatusF(e.target.value)} style={{width:"auto",minWidth:150}}>
          <option value="all">Tous les statuts</option>
          {ORG_STATUSES.map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {filtered.length===0 ? (
        <div className="empty-state"><div style={{fontWeight:600,color:"var(--text-3)"}}>Aucune organisation trouvée</div></div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:12}}>
          {filtered.map(org=><OrgCard key={org.id} org={org} onEdit={()=>setEditing(org)}/>)}
        </div>
      )}
    </div>
  );
}
