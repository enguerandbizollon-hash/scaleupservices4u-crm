import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: dealId } = await params;
  const supabase = await createClient();

  // 1. Orgs liées via deal_organizations (source principale)
  const { data: dealOrgs } = await supabase
    .from("deal_organizations")
    .select("organization_id, organizations(id, name, base_status, organization_type, location, website, sector, investment_ticket, investment_stage)")
    .eq("deal_id", dealId);

  // 2. Orgs liées via activities (compatibilité rétroactive)
  const { data: actOrgs } = await supabase
    .from("activities")
    .select("organization_id, organizations(id, name, base_status, organization_type, location, website, sector, investment_ticket, investment_stage)")
    .eq("deal_id", dealId)
    .not("organization_id", "is", null);

  // Dédupliquer
  const orgMap = new Map<string, any>();
  for (const row of [...(dealOrgs ?? []), ...(actOrgs ?? [])]) {
    const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations as any;
    if (org && !orgMap.has(org.id)) orgMap.set(org.id, org);
  }

  if (orgMap.size === 0) return NextResponse.json({ groups: [], total_orgs: 0 });

  // 3. Pour chaque org, récupérer les contacts liés
  const groups = [];
  for (const [orgId, org] of orgMap) {
    const { data: orgContacts } = await supabase
      .from("organization_contacts")
      .select("contact_id, role_label, contacts(id, first_name, last_name, email, phone, title, base_status, last_contact_date, linkedin_url)")
      .eq("organization_id", orgId);

    const contacts = (orgContacts ?? [])
      .map(oc => {
        const c = Array.isArray(oc.contacts) ? oc.contacts[0] : oc.contacts as any;
        return c ? { ...c, role_label: oc.role_label } : null;
      })
      .filter(Boolean);

    groups.push({ org, contacts });
  }

  // Trier par nb contacts décroissant
  groups.sort((a, b) => b.contacts.length - a.contacts.length);

  return NextResponse.json({ groups, total_orgs: orgMap.size });
}
