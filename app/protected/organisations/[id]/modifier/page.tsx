import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrganisationForm } from "@/components/organisations/OrganisationForm";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select(`
      id, name, organization_type, base_status, sector, location, website,
      linkedin_url, description, notes,
      investor_ticket_min, investor_ticket_max, investor_sectors,
      investor_stages, investor_geographies, investor_thesis
    `)
    .eq("id", id)
    .maybeSingle();

  if (!org) notFound();

  return (
    <OrganisationForm
      mode="edit"
      initialData={{
        id:                   org.id,
        name:                 org.name,
        organization_type:    org.organization_type,
        base_status:          org.base_status,
        location:             (org as any).location ?? undefined,
        website:              org.website ?? undefined,
        linkedin_url:         (org as any).linkedin_url ?? undefined,
        description:          (org as any).description ?? undefined,
        notes:                (org as any).notes ?? undefined,
        investor_ticket_min:  (org as any).investor_ticket_min ?? null,
        investor_ticket_max:  (org as any).investor_ticket_max ?? null,
        investor_sectors:     ((org as any).investor_sectors as string[]) ?? [],
        investor_stages:      ((org as any).investor_stages as string[]) ?? [],
        investor_thesis:      (org as any).investor_thesis ?? null,
      }}
    />
  );
}

export default function ModifierOrganisationPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}><div style={{ height: 400, borderRadius: 12, background: "#f3f4f6" }}/></div>}>
      <Content params={params} />
    </Suspense>
  );
}
