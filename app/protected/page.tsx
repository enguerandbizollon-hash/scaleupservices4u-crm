import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { DashboardClient } from "./dashboard-client";
import { getFeesKpis } from "@/actions/fees";
import { projectYearEndFromYtd } from "@/lib/crm/fee-calculator";
import { stageLabel } from "@/lib/crm/matching-maps";

// Les widgets lisent des données mutables (actions, deals, relances) :
// on force le rendu dynamique pour que revalidatePath depuis les Server
// Actions déclenche un vrai re-fetch.
export const dynamic = "force-dynamic";

const PRIO: Record<string,string> = { high:"var(--rec-dot)", medium:"var(--sell-dot)", low:"var(--border-2)" };
const DT: Record<string,{label:string;bg:string;tx:string;border:string}> = {
  fundraising:{label:"Fundraising",bg:"var(--fund-bg)",tx:"var(--fund-tx)",border:"var(--fund-mid)"},
  ma_sell:    {label:"M&A Sell",   bg:"var(--sell-bg)",tx:"var(--sell-tx)",border:"var(--sell-mid)"},
  ma_buy:     {label:"M&A Buy",    bg:"var(--buy-bg)", tx:"var(--buy-tx)", border:"var(--buy-mid)"},
  cfo_advisor:{label:"CFO Advisor",bg:"var(--cfo-bg)", tx:"var(--cfo-tx)", border:"var(--cfo-mid)"},
  recruitment:{label:"Recrutement",bg:"var(--rec-bg)", tx:"var(--rec-tx)", border:"var(--rec-mid)"},
};
// V55 : libellés unifiés via stageLabel() depuis matching-maps.
const STAGE: Record<string,string> = {};

function fmt(v:string|null){ if(!v)return"—"; return new Date(v).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}); }
function daysSince(v:string){ return Math.floor((Date.now()-new Date(v).getTime())/86400000); }

