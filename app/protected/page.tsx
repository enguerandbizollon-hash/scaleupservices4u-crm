import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { DashboardClient } from "./dashboard-client";
import { getFeesKpis } from "@/actions/fees";
import { projectYearEndFromYtd } from "@/lib/crm/fee-calculator";
import { stageLabel } from "@/lib/crm/matching-maps";
import { AlertsBar, type DashboardAlert } from "@/components/dashboard/AlertsBar";
import { isDormant } from "@/lib/crm/health-score";

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
  const [dealsRes, openTasksRes, relancesRes, recentActsRes, upcomingEventsRes, kpiRes, allContactsRes, closedDealsRes] = await Promise.all([
    supabase.from("deals").select("id,name,deal_type,deal_status,deal_stage,priority_level,target_date,target_amount,currency,next_action_date").eq("deal_status","open").order("priority_level"),
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
    // V58 — dossiers clôturés (won + lost) sur 12 mois glissants pour le
    // taux de conversion par métier dans la bande analytique.
    supabase.from("deals")
      .select("id,deal_type,deal_status")
      .in("deal_status",["won","lost"])
      .gte("updated_at", new Date(Date.now() - 365 * 864e5).toISOString()),
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

  // Alertes proactives : signaux qu'on remonte en haut du dashboard.
  // 4 signaux en parallèle, agrégation par count.
  const cutoffFees30 = new Date(Date.now() - 30 * 864e5).toISOString().split("T")[0]!;
  const [tasksOverdueRes, feesOverdueRes, openDealsForDormantRes, rgpdRes, inboxRes] = await Promise.all([
    supabase
      .from("actions")
      .select("id", { count: "exact", head: true })
      .eq("type", "task")
      .not("status", "in", '("done","cancelled","completed")')
      .lt("due_date", today!),
    supabase
      .from("fee_milestones")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("due_date", cutoffFees30),
    supabase
      .from("deals")
      .select("id")
      .eq("deal_status", "open"),
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .not("rgpd_expiry_date", "is", null)
      .lte("rgpd_expiry_date", in30!)
      .gte("rgpd_expiry_date", today!),
    supabase
      .from("actions")
      .select("id", { count: "exact", head: true })
      .eq("type", "email")
      .eq("needs_review", true),
  ]);

  // Calculer dormants : 1 requête pour les open deals, puis joindre avec
  // la dernière activité (déjà partiellement chargée via recentActsRes mais
  // limitée à 8). On fait une requête dédiée pour avoir le compte exact.
  let dormantDealsCount = 0;
  const openDealIds = (openDealsForDormantRes.data ?? []).map(d => d.id);
  if (openDealIds.length > 0) {
    const { data: lastActs } = await supabase
      .from("actions")
      .select("deal_id,start_datetime,due_date")
      .in("deal_id", openDealIds)
      .neq("type", "task")
      .order("start_datetime", { ascending: false, nullsFirst: false });
    const lastByDeal = new Map<string, string | null>();
    for (const a of lastActs ?? []) {
      if (!a.deal_id) continue;
      if (!lastByDeal.has(a.deal_id)) {
        lastByDeal.set(a.deal_id, a.start_datetime ?? a.due_date ?? null);
      }
    }
    for (const id of openDealIds) {
      if (isDormant(lastByDeal.get(id) ?? null, "open")) dormantDealsCount++;
    }
  }

  const alerts: DashboardAlert[] = [
    { kind: "inbox_to_review", count: inboxRes.count ?? 0,        href: "/protected/inbox" },
    { kind: "tasks_overdue",   count: tasksOverdueRes.count ?? 0, href: "/protected/dossiers" },
    { kind: "fees_overdue",    count: feesOverdueRes.count ?? 0,  href: "/protected/mandats" },
    { kind: "deals_dormant",   count: dormantDealsCount,          href: "/protected/dossiers?view=kanban" },
    { kind: "rgpd_expiring",   count: rgpdRes.count ?? 0,         href: "/protected/contacts" },
  ];

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

  // V58 — Bande analytique : Pipeline par stade + Conversion par métier + Top 5 dossiers.
  // Les 3 stats sont calculées côté server pour éviter des allers-retours.

  // 1. Pipeline par stade (sur l'ensemble des open deals, agrégé par stage).
  //    On expose count + totalAmount + un sample du métier dominant pour pouvoir
  //    légender côté UI.
  const pipelineByStage: Record<string, { count: number; amount_total: number; types: Record<string, number> }> = {};
  for (const d of deals) {
    const stage = d.deal_stage ?? "kickoff";
    if (!pipelineByStage[stage]) pipelineByStage[stage] = { count: 0, amount_total: 0, types: {} };
    pipelineByStage[stage]!.count++;
    if (typeof d.target_amount === "number") pipelineByStage[stage]!.amount_total += d.target_amount;
    pipelineByStage[stage]!.types[d.deal_type] = (pipelineByStage[stage]!.types[d.deal_type] ?? 0) + 1;
  }
  const pipelineStats = Object.entries(pipelineByStage).map(([stage, v]) => ({
    stage,
    label: stageLabel(stage),
    count: v.count,
    amount_total: v.amount_total,
    dominant_type: Object.entries(v.types).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "ma_sell",
  })).sort((a, b) => b.count - a.count);

  // 2. Conversion par métier (won / (won+lost) sur 12 mois glissants).
  const closedDeals = (closedDealsRes.data ?? []) as Array<{ id: string; deal_type: string; deal_status: string }>;
  const conversionByType: Record<string, { won: number; lost: number }> = {};
  for (const d of closedDeals) {
    if (!conversionByType[d.deal_type]) conversionByType[d.deal_type] = { won: 0, lost: 0 };
    if (d.deal_status === "won")  conversionByType[d.deal_type]!.won++;
    if (d.deal_status === "lost") conversionByType[d.deal_type]!.lost++;
  }
  const conversionStats = Object.entries(conversionByType).map(([type, v]) => {
    const total = v.won + v.lost;
    return {
      type,
      label: DT[type]?.label ?? type,
      color: DT[type]?.tx ?? "var(--text-2)",
      won: v.won,
      lost: v.lost,
      total,
      rate: total > 0 ? Math.round((v.won / total) * 100) : 0,
    };
  }).filter(s => s.total > 0).sort((a, b) => b.total - a.total);

  // 3. Top 5 dossiers actifs (high priority en tête, puis échéance proche).
  //    On annexe la prochaine action (premier event ou première tâche par due_date).
  const nextActionByDeal: Record<string, { title: string; date: string }> = {};
  for (const e of events) {
    if (!e.deal_id || !e.due_date) continue;
    if (!nextActionByDeal[e.deal_id]) {
      nextActionByDeal[e.deal_id] = { title: e.title as string, date: e.due_date as string };
    }
  }
  for (const t of tasks) {
    if (!t.deal_id || !t.due_date) continue;
    const existing = nextActionByDeal[t.deal_id];
    if (!existing || (t.due_date as string) < existing.date) {
      nextActionByDeal[t.deal_id] = { title: t.title as string, date: t.due_date as string };
    }
  }
  const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const topDeals = [...deals]
    .sort((a, b) => {
      const pa = priorityRank[a.priority_level] ?? 3;
      const pb = priorityRank[b.priority_level] ?? 3;
      if (pa !== pb) return pa - pb;
      const ta = a.target_date ?? "9999-12-31";
      const tb = b.target_date ?? "9999-12-31";
      return ta.localeCompare(tb);
    })
    .slice(0, 5)
    .map(d => ({
      id: d.id,
      name: d.name,
      type: d.deal_type,
      stage: d.deal_stage,
      priority: d.priority_level,
      target_amount: d.target_amount ?? null,
      currency: d.currency ?? "EUR",
      type_label: DT[d.deal_type]?.label ?? d.deal_type,
      type_color: DT[d.deal_type]?.tx ?? "var(--text-2)",
      stage_label: stageLabel(d.deal_stage),
      next_action: nextActionByDeal[d.id] ?? null,
    }));

  const analytics = {
    pipeline: pipelineStats,
    conversion: conversionStats,
    top_deals: topDeals,
  };

  return (
    <>
    <div style={{ padding: "24px 24px 0" }}>
      <AlertsBar alerts={alerts} />
    </div>
    <DashboardClient
      kpis={[
        { label:"Dossiers actifs",  val:cDeals.count??0,    href:"/protected/dossiers",      color:"#3468B0" },
        { label:"À screener",       val:cToScreen.count??0, href:"/protected/dossiers",      color:(cToScreen.count??0)>0?"#B45309":"#15A348" },
        { label:"Organisations",    val:cOrgs.count??0,     href:"/protected/organisations", color:"#D97706" },
        { label:"Contacts",         val:cContacts.count??0, href:"/protected/contacts",      color:"#A8306A" },
        { label:"Tâches ouvertes",  val:cTasks.count??0,    href:"/protected/dossiers",      color:(cTasks.count??0)>0?"#DC2626":"#15A348" },
      ]}
      feesKpis={feesKpis}
      deals={deals.map(d => ({ id:d.id, name:d.name, type:d.deal_type, stage:d.deal_stage, priority:d.priority_level, targetDate:d.target_date, dt:DT[d.deal_type]??DT.ma_sell, stageLabel:stageLabel(d.deal_stage), prioColor:PRIO[d.priority_level]??PRIO.medium }))}
      relances={relances.map(c => { const org=(c.organization_contacts as any[])?.[0]?.organizations; return { id:c.id, firstName:c.first_name, lastName:c.last_name, days:daysSince(c.last_contact_date!), orgName:Array.isArray(org)?org[0]?.name:org?.name }; })}
      tasks={tasks.map(t => { const deal=Array.isArray(t.deals)?t.deals[0]:t.deals as any; return { id:t.id, title:t.title, priority:t.priority ?? "medium", dueDate:t.due_date, dealId:t.deal_id, dealName:deal?.name, overdue:!!(t.due_date&&new Date(t.due_date)<new Date()), prioColor:PRIO[t.priority ?? "medium"]??PRIO.medium }; })}
      activities={activities.map(a => { const deal=Array.isArray(a.deals)?a.deals[0]:a.deals as any; return { id:a.id, title:a.title, type:toLegacyType(a.type, a.email_direction), date:(a.start_datetime ?? a.due_date) as string, dealId:a.deal_id, dealName:deal?.name }; })}
      calendarItems={[...calendarEvents, ...calendarTasks]}
      allContacts={(allContactsRes.data ?? []).map((c:any) => {
        const org = (c.organization_contacts as any[])?.[0]?.organizations;
        const orgName = Array.isArray(org) ? org[0]?.name : org?.name;
        return { id:c.id, first_name:c.first_name, last_name:c.last_name, email:c.email, org_name:orgName };
      })}
      analytics={analytics}
    />
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ padding:32 }}><div style={{ height:400, borderRadius:14, background:"var(--surface-2)" }}/></div>}>
      <Content/>
    </Suspense>
  );
}
