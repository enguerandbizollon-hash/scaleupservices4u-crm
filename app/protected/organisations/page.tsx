import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { OrganisationsList } from "./organisations-list";

export const revalidate = 60;

const typeLabels: Record<string, string> = {
  client: "Client", prospect_client: "Prospect client", investor: "Investisseur",
  buyer: "Repreneur", target: "Cible", law_firm: "Cabinet juridique",
  bank: "Banque", advisor: "Conseil", accounting_firm: "Cabinet comptable",
  family_office: "Family office", corporate: "Corporate",
  consulting_firm: "Cabinet de conseil", other: "Autre",
};

async function Content() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, organization_type, base_status, sector, country, website, notes")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  // Compter les deals séparément et simplement
  const { data: dealCounts } = await supabase
    .from("deals")
    .select("client_organization_id");

  const dealMap = new Map<string, number>();
  for (const d of dealCounts ?? []) {
    if (d.client_organization_id) {
      dealMap.set(d.client_organization_id, (dealMap.get(d.client_organization_id) ?? 0) + 1);
    }
  }

  const orgs = (data ?? []).map(o => ({
    id: o.id,
    name: o.name,
    typeLabel: typeLabels[o.organization_type] ?? o.organization_type,
    statusLabel: o.base_status,
    status: o.base_status,
    sector: o.sector ?? "",
    country: o.country ?? "",
    website: o.website ?? null,
    notes: o.notes ?? "",
    dealsCount: dealMap.get(o.id) ?? 0,
  }));

  return <OrganisationsList orgs={orgs} stats={{ total: orgs.length }} />;
}

export default function OrganisationsPage() {
  return (
    <Suspense fallback={
      <div style={{ padding:32, background:"var(--bg)", minHeight:"100vh" }}>
        <div style={{ height:40, width:200, borderRadius:10, background:"var(--border)", marginBottom:24, animation:"pulse 1.5s infinite" }}/>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {[1,2,3,4,5].map(i => <div key={i} style={{ height:60, borderRadius:12, background:"var(--border)", animation:"pulse 1.5s infinite" }}/>)}
        </div>
      </div>
    }>
      <Content />
    </Suspense>
  );
}
