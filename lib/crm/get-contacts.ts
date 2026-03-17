import { createClient } from "@/lib/supabase/server";
import {
  baseContactStatusLabels,
  contactPipelineStatusLabels,
} from "@/lib/crm/labels";
import type {
  ContactLinkedDealView,
  ContactView,
} from "@/lib/crm/types";

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  linkedin_url: string | null;
  sector: string | null;
  investment_ticket_label: string | null;
  country: string | null;
  notes: string | null;
  base_status: string;
  first_contact_at: string | null;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
};

type OrganizationContactRow = {
  contact_id: string;
  organization_id: string;
  role_label: string | null;
};

type OrganizationRow = {
  id: string;
  name: string;
};

type DealContactRow = {
  contact_id: string;
  deal_id: string;
  organization_id: string | null;
  role_in_deal: string | null;
  status_in_deal: string | null;
  contacted: boolean;
  contacted_at: string | null;
  first_contact_at: string | null;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  notes: string | null;
};

type DealRow = {
  id: string;
  name: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return new Intl.DateTimeFormat("fr-FR").format(date);
}

export async function getContactsView() {
  const supabase = await createClient();

  const { data: contactsData, error: contactsError } = await supabase
    .from("contacts")
    .select(
      "id,first_name,last_name,full_name,email,phone,title,linkedin_url,sector,investment_ticket_label,country,notes,base_status,first_contact_at,last_contact_at,next_follow_up_at"
    )
    .order("last_name", { ascending: true });

  if (contactsError) {
    throw new Error(contactsError.message);
  }

  const contacts = (contactsData ?? []) as ContactRow[];
  const contactIds = contacts.map((contact) => contact.id);

  let organizationContacts: OrganizationContactRow[] = [];
  let dealContacts: DealContactRow[] = [];

  if (contactIds.length > 0) {
    const { data: organizationContactsData, error: organizationContactsError } =
      await supabase
        .from("organization_contacts")
        .select("contact_id,organization_id,role_label")
        .in("contact_id", contactIds);

    if (organizationContactsError) {
      throw new Error(organizationContactsError.message);
    }

    organizationContacts = (organizationContactsData ?? []) as OrganizationContactRow[];

    const { data: dealContactsData, error: dealContactsError } = await supabase
      .from("deal_contacts")
      .select(
        "contact_id,deal_id,organization_id,role_in_deal,status_in_deal,contacted,contacted_at,first_contact_at,last_contact_at,next_follow_up_at,notes"
      )
      .in("contact_id", contactIds);

    if (dealContactsError) {
      throw new Error(dealContactsError.message);
    }

    dealContacts = (dealContactsData ?? []) as DealContactRow[];
  }

  const organizationIds = [
    ...new Set([
      ...organizationContacts.map((row) => row.organization_id),
      ...dealContacts.map((row) => row.organization_id).filter(Boolean),
    ]),
  ] as string[];

  const dealIds = [...new Set(dealContacts.map((row) => row.deal_id))];

  let organizationsMap: Record<string, string> = {};
  let dealsMap: Record<string, string> = {};

  if (organizationIds.length > 0) {
    const { data: organizationsData, error: organizationsError } = await supabase
      .from("organizations")
      .select("id,name")
      .in("id", organizationIds);

    if (organizationsError) {
      throw new Error(organizationsError.message);
    }

    const organizations = (organizationsData ?? []) as OrganizationRow[];
    organizationsMap = Object.fromEntries(
      organizations.map((org) => [org.id, org.name])
    );
  }

  if (dealIds.length > 0) {
    const { data: dealsData, error: dealsError } = await supabase
      .from("deals")
      .select("id,name")
      .in("id", dealIds);

    if (dealsError) {
      throw new Error(dealsError.message);
    }

    const deals = (dealsData ?? []) as DealRow[];
    dealsMap = Object.fromEntries(deals.map((deal) => [deal.id, deal.name]));
  }

  const allContacts: ContactView[] = contacts.map((contact) => {
    const contactOrganizations = organizationContacts.filter(
      (row) => row.contact_id === contact.id
    );

    const mainOrganisation =
      contactOrganizations.length > 0
        ? organizationsMap[contactOrganizations[0].organization_id] ??
          "Organisation inconnue"
        : "Organisation inconnue";

    const linkedDeals: ContactLinkedDealView[] = dealContacts
      .filter((row) => row.contact_id === contact.id)
      .map((row) => ({
        dealName: dealsMap[row.deal_id] ?? "Dossier inconnu",
        roleInDeal: row.role_in_deal ?? "—",
        contacted: row.contacted,
        contactedAt: formatDate(row.contacted_at),
        lastContactAt: formatDate(row.last_contact_at),
        nextFollowUpAt: formatDate(row.next_follow_up_at),
        statusInDeal:
          contactPipelineStatusLabels[row.status_in_deal ?? ""] ??
          (row.status_in_deal ?? "—"),
        notes: row.notes ?? "—",
      }));

    return {
      id: contact.id,
      fullName:
        contact.full_name ||
        `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim(),
      title: contact.title ?? "—",
      email: contact.email ?? "—",
      phone: contact.phone ?? "—",
      linkedinUrl: contact.linkedin_url,
      sector: contact.sector ?? "N/A",
      ticket: contact.investment_ticket_label ?? "N/A",
      organisation: mainOrganisation,
      status: baseContactStatusLabels[contact.base_status] ?? contact.base_status,
      notes: contact.notes ?? "—",
      linkedDeals,
    };
  });

  return {
    allContacts,
    activeContactsCount: allContacts.filter((c) => c.status === "Actif").length,
    linkedDealsCount: allContacts.reduce((acc, c) => acc + c.linkedDeals.length, 0),
  };
}