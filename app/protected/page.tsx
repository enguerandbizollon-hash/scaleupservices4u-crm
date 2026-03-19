import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FolderOpen, Users, Building2, ArrowRight, Mail, Phone, Clock, AlertCircle, Sparkles, Plus } from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────
const dealType: Record<string, { label: string; cls: string; dot: string }> = {
  fundraising: { label: "Fundraising",   cls: "badge-fundraising", dot: "var(--deal-fundraising-dot)" },
  ma_sell:     { label: "M&A Sell",      cls: "badge-ma-sell",     dot: "var(--deal-ma-sell-dot)" },
  ma_buy:      { label: "M&A Buy",       cls: "badge-ma-buy",      dot: "var(--deal-ma-buy-dot)" },
  cfo_advisor: { label: "CFO Advisor",   cls: "badge-cfo",         dot: "var(--deal-cfo-dot)" },
  recruitment: { label: "Recrutement",   cls: "badge-recruitment", dot: "var(--deal-recruitment-dot)" },
};

const stageLabel: Record<string, string> = {
  kickoff: "Kickoff", preparation: "Préparation", outreach: "Outreach",
  management_meetings: "Mgmt meetings", dd: "Due diligence",
  negotiation: "Négociation", closing: "Closing",
  post_closing: "Post-closing", ongoing_support: "Suivi", search: "Recherche",
};

const eventColor: Record<string, string> = {
  meeting: "#EBF5FC", follow_up: "#FFF8EC", deadline: "#FEF0F0",
  call: "#F4F0FB", delivery: "#EEFBF4", closing: "#EEF7EE", other: "#F2F5F9",
};
const eventTColor: Record<string, string> = {
  meeting: "#1A4A7A", follow_up: "#7A4A0A", deadline: "#7A1A1A",
  call: "#4A2080", delivery: "#1A6B3A", closing: "#1A6B2E", other: "#2C4A6B",
};
const eventLabel: Record<string, string> = {
  meeting: "Réunion", follow_up: "Relance", deadline: "Deadline",
  call: "Appel", delivery: "Livraison", closing: "Closing", other: "Autre",
};

