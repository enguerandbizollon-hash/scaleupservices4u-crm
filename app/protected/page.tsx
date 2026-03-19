import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowRight, Mail, Phone, AlertTriangle } from "lucide-react";

const typeLabel: Record<string, string> = {
  fundraising: "Fundraising", ma_sell: "M&A Sell-side",
  ma_buy: "M&A Buy-side", cfo_advisor: "CFO Advisor", recruitment: "Recrutement",
};

const typeIcon: Record<string, string> = {
  fundraising: "📈", ma_sell: "🏢", ma_buy: "🎯", cfo_advisor: "💼", recruitment: "👤",
};

const stageLabel: Record<string, string> = {
  kickoff: "Kickoff", preparation: "Préparation", outreach: "Outreach",
  management_meetings: "Mgmt meetings", dd: "Due diligence",
  negotiation: "Négociation", closing: "Closing",
  post_closing: "Post-closing", ongoing_support: "Suivi", search: "Recherche",
};

const eventTypeLabel: Record<string, string> = {
  meeting: "Réunion", follow_up: "Relance", deadline: "Deadline",
  call: "Appel", delivery: "Livraison", closing: "Closing", other: "Autre",
};

const eventBadge: Record<string, string> = {
  meeting: "badge-ma-buy", follow_up: "badge-medium", deadline: "badge-high",
  call: "badge-cfo", delivery: "badge-fundraising", closing: "badge-closed", other: "badge-inactive",
};