async function Content() {
  const supabase = await createClient();
  const cutoff15 = new Date(Date.now()-15*864e5).toISOString().split("T")[0];
  const cutoff30 = new Date(Date.now()-30*864e5).toISOString().split("T")[0];
  const today    = new Date().toISOString().split("T")[0];
  const in30     = new Date(Date.now()+30*864e5).toISOString().split("T")[0];

  // Toutes les lectures de tâches, activités et événements viennent
  // désormais de la table unifiée actions (V35). Les filtres type/status
  // remplacent les filtres task_status / event_type des anciennes tables.
  const [dealsRes, openTasksRes, relancesRes, recentActsRes, upcomingEventsRes, kpiRes, allContactsRes] = await Promise.all([
    supabase.from("deals").select("id,name,deal_type,deal_status,deal_stage,priority_level,target_date").eq("deal_status","open").order("priority_level"),
    // Tâches ouvertes — widget "Tâches à faire"
    supabase.from("actions")
      .select("id,title,priority,due_date,deal_id,deals(name)")
      .eq("type","task")
      .not("status","in",'("done","cancelled","completed")')
      .order("due_date",{ascending:true})
      .limit(6),
    supabase.from("contacts").select("id,first_name,last_name,last_contact_date,organization_contacts(organizations(name))").not("last_contact_date","is",null).lte("last_contact_date",cutoff15).not("base_status","in","(excluded,inactive)").order("last_contact_date",{ascending:true}).limit(8),
    // Activités récentes — widget "Activités récentes" (tout sauf tâches)
    supabase.from("actions")
      .select("id,title,type,email_direction,start_datetime,due_date,deal_id,deals(name)")
      .neq("type","task")
      .order("created_at",{ascending:false})
      .limit(8),
    // Événements à venir — widget calendrier 30j (meetings / calls / deadlines ouverts)
    supabase.from("actions")
      .select("id,title,type,due_date,start_datetime,deal_id,deals(name)")
      .in("type",["meeting","call","deadline"])
      .not("status","in",'("done","cancelled","completed")')
      .gte("due_date",today)
      .lte("due_date",in30)
      .order("due_date",{ascending:true})
      .limit(20),
    Promise.all([
      supabase.from("deals").select("*",{count:"exact",head:true}).eq("deal_status","open"),
      supabase.from("contacts").select("*",{count:"exact",head:true}),
      supabase.from("organizations").select("*",{count:"exact",head:true}),
      supabase.from("actions").select("*",{count:"exact",head:true}).eq("type","task").not("status","in",'("done","cancelled","completed")'),
      // V53e : dossiers open non encore prêts pour outreach (not_started + drafting)
      supabase.from("deals").select("*",{count:"exact",head:true})
        .eq("deal_status","open")
        .in("screening_status",["not_started","drafting"]),
    ]),
    supabase.from("contacts")
      .select("id,first_name,last_name,email,organization_contacts(organizations(name))")
      .not("base_status","in","(excluded,inactive)")
      .order("last_name").limit(200),
  ]);

  const deals      = dealsRes.data ?? [];
  const tasks      = openTasksRes.data ?? [];
  const relances   = relancesRes.data ?? [];
  const activities = recentActsRes.data ?? [];
  const events     = upcomingEventsRes.data ?? [];
  const [cDeals, cContacts, cOrgs, cTasks, cToScreen] = await kpiRes;

  // V52 — KPIs honoraires cabinet (pipeline / facturé / encaissé YTD / projection)
  const feesRaw = await getFeesKpis();
  const feesKpis = {
    ...feesRaw,
    projection: projectYearEndFromYtd(feesRaw.paid_ytd),
  };

  // Mapping Action.type → clé historique pour ACT_ICON / EVT_COLOR
  // du DashboardClient (qui connaît email_sent, follow_up, etc.).
  const toLegacyType = (t: string, emailDir?: string | null) => {
    if (t === "email") return emailDir === "received" ? "email_received" : "email_sent";
    if (t === "deadline") return "deadline";
    if (t === "document_request") return "other";
    return t; // task, call, meeting, note
  };

  // Préparer les événements du calendrier (30 prochains jours)
  const calendarEvents = events.map(e => {
    const deal = Array.isArray(e.deals) ? e.deals[0] : e.deals as any;
    return {
      id: e.id,
      title: e.title,
      date: (e.due_date ?? e.start_datetime) as string,
      type: toLegacyType(e.type),
      dealName: deal?.name ?? null,
      contactName: null as string | null,
    };
  });
  // Ajouter les tâches dans le calendrier
  const calendarTasks = tasks.filter(t => t.due_date).map(t => {
    const deal = Array.isArray(t.deals) ? t.deals[0] : t.deals as any;
    return { id:t.id, title:t.title, date:t.due_date!, type:"task", dealName:deal?.name ?? null, contactName:null };
  });

  return (
    <DashboardClient
      kpis={[
        { label:"Dossiers actifs",  val:cDeals.count??0,    href:"/protected/dossiers",      color:"#3468B0" },
        { label:"À screener",       val:cToScreen.count??0, href:"/protected/dossiers",      color:(cToScreen.count??0)>0?"#B45309":"#15A348" },
        { label:"Organisations",    val:cOrgs.count??0,     href:"/protected/organisations", color:"#D97706" },
        { label:"Contacts",         val:cContacts.count??0, href:"/protected/contacts",      color:"#A8306A" },
        { label:"Tâches ouvertes",  val:cTasks.count??0,    href:"/protected/dossiers",      color:(cTasks.count??0)>0?"#DC2626":"#15A348" },
      ]}
      feesKpis={feesKpis}
      deals={deals.map(d => ({ id:d.id, name:d.name, type:d.deal_type, stage:d.deal_stage, priority:d.priority_level, targetDate:d.target_date, dt:DT[d.deal_type]??DT.fundraising, stageLabel:stageLabel(d.deal_stage), prioColor:PRIO[d.priority_level]??PRIO.medium }))}
      relances={relances.map(c => { const org=(c.organization_contacts as any[])?.[0]?.organizations; return { id:c.id, firstName:c.first_name, lastName:c.last_name, days:daysSince(c.last_contact_date!), orgName:Array.isArray(org)?org[0]?.name:org?.name }; })}
      tasks={tasks.map(t => { const deal=Array.isArray(t.deals)?t.deals[0]:t.deals as any; return { id:t.id, title:t.title, priority:t.priority ?? "medium", dueDate:t.due_date, dealId:t.deal_id, dealName:deal?.name, overdue:!!(t.due_date&&new Date(t.due_date)<new Date()), prioColor:PRIO[t.priority ?? "medium"]??PRIO.medium }; })}
      activities={activities.map(a => { const deal=Array.isArray(a.deals)?a.deals[0]:a.deals as any; return { id:a.id, title:a.title, type:toLegacyType(a.type, a.email_direction), date:(a.start_datetime ?? a.due_date) as string, dealId:a.deal_id, dealName:deal?.name }; })}
      calendarItems={[...calendarEvents, ...calendarTasks]}
      allContacts={(allContactsRes.data ?? []).map((c:any) => {
        const org = (c.organization_contacts as any[])?.[0]?.organizations;
        const orgName = Array.isArray(org) ? org[0]?.name : org?.name;
        return { id:c.id, first_name:c.first_name, last_name:c.last_name, email:c.email, org_name:orgName };
      })}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ padding:32 }}><div style={{ height:400, borderRadius:14, background:"var(--surface-2)" }}/></div>}>
      <Content/>
    </Suspense>
  );
}
