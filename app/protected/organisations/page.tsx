import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { OrganisationsList } from "./organisations-list";

const typeLabels: Record<string, string> = {
  client: "Client", prospect_client: "Prospect client", investor: "Investisseur",
  buyer: "Repreneur", target: "Cible", law_firm: "Cabinet juridique",
  bank: "Banque", advisor: "Conseil", accounting_firm: "Cabinet comptable",
  family_office: "Family office", corporate: "Corporate",
  consulting_firm: "Cabinet de conseil", other: "Autre",
};

const statusLabels: Record<string, string> = {
  to_qualify: "À qualifier", qualified: "Qualifié", priority: "Prioritaire",
  active: "Actif", dormant: "Dormant", inactive: "Inactif", excluded: "Exclu",
};

async function Content() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organizations")
    .select(`
      id, name, organization_type, base_status, sector, country, website, notes,
      deals:deals(id)
    `)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  const orgs = (data ?? []).map(o => ({
    id: o.id,
    name: o.name,
    typeLabel: typeLabels[o.organization_type] ?? o.organization_type,
    statusLabel: statusLabels[o.base_status] ?? o.base_status,
    status: o.base_status,
    sector: o.sector ?? "N/A",
    country: o.country ?? "N/A",
    website: o.website ?? null,
    notes: o.notes ?? "—",
    dealsCount: Array.isArray(o.deals) ? o.deals.length : 0,
  }));

  return <OrganisationsList orgs={orgs} stats={{ total: orgs.length }} />;
}

export default function OrganisationsPage() {
  return (
    <Suspense fallback={
      <div className="p-8">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-slate-200 mb-8" />
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200" />)}
        </div>
      </div>
    }>
      <Content />
    </Suspense>
  );
}
