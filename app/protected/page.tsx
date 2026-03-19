import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowRight, Sparkles, Clock, CalendarDays, Plus } from "lucide-react";

const DT: Record<string, { label:string; bg:string; tx:string; dot:string; border:string; icon:string }> = {
  fundraising: { label:"Fundraising",  bg:"var(--fund-bg)", tx:"var(--fund-tx)", dot:"var(--fund-dot)", border:"var(--fund-mid)", icon:"📈" },
  ma_sell:     { label:"M&A Sell",     bg:"var(--sell-bg)", tx:"var(--sell-tx)", dot:"var(--sell-dot)", border:"var(--sell-mid)", icon:"🏢" },
  ma_buy:      { label:"M&A Buy",      bg:"var(--buy-bg)",  tx:"var(--buy-tx)",  dot:"var(--buy-dot)",  border:"var(--buy-mid)",  icon:"🎯" },
  cfo_advisor: { label:"CFO Advisor",  bg:"var(--cfo-bg)",  tx:"var(--cfo-tx)",  dot:"var(--cfo-dot)",  border:"var(--cfo-mid)",  icon:"💼" },
  recruitment: { label:"Recrutement",  bg:"var(--rec-bg)",  tx:"var(--rec-tx)",  dot:"var(--rec-dot)",  border:"var(--rec-mid)",  icon:"👤" },
};
const STAGE: Record<string,string> = { kickoff:"Kickoff", preparation:"Préparation", outreach:"Outreach", management_meetings:"Mgmt meetings", dd:"Due Diligence", negotiation:"Négociation", closing:"Closing", post_closing:"Post-closing", ongoing_support:"Suivi", search:"Recherche" };
const EVT_COLOR: Record<string,{bg:string;tx:string;label:string}> = {
  meeting:   {bg:"var(--buy-bg)",  tx:"var(--buy-tx)",  label:"Réunion"},
  follow_up: {bg:"var(--sell-bg)", tx:"var(--sell-tx)", label:"Relance"},
  deadline:  {bg:"var(--rec-bg)",  tx:"var(--rec-tx)",  label:"Deadline"},
  call:      {bg:"var(--cfo-bg)",  tx:"var(--cfo-tx)",  label:"Appel"},
  other:     {bg:"var(--surface-3)",tx:"var(--text-3)", label:"Autre"},
};

function fmtDate(v:string|null){if(!v)return"—";const d=new Date(v);return d.toLocaleDateString("fr-FR",{day:"numeric",month:"short"});}
function fmtDT(v:string|null){if(!v)return"—";const d=new Date(v);return d.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})+" "+d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});}

