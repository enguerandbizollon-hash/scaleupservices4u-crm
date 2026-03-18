import { createClient } from "@/lib/supabase/server";

export type ContactView = {
  id: string;
  fullName: string;
  title: string;
  email: string;
  phone: string;
  linkedinUrl: string | null;
  sector: string;
  ticket: string;
  organisation: string;
  status: string;
  notes: string;
  linkedDeals: { dealName: string; roleInDeal: string; contacted: boolean; contactedAt: string; lastContactAt: string; nextFollowUpAt: string; statusInDeal: string; notes: string; }[];
};

export async function getContactsView() {
  const supabase = await createClient();

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select(`
      id,
      first_name,
      last_name,
      full_name,
      email,
      phone,
      title,
      linkedin_url,
      sector,
      investment_ticket_label,
      notes,
      base_status,
      organization_contacts (
        organization_id,
        role_label,
        organizations ( id, name )
      )
    `)
    .order("last_name", { ascending: true });

  if (error) throw new Error(error.message);

  const allContacts: ContactView[] = (contacts ?? []).map((c) => {
    const orgContact = c.organization_contacts?.[0];
    const org = orgContact?.organizations as { id: string; name: string } | null;

    return {
      id: c.id,
      fullName: c.full_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
      title: c.title ?? "—",
      email: c.email ?? "—",
      phone: c.phone ?? "—",
      linkedinUrl: c.linkedin_url ?? null,
      sector: c.sector ?? "N/A",
      ticket: c.investment_ticket_label ?? "N/A",
      organisation: org?.name ?? "—",
      status: c.base_status ?? "—",
      notes: c.notes ?? "—",
      linkedDeals: [],
    };
  });

  return {
    allContacts,
    activeContactsCount: allContacts.filter(c => c.status === "active" || c.status === "priority").length,
    linkedDealsCount: 0,
  };
}
