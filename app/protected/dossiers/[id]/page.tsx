import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dealTypeLabels, dealStageLabels, dealStatusLabels, priorityLabels, activityTypeLabels } from "@/lib/crm/labels";
import { DealTabs } from "./deal-tabs";

export const revalidate = 0;

const DT: Record<string,{bg:string;tx:string;border:string}> = {
  fundraising: { bg:"var(--fund-bg)", tx:"var(--fund-tx)", border:"var(--fund-mid)" },
  ma_sell:     { bg:"var(--sell-bg)", tx:"var(--sell-tx)", border:"var(--sell-mid)" },
  ma_buy:      { bg:"var(--buy-bg)",  tx:"var(--buy-tx)",  border:"var(--buy-mid)"  },
  cfo_advisor: { bg:"var(--cfo-bg)",  tx:"var(--cfo-tx)",  border:"var(--cfo-mid)"  },
  recruitment: { bg:"var(--rec-bg)",  tx:"var(--rec-tx)",  border:"var(--rec-mid)"  },
};
const PRIO: Record<string,string> = { high:"var(--rec-dot)", medium:"var(--sell-dot)", low:"var(--border-2)" };

function fmt(v:string|null){
  if(!v) return null;
  return new Intl.DateTimeFormat("fr-FR",{dateStyle:"short"}).format(new Date(v));
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: deal, error } = await supabase
    .from("deals")
    .select("id,name,deal_type,deal_status,deal_stage,priority_level,sector,location,description,start_date,target_date")
    .eq("id", id)
    .maybeSingle();

  if (error || !deal) notFound();

  const [{ data: docs }, { data: tasks }, { data: activities }] = await Promise.all([
    supabase.from("deal_documents").select("id,name,document_type,document_status,document_url,version_label,added_at,note").eq("deal_id", id).order("added_at",{ascending:false}),
    supabase.from("tasks").select("id,title,task_status,priority_level,due_date,description").eq("deal_id",id).order("due_date",{ascending:true}),
    supabase.from("activities").select("id,activity_type,title,summary,activity_date,source").eq("deal_id",id).order("activity_date",{ascending:false}).limit(20),
  ]);

  const dt = DT[deal.deal_type] ?? DT.fundraising;
  const openTasks = (tasks??[]).filter(t=>t.task_status==="open").length;
  const docsCount = (docs??[]).length;

  const formatDoc = (d: any) => ({
    id: d.id, name: d.name, type: d.document_type ?? "other",
    status: d.document_status ?? "draft", url: d.document_url ?? null,
    version: d.version_label ?? "", date: fmt(d.added_at) ?? "—", note: d.note ?? "",
  });
  const formatTask = (t: any) => ({
    id: t.id, title: t.title, status: t.task_status,
    priority: t.priority_level, dueDate: fmt(t.due_date) ?? "—",
    dueDateRaw: t.due_date, description: t.description ?? "",
  });
  const formatActivity = (a: any) => ({
    id: a.id, type: activityTypeLabels[a.activity_type] ?? a.activity_type,
    typeKey: a.activity_type, title: a.title, summary: a.summary ?? "",
    date: fmt(a.activity_date) ?? "—", source: a.source ?? "",
  });

  return (
    <div style={{ padding:32, minHeight:"100vh", background:"var(--bg)" }}>
      <div style={{ maxWidth:1100, margin:"0 auto" }}>

        {/* ── Breadcrumb ── */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20, fontSize:13 }}>
          <Link href="/protected/dossiers" style={{ color:"var(--text-4)", textDecoration:"none" }}>← Dossiers</Link>
          <span style={{ color:"var(--text-5)" }}>/</span>
          <span style={{ color:"var(--text-3)" }}>{deal.name}</span>
        </div>

        {/* ── Header ── */}
        <div className="card" style={{ padding:24, marginBottom:20, borderTop:`4px solid ${PRIO[deal.priority_level]??PRIO.medium}`, overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
            <div style={{ flex:1, minWidth:0 }}>
              {/* Badges */}
              <div style={{ display:"flex", gap:7, marginBottom:10, flexWrap:"wrap" }}>
                <span style={{ fontSize:11.5, fontWeight:700, borderRadius:7, padding:"3px 10px", background:dt.bg, color:dt.tx, border:`1px solid ${dt.border}` }}>
                  {dealTypeLabels[deal.deal_type] ?? deal.deal_type}
                </span>
                <span style={{ fontSize:11.5, fontWeight:600, borderRadius:7, padding:"3px 10px", background:"var(--surface-2)", color:"var(--text-3)", border:"1px solid var(--border)" }}>
                  {dealStageLabels[deal.deal_stage] ?? deal.deal_stage}
                </span>
                <span style={{ fontSize:11.5, fontWeight:600, borderRadius:7, padding:"3px 10px", background:"var(--surface-2)", color:"var(--text-4)", border:"1px solid var(--border)" }}>
                  {dealStatusLabels[deal.deal_status] ?? deal.deal_status}
                </span>
              </div>

              <h1 style={{ margin:"0 0 8px 0", fontSize:24, fontWeight:800, color:"var(--text-1)" }}>{deal.name}</h1>

              <div style={{ display:"flex", gap:12, fontSize:12.5, color:"var(--text-4)", flexWrap:"wrap" }}>
                {deal.sector   && <span>🏭 {deal.sector}</span>}
                {deal.location && <span>📍 {deal.location}</span>}
                {deal.start_date  && <span>🗓 Début {fmt(deal.start_date)}</span>}
                {deal.target_date && <span>🎯 Cible {fmt(deal.target_date)}</span>}
              </div>

              {deal.description && (
                <p style={{ margin:"12px 0 0 0", fontSize:13, color:"var(--text-3)", lineHeight:1.6, maxWidth:680 }}>
                  {deal.description}
                </p>
              )}
            </div>

            {/* Actions */}
            <div style={{ display:"flex", gap:8, flexShrink:0 }}>
              <Link href={`/protected/dossiers/${deal.id}/modifier`} className="btn btn-secondary">
                Modifier
              </Link>
            </div>
          </div>
        </div>

        {/* ── Onglets ── */}
        <DealTabs
          dealId={deal.id}
          contacts={[]}
          docs={(docs??[]).map(formatDoc)}
          tasks={(tasks??[]).map(formatTask)}
          activities={(activities??[]).map(formatActivity)}
          description={deal.description ?? ""}
          openTasksCount={openTasks}
          contactsCount={0}
          docsCount={docsCount}
        />
      </div>
    </div>
  );
}

export default function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={
      <div style={{ padding:32, background:"var(--bg)", minHeight:"100vh" }}>
        <div className="skeleton" style={{ height:160, borderRadius:14, marginBottom:20 }}/>
        <div className="skeleton" style={{ height:400, borderRadius:14 }}/>
      </div>
    }>
      <Content params={params}/>
    </Suspense>
  );
}