async function Content() {
  const supabase = await createClient();
  const today = new Date();
  const in10 = new Date(Date.now()+10*24*60*60*1000);

  const [{ data:deals },{ data:tasks },{ data:events },{ count:cC },{ count:cO }] = await Promise.all([
    supabase.from("deals").select("id,name,deal_type,deal_status,deal_stage,priority_level,client_organization_id").order("priority_level"),
    supabase.from("tasks").select("id,title,priority_level,due_date,deal_id,deals(id,name)").eq("task_status","open").order("due_date",{ascending:true}).limit(8),
    supabase.from("agenda_events").select("id,title,event_type,starts_at,meet_link,deals(name)").eq("status","open").gte("starts_at",today.toISOString()).lte("starts_at",in10.toISOString()).order("starts_at").limit(6),
    supabase.from("contacts").select("*",{count:"exact",head:true}),
    supabase.from("organizations").select("*",{count:"exact",head:true}),
  ]);

  const all = deals??[];
  const active = all.filter(d=>d.deal_status==="active");
  const types = ["fundraising","ma_sell","ma_buy","cfo_advisor","recruitment"];

  // Stats par type
  const typeStats = types.map(t=>({
    t, dt:DT[t],
    active: active.filter(d=>d.deal_type===t).length,
    total: all.filter(d=>d.deal_type===t).length,
  })).filter(s=>s.total>0);

  return (
    <div style={{ padding:32, minHeight:"100vh", background:"var(--bg)" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:28, flexWrap:"wrap", gap:12 }}>
        <div>
          <div className="section-label" style={{ marginBottom:6 }}>Tableau de bord</div>
          <h1 style={{ margin:0 }}>Bonjour 👋</h1>
          <div style={{ fontSize:13, color:"var(--text-4)", marginTop:4 }}>{today.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
        </div>
        <Link href="/protected/ia" style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"10px 20px", borderRadius:11, background:"linear-gradient(135deg,var(--su-600),var(--su-500))", color:"#fff", fontWeight:700, fontSize:13, boxShadow:"0 3px 12px rgba(29,61,114,.3)" }}>
          <Sparkles size={15}/>Assistant IA
          <span style={{ fontSize:9, background:"rgba(255,255,255,.2)", borderRadius:4, padding:"2px 6px", fontWeight:800, letterSpacing:".04em" }}>NEW</span>
        </Link>
      </div>

      {/* KPIs globaux */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:20 }}>
        {[
          { label:"Actifs",    val:active.length,   bg:"var(--buy-bg)",  tx:"var(--buy-tx)",  border:"var(--buy-mid)",  sub:"dossiers" },
          { label:"Total",     val:all.length,      bg:"var(--surface-2)", tx:"var(--text-2)", border:"var(--border)",   sub:"dossiers" },
          { label:"Contacts",  val:cC??0,           bg:"#FFF0FA",        tx:"#8B1E6A",        border:"#E8C0DC",         sub:"CRM" },
          { label:"Orgas",     val:cO??0,           bg:"#FFF5E8",        tx:"#8B4A0A",        border:"#F8D09A",         sub:"CRM" },
          { label:"Tâches",    val:(tasks??[]).length, bg:"var(--cfo-bg)", tx:"var(--cfo-tx)", border:"var(--cfo-mid)", sub:"ouvertes" },
        ].map((k,i)=>(
          <div key={i} style={{ background:k.bg, border:`1px solid ${k.border}`, borderRadius:14, padding:"18px 20px", boxShadow:"var(--shadow-xs)" }}>
            <div style={{ fontSize:10, fontWeight:800, letterSpacing:".09em", textTransform:"uppercase", color:k.tx, opacity:.7, marginBottom:8 }}>{k.label}</div>
            <div style={{ fontSize:34, fontWeight:800, color:k.tx, lineHeight:1 }}>{k.val}</div>
            <div style={{ fontSize:11, color:k.tx, opacity:.6, marginTop:4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Modules par type de dossier */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:24 }}>
        {typeStats.map(s=>(
          <Link key={s.t} href="/protected/dossiers" style={{ display:"block", padding:"14px 16px", borderRadius:12, background:s.dt.bg, border:`1px solid ${s.dt.border}`, transition:"transform .12s,box-shadow .12s", boxShadow:"var(--shadow-xs)" }}
            onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.transform="translateY(-2px)";el.style.boxShadow="var(--shadow-md)"}}
            onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.transform="";el.style.boxShadow="var(--shadow-xs)"}}>
            <div style={{ fontSize:18, marginBottom:6 }}>{s.dt.icon}</div>
            <div style={{ fontSize:11.5, fontWeight:700, color:s.dt.tx, marginBottom:8 }}>{s.dt.label}</div>
            <div style={{ display:"flex", alignItems:"baseline", gap:5 }}>
              <span style={{ fontSize:26, fontWeight:800, color:s.dt.tx }}>{s.total}</span>
              {s.active>0 && <span style={{ fontSize:11, color:s.dt.tx, opacity:.65 }}>{s.active} actif{s.active>1?"s":""}</span>}
            </div>
          </Link>
        ))}
      </div>

      {/* Grid principale */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 300px", gap:18 }}>

        {/* Dossiers actifs */}
        <div className="card" style={{ overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", borderBottom:"1px solid var(--border)", background:"var(--surface-2)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:13, fontWeight:700, color:"var(--text-1)" }}>Dossiers actifs</span>
              <span style={{ fontSize:11, fontWeight:700, background:"var(--buy-bg)", color:"var(--buy-tx)", borderRadius:12, padding:"2px 8px" }}>{active.length}</span>
            </div>
            <Link href="/protected/dossiers" style={{ display:"flex", alignItems:"center", gap:3, fontSize:12, color:"var(--su-500)", fontWeight:600 }}>Tous <ArrowRight size={12}/></Link>
          </div>
          <div>
            {active.length===0 ? (
              <div style={{ padding:"32px 20px", textAlign:"center", fontSize:13, color:"var(--text-5)" }}>Aucun dossier actif</div>
            ) : active.slice(0,7).map(d=>{
              const dt = DT[d.deal_type];
              const pcolor = d.priority_level==="high"?"var(--rec-dot)":d.priority_level==="medium"?"var(--sell-dot)":"var(--border-2)";
              return (
                <Link key={d.id} href={`/protected/dossiers/${d.id}`} style={{ display:"flex", alignItems:"center", gap:11, padding:"11px 20px", borderBottom:"1px solid var(--border)", background:"var(--surface)" }}>
                  <div style={{ width:3, height:32, borderRadius:3, background:pcolor, flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text-1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.name}</div>
                    <div style={{ fontSize:11, color:"var(--text-4)", marginTop:1 }}>{STAGE[d.deal_stage]??d.deal_stage}</div>
                  </div>
                  {dt && <span className={`badge dt-${d.deal_type}`} style={{ fontSize:10 }}>{dt.icon} {dt.label}</span>}
                  <ArrowRight size={11} color="var(--border-2)"/>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Tâches */}
        <div className="card" style={{ overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", borderBottom:"1px solid var(--border)", background:"var(--surface-2)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <Clock size={14} color="var(--text-3)"/>
              <span style={{ fontSize:13, fontWeight:700, color:"var(--text-1)" }}>Tâches ouvertes</span>
              <span style={{ fontSize:11, fontWeight:700, background:"var(--cfo-bg)", color:"var(--cfo-tx)", borderRadius:12, padding:"2px 8px" }}>{(tasks??[]).length}</span>
            </div>
            <Link href="/protected/agenda" style={{ fontSize:12, color:"var(--su-500)", fontWeight:600 }}>Agenda</Link>
          </div>
          <div>
            {(tasks??[]).length===0 ? (
              <div style={{ padding:"32px 20px", textAlign:"center", fontSize:13, color:"var(--text-5)" }}>Aucune tâche ouverte ✓</div>
            ) : (tasks??[]).map(task=>{
              const dl = Array.isArray(task.deals)?task.deals[0]:task.deals as any;
              const isOv = task.due_date && new Date(task.due_date)<today;
              const pdot = task.priority_level==="high"?"var(--rec-dot)":task.priority_level==="medium"?"var(--sell-dot)":"var(--border-2)";
              return (
                <div key={task.id} style={{ padding:"11px 20px", borderBottom:"1px solid var(--border)", background:isOv?"#FEF8F8":"var(--surface)" }}>
                  <div style={{ display:"flex", gap:9 }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:pdot, marginTop:5, flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--text-1)" }}>{task.title}</div>
                      {dl && <Link href={`/protected/dossiers/${dl.id}`} style={{ fontSize:11, color:"var(--su-500)", fontWeight:500 }}>📁 {dl.name}</Link>}
                    </div>
                    <div style={{ fontSize:11, fontWeight:500, color:isOv?"var(--rec-tx)":"var(--text-4)", flexShrink:0 }}>{fmtDate(task.due_date)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Colonne droite */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* Actions rapides */}
          <div className="card" style={{ padding:"16px 14px" }}>
            <div style={{ fontSize:10, fontWeight:800, letterSpacing:".1em", textTransform:"uppercase", color:"var(--text-4)", marginBottom:11 }}>Actions rapides</div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {[
                {href:"/protected/dossiers/nouveau",      label:"Nouveau dossier",      bg:"var(--buy-bg)",  tx:"var(--buy-tx)"},
                {href:"/protected/contacts/nouveau",      label:"Nouveau contact",      bg:"#FFF0FA",        tx:"#8B1E6A"},
                {href:"/protected/organisations/nouveau", label:"Nouvelle organisation",bg:"#FFF5E8",        tx:"#8B4A0A"},
                {href:"/protected/agenda/nouvelle-tache", label:"Nouvelle tâche",       bg:"var(--cfo-bg)",  tx:"var(--cfo-tx)"},
                {href:"/protected/import",                label:"Import CSV",           bg:"var(--surface-3)",tx:"var(--text-3)"},
              ].map(a=>(
                <Link key={a.href} href={a.href} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 12px", borderRadius:9, background:a.bg, color:a.tx, fontSize:12.5, fontWeight:600 }}>
                  {a.label}<ArrowRight size={12} style={{ opacity:.5 }}/>
                </Link>
              ))}
            </div>
          </div>

          {/* Agenda */}
          <div className="card" style={{ overflow:"hidden", flex:1 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 16px", borderBottom:"1px solid var(--border)", background:"var(--surface-2)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <CalendarDays size={13} color="var(--text-3)"/>
                <span style={{ fontSize:12, fontWeight:700, color:"var(--text-1)" }}>10 prochains jours</span>
              </div>
              <Link href="/protected/agenda" style={{ fontSize:11, color:"var(--su-500)", fontWeight:600 }}>Tout →</Link>
            </div>
            {(events??[]).length===0 ? (
              <div style={{ padding:"24px 16px", textAlign:"center", fontSize:12, color:"var(--text-5)" }}>Aucun événement</div>
            ) : (events??[]).map(ev=>{
              const ec = EVT_COLOR[ev.event_type]??EVT_COLOR.other;
              const dl = Array.isArray(ev.deals)?ev.deals[0]:ev.deals as any;
              return (
                <div key={ev.id} style={{ padding:"11px 16px", borderBottom:"1px solid var(--border)" }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <span style={{ fontSize:10, fontWeight:700, borderRadius:5, padding:"2px 6px", background:ec.bg, color:ec.tx }}>{ec.label}</span>
                      <div style={{ fontSize:12, fontWeight:600, color:"var(--text-1)", marginTop:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ev.title}</div>
                      {dl && <div style={{ fontSize:10.5, color:"var(--text-4)" }}>📁 {dl.name}</div>}
                    </div>
                    <div style={{ fontSize:10, color:"var(--text-4)", flexShrink:0, textAlign:"right", marginTop:2 }}>{fmtDT(ev.starts_at)}</div>
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
    <Suspense fallback={<div style={{ padding:32, background:"var(--bg)", minHeight:"100vh" }}><div className="skeleton" style={{ height:200, borderRadius:16, marginBottom:16 }}/><div className="skeleton" style={{ height:400, borderRadius:16 }}/></div>}>
      <Content/>
    </Suspense>
  );
}
