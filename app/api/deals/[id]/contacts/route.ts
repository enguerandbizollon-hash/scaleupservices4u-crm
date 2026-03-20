import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Récupérer l'organisation liée au dossier
  const { data: deal } = await supabase
    .from("deals")
    .select("id, name, client_organization_id")
    .eq("id", id)
    .maybeSingle();

  if (!deal) return NextResponse.json({ groups: [] });

  // Toutes les organisations contactées pour ce dossier
  // On prend les orgs liées via activities ou organization_contacts
  const { data: activities } = await supabase
    .from("activities")
    .select("organization_id, organizations(id, name, base_status, organization_type)")
    .eq("deal_id", id)
    .not("organization_id", "is", null);

  // Orgs uniques depuis les activités
  const orgMap = new Map<string, any>();
  for (const a of activities ?? []) {
    const org = Array.isArray(a.organizations) ? a.organizations[0] : a.organizations as any;
    if (org && !orgMap.has(org.id)) orgMap.set(org.id, org);
  }

  // Ajouter l'org principale du deal
  if (deal.client_organization_id) {
    const { data: mainOrg } = await supabase
      .from("organizations")
      .select("id, name, base_status, organization_type")
      .eq("id", deal.client_organization_id)
      .maybeSingle();
    if (mainOrg) orgMap.set(mainOrg.id, mainOrg);
  }

  // Pour chaque org, récupérer les contacts + leur dernière activité sur ce dossier
  const groups = [];
  for (const [orgId, org] of orgMap) {
    const { data: orgContacts } = await supabase
      .from("organization_contacts")
      .select("contact_id, role_label, contacts(id, first_name, last_name, full_name, email, phone, title, base_status, last_contact_date, linkedin_url)")
      .eq("organization_id", orgId);

    const contacts = (orgContacts ?? []).map(oc => {
      const c = Array.isArray(oc.contacts) ? oc.contacts[0] : oc.contacts as any;
      return { ...c, role_label: oc.role_label };
    }).filter(Boolean);

    if (contacts.length > 0) {
      groups.push({ org, contacts });
    }
  }

  return NextResponse.json({ groups, deal });
}
