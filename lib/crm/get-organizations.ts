import { createClient } from "@/lib/supabase/server";
import {
  organizationTypeLabels,
  organizationStatusLabels,
} from "@/lib/crm/labels";
import type { OrganizationView } from "@/lib/crm/types";

type OrganizationRow = {
  id: string;
  name: string;
  organization_type: string;
  base_status: string;
  sector: string | null;
  country: string | null;
  website: string | null;
  notes: string | null;
};

type DealLinkRow = {
  name: string;
  client_organization_id: string;
};

export async function getOrganizationsView() {
  const supabase = await createClient();

  const { data: organizationsData, error: organizationsError } = await supabase
    .from("organizations")
    .select("id,name,organization_type,base_status,sector,country,website,notes")
    .order("name", { ascending: true });

  if (organizationsError) {
    throw new Error(organizationsError.message);
  }

  const organizations = (organizationsData ?? []) as OrganizationRow[];

  const { data: dealsData, error: dealsError } = await supabase
    .from("deals")
    .select("name,client_organization_id")
    .order("name", { ascending: true });

  if (dealsError) {
    throw new Error(dealsError.message);
  }

  const deals = (dealsData ?? []) as DealLinkRow[];

const dealsByOrganizationId = deals.reduce<Record<string, string[]>>((acc, deal) => {
  if (!acc[deal.client_organization_id]) {
    acc[deal.client_organization_id] = [];
  }

  if (!acc[deal.client_organization_id].includes(deal.name)) {
    acc[deal.client_organization_id].push(deal.name);
  }

  return acc;
}, {});

  const allOrganizations: OrganizationView[] = organizations.map((org) => ({
    id: org.id,
    name: org.name,
    typeLabel: organizationTypeLabels[org.organization_type] ?? org.organization_type,
    statusLabel: organizationStatusLabels[org.base_status] ?? org.base_status,
    sector: org.sector ?? "N/A",
    country: org.country ?? "N/A",
    website: org.website,
    notes: org.notes ?? "—",
    linkedDeals: dealsByOrganizationId[org.id] ?? [],
  }));

  return {
    allOrganizations,
    clientsCount: allOrganizations.filter((o) => o.typeLabel === "Client").length,
    investorsCount: allOrganizations.filter((o) => o.typeLabel === "Investisseur").length,
    thirdPartiesCount: allOrganizations.filter((o) =>
      ["Avocat", "Conseil", "Banque", "Tiers"].includes(o.typeLabel)
    ).length,
  };
}