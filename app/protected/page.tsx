import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, Plus } from "lucide-react";

const DT: Record<string,{label:string;bg:string;tx:string;border:string}> = {
  fundraising:{label:"Fundraising",bg:"var(--fund-bg)",tx:"var(--fund-tx)",border:"var(--fund-mid)"},
  ma_sell:    {label:"M&A Sell",   bg:"var(--sell-bg)",tx:"var(--sell-tx)",border:"var(--sell-mid)"},
  ma_buy:     {label:"M&A Buy",    bg:"var(--buy-bg)", tx:"var(--buy-tx)", border:"var(--buy-mid)"},
  cfo_advisor:{label:"CFO Advisor",bg:"var(--cfo-bg)", tx:"var(--cfo-tx)", border:"var(--cfo-mid)"},
  recruitment:{label:"Recrutement",bg:"var(--rec-bg)", tx:"var(--rec-tx)", border:"var(--rec-mid)"},
};
const STAGE: Record<string,string> = {
  kickoff:"Kickoff",preparation:"Préparation",outreach:"Outreach",
  management_meetings:"Mgmt",dd:"Due Diligence",negotiation:"Négociation",
  closing:"Closing",post_closing:"Post-closing",ongoing_support:"Suivi",search:"Recherche",
};
const PRIO: Record<string,string> = {high:"var(--rec-dot)",medium:"var(--sell-dot)",low:"var(--border-2)"};

function fmt(v:string|null){if(!v)return"—";return new Date(v).toLocaleDateString("fr-FR",{day:"numeric",month:"short"});}
function daysSince(v:string){return Math.floor((Date.now()-new Date(v).getTime())/86400000);}

