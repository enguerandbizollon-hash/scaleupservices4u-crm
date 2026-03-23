import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DealTabs } from "./deal-tabs";

export const revalidate = 0;

const DT: Record<string,{bg:string;tx:string;border:string}> = {
  fundraising: { bg:"var(--fund-bg)", tx:"var(--fund-tx)", border:"var(--fund-mid)" },
  ma_sell:     { bg:"var(--sell-bg)", tx:"var(--sell-tx)", border:"var(--sell-mid)" },
  ma_buy:      { bg:"var(--buy-bg)",  tx:"var(--buy-tx)",  border:"var(--buy-mid)"  },
  cfo_advisor: { bg:"var(--cfo-bg)",  tx:"var(--cfo-tx)",  border:"var(--cfo-mid)"  },
  recruitment: { bg:"var(--rec-bg)",  tx:"var(--rec-tx)",  border:"var(--rec-mid)"  },
};
const STAGE_LABELS: Record<string,string> = {
  kickoff:"Kickoff", preparation:"Préparation", outreach:"Prospection",
  management_meetings:"Meetings mgt", dd:"Due diligence", negotiation:"Négociation",
  closing:"Closing", post_closing:"Post-closing", ongoing_support:"Suivi", search:"Recherche",
};
const TYPE_LABELS: Record<string,string> = {
  fundraising:"Fundraising", ma_sell:"M&A Sell", ma_buy:"M&A Buy",
  cfo_advisor:"CFO Advisor", recruitment:"Recrutement",
};
const PRIO: Record<string,string> = {
  high:"var(--rec-dot)", medium:"var(--sell-dot)", low:"var(--border-2)"
};