function fmtDate(v: string | null) {
  if (!v) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(v));
}
function fmtDT(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// ── Dashboard ─────────────────────────────────────────────────────
async function Content() {
  const supabase = await createClient();
  const today = new Date();
  const in10 = new Date(); in10.setDate(today.getDate() + 10);

  const [{ data: deals }, { data: tasks }, { data: events }, { count: cContacts }, { count: cOrgs }] = await Promise.all([
    supabase.from("deals").select("id,name,deal_type,deal_status,deal_stage,priority_level,client_organization_id").order("priority_level"),
    supabase.from("tasks").select("id,title,priority_level,due_date,description,contacts(id,full_name,first_name,last_name,email,phone),deal_id,deals(id,name)").eq("task_status","open").order("due_date",{ascending:true}).limit(8),
    supabase.from("agenda_events").select("id,title,event_type,starts_at,meet_link,deals(name)").eq("status","open").gte("starts_at",today.toISOString()).lte("starts_at",in10.toISOString()).order("starts_at").limit(8),
    supabase.from("contacts").select("*",{count:"exact",head:true}),
    supabase.from("organizations").select("*",{count:"exact",head:true}),
  ]);

  const orgIds = [...new Set((deals??[]).map(d=>d.client_organization_id).filter(Boolean))];
  let orgsMap: Record<string,string> = {};
  if (orgIds.length) {
    const {data:orgs} = await supabase.from("organizations").select("id,name").in("id",orgIds);
    orgsMap = Object.fromEntries((orgs??[]).map(o=>[o.id,o.name]));
  }

  const all = deals??[];
  const active = all.filter(d=>d.deal_status==="active");
  const inactive = all.filter(d=>d.deal_status==="inactive");
  const closed = all.filter(d=>d.deal_status==="closed");
  const overdue = (tasks??[]).filter(t=>t.due_date && new Date(t.due_date)<today).length;

  // Stats par type
  const types = ["fundraising","ma_sell","ma_buy","cfo_advisor","recruitment"];
  const typeStats = types.map(t=>({
    t, label: dealType[t]?.label??t, cls: dealType[t]?.cls??"",
    active: active.filter(d=>d.deal_type===t).length,
    inactive: inactive.filter(d=>d.deal_type===t).length,
    closed: closed.filter(d=>d.deal_type===t).length,
    total: all.filter(d=>d.deal_type===t).length,
  })).filter(s=>s.total>0);

  return (
    <div style={{padding:32, minHeight:"100vh", background:"var(--bg)"}}>
      {/* Header */}
      <div style={{display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:28}}>
        <div>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",color:"var(--su-600)",marginBottom:4}}>TABLEAU DE BORD</div>
          <h1 style={{fontSize:28,fontWeight:700,color:"var(--text-1)",margin:0}}>Bonjour 👋</h1>
          <div style={{fontSize:13,color:"var(--text-3)",marginTop:4}}>
            {today.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
          </div>
        </div>
        <Link href="/protected/ia" style={{display:"flex",alignItems:"center",gap:8,padding:"9px 18px",borderRadius:10,background:"var(--su-700)",color:"white",textDecoration:"none",fontSize:13,fontWeight:600}}>
          <Sparkles size={14}/> Assistant IA
        </Link>
      </div>

      {/* KPIs globaux */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:16}}>
        {[
          {label:"ACTIFS",  count:active.length,  color:"var(--deal-fundraising-dot)", bg:"var(--deal-fundraising-bg)"},
          {label:"INACTIFS",count:inactive.length, color:"var(--text-3)",              bg:"var(--surface-2)"},
          {label:"CLÔTURÉS",count:closed.length,   color:"var(--su-600)",              bg:"var(--su-50)"},
          {label:"CONTACTS",count:cContacts??0,    color:"var(--deal-cfo-dot)",        bg:"var(--deal-cfo-bg)"},
          {label:"ORGAS",   count:cOrgs??0,        color:"var(--deal-ma-sell-dot)",    bg:"var(--deal-ma-sell-bg)"},
        ].map((k,i)=>(
          <Link key={i} href="/protected/dossiers" style={{display:"block",background:k.bg,border:"1px solid var(--border)",borderRadius:14,padding:"16px 18px",textDecoration:"none",transition:"all 0.12s"}}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.transform="translateY(-2px)";(e.currentTarget as HTMLElement).style.boxShadow="0 4px 12px rgba(13,31,53,0.1)"}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform="";(e.currentTarget as HTMLElement).style.boxShadow=""}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",color:"var(--text-4)",marginBottom:8}}>{k.label}</div>
            <div style={{fontSize:32,fontWeight:700,color:k.color,lineHeight:1}}>{k.count}</div>
          </Link>
        ))}
      </div>

      {/* Stats par type */}
      {typeStats.length>0 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10,marginBottom:24}}>
          {typeStats.map(s=>(
            <div key={s.t} className={`deal-badge ${s.cls}`} style={{display:"block",borderRadius:12,padding:"14px 16px",border:"1px solid var(--border)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:12,fontWeight:700}}>{s.label}</span>
                <span style={{fontSize:22,fontWeight:700}}>{s.total}</span>
              </div>
              <div style={{display:"flex",gap:12,fontSize:11}}>
                {s.active>0 && <span>●&nbsp;{s.active} actif{s.active>1?"s":""}</span>}
                {s.inactive>0 && <span style={{opacity:0.7}}>●&nbsp;{s.inactive} inactif{s.inactive>1?"s":""}</span>}
                {s.closed>0 && <span style={{opacity:0.6}}>●&nbsp;{s.closed} clôturé{s.closed>1?"s":""}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 320px",gap:20}}>
        {/* Dossiers actifs */}
        <div className="su-card" style={{overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:"1px solid var(--border)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <FolderOpen size={14} color="var(--su-600)"/>
              <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",color:"var(--text-3)"}}>DOSSIERS ACTIFS</span>
              <span style={{fontSize:11,fontWeight:700,background:"var(--su-50)",color:"var(--su-600)",borderRadius:20,padding:"1px 8px"}}>{active.length}</span>
            </div>
            <Link href="/protected/dossiers" style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:"var(--su-600)",textDecoration:"none",fontWeight:500}}>
              Voir tous <ArrowRight size={12}/>
            </Link>
          </div>
          <div>
            {active.length===0 ? (
              <div style={{padding:"32px 20px",textAlign:"center",fontSize:13,color:"var(--text-4)"}}>Aucun dossier actif.</div>
            ) : active.slice(0,7).map(d=>{
              const pcolor = d.priority_level==="high"?"#DC2626":d.priority_level==="medium"?"#D97706":"var(--border-2)";
              const dt = dealType[d.deal_type];
              return (
                <Link key={d.id} href={`/protected/dossiers/${d.id}`} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 20px",borderBottom:"1px solid var(--border)",textDecoration:"none",background:"var(--surface)"}}>
                  <div style={{width:3,height:32,borderRadius:4,background:pcolor,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{d.name}</div>
                    <div style={{fontSize:11,color:"var(--text-4)",marginTop:1}}>{orgsMap[d.client_organization_id]??"—"}</div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <span className={`deal-badge ${dt?.cls??""}`} style={{borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600}}>{dt?.label??d.deal_type}</span>
                    <span style={{fontSize:11,color:"var(--text-4)",background:"var(--surface-2)",borderRadius:6,padding:"2px 8px"}}>{stageLabel[d.deal_stage]??d.deal_stage}</span>
                  </div>
                  <ArrowRight size={12} color="var(--border-2)"/>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Tâches */}
        <div className="su-card" style={{overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:"1px solid var(--border)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Clock size={14} color="var(--su-600)"/>
              <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",color:"var(--text-3)"}}>TÂCHES</span>
              <span style={{fontSize:11,fontWeight:700,background:"var(--su-50)",color:"var(--su-600)",borderRadius:20,padding:"1px 8px"}}>{(tasks??[]).length}</span>
              {overdue>0 && <span style={{fontSize:11,fontWeight:700,background:"var(--deal-recruitment-bg)",color:"var(--deal-recruitment-text)",borderRadius:20,padding:"1px 8px",display:"flex",alignItems:"center",gap:3}}><AlertCircle size={10}/>{overdue} retard</span>}
            </div>
            <Link href="/protected/agenda" style={{fontSize:12,color:"var(--su-600)",textDecoration:"none",fontWeight:500}}>Agenda</Link>
          </div>
          <div>
            {(tasks??[]).length===0 ? (
              <div style={{padding:"32px 20px",textAlign:"center",fontSize:13,color:"var(--text-4)"}}>Aucune tâche ouverte ✓</div>
            ) : (tasks??[]).map(task=>{
              const c = Array.isArray(task.contacts)?task.contacts[0]:task.contacts as any;
              const dl = Array.isArray(task.deals)?task.deals[0]:task.deals as any;
              const isOv = task.due_date && new Date(task.due_date)<today;
              const pdot = task.priority_level==="high"?"#DC2626":task.priority_level==="medium"?"#D97706":"var(--border-2)";
              return (
                <div key={task.id} style={{padding:"12px 20px",borderBottom:"1px solid var(--border)",background:isOv?"#FEF5F5":undefined}}>
                  <div style={{display:"flex",gap:10}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:pdot,marginTop:5,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)"}}>{task.title}</div>
                      {task.description && <div style={{fontSize:11,color:"var(--text-4)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.description}</div>}
                      <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:6}}>
                        {dl && <Link href={`/protected/dossiers/${dl.id}`} style={{fontSize:11,color:"var(--su-600)",fontWeight:500,textDecoration:"none"}}>📁 {dl.name}</Link>}
                        {c && <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:11,color:"var(--text-3)"}}>{c.full_name||`${c.first_name??""} ${c.last_name??""}`.trim()}</span>
                          {c.email && <a href={`mailto:${c.email}`} style={{display:"flex",alignItems:"center",justifyContent:"center",width:18,height:18,borderRadius:5,background:"var(--su-50)",color:"var(--su-600)"}}><Mail size={10}/></a>}
                          {c.phone && <a href={`tel:${c.phone}`} style={{display:"flex",alignItems:"center",justifyContent:"center",width:18,height:18,borderRadius:5,background:"#EEF7EE",color:"var(--deal-fundraising-dot)"}}><Phone size={10}/></a>}
                        </div>}
                      </div>
                    </div>
                    <div style={{fontSize:11,fontWeight:500,color:isOv?"#DC2626":"var(--text-4)",flexShrink:0}}>{fmtDate(task.due_date)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Colonne droite */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {/* Actions rapides */}
          <div className="su-card" style={{padding:"16px 14px"}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",color:"var(--text-4)",marginBottom:12}}>ACTIONS RAPIDES</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[
                {href:"/protected/dossiers/nouveau", label:"Nouveau dossier",      bg:"var(--su-50)",    color:"var(--su-700)"},
                {href:"/protected/contacts/nouveau", label:"Nouveau contact",      bg:"var(--deal-fundraising-bg)", color:"var(--deal-fundraising-text)"},
                {href:"/protected/organisations/nouveau", label:"Nouvelle organisation", bg:"var(--deal-ma-sell-bg)", color:"var(--deal-ma-sell-text)"},
                {href:"/protected/agenda/nouvelle-tache", label:"Nouvelle tâche",  bg:"var(--deal-recruitment-bg)", color:"var(--deal-recruitment-text)"},
                {href:"/protected/agenda/nouvel-evenement", label:"Nouvel événement", bg:"var(--deal-cfo-bg)", color:"var(--deal-cfo-text)"},
                {href:"/protected/import", label:"Import CSV",                     bg:"var(--surface-2)", color:"var(--text-2)"},
              ].map(a=>(
                <Link key={a.href} href={a.href} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px",borderRadius:9,background:a.bg,color:a.color,textDecoration:"none",fontSize:12,fontWeight:600}}>
                  {a.label} <ArrowRight size={12} style={{opacity:0.5}}/>
                </Link>
              ))}
            </div>
          </div>

          {/* Agenda */}
          <div className="su-card" style={{overflow:"hidden",flex:1}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",borderBottom:"1px solid var(--border)"}}>
              <span style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",color:"var(--text-4)"}}>AGENDA — 10 JOURS</span>
              <Link href="/protected/agenda" style={{fontSize:11,color:"var(--su-600)",textDecoration:"none"}}>Tout →</Link>
            </div>
            {(events??[]).length===0 ? (
              <div style={{padding:"24px 16px",textAlign:"center",fontSize:12,color:"var(--text-4)"}}>Aucun événement prévu.</div>
            ) : (events??[]).map(ev=>{
              const dl = Array.isArray(ev.deals)?ev.deals[0]:ev.deals as any;
              return (
                <div key={ev.id} style={{padding:"11px 16px",borderBottom:"1px solid var(--border)"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                    <div style={{minWidth:0,flex:1}}>
                      <span style={{fontSize:10,fontWeight:700,borderRadius:5,padding:"2px 7px",background:eventColor[ev.event_type]??"#F2F5F9",color:eventTColor[ev.event_type]??"var(--text-2)"}}>{eventLabel[ev.event_type]??ev.event_type}</span>
                      <div style={{fontSize:12,fontWeight:600,color:"var(--text-1)",marginTop:5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.title}</div>
                      {dl && <div style={{fontSize:11,color:"var(--text-4)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📁 {dl.name}</div>}
                      {ev.meet_link && <a href={ev.meet_link} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#2563EB",display:"block",marginTop:2}}>🎥 Meet</a>}
                    </div>
                    <div style={{fontSize:10,fontWeight:600,color:"var(--text-3)",flexShrink:0,textAlign:"right"}}>{fmtDT(ev.starts_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{padding:32,background:"var(--bg)",minHeight:"100vh"}}><div style={{height:400,borderRadius:16,background:"#E8EEF4",animation:"pulse 1.5s infinite"}}/></div>}>
      <Content/>
    </Suspense>
  );
}
