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
      siren,street,postal_code,city,region,country,latitude,longitude,address_formatted,geocoded_at,
      linkedin_url,
      founded_year,employee_count,company_stage,revenue_range,
      sale_readiness,partial_sale_ok,
      acquisition_rationale,target_sectors,excluded_sectors,target_geographies,target_revenue_min,target_revenue_max,
      acquirer_type,acquisition_motivations,target_ebitda_min,target_ebitda_max,acquisition_history,
      operation_types,deal_stance,acquirer_summary
    `)
    .eq("id", id).maybeSingle();

  if (!org) notFound();

  // Pont vers la prospection : une organisation née d'une fiche univers
  // (promotion) garde son SIREN, donc son radar et sa fiche 360 restent
  // accessibles depuis l'écran CRM au lieu d'être enfermés côté univers.
  const { data: universFiche } = org.siren
    ? await supabase
        .from("univers_entreprises")
        .select("siren, statut, cedabilite_score, cedabilite_raisons")
        .eq("siren", org.siren)
        .maybeSingle()
    : { data: null };

  // Les activités/tâches de l'organisation sont chargées côté client par
  // <ActionTimeline filters={{ organization_id: id }} /> dans OrgDetail.
  // On récupère juste le count ici pour l'afficher dans la barre d'onglets.
  const [{ data: orgContacts }, { data: dealOrgs }, { data: clientDeals }, { data: financialData }, { count: actionsCount }] = await Promise.all([
    supabase.from("organization_contacts")
      .select("contact_id,role_label,is_primary,contacts(id,first_name,last_name,title,email,phone,linkedin_url,base_status,last_contact_date)")
      .eq("organization_id", id),
    supabase.from("deal_organizations")
      .select("deal_id,deals(id,name,deal_type,deal_status,deal_stage,priority_level,target_date,target_amount,currency)")
      .eq("organization_id", id),
    // Dossiers dont l'organisation est le sujet/client (fusion mandats, v65)
    supabase.from("deals")
      .select("id,name,deal_type,deal_status,estimated_fee_amount,confirmed_fee_amount,currency,start_date,target_date")
      .eq("organization_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("financial_data")
      .select("*")
      .eq("organization_id", id)
      .order("fiscal_year", { ascending: false }),
    supabase.from("actions")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", id),
  ]);

  const contacts = (orgContacts ?? []).map(oc => {
    const c = Array.isArray(oc.contacts) ? oc.contacts[0] : oc.contacts as any;
    return { ...c, role_label: oc.role_label, is_primary: oc.is_primary };
  }).filter(Boolean);

  const deals = (dealOrgs ?? []).map(r => {
    const d = Array.isArray(r.deals) ? r.deals[0] : r.deals as any;
    return d;
  }).filter(Boolean);

  return <OrgDetail org={org} contacts={contacts} deals={deals} clientDeals={clientDeals ?? []} financialData={financialData ?? []} actionsCount={actionsCount ?? 0} universFiche={universFiche ?? null} />;
}

export default function OrgPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}><div style={{ height: 400, borderRadius: 16, background: "var(--surface-2)" }}/></div>}>
      <Content params={params} />
    </Suspense>
  );
}
