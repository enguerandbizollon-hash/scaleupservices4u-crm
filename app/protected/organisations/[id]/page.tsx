import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrgDetail } from "./org-detail";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select(`
      id,name,organization_type,base_status,sector,location,website,description,notes,
      investment_ticket,investment_stage,deal_name_hint,
      investor_ticket_min,investor_ticket_max,investor_sectors,investor_stages,investor_geographies,investor_thesis,investor_stage_min,investor_stage_max,linkedin_url,
      founded_year,employee_count,company_stage,revenue_range,
      sale_readiness,partial_sale_ok,
      acquisition_rationale,target_sectors,excluded_sectors,target_geographies,target_revenue_min,target_revenue_max
    `)
    .eq("id", id).maybeSingle();

  if (!org) notFound();

  const [{ data: orgContacts }, { data: dealOrgs }, { data: activities }, { data: mandates }, { data: financialData }] = await Promise.all([
    supabase.from("organization_contacts")
      .select("contact_id,role_label,is_primary,contacts(id,first_name,last_name,title,email,phone,linkedin_url,base_status,last_contact_date)")
      .eq("organization_id", id),
    supabase.from("deal_organizations")
      .select("deal_id,deals(id,name,deal_type,deal_status,deal_stage,priority_level,target_date,target_amount,currency)")
      .eq("organization_id", id),
    supabase.from("activities")
      .select("id,activity_type,title,summary,activity_date")
      .eq("organization_id", id)
      .order("activity_date", { ascending: false }).limit(15),
    supabase.from("mandates")
      .select("id,name,type,status,estimated_fee_amount,confirmed_fee_amount,currency,start_date,target_close_date")
      .eq("client_organization_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("financial_data")
      .select("*")
      .eq("organization_id", id)
      .order("fiscal_year", { ascending: false }),
  ]);

  const contacts = (orgContacts ?? []).map(oc => {
    const c = Array.isArray(oc.contacts) ? oc.contacts[0] : oc.contacts as any;
    return { ...c, role_label: oc.role_label, is_primary: oc.is_primary };
  }).filter(Boolean);

  const deals = (dealOrgs ?? []).map(r => {
    const d = Array.isArray(r.deals) ? r.deals[0] : r.deals as any;
    return d;
  }).filter(Boolean);

  return <OrgDetail org={org} contacts={contacts} deals={deals} activities={activities ?? []} mandates={mandates ?? []} financialData={financialData ?? []} />;
}

export default function OrgPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}><div style={{ height: 400, borderRadius: 16, background: "var(--surface-2)" }}/></div>}>
      <Content params={params} />
    </Suspense>
  );
}
