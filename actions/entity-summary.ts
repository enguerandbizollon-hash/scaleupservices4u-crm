"use server";

import { createClient } from "@/lib/supabase/server";

export type ContactSummary = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  linkedin_url: string | null;
  base_status: string;
  sector: string | null;
  country: string | null;
  last_contact_date: string | null;
  organizations: { id: string; name: string; role_label: string | null }[];
};

export type OrganizationSummary = {
  id: string;
  name: string;
  organization_type: string;
  base_status: string;
  sector: string | null;
  location: string | null;
  website: string | null;
  company_stage: string | null;
  revenue_range: string | null;
  is_client: boolean;
  investment_ticket: string | null;
  contacts: {
    id: string;
    first_name: string;
    last_name: string;
    title: string | null;
    email: string | null;
    role_label: string | null;
  }[];
  deals: {
    id: string;
    name: string;
    deal_type: string;
    deal_stage: string | null;
    deal_status: string;
  }[];
};

type Result<T> = { data: T | null; error: string | null };

export async function getContactSummary(contactId: string): Promise<Result<ContactSummary>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Non autorisé" };

    const { data: contact, error: cErr } = await supabase
      .from("contacts")
      .select("id,first_name,last_name,email,phone,title,linkedin_url,base_status,sector,country,last_contact_date")
      .eq("id", contactId)
      .maybeSingle();
    if (cErr) return { data: null, error: cErr.message };
    if (!contact) return { data: null, error: null };

    const { data: ocData } = await supabase
      .from("organization_contacts")
      .select("role_label,organizations(id,name)")
      .eq("contact_id", contactId);

    const organizations = (ocData ?? [])
      .map((oc) => {
        const rel = oc as unknown as { role_label: string | null; organizations: { id: string; name: string } | { id: string; name: string }[] | null };
        const o = Array.isArray(rel.organizations) ? rel.organizations[0] : rel.organizations;
        return o ? { id: o.id, name: o.name, role_label: rel.role_label } : null;
      })
      .filter((x): x is { id: string; name: string; role_label: string | null } => x !== null);

    return { data: { ...contact, organizations }, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return { data: null, error: msg };
  }
}

export async function getOrganizationSummary(orgId: string): Promise<Result<OrganizationSummary>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Non autorisé" };

    const { data: org, error: oErr } = await supabase
      .from("organizations")
      .select("id,name,organization_type,base_status,sector,location,website,company_stage,revenue_range,is_client,investment_ticket")
      .eq("id", orgId)
      .maybeSingle();
    if (oErr) return { data: null, error: oErr.message };
    if (!org) return { data: null, error: null };

    const [ocRes, dealsRes] = await Promise.all([
      supabase
        .from("organization_contacts")
        .select("role_label,contacts(id,first_name,last_name,title,email)")
        .eq("organization_id", orgId)
        .limit(12),
      supabase
        .from("deals")
        .select("id,name,deal_type,deal_stage,deal_status")
        .eq("organization_id", orgId)
        .limit(8),
    ]);

    const contacts = (ocRes.data ?? [])
      .map((oc) => {
        const rel = oc as unknown as {
          role_label: string | null;
          contacts:
            | { id: string; first_name: string; last_name: string; title: string | null; email: string | null }
            | { id: string; first_name: string; last_name: string; title: string | null; email: string | null }[]
            | null;
        };
        const c = Array.isArray(rel.contacts) ? rel.contacts[0] : rel.contacts;
        return c ? { ...c, role_label: rel.role_label } : null;
      })
      .filter(
        (x): x is { id: string; first_name: string; last_name: string; title: string | null; email: string | null; role_label: string | null } =>
          x !== null
      );

    return { data: { ...org, contacts, deals: dealsRes.data ?? [] }, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return { data: null, error: msg };
  }
}