function fmt(v:string|null){
  if(!v) return null;
  return new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(v));
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: deal, error } = await supabase
    .from("deals")
    .select("id,name,deal_type,deal_status,deal_stage,priority_level,sector,location,description,start_date,target_date,target_amount,committed_amount,closed_amount,currency")
    .eq("id", id).maybeSingle();

  if (error || !deal) notFound();

  // Toutes les données via deal_organizations (la bonne source)
  const [orgsRes, docsRes, tasksRes, activitiesRes, commitmentsRes] = await Promise.all([
    supabase.from("deal_organizations")
      .select("organization_id,organizations(id,name,organization_type,base_status,location,investment_ticket,investment_stage,website,deal_name_hint)")
      .eq("deal_id", id),
    supabase.from("deal_documents")
      .select("id,name,document_type,document_status,document_url,version_label,added_at,note")
      .eq("deal_id", id).order("added_at",{ascending:false}),
    supabase.from("tasks")
      .select("id,title,task_status,priority_level,due_date,description")
      .eq("deal_id",id).order("due_date",{ascending:true}),
    supabase.from("activities")
      .select("id,activity_type,title,summary,activity_date,organization_id,organizations(name)")
      .eq("deal_id",id).order("activity_date",{ascending:false}).limit(30),
    supabase.from("investor_commitments")
      .select("id,amount,currency,status,committed_at,organization_id,organizations(name)")
      .eq("deal_id",id).order("committed_at",{ascending:false}),
  ]);

  const orgs = (orgsRes.data ?? []).map(r => {
    const o = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations as any;
    return o;
  }).filter(Boolean);

  // Récupérer les contacts de toutes les orgs liées
  const orgIds = orgs.map((o:any) => o.id);
  let allContacts: any[] = [];
  if (orgIds.length > 0) {
    const { data: ocData } = await supabase
      .from("organization_contacts")
      .select("organization_id,role_label,contacts(id,first_name,last_name,email,phone,title,base_status,last_contact_date,linkedin_url),organizations(name)")
      .in("organization_id", orgIds);

    allContacts = (ocData ?? []).map(oc => {
      const c = Array.isArray(oc.contacts) ? oc.contacts[0] : oc.contacts as any;
      const o = Array.isArray(oc.organizations) ? oc.organizations[0] : oc.organizations as any;
      return c ? { ...c, organisation: o?.name ?? "", role_label: oc.role_label, org_id: oc.organization_id } : null;
    }).filter(Boolean);
  }

  const docs    = docsRes.data ?? [];
  const tasks   = tasksRes.data ?? [];
  const acts    = activitiesRes.data ?? [];
  const comms   = commitmentsRes.data ?? [];
  const openTasks = tasks.filter(t=>t.task_status==="open").length;

  // Stats financières
  const target = deal.target_amount ?? 0;
  const hardAmount = comms.filter((c:any) => ["hard","signed","transferred"].includes(c.status))
    .reduce((s:number,c:any) => s + (c.amount ?? 0), 0);
  const softAmount = comms.filter((c:any) => ["soft","hard","signed","transferred"].includes(c.status))
    .reduce((s:number,c:any) => s + (c.amount ?? 0), 0);

  const dt = DT[deal.deal_type] ?? DT.fundraising;

  return (
    <div style={{ padding:"28px 24px", minHeight:"100vh", background:"var(--bg)" }}>
      <div style={{ maxWidth:1080, margin:"0 auto" }}>

        {/* Breadcrumb */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20, fontSize:12.5 }}>
          <Link href="/protected/dossiers" style={{ color:"var(--text-4)", textDecoration:"none" }}>← Dossiers</Link>
          <span style={{ color:"var(--text-5)" }}>/</span>
          <span style={{ color:"var(--text-3)", fontWeight:600 }}>{deal.name}</span>
        </div>

        {/* Header */}
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16, padding:"22px 26px", marginBottom:14, borderTop:`4px solid ${PRIO[deal.priority_level]??PRIO.medium}` }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", gap:7, marginBottom:10, flexWrap:"wrap" }}>
                <span style={{ fontSize:11.5, fontWeight:700, borderRadius:7, padding:"3px 10px", background:dt.bg, color:dt.tx, border:`1px solid ${dt.border}` }}>
                  {TYPE_LABELS[deal.deal_type] ?? deal.deal_type}
                </span>
                <span style={{ fontSize:11.5, fontWeight:600, borderRadius:7, padding:"3px 10px", background:"var(--surface-2)", color:"var(--text-3)", border:"1px solid var(--border)" }}>
                  {STAGE_LABELS[deal.deal_stage] ?? deal.deal_stage}
                </span>
                <span style={{ fontSize:11.5, fontWeight:600, borderRadius:7, padding:"3px 10px", background:"var(--surface-2)", color:"var(--text-4)", border:"1px solid var(--border)" }}>
                  {deal.deal_status}
                </span>
              </div>

              <h1 style={{ margin:"0 0 8px", fontSize:24, fontWeight:800, color:"var(--text-1)" }}>{deal.name}</h1>

              <div style={{ display:"flex", gap:12, fontSize:12.5, color:"var(--text-4)", flexWrap:"wrap" }}>
                {deal.sector    && <span>🏭 {deal.sector}</span>}
                {deal.location  && <span>📍 {deal.location}</span>}
                {deal.start_date  && <span>🗓 Début {fmt(deal.start_date)}</span>}
                {deal.target_date && <span>🎯 Cible {fmt(deal.target_date)}</span>}
              </div>

              {deal.description && (
                <p style={{ margin:"10px 0 0", fontSize:13, color:"var(--text-3)", lineHeight:1.6, maxWidth:640 }}>
                  {deal.description}
                </p>
              )}
            </div>

            <div style={{ display:"flex", gap:8, flexShrink:0 }}>
              <Link href={`/protected/dossiers/${deal.id}/modifier`}
                style={{ padding:"8px 16px", borderRadius:9, background:"var(--surface-2)", border:"1px solid var(--border)", fontSize:13, color:"var(--text-2)", textDecoration:"none", fontWeight:500 }}>
                Modifier
              </Link>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:14 }}>
          {[
            { label:"Organisations", val:orgs.length, color:"#3468B0" },
            { label:"Contacts",      val:allContacts.length, color:"#A8306A" },
            { label:"Tâches",        val:openTasks, color:"#D97706" },
            { label:"Documents",     val:docs.length, color:"#15A348" },
            { label:"Activités",     val:acts.length, color:"#6D28D9" },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ textAlign:"center", padding:"14px 8px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12 }}>
              <div style={{ fontSize:24, fontWeight:700, color, lineHeight:1.2 }}>{val}</div>
              <div style={{ fontSize:11.5, color:"var(--text-4)", marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Onglets */}
        <DealTabs
          dealId={deal.id}
          dealType={deal.deal_type}
          orgs={orgs}
          contacts={allContacts}
          docs={docs}
          tasks={tasks}
          activities={acts}
          commitments={comms}
          target={target}
          hardAmount={hardAmount}
          softAmount={softAmount}
          currency={deal.currency ?? "EUR"}
        />
      </div>
    </div>
  );
}

export default function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={
      <div style={{ padding:32 }}>
        <div style={{ height:180, borderRadius:14, background:"var(--surface-2)", marginBottom:14 }}/>
        <div style={{ height:400, borderRadius:14, background:"var(--surface-2)" }}/>
      </div>
    }>
      <Content params={params}/>
    </Suspense>
  );
}
