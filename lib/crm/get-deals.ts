import { createClient } from "@/lib/supabase/server";
import {
  dealTypeLabels,
  dealStatusLabels,
  dealStageLabels,
  priorityLabels,
} from "@/lib/crm/labels";
import type { DealView } from "@/lib/crm/types";

type DealRow = {
  id: string;
  name: string;
  deal_type: string;
  deal_status: string;
  deal_stage: string;
  priority_level: string;
  client_organization_id: string;
  sector: string | null;
  valuation_amount: number | null;
  fundraising_amount: number | null;
  description: string | null;
  start_date: string | null;
  target_date: string | null;
};

type OrganizationRow = {
  id: string;
  name: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return new Intl.DateTimeFormat("fr-FR").format(date);
}

function formatAmount(value: number | null) {
  if (value === null || value === undefined) return "N/A";
  return new Intl.NumberFormat("fr-FR").format(value);
}

export async function getDealsView() {
  const supabase = await createClient();

  const { data: dealsData, error: dealsError } = await supabase
    .from("deals")
    .select(
      "id,name,deal_type,deal_status,deal_stage,priority_level,client_organization_id,sector,valuation_amount,fundraising_amount,description,start_date,target_date"
    )
    .order("target_date", { ascending: true });

  if (dealsError) {
    throw new Error(dealsError.message);
  }

  const deals = (dealsData ?? []) as DealRow[];
  const organizationIds = [...new Set(deals.map((deal) => deal.client_organization_id))];

  let organizationMap: Record<string, string> = {};

  if (organizationIds.length > 0) {
    const { data: organizationsData, error: organizationsError } = await supabase
      .from("organizations")
      .select("id,name")
      .in("id", organizationIds);

    if (organizationsError) {
      throw new Error(organizationsError.message);
    }

    const organizations = (organizationsData ?? []) as OrganizationRow[];

    organizationMap = Object.fromEntries(
      organizations.map((organization) => [organization.id, organization.name])
    );
  }

  const dealsView: DealView[] = deals.map((deal) => ({
    id: deal.id,
    name: deal.name,
    typeLabel: dealTypeLabels[deal.deal_type] ?? deal.deal_type,
    statusLabel: dealStatusLabels[deal.deal_status] ?? deal.deal_status,
    stageLabel: dealStageLabels[deal.deal_stage] ?? deal.deal_stage,
    priorityLabel: priorityLabels[deal.priority_level] ?? deal.priority_level,
    organisation: organizationMap[deal.client_organization_id] ?? "Organisation inconnue",
    sector: deal.sector ?? "N/A",
    valuation: formatAmount(deal.valuation_amount),
    fundraising: formatAmount(deal.fundraising_amount),
    startDate: formatDate(deal.start_date),
    targetDate: formatDate(deal.target_date),
    description: deal.description ?? "—",
  }));

  return {
    allDeals: dealsView,
    activeDeals: dealsView.filter((deal) => deal.statusLabel === "Actif"),
    inactiveDeals: dealsView.filter((deal) => deal.statusLabel !== "Actif"),
  };
}