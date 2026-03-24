import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { DashboardClient } from "./dashboard-client";

const PRIO: Record<string,string> = { high:"var(--rec-dot)", medium:"var(--sell-dot)", low:"var(--border-2)" };
const DT: Record<string,{label:string;bg:string;tx:string;border:string}> = {
  fundraising:{label:"Fundraising",bg:"var(--fund-bg)",tx:"var(--fund-tx)",border:"var(--fund-mid)"},
  ma_sell:    {label:"M&A Sell",   bg:"var(--sell-bg)",tx:"var(--sell-tx)",border:"var(--sell-mid)"},
  ma_buy:     {label:"M&A Buy",    bg:"var(--buy-bg)", tx:"var(--buy-tx)", border:"var(--buy-mid)"},
  cfo_advisor:{label:"CFO Advisor",bg:"var(--cfo-bg)", tx:"var(--cfo-tx)", border:"var(--cfo-mid)"},
  recruitment:{label:"Recrutement",bg:"var(--rec-bg)", tx:"var(--rec-tx)", border:"var(--rec-mid)"},
};
const STAGE: Record<string,string> = { kickoff:"Kickoff",preparation:"Préparation",outreach:"Outreach",management_meetings:"Mgmt",dd:"Due Diligence",negotiation:"Négociation",closing:"Closing",post_closing:"Post-closing",ongoing_support:"Suivi",search:"Recherche" };

function fmt(v:string|null){ if(!v)return"—"; return new Date(v).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}); }
function daysSince(v:string){ return Math.floor((Date.now()-new Date(v).getTime())/86400000); }

async function Content() {
  const supabase = await createClient();
  const cutoff15 = new Date(Date.now()-15*864e5).toISOString().split("T")[0];
  const cutoff30 = new Date(Date.now()-30*864e5).toISOString().split("T")[0];
  const today    = new Date().toISOString().split("T")[0];
  const in30     = new Date(Date.now()+30*864e5).toISOString().split("T")[0];

  const [dealsRes, tasksRes, relancesRes, activitiesRes, eventsRes, kpiRes] = await Promise.all([
    supabase.from("deals").select("id,name,deal_type,deal_status,deal_stage,priority_level,target_date").eq("deal_status","active").order("priority_level"),
    supabase.from("tasks").select("id,title,priority_level,due_date,deal_id,deals(name)").eq("task_status","open").order("due_date",{ascending:true}).limit(6),
    supabase.from("contacts").select("id,first_name,last_name,last_contact_date,organization_contacts(organizations(name))").not("last_contact_date","is",null).lte("last_contact_date",cutoff15).not("base_status","in","(excluded,inactive)").order("last_contact_date",{ascending:true}).limit(8),
    supabase.from("activities").select("id,title,activity_type,activity_date,deal_id,deals(name)").order("activity_date",{ascending:false}).limit(8),
    supabase.from("events").select("id,title,event_type,due_date,deal_id,contact_id,deals(name),contacts(first_name,last_name)").eq("status","open").gte("due_date",today).lte("due_date",in30).order("due_date",{ascending:true}).limit(20),
    Promise.all([
      supabase.from("deals").select("*",{count:"exact",head:true}).eq("deal_status","active"),
      supabase.from("contacts").select("*",{count:"exact",head:true}),
      supabase.from("organizations").select("*",{count:"exact",head:true}),
      supabase.from("tasks").select("*",{count:"exact",head:true}).eq("task_status","open"),
    ]),
  ]);

  const deals     = dealsRes.data ?? [];
  const tasks     = tasksRes.data ?? [];
  const relances  = relancesRes.data ?? [];
  const activities = activitiesRes.data ?? [];
  const events    = eventsRes.data ?? [];
  const [cDeals, cContacts, cOrgs, cTasks] = await kpiRes;

  const relancesUrgentes = relances.filter(c => c.last_contact_date && c.last_contact_date <= cutoff30);

  // Préparer les événements du calendrier (30 prochains jours)
  const calendarEvents = events.map(e => {
    const deal = Array.isArray(e.deals) ? e.deals[0] : e.deals as any;
    const contact = Array.isArray(e.contacts) ? e.contacts[0] : e.contacts as any;
    return {
      id: e.id,
      title: e.title,
      date: e.due_date,
      type: e.event_type,
      dealName: deal?.name ?? null,
      contactName: contact ? `${contact.first_name} ${contact.last_name}` : null,
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
        { label:"Organisations",    val:cOrgs.count??0,     href:"/protected/organisations", color:"#D97706" },
        { label:"Contacts",         val:cContacts.count??0, href:"/protected/contacts",      color:"#A8306A" },
        { label:"Tâches ouvertes",  val:cTasks.count??0,    href:"/protected/dossiers",      color:(cTasks.count??0)>0?"#DC2626":"#15A348" },
      ]}
      deals={deals.map(d => ({ id:d.id, name:d.name, type:d.deal_type, stage:d.deal_stage, priority:d.priority_level, targetDate:d.target_date, dt:DT[d.deal_type]??DT.fundraising, stageLabel:STAGE[d.deal_stage]??d.deal_stage, prioColor:PRIO[d.priority_level]??PRIO.medium }))}
      relances={relances.map(c => { const org=(c.organization_contacts as any[])?.[0]?.organizations; return { id:c.id, firstName:c.first_name, lastName:c.last_name, days:daysSince(c.last_contact_date!), orgName:Array.isArray(org)?org[0]?.name:org?.name }; })}
      tasks={tasks.map(t => { const deal=Array.isArray(t.deals)?t.deals[0]:t.deals as any; return { id:t.id, title:t.title, priority:t.priority_level, dueDate:t.due_date, dealId:t.deal_id, dealName:deal?.name, overdue:!!(t.due_date&&new Date(t.due_date)<new Date()), prioColor:PRIO[t.priority_level]??PRIO.medium }; })}
      activities={activities.map(a => { const deal=Array.isArray(a.deals)?a.deals[0]:a.deals as any; return { id:a.id, title:a.title, type:a.activity_type, date:a.activity_date, dealId:a.deal_id, dealName:deal?.name }; })}
      calendarItems={[...calendarEvents, ...calendarTasks]}
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
