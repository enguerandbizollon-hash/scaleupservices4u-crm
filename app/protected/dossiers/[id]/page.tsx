import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DealDetail } from "./deal-detail";

export const revalidate = 0;

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .select("id,name,deal_type,deal_status,deal_stage,priority_level,sector,location,description,start_date,target_date,next_action_date,target_amount,committed_amount,closed_amount,currency,company_stage,company_geography,mandate_id,pre_money_valuation,post_money_valuation,round_type,runway_months,use_of_funds,current_investors,asking_price_min,asking_price_max,partial_sale_ok,management_retention,deal_timing,ai_financial_score,ai_valuation_low,ai_valuation_high,target_sectors,target_geographies,target_revenue_min,target_revenue_max,target_ev_min,target_ev_max,acquisition_budget_min,acquisition_budget_max,full_acquisition_required,strategic_rationale,target_stage")
    .eq("id", id).maybeSingle();
  if (dealError) throw new Error(dealError.message);
  if (!deal) notFound();

  const [orgsRes, docsRes, tasksRes, activitiesRes, commitmentsRes, financialRes] = await Promise.all([
    supabase.from("deal_organizations")
      .select("organization_id,organizations(id,name,organization_type,base_status,location,investment_ticket,investment_stage)")
      .eq("deal_id", id),
    supabase.from("deal_documents").select("id,name,document_type,document_status,document_url,version_label,added_at,note").eq("deal_id", id).order("added_at",{ascending:false}),
    supabase.from("tasks").select("id,title,task_status,priority_level,due_date,description,contact_id").eq("deal_id",id).order("due_date",{ascending:true}),
    supabase.from("activities").select("id,title,activity_type,activity_date,summary,activity_contacts(contacts(id,first_name,last_name))").eq("deal_id",id).order("activity_date",{ascending:false}).limit(30),
    supabase.from("investor_commitments").select("id,amount,currency,status,committed_at,notes,organization_id,organizations(name)").eq("deal_id",id).order("committed_at",{ascending:false}),
    supabase.from("financial_data").select("*").eq("deal_id",id).order("fiscal_year",{ascending:false}),
  ]);

  const orgs = (orgsRes.data ?? []).map(r => {
    const o = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations as any;
    return o ? { ...o, contacts: [] } : null;
  }).filter(Boolean);

  const orgIds = orgs.map((o:any) => o.id);
  let contacts: any[] = [];
  if (orgIds.length > 0) {
    const { data: ocData } = await supabase
      .from("organization_contacts")
      .select("organization_id,role_label,contacts(id,first_name,last_name,email,phone,title,base_status,last_contact_date,linkedin_url),organizations(name)")
      .in("organization_id", orgIds);
    contacts = (ocData ?? []).map(oc => {
      const c = Array.isArray(oc.contacts) ? oc.contacts[0] : oc.contacts as any;
      const o = Array.isArray(oc.organizations) ? oc.organizations[0] : oc.organizations as any;
      return c ? { ...c, role_label: oc.role_label, org_id: oc.organization_id, org_name: o?.name } : null;
    }).filter(Boolean);
    // Attacher les contacts aux orgs
    for (const org of orgs) {
      org.contacts = contacts.filter((c:any) => c.org_id === org.id);
    }
  }

  const acts = (activitiesRes.data ?? []).map((a: any) => {
    const acLinks = a.activity_contacts ?? [];
    const contactNames = acLinks.map((ac: any) => {
      const c = Array.isArray(ac.contacts) ? ac.contacts[0] : ac.contacts;
      return c ? `${c.first_name} ${c.last_name}` : null;
    }).filter(Boolean);
    const contactIds = acLinks.map((ac: any) => {
      const c = Array.isArray(ac.contacts) ? ac.contacts[0] : ac.contacts;
      return c?.id ?? null;
    }).filter(Boolean);
    return { ...a, contact_names: contactNames, contact_ids: contactIds };
  });

  const comms = (commitmentsRes.data ?? []).map(c => ({
    ...c,
    org_name: Array.isArray(c.organizations) ? c.organizations[0]?.name : (c.organizations as any)?.name,
  }));

  const tasksList = (tasksRes.data ?? []).map(t => ({
    ...t,
    contact_name: contacts.find((c:any) => c.id === t.contact_id)
      ? (() => { const c = contacts.find((ct:any) => ct.id === t.contact_id); return c ? `${c.first_name} ${c.last_name}` : undefined; })()
      : undefined,
  }));

  return (
    <DealDetail
      deal={deal}
      initialOrgs={orgs}
      initialContacts={contacts}
      initialCommitments={comms}
      initialTasks={tasksList}
      initialActivities={acts}
      initialDocs={docsRes.data ?? []}
      initialFinancialData={financialRes.data ?? []}
    />
  );
}

export default function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ padding:32 }}><div style={{ height:400, borderRadius:14, background:"var(--surface-2)" }}/></div>}>
      <Content params={params}/>
    </Suspense>
  );
}
