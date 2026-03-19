import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { OrganisationsList } from "./organisations-list";

export const revalidate = 60;

const TYPE_LABELS: Record<string, string> = {
  client:"Client", prospect_client:"Prospect client", investor:"Investisseur",
  buyer:"Repreneur", target:"Cible", law_firm:"Cabinet juridique",
  bank:"Banque", advisor:"Conseil", accounting_firm:"Cabinet comptable",
  family_office:"Family office", corporate:"Corporate",
  consulting_firm:"Cabinet de conseil", other:"Autre",
};

async function Content() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, organization_type, base_status, sector, country, website, notes")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);

  const { data: dealCounts } = await supabase.from("deals").select("client_organization_id");
  const dealMap = new Map<string, number>();
  for (const d of dealCounts ?? []) {
    if (d.client_organization_id) dealMap.set(d.client_organization_id, (dealMap.get(d.client_organization_id) ?? 0) + 1);
  }

  const orgs = (data ?? []).map(o => ({
    id: o.id, name: o.name,
    typeKey: o.organization_type,
    typeLabel: TYPE_LABELS[o.organization_type] ?? o.organization_type,
    statusLabel: o.base_status,
    status: o.base_status,
    sector: o.sector ?? "",
    country: o.country ?? "",
    website: o.website ?? null,
    notes: o.notes ?? "",
    dealsCount: dealMap.get(o.id) ?? 0,
  }));

  return <OrganisationsList orgs={orgs} stats={{ total: orgs.length }}/>;
}

function Skeleton() {
  return (
    <div style={{ padding:32, background:"var(--bg)", minHeight:"100vh" }}>
      <div className="skeleton" style={{ height:36, width:180, marginBottom:24 }}/>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
        {[...Array(12)].map((_,i) => <div key={i} className="skeleton" style={{ height:160, borderRadius:14 }}/>)}
      </div>
    </div>
  );
}

export default function OrganisationsPage() {
  return <Suspense fallback={<Skeleton/>}><Content/></Suspense>;
}
