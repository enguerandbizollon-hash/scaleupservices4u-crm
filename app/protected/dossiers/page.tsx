import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Plus, AlertTriangle, CheckSquare, CalendarDays, Activity } from "lucide-react";
import { DealsKanban } from "./_components/deals-kanban";

export const revalidate = 60;

const DT: Record<string, { label:string; icon:string; bg:string; tx:string; dot:string; border:string }> = {
  fundraising: { label:"Fundraising", icon:"📈", bg:"var(--fund-bg)", tx:"var(--fund-tx)", dot:"var(--fund-dot)", border:"var(--fund-mid)" },
  ma_sell:     { label:"M&A Sell",    icon:"🏢", bg:"var(--sell-bg)", tx:"var(--sell-tx)", dot:"var(--sell-dot)", border:"var(--sell-mid)" },
  ma_buy:      { label:"M&A Buy",     icon:"🎯", bg:"var(--buy-bg)",  tx:"var(--buy-tx)",  dot:"var(--buy-dot)",  border:"var(--buy-mid)"  },
  cfo_advisor: { label:"CFO Advisor", icon:"💼", bg:"var(--cfo-bg)",  tx:"var(--cfo-tx)",  dot:"var(--cfo-dot)",  border:"var(--cfo-mid)"  },
  recruitment: { label:"Recrutement", icon:"👤", bg:"var(--rec-bg)",  tx:"var(--rec-tx)",  dot:"var(--rec-dot)",  border:"var(--rec-mid)"  },
};
const STAGE: Record<string,string> = {
  kickoff:"Kickoff", preparation:"Préparation", outreach:"Outreach",
  management_meetings:"Mgmt meetings", dd:"Due Diligence",
  negotiation:"Négociation", closing:"Closing",
  post_closing:"Post-closing", ongoing_support:"Suivi", search:"Recherche",
};
const PRIO: Record<string,string> = { high:"var(--rec-dot)", medium:"var(--sell-dot)", low:"var(--border-2)" };

function fmt(v:string|null) {
  if (!v) return null;
  return new Intl.DateTimeFormat("fr-FR", { day:"numeric", month:"short" }).format(new Date(v));
}
function daysSince(v:string) { return Math.floor((Date.now()-new Date(v).getTime())/86400000); }

