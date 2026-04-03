"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Type partagé avec OrganisationForm ───────────────────────────────

export interface OrgActionData {
  name: string;
  organization_type: string;
  base_status: string;
  location: string | null;
  website: string | null;
  linkedin_url: string | null;
  description: string | null;
  notes: string | null;
  // Champs investisseur (conditionnels)
  investor_ticket_min: number | null;
  investor_ticket_max: number | null;
  investor_sectors: string[];
  investor_stages: string[];
  investor_geographies: string[];
  investor_thesis: string | null;
  investor_stage_min?: string | null;
  investor_stage_max?: string | null;
  // Profil entreprise (client, prospect, cible, repreneur)
  sector: string | null;
  founded_year: number | null;
  employee_count: number | null;
  company_stage: string | null;
  revenue_range: string | null;
  // M&A vendeur (target)
  sale_readiness: string | null;
  partial_sale_ok: boolean;
  // M&A acquéreur (buyer)
  acquisition_rationale: string | null;
  target_sectors: string[];
  excluded_sectors: string[];
  target_geographies: string[];
  target_revenue_min: number | null;
  target_revenue_max: number | null;
  // Acquirer profile
  acquirer_type?: string | null;
  acquisition_motivations?: string[];
  target_ebitda_min?: number | null;
  target_ebitda_max?: number | null;
  acquisition_history?: string | null;
}

export type OrgActionResult =
  | { success: true; id: string }
  | { success: false; error: string };

// ── createOrganisationAction ─────────────────────────────────────────

export async function createOrganisationAction(
  data: OrgActionData,
): Promise<OrgActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const name = data.name.trim();
  if (!name) return { success: false, error: "Le nom est obligatoire" };


  // Vérif doublon
  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .eq("user_id", user.id)
    .ilike("name", name)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return { success: false, error: `Une organisation "${name}" existe déjà.` };
  }

  const { data: org, error } = await supabase
    .from("organizations")
    .insert({
      name,
      organization_type:  data.organization_type || "other",
      base_status:        data.base_status || "to_qualify",
      location:           data.location,
      website:            data.website,
      linkedin_url:       data.linkedin_url,
      description:        data.description,
      notes:              data.notes,
      investor_ticket_min:  data.investor_ticket_min,
      investor_ticket_max:  data.investor_ticket_max,
      investor_sectors:     data.investor_sectors.length > 0 ? data.investor_sectors : null,
      investor_stages:      data.investor_stages.length > 0 ? data.investor_stages : null,
      investor_geographies: data.investor_geographies.length > 0 ? data.investor_geographies : null,
      investor_thesis:      data.investor_thesis,
      investor_stage_min:   data.investor_stage_min ?? null,
      investor_stage_max:   data.investor_stage_max ?? null,
      // Profil entreprise
      sector:               data.sector,
      founded_year:         data.founded_year,
      employee_count:       data.employee_count,
      company_stage:        data.company_stage,
      revenue_range:        data.revenue_range,
      // M&A vendeur
      sale_readiness:       data.sale_readiness,
      partial_sale_ok:      data.partial_sale_ok,
      // M&A acquéreur
      acquisition_rationale: data.acquisition_rationale,
      target_sectors:        data.target_sectors.length > 0 ? data.target_sectors : null,
      excluded_sectors:      data.excluded_sectors.length > 0 ? data.excluded_sectors : null,
      target_geographies:    data.target_geographies.length > 0 ? data.target_geographies : null,
      target_revenue_min:    data.target_revenue_min,
      target_revenue_max:    data.target_revenue_max,
      // Acquirer profile
      acquirer_type:           data.acquirer_type ?? null,
      acquisition_motivations: (data.acquisition_motivations ?? []).length > 0 ? data.acquisition_motivations : null,
      target_ebitda_min:       data.target_ebitda_min ?? null,
      target_ebitda_max:       data.target_ebitda_max ?? null,
      acquisition_history:     data.acquisition_history ?? null,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/protected/organisations");
  return { success: true, id: org.id };
}

// ── updateOrganisationAction ─────────────────────────────────────────

export async function updateOrganisationAction(
  id: string,
  data: OrgActionData,
): Promise<OrgActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  if (!id) return { success: false, error: "ID manquant" };


  const { error } = await supabase
    .from("organizations")
    .update({
      name:               data.name.trim(),
      organization_type:  data.organization_type || "other",
      base_status:        data.base_status || "to_qualify",
      location:           data.location,
      website:            data.website,
      linkedin_url:       data.linkedin_url,
      description:        data.description,
      notes:              data.notes,
      investor_ticket_min:  data.investor_ticket_min,
      investor_ticket_max:  data.investor_ticket_max,
      investor_sectors:     data.investor_sectors.length > 0 ? data.investor_sectors : null,
      investor_stages:      data.investor_stages.length > 0 ? data.investor_stages : null,
      investor_geographies: data.investor_geographies.length > 0 ? data.investor_geographies : null,
      investor_thesis:      data.investor_thesis,
      investor_stage_min:   data.investor_stage_min ?? null,
      investor_stage_max:   data.investor_stage_max ?? null,
      // Profil entreprise
      sector:               data.sector,
      founded_year:         data.founded_year,
      employee_count:       data.employee_count,
      company_stage:        data.company_stage,
      revenue_range:        data.revenue_range,
      // M&A vendeur
      sale_readiness:       data.sale_readiness,
      partial_sale_ok:      data.partial_sale_ok,
      // M&A acquéreur
      acquisition_rationale: data.acquisition_rationale,
      target_sectors:        data.target_sectors.length > 0 ? data.target_sectors : null,
      excluded_sectors:      data.excluded_sectors.length > 0 ? data.excluded_sectors : null,
      target_geographies:    data.target_geographies.length > 0 ? data.target_geographies : null,
      target_revenue_min:    data.target_revenue_min,
      target_revenue_max:    data.target_revenue_max,
      // Acquirer profile
      acquirer_type:           data.acquirer_type ?? null,
      acquisition_motivations: (data.acquisition_motivations ?? []).length > 0 ? data.acquisition_motivations : null,
      target_ebitda_min:       data.target_ebitda_min ?? null,
      target_ebitda_max:       data.target_ebitda_max ?? null,
      acquisition_history:     data.acquisition_history ?? null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/protected/organisations");
  revalidatePath(`/protected/organisations/${id}`);
  // Les dossiers fundraising/M&A utilisent les données investisseur pour le matching
  revalidatePath("/protected/dossiers");
  return { success: true, id };
}

// ── getAllOrganisationsSimple ──────────────────────────────────────────
// Liste légère id+name — utilisée pour les sélecteurs dans les formulaires

export async function getAllOrganisationsSimple(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("user_id", user.id)
    .order("name");

  return (data ?? []) as { id: string; name: string }[];
}