function fmt(v: string | null) {
  if (!v) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(v));
}
function fmtDT(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

async function Content() {
  const supabase = await createClient();
  const today = new Date();
  const in10 = new Date(); in10.setDate(today.getDate() + 10);

  const [{ data: deals }, { data: tasks }, { data: events }, { count: cCount }, { count: oCount }] = await Promise.all([
    supabase.from("deals").select("id,name,deal_type,deal_status,deal_stage,priority_level,client_organization_id").order("priority_level"),
    supabase.from("tasks").select("id,title,priority_level,due_date,description,contacts(id,full_name,first_name,last_name,email,phone),deal_id,deals(id,name)").eq("task_status","open").order("due_date",{ascending:true}).limit(8),
    supabase.from("agenda_events").select("id,title,event_type,starts_at,meet_link,deals(name)").eq("status","open").gte("starts_at",today.toISOString()).lte("starts_at",in10.toISOString()).order("starts_at").limit(8),
    supabase.from("contacts").select("*",{count:"exact",head:true}),
    supabase.from("organizations").select("*",{count:"exact",head:true}),
  ]);

  const orgIds = [...new Set((deals??[]).map(d=>d.client_organization_id).filter(Boolean))];
  let orgMap: Record<string,string> = {};
  if (orgIds.length) {
    const {data:orgs} = await supabase.from("organizations").select("id,name").in("id",orgIds);
    orgMap = Object.fromEntries((orgs??[]).map(o=>[o.id,o.name]));
  }

  const all = deals??[];
  const active = all.filter(d=>d.deal_status==="active");
  const inactive = all.filter(d=>d.deal_status==="inactive");
  const closed = all.filter(d=>d.deal_status==="closed");
  const taskList = tasks??[];
  const overdue = taskList.filter(t=>t.due_date && new Date(t.due_date)<today).length;

  const types = ["fundraising","ma_sell","ma_buy","cfo_advisor","recruitment"];
  const byType = types.map(t=>({
    type:t, icon:typeIcon[t], label:typeLabel[t],
    active:active.filter(d=>d.deal_type===t).length,
    inactive:inactive.filter(d=>d.deal_type===t).length,
    closed:closed.filter(d=>d.deal_type===t).length,
    total:all.filter(d=>d.deal_type===t).length,
  })).filter(s=>s.total>0);

  return (
    <div className="p-8" style={{background:"var(--bg)",minHeight:"100vh"}}>
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="section-title mb-1">Tableau de bord</p>
          <h1 style={{color:"var(--text-1)"}}>Bonjour 👋</h1>
          <p style={{fontSize:13,color:"var(--text-3)",marginTop:4}}>
            {today.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
          </p>
        </div>
        <Link href="/protected/ia" className="btn-primary">
          ✦ Assistant IA
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 mb-6" style={{gridTemplateColumns:"repeat(4,1fr)"}}>
        {[
          {label:"Actifs",count:active.length,color:"var(--c-active)",bg:"var(--c-active-bg)"},
          {label:"Inactifs",count:inactive.length,color:"var(--c-inactive)",bg:"var(--c-inactive-bg)"},
          {label:"Clôturés",count:closed.length,color:"var(--c-closed)",bg:"var(--c-closed-bg)"},
          {label:"Total",count:all.length,color:"var(--su-600)",bg:"var(--su-50)"},
        ].map((k,i)=>(
          <Link key={i} href="/protected/dossiers" className="card" style={{padding:20,display:"block",textDecoration:"none",transition:"box-shadow 0.15s"}}>
            <p className="section-title">{k.label}</p>
            <p style={{fontSize:36,fontWeight:700,color:k.color,marginTop:8,lineHeight:1}}>{k.count}</p>
            <p style={{fontSize:12,color:"var(--text-4)",marginTop:4}}>dossiers</p>
          </Link>
        ))}
      </div>

      {/* Stats par type */}
      {byType.length>0 && (
        <div className="grid gap-3 mb-6" style={{gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))"}}>
          {byType.map(s=>(
            <Link key={s.type} href="/protected/dossiers" className={`badge badge-${s.type==="ma_sell"?"ma-sell":s.type==="ma_buy"?"ma-buy":s.type==="cfo_advisor"?"cfo":s.type}`}
              style={{display:"block",padding:"14px 16px",borderRadius:12,textDecoration:"none",border:"1px solid",borderColor:"currentColor",opacity:0.9}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:600}}>{s.icon} {s.label}</span>
                <span style={{fontSize:22,fontWeight:700}}>{s.total}</span>
              </div>
              <div style={{display:"flex",gap:10,fontSize:11,opacity:0.8}}>
                <span>● {s.active} actifs</span>
                {s.inactive>0&&<span>● {s.inactive} inactifs</span>}
                {s.closed>0&&<span>● {s.closed} clôturés</span>}
              </div>
            </Link>
          ))}
          <div className="card" style={{padding:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <Link href="/protected/contacts" style={{textDecoration:"none",background:"var(--su-50)",borderRadius:9,padding:"10px 12px",textAlign:"center",display:"block"}}>
              <p style={{fontSize:24,fontWeight:700,color:"var(--su-600)"}}>{cCount??0}</p>
              <p style={{fontSize:11,color:"var(--text-3)",marginTop:2}}>Contacts</p>
            </Link>
            <Link href="/protected/organisations" style={{textDecoration:"none",background:"var(--c-cfo-bg)",borderRadius:9,padding:"10px 12px",textAlign:"center",display:"block"}}>
              <p style={{fontSize:24,fontWeight:700,color:"var(--c-cfo)"}}>{oCount??0}</p>
              <p style={{fontSize:11,color:"var(--text-3)",marginTop:2}}>Orgs</p>
            </Link>
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 280px",gap:20}}>
        {/* Dossiers actifs */}
        <div className="card" style={{overflow:"hidden"}}>
          <div style={{padding:"14px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <p style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",color:"var(--text-3)",textTransform:"uppercase"}}>Dossiers actifs</p>
              <span className="badge badge-active">{active.length}</span>
            </div>
            <Link href="/protected/dossiers" style={{fontSize:12,color:"var(--su-600)",textDecoration:"none",display:"flex",alignItems:"center",gap:4}}>Voir tous <ArrowRight size={11}/></Link>
          </div>
          <div>
            {active.length===0
              ? <p style={{padding:"24px 20px",textAlign:"center",color:"var(--text-4)",fontSize:13}}>Aucun dossier actif.</p>
              : active.slice(0,7).map(d=>{
                const badgeCls = `badge badge-${d.deal_type==="ma_sell"?"ma-sell":d.deal_type==="ma_buy"?"ma-buy":d.deal_type==="cfo_advisor"?"cfo":d.deal_type}`;
                return (
                  <Link key={d.id} href={`/protected/dossiers/${d.id}`} className="row-hover" style={{display:"flex",alignItems:"center",gap:12,padding:"11px 20px",borderBottom:"1px solid var(--border)",textDecoration:"none"}}>
                    <div className={`priority-bar-${d.priority_level}`} style={{width:3,height:32,borderRadius:2,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:13,fontWeight:600,color:"var(--text-1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</p>
                      <p style={{fontSize:11,color:"var(--text-4)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{orgMap[d.client_organization_id]??""}</p>
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      <span className={badgeCls+" badge"}>{typeIcon[d.deal_type]} {typeLabel[d.deal_type]}</span>
                      <span className="badge badge-inactive">{stageLabel[d.deal_stage]??d.deal_stage}</span>
                    </div>
                    <ArrowRight size={12} style={{color:"var(--border-2)",flexShrink:0}}/>
                  </Link>
                );
              })
            }
          </div>
        </div>

        {/* Tâches */}
        <div className="card" style={{overflow:"hidden"}}>
          <div style={{padding:"14px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <p style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",color:"var(--text-3)",textTransform:"uppercase"}}>Tâches</p>
              <span className="badge badge-inactive">{taskList.length}</span>
              {overdue>0&&<span className="badge badge-high"><AlertTriangle size={9}/> {overdue} retard</span>}
            </div>
            <Link href="/protected/agenda" style={{fontSize:12,color:"var(--su-600)",textDecoration:"none",display:"flex",alignItems:"center",gap:4}}>Agenda <ArrowRight size={11}/></Link>
          </div>
          <div>
            {taskList.length===0
              ? <p style={{padding:"24px 20px",textAlign:"center",color:"var(--text-4)",fontSize:13}}>Aucune tâche en cours ✓</p>
              : taskList.map(t=>{
                const c = Array.isArray(t.contacts)?t.contacts[0]:t.contacts as any;
                const d = Array.isArray(t.deals)?t.deals[0]:t.deals as any;
                const late = t.due_date && new Date(t.due_date)<today;
                return (
                  <div key={t.id} className="row-hover" style={{padding:"11px 20px",borderBottom:"1px solid var(--border)",background:late?"#FBF0EE":undefined}}>
                    <div style={{display:"flex",gap:10}}>
                      <div className={`priority-bar-${t.priority_level}`} style={{width:3,borderRadius:2,flexShrink:0,alignSelf:"stretch",minHeight:12}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:13,fontWeight:600,color:"var(--text-1)"}}>{t.title}</p>
                        {t.description&&<p style={{fontSize:11,color:"var(--text-4)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.description}</p>}
                        <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:6,alignItems:"center"}}>
                          {d&&<Link href={`/protected/dossiers/${d.id}`} style={{fontSize:11,color:"var(--su-600)",textDecoration:"none",display:"flex",alignItems:"center",gap:3}}>📁 {d.name}</Link>}
                          {c&&<div style={{display:"flex",alignItems:"center",gap:6}}>
                            <span style={{fontSize:11,color:"var(--text-3)"}}>{c.full_name||`${c.first_name??""} ${c.last_name??""}`}</span>
                            {c.email&&<a href={`mailto:${c.email}`} style={{width:18,height:18,borderRadius:4,background:"var(--su-50)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--su-600)"}} title={c.email}><Mail size={10}/></a>}
                            {c.phone&&<a href={`tel:${c.phone}`} style={{width:18,height:18,borderRadius:4,background:"#EAF5EE",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--c-active)"}} title={c.phone}><Phone size={10}/></a>}
                          </div>}
                        </div>
                      </div>
                      <p style={{fontSize:11,fontWeight:500,color:late?"var(--c-high)":"var(--text-4)",flexShrink:0}}>{late&&"⚠ "}{fmt(t.due_date)}</p>
                    </div>
                  </div>
                );
              })
            }
          </div>
        </div>

        {/* Colonne droite */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {/* Actions rapides */}
          <div className="card" style={{padding:16}}>
            <p className="section-title mb-3">Actions rapides</p>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[
                {href:"/protected/dossiers/nouveau",label:"Nouveau dossier",bg:"var(--su-50)",c:"var(--su-700)"},
                {href:"/protected/contacts/nouveau",label:"Nouveau contact",bg:"var(--c-active-bg)",c:"var(--c-active)"},
                {href:"/protected/organisations/nouveau",label:"Nouvelle organisation",bg:"var(--c-cfo-bg)",c:"var(--c-cfo)"},
                {href:"/protected/agenda/nouvelle-tache",label:"Nouvelle tâche",bg:"var(--c-ma-sell-bg)",c:"var(--c-ma-sell)"},
                {href:"/protected/import",label:"Importer CSV",bg:"var(--c-recruitment-bg)",c:"var(--c-recruitment)"},
              ].map(a=>(
                <Link key={a.href} href={a.href} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderRadius:8,background:a.bg,color:a.c,fontSize:12,fontWeight:500,textDecoration:"none"}}>
                  {a.label} <ArrowRight size={11}/>
                </Link>
              ))}
            </div>
          </div>

          {/* Agenda */}
          <div className="card" style={{overflow:"hidden",flex:1}}>
            <div style={{padding:"14px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <p className="section-title">Agenda — 10 jours</p>
              <Link href="/protected/agenda" style={{fontSize:11,color:"var(--su-600)",textDecoration:"none"}}>Tout →</Link>
            </div>
            <div>
              {(events??[]).length===0
                ? <p style={{padding:"20px 16px",textAlign:"center",color:"var(--text-4)",fontSize:12}}>Aucun événement.</p>
                : (events??[]).map(ev=>{
                  const d=Array.isArray(ev.deals)?ev.deals[0]:ev.deals as any;
                  return (
                    <div key={ev.id} className="row-hover" style={{padding:"10px 16px",borderBottom:"1px solid var(--border)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                        <div style={{flex:1,minWidth:0}}>
                          <span className={`badge ${eventBadge[ev.event_type]??""}`} style={{marginBottom:5}}>{eventTypeLabel[ev.event_type]??ev.event_type}</span>
                          <p style={{fontSize:12,fontWeight:600,color:"var(--text-1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.title}</p>
                          {d&&<p style={{fontSize:11,color:"var(--text-4)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📁 {d.name}</p>}
                          {ev.meet_link&&<a href={ev.meet_link} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#1A56DB",textDecoration:"none"}}>🎥 Meet</a>}
                        </div>
                        <p style={{fontSize:11,color:"var(--text-3)",flexShrink:0,textAlign:"right"}}>{fmtDT(ev.starts_at)}</p>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{padding:32,background:"var(--bg)",minHeight:"100vh"}}><div style={{height:400,borderRadius:14,background:"var(--border)",animation:"pulse 1.5s infinite"}}/></div>}>
      <Content/>
    </Suspense>
  );
}
