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
      investor_stages, investor_geographies, investor_thesis,
      founded_year, employee_count, company_stage, revenue_range,
      sale_readiness, partial_sale_ok,
      acquisition_rationale, target_sectors, excluded_sectors,
      target_geographies, target_revenue_min, target_revenue_max
    `)
    .eq("id", id)
    .maybeSingle();

  if (!org) notFound();

  const o = org as Record<string, unknown>;

  return (
    <OrganisationForm
      mode="edit"
      initialData={{
        id:                   org.id,
        name:                 org.name,
        organization_type:    org.organization_type,
        base_status:          org.base_status,
        location:             (o.location as string) ?? undefined,
        website:              (o.website as string) ?? undefined,
        linkedin_url:         (o.linkedin_url as string) ?? undefined,
        description:          (o.description as string) ?? undefined,
        notes:                (o.notes as string) ?? undefined,
        investor_ticket_min:  (o.investor_ticket_min as number) ?? null,
        investor_ticket_max:  (o.investor_ticket_max as number) ?? null,
        investor_sectors:     (o.investor_sectors as string[]) ?? [],
        investor_stages:      (o.investor_stages as string[]) ?? [],
        investor_geographies: (o.investor_geographies as string[]) ?? [],
        investor_thesis:      (o.investor_thesis as string) ?? null,
        sector:               (o.sector as string) ?? null,
        founded_year:         (o.founded_year as number) ?? null,
        employee_count:       (o.employee_count as number) ?? null,
        company_stage:        (o.company_stage as string) ?? null,
        revenue_range:        (o.revenue_range as string) ?? null,
        sale_readiness:       (o.sale_readiness as string) ?? null,
        partial_sale_ok:      (o.partial_sale_ok as boolean) ?? true,
        acquisition_rationale:(o.acquisition_rationale as string) ?? null,
        target_sectors:       (o.target_sectors as string[]) ?? [],
        excluded_sectors:     (o.excluded_sectors as string[]) ?? [],
        target_geographies:   (o.target_geographies as string[]) ?? [],
        target_revenue_min:   (o.target_revenue_min as number) ?? null,
        target_revenue_max:   (o.target_revenue_max as number) ?? null,
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