async function Content() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // Deals avec stats agrégées
  const { data: deals } = await supabase
    .from("deals")
    .select("id,name,deal_type,deal_status,deal_stage,priority_level,sector,location,target_date,target_amount,currency,description")
    .order("priority_level");

  if (!deals?.length) {
    return (
      <div style={{ padding:32, minHeight:"100vh", background:"var(--bg)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:28 }}>
          <h1 style={{ margin:0, fontSize:24, fontWeight:700 }}>Dossiers</h1>
          <Link href="/protected/dossiers/nouveau" style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:9, background:"#1a56db", color:"#fff", textDecoration:"none", fontSize:13.5, fontWeight:600 }}>
            <Plus size={14}/> Nouveau dossier
          </Link>
        </div>
        <div style={{ textAlign:"center", padding:"60px 24px", color:"var(--text-5)", fontSize:14 }}>
          Aucun dossier — <Link href="/protected/dossiers/nouveau" style={{ color:"#1a56db" }}>créer le premier</Link>
        </div>
      </div>
    );
  }

  // Charger tâches ouvertes + activités récentes + events à venir pour chaque deal
  const dealIds = deals.map(d => d.id);

  // Table unifiée actions : tâches, activités passées et événements à venir
  // sont tous dérivés de la même requête avec un filtre type + status.
  const [openTasksRes, recentActsRes, upcomingEventsRes, orgsRes] = await Promise.all([
    supabase.from("actions")
      .select("id,deal_id,status,due_date,priority")
      .in("deal_id", dealIds)
      .eq("type", "task")
      .not("status", "in", '("done","cancelled","completed")'),
    supabase.from("actions")
      .select("id,deal_id,start_datetime,due_date")
      .in("deal_id", dealIds)
      .neq("type", "task")
      .order("start_datetime", { ascending: false, nullsFirst: false }),
    supabase.from("actions")
      .select("id,deal_id,title,type,due_date,start_datetime,status")
      .in("deal_id", dealIds)
      .in("type", ["meeting", "deadline", "call"])
      .not("status", "in", '("done","cancelled","completed")')
      .gte("due_date", today)
      .order("due_date", { ascending: true }),
    supabase.from("deal_organizations")
      .select("deal_id")
      .in("deal_id", dealIds),
  ]);

  // Indexer par deal_id — on conserve les shapes historiques TaskType/EventType
  // consommées par la carte ci-dessous.
  const tasksByDeal: Record<string, TaskType[]> = {};
  const actsByDeal: Record<string, { activity_date: string | null }[]> = {};
  const eventsByDeal: Record<string, NonNullable<EventType>[]> = {};
  const orgCountByDeal: Record<string, number> = {};

  for (const t of openTasksRes.data ?? []) {
    if (!t.deal_id) continue;
    if (!tasksByDeal[t.deal_id]) tasksByDeal[t.deal_id] = [];
    tasksByDeal[t.deal_id]!.push({
      id: t.id,
      deal_id: t.deal_id,
      task_status: t.status,
      due_date: t.due_date,
      priority_level: t.priority ?? "medium",
    });
  }
  for (const a of recentActsRes.data ?? []) {
    if (!a.deal_id) continue;
    if (!actsByDeal[a.deal_id]) actsByDeal[a.deal_id] = [];
    actsByDeal[a.deal_id]!.push({ activity_date: a.start_datetime ?? a.due_date });
  }
  for (const e of upcomingEventsRes.data ?? []) {
    if (!e.deal_id || !e.due_date) continue;
    if (!eventsByDeal[e.deal_id]) eventsByDeal[e.deal_id] = [];
    eventsByDeal[e.deal_id]!.push({
      id: e.id,
      deal_id: e.deal_id,
      title: e.title,
      event_type: e.type,
      due_date: e.due_date,
      status: e.status,
    });
  }
  for (const o of orgsRes.data ?? []) {
    orgCountByDeal[o.deal_id] = (orgCountByDeal[o.deal_id] ?? 0) + 1;
  }

  const open    = deals.filter(d => d.deal_status === "open");
  const paused  = deals.filter(d => d.deal_status === "paused");
  const won     = deals.filter(d => d.deal_status === "won");
  const lost    = deals.filter(d => d.deal_status === "lost");
  const closed  = [...won, ...lost]; // affichés ensemble en grisé
  const types   = ["fundraising","ma_sell","ma_buy","cfo_advisor","recruitment"];
  const groups  = types.map(t => ({
    t, dt: DT[t],
    open:   open.filter(d => d.deal_type === t),
    paused: paused.filter(d => d.deal_type === t),
    won:    won.filter(d => d.deal_type === t),
    lost:   lost.filter(d => d.deal_type === t),
  })).filter(g => g.open.length + g.paused.length + g.won.length + g.lost.length > 0);

  return (
    <div style={{ padding:"28px 24px", minHeight:"100vh", background:"var(--bg)" }}>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:"var(--text-1)" }}>Dossiers</h1>
          <div style={{ display:"flex", gap:8, marginTop:6 }}>
            <span style={{ fontSize:12, padding:"2px 9px", borderRadius:20, background:"var(--surface-3)", color:"var(--text-4)", fontWeight:600 }}>{deals.length} total</span>
            <span style={{ fontSize:12, padding:"2px 9px", borderRadius:20, background:"var(--fund-bg)", color:"var(--fund-tx)", fontWeight:600 }}>{open.length} en cours</span>
            {paused.length > 0 && <span style={{ fontSize:12, padding:"2px 9px", borderRadius:20, background:"var(--surface-3)", color:"var(--text-4)", fontWeight:600 }}>{paused.length} en pause</span>}
            {won.length > 0 && <span style={{ fontSize:12, padding:"2px 9px", borderRadius:20, background:"#D1FAE5", color:"#065F46", fontWeight:600 }}>{won.length} gagné{won.length !== 1 ? "s" : ""}</span>}
            {lost.length > 0 && <span style={{ fontSize:12, padding:"2px 9px", borderRadius:20, background:"var(--surface-3)", color:"var(--text-5)", fontWeight:600 }}>{lost.length} perdu{lost.length !== 1 ? "s" : ""}</span>}
          </div>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <Link href="/protected/dossiers?view=kanban" style={{ fontSize:12.5, padding:"7px 14px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface-2)", color:"var(--text-3)", textDecoration:"none" }}>
            Vue kanban
          </Link>
          <Link href="/protected/dossiers/nouveau" style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 18px", borderRadius:9, background:"#1a56db", color:"#fff", textDecoration:"none", fontSize:13.5, fontWeight:600 }}>
            <Plus size={14}/> Nouveau dossier
          </Link>
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:28, marginTop:24 }}>
        {groups.map(g => (
          <div key={g.t}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, paddingBottom:10, borderBottom:`2px solid ${g.dt.border}` }}>
              <span style={{ fontSize:16 }}>{g.dt.icon}</span>
              <h2 style={{ margin:0, fontSize:15, fontWeight:700, color:g.dt.tx }}>{g.dt.label}</h2>
              {g.open.length > 0 && <span style={{ fontSize:11, fontWeight:700, background:g.dt.bg, color:g.dt.tx, border:`1px solid ${g.dt.border}`, borderRadius:20, padding:"2px 9px" }}>{g.open.length} en cours</span>}
              {g.paused.length > 0 && <span style={{ fontSize:11, background:"var(--surface-3)", color:"var(--text-4)", borderRadius:20, padding:"2px 9px" }}>{g.paused.length} en pause</span>}
              {g.won.length > 0 && <span style={{ fontSize:11, background:"#D1FAE5", color:"#065F46", borderRadius:20, padding:"2px 9px" }}>{g.won.length} gagné{g.won.length > 1 ? "s" : ""}</span>}
              {g.lost.length > 0 && <span style={{ fontSize:11, background:"var(--surface-3)", color:"var(--text-5)", borderRadius:20, padding:"2px 9px" }}>{g.lost.length} perdu{g.lost.length > 1 ? "s" : ""}</span>}
            </div>

            {g.open.length > 0 && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:10, marginBottom: g.paused.length + g.won.length + g.lost.length > 0 ? 10 : 0 }}>
                {g.open.map(d => (
                  <DealCard key={d.id} deal={d} dt={g.dt}
                    tasks={tasksByDeal[d.id] ?? []}
                    lastActivity={(actsByDeal[d.id] ?? [])[0]?.activity_date ?? null}
                    nextEvent={(eventsByDeal[d.id] ?? [])[0] ?? null}
                    orgCount={orgCountByDeal[d.id] ?? 0}
                  />
                ))}
              </div>
            )}
            {(g.paused.length + g.won.length + g.lost.length) > 0 && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:10, opacity:.5 }}>
                {[...g.paused, ...g.won, ...g.lost].map(d => (
                  <DealCard key={d.id} deal={d} dt={g.dt}
                    tasks={[]} lastActivity={null} nextEvent={null} orgCount={0}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

type DealType = { id:string; name:string; deal_type:string; deal_status:string; deal_stage:string; priority_level:string; sector:string|null; location:string|null; target_date:string|null; target_amount:number|null; currency:string|null; description:string|null };
type TaskType = { id:string; deal_id:string; task_status:string; due_date:string|null; priority_level:string };
type EventType = { id:string; deal_id:string; title:string; event_type:string; due_date:string; status:string } | null;

function DealCard({ deal, dt, tasks, lastActivity, nextEvent, orgCount }: {
  deal: DealType; dt: typeof DT[string];
  tasks: TaskType[]; lastActivity: string|null; nextEvent: EventType; orgCount: number;
}) {
  const pcolor = PRIO[deal.priority_level] ?? "var(--border-2)";
  const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date());
  const daysSinceActivity = lastActivity ? daysSince(lastActivity) : null;
  const inactive = deal.deal_status !== "open";
  const fmtAmount = (n: number|null, c: string|null) => {
    if (!n) return null;
    return n >= 1e6 ? `${(n/1e6).toFixed(1)}M ${c??"€"}` : n >= 1e3 ? `${(n/1e3).toFixed(0)}k ${c??"€"}` : `${n} ${c??"€"}`;
  };

  return (
    <Link href={`/protected/dossiers/${deal.id}`} style={{ textDecoration:"none" }}>
      <div style={{
        background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14,
        overflow:"hidden", transition:"border-color .12s, box-shadow .12s",
        borderTop:`3px solid ${pcolor}`,
      }}>
        <div style={{ padding:"14px 16px" }}>

          {/* Titre + statut */}
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:6 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--text-1)", lineHeight:1.3, flex:1, minWidth:0 }}>
              {deal.name}
            </div>
            <span style={{ fontSize:11, fontWeight:700, borderRadius:6, padding:"2px 8px", background:dt.bg, color:dt.tx, flexShrink:0 }}>
              {STAGE[deal.deal_stage] ?? deal.deal_stage}
            </span>
          </div>

          {/* Secteur + localisation */}
          {(deal.sector || deal.location) && (
            <div style={{ fontSize:12, color:"var(--text-4)", marginBottom:8 }}>
              {deal.sector && <span>{deal.sector}</span>}
              {deal.sector && deal.location && <span style={{ margin:"0 5px" }}>·</span>}
              {deal.location && <span>📍 {deal.location}</span>}
            </div>
          )}

          {/* Montant cible */}
          {deal.target_amount && (
            <div style={{ fontSize:12.5, fontWeight:700, color:dt.tx, marginBottom:8 }}>
              Objectif : {fmtAmount(deal.target_amount, deal.currency)}
            </div>
          )}

          {/* Séparateur */}
          <div style={{ height:1, background:"var(--border)", margin:"10px 0" }}/>

          {/* Stats rapides */}
          <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>

            {/* Organisations */}
            <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, color:"var(--text-4)" }}>
              <span>🏢</span>
              <span>{orgCount} org{orgCount !== 1 ? "s" : ""}</span>
            </div>

            {/* Tâches */}
            {tasks.length > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, color: overdueTasks.length > 0 ? "var(--rec-tx)" : "var(--text-4)" }}>
                {overdueTasks.length > 0 ? <AlertTriangle size={11}/> : <CheckSquare size={11}/>}
                <span>{tasks.length} tâche{tasks.length > 1 ? "s" : ""}{overdueTasks.length > 0 ? ` (${overdueTasks.length} en retard)` : ""}</span>
              </div>
            )}

            {/* Dernière activité */}
            {daysSinceActivity !== null && (
              <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, color: daysSinceActivity > 14 ? "#B45309" : "var(--text-4)" }}>
                <Activity size={11}/>
                <span>{daysSinceActivity === 0 ? "aujourd'hui" : `il y a ${daysSinceActivity}j`}</span>
              </div>
            )}

            {/* Prochain événement */}
            {nextEvent && (
              <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, color:"var(--text-3)", fontWeight:600 }}>
                <CalendarDays size={11}/>
                <span>{fmt(nextEvent.due_date)} — {nextEvent.title.length > 22 ? nextEvent.title.slice(0,22)+"…" : nextEvent.title}</span>
              </div>
            )}
          </div>

          {/* Date cible */}
          {deal.target_date && (
            <div style={{ marginTop:8, fontSize:11.5, color:"var(--text-5)" }}>
              🎯 Closing cible : {fmt(deal.target_date)}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

async function KanbanContent() {
  const supabase = await createClient();
  const { data: deals } = await supabase
    .from("deals")
    .select("id,name,deal_type,deal_status,deal_stage,priority_level,sector,target_amount,target_date,currency,next_action_date")
    .order("priority_level");
  return <DealsKanban deals={deals ?? []} />;
}

export default async function DossiersPage({ searchParams }: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const isKanban = view === "kanban";

  return (
    <Suspense fallback={<div style={{ padding:32 }}><div style={{ height:400, borderRadius:14, background:"var(--surface-2)" }}/></div>}>
      {isKanban ? <KanbanContent/> : <Content/>}
    </Suspense>
  );
}