async function Content() {
  const supabase = await createClient();
  const cutoff15 = new Date(Date.now()-15*864e5).toISOString().split("T")[0];
  const cutoff30 = new Date(Date.now()-30*864e5).toISOString().split("T")[0];

  const [dealsRes, tasksRes, relancesRes, kpiRes] = await Promise.all([
    supabase.from("deals")
      .select("id,name,deal_type,deal_status,deal_stage,priority_level,target_date,target_amount,currency")
      .eq("deal_status","active").order("priority_level"),
    supabase.from("tasks")
      .select("id,title,priority_level,due_date,deal_id,deals(name)")
      .eq("task_status","open").order("due_date",{ascending:true}).limit(6),
    supabase.from("contacts")
      .select("id,first_name,last_name,base_status,last_contact_date,organization_contacts(organizations(name))")
      .not("last_contact_date","is",null)
      .lte("last_contact_date", cutoff15)
      .not("base_status","in","(excluded,inactive)")
      .order("last_contact_date",{ascending:true}).limit(8),
    Promise.all([
      supabase.from("deals").select("*",{count:"exact",head:true}).eq("deal_status","active"),
      supabase.from("contacts").select("*",{count:"exact",head:true}),
      supabase.from("organizations").select("*",{count:"exact",head:true}),
      supabase.from("tasks").select("*",{count:"exact",head:true}).eq("task_status","open"),
    ]),
  ]);

  const deals = dealsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const relances = relancesRes.data ?? [];
  const [cDeals, cContacts, cOrgs, cTasks] = await kpiRes;

  const relancesUrgentes = relances.filter(c => c.last_contact_date && c.last_contact_date <= cutoff30);

  return (
    <div style={{ padding:"28px 24px", maxWidth:1080, margin:"0 auto" }}>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
        {[
          { label:"Dossiers actifs", val:cDeals.count??0, href:"/protected/dossiers", color:"#3468B0" },
          { label:"Organisations",   val:cOrgs.count??0,  href:"/protected/organisations", color:"#D97706" },
          { label:"Contacts",        val:cContacts.count??0, href:"/protected/contacts", color:"#A8306A" },
          { label:"Tâches ouvertes", val:cTasks.count??0, href:"/protected/dossiers", color: (cTasks.count??0)>0?"#DC2626":"#15A348" },
        ].map(({ label, val, href, color }) => (
          <Link key={label} href={href} style={{ textDecoration:"none" }}>
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:"16px 18px", transition:"border-color .12s" }}

            >
              <div style={{ fontSize:26, fontWeight:800, color, lineHeight:1.1 }}>{val}</div>
              <div style={{ fontSize:12.5, color:"var(--text-4)", marginTop:3 }}>{label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>

        {/* Dossiers actifs */}
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid var(--border)" }}>
            <span style={{ fontSize:12, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em" }}>Dossiers actifs</span>
            <Link href="/protected/dossiers/nouveau" style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, color:"var(--text-4)", textDecoration:"none", padding:"3px 8px", border:"1px solid var(--border)", borderRadius:6 }}>
              <Plus size={11}/> Nouveau
            </Link>
          </div>
          {deals.length === 0 && <div style={{ padding:"28px", textAlign:"center", fontSize:13, color:"var(--text-5)" }}>Aucun dossier actif</div>}
          {deals.map((d, i) => {
            const dt = DT[d.deal_type] ?? DT.fundraising;
            return (
              <Link key={d.id} href={`/protected/dossiers/${d.id}`} style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 16px", borderBottom: i<deals.length-1?"1px solid var(--border)":"none", textDecoration:"none", transition:"background .1s" }}

              >
                <div style={{ width:6, height:6, borderRadius:3, background:PRIO[d.priority_level]??PRIO.medium, flexShrink:0 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, color:"var(--text-1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.name}</div>
                  <div style={{ fontSize:11.5, color:"var(--text-5)", marginTop:1 }}>
                    {STAGE[d.deal_stage]??d.deal_stage}
                    {d.target_date ? ` · 🎯 ${fmt(d.target_date)}` : ""}
                  </div>
                </div>
                <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:dt.bg, color:dt.tx, border:`1px solid ${dt.border}`, flexShrink:0, fontWeight:600 }}>{dt.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Colonne droite */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

          {/* Relances urgentes */}
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", gap:7, padding:"12px 16px", borderBottom:"1px solid var(--border)" }}>
              {relancesUrgentes.length > 0 && <AlertTriangle size={13} color="var(--rec-tx)"/>}
              <span style={{ fontSize:12, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em" }}>
                Relances {relancesUrgentes.length > 0 ? `(${relancesUrgentes.length} urgentes)` : ""}
              </span>
            </div>
            {relances.length === 0 && <div style={{ padding:"20px", textAlign:"center", fontSize:13, color:"var(--text-5)" }}>✅ Aucune relance due</div>}
            {relances.slice(0,5).map((c, i) => {
              const days = daysSince(c.last_contact_date!);
              const org = (c.organization_contacts as any[])?.[0]?.organizations;
              const orgName = Array.isArray(org) ? org[0]?.name : org?.name;
              return (
                <Link key={c.id} href={`/protected/contacts/${c.id}`} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 16px", borderBottom: i<Math.min(relances.length,5)-1?"1px solid var(--border)":"none", textDecoration:"none", transition:"background .1s" }}

                >
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text-1)" }}>{c.first_name} {c.last_name}</div>
                    {orgName && <div style={{ fontSize:11.5, color:"var(--text-5)" }}>{orgName}</div>}
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color: days>=30?"var(--rec-tx)":"#B45309", flexShrink:0 }}>
                    {days}j
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Tâches à faire */}
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)" }}>
              <span style={{ fontSize:12, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em" }}>Tâches à faire</span>
            </div>
            {tasks.length === 0 && <div style={{ padding:"20px", textAlign:"center", fontSize:13, color:"var(--text-5)" }}>✅ Aucune tâche</div>}
            {tasks.map((t, i) => {
              const deal = Array.isArray(t.deals) ? t.deals[0] : t.deals as any;
              const overdue = t.due_date && new Date(t.due_date) < new Date();
              return (
                <Link key={t.id} href={t.deal_id ? `/protected/dossiers/${t.deal_id}` : "#"} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 16px", borderBottom: i<tasks.length-1?"1px solid var(--border)":"none", textDecoration:"none", transition:"background .1s" }}

                >
                  <div style={{ width:7, height:7, borderRadius:3.5, background:PRIO[t.priority_level]??PRIO.medium, flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text-1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.title}</div>
                    {deal?.name && <div style={{ fontSize:11.5, color:"var(--text-5)" }}>{deal.name}</div>}
                  </div>
                  {t.due_date && (
                    <span style={{ fontSize:11.5, color: overdue?"var(--rec-tx)":"var(--text-5)", fontWeight: overdue?700:400, flexShrink:0 }}>
                      {overdue?"⚠ ":""}{fmt(t.due_date)}
                    </span>
                  )}
                </Link>
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
    <Suspense fallback={<div style={{ padding:32 }}><div style={{ height:400, borderRadius:14, background:"var(--surface-2)" }}/></div>}>
      <Content/>
    </Suspense>
  );
}
