import { createClient } from "@/lib/supabase/server";
import { DealWizard } from "./_components/deal-wizard";

interface RawMandate {
  id: string;
  name: string;
  type: string;
  status: string;
  organizations: { name: string } | { name: string }[] | null;
}

export default async function NouveauDossierPage() {
  const supabase = await createClient();

  const [mandatesRes, orgsRes, contactsRes] = await Promise.all([
    supabase
      .from("mandates")
      .select("id,name,type,status,organizations:client_organization_id(name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("organizations")
      .select("id,name")
      .order("name"),
    supabase
      .from("contacts")
      .select("id,first_name,last_name,email")
      .order("last_name"),
  ]);

  const mandates = ((mandatesRes.data ?? []) as RawMandate[]).map(m => ({
    id: m.id,
    name: m.name,
    type: m.type,
    status: m.status,
    client_name: Array.isArray(m.organizations)
      ? (m.organizations[0]?.name ?? null)
      : (m.organizations?.name ?? null),
  }));

  return (
    <DealWizard
      mandates={mandates}
      organisations={orgsRes.data ?? []}
      contacts={contactsRes.data ?? []}
    />
  );
}
