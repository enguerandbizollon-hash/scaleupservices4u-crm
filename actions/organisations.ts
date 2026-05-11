"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { fetchEntrepriseBySiren, searchEntreprisesByName, type NormalizedEntreprise } from "@/lib/connectors/recherche-entreprises";

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

// ── createOrganisationMinimal ──────────────────────────────────────────
// Création légère pour les pickers inline. Crée une organisation avec
// le minimum requis (nom + type) et tous les autres champs en defaults.
// L'utilisateur enrichit ensuite via la fiche complète.

export async function createOrganisationMinimal(input: {
  name: string;
  organization_type?: string;
}): Promise<OrgActionResult> {
  const name = input.name.trim();
  if (!name) return { success: false, error: "Le nom est obligatoire" };

  const orgType = input.organization_type || "other";

  return createOrganisationAction({
    name,
    organization_type: orgType,
    base_status: "to_qualify",
    location: null,
    website: null,
    linkedin_url: null,
    description: null,
    notes: null,
    investor_ticket_min: null,
    investor_ticket_max: null,
    investor_sectors: [],
    investor_stages: [],
    investor_geographies: [],
    investor_thesis: null,
    sector: null,
    founded_year: null,
    employee_count: null,
    company_stage: null,
    revenue_range: null,
    sale_readiness: null,
    partial_sale_ok: false,
    acquisition_rationale: null,
    target_sectors: [],
    excluded_sectors: [],
    target_geographies: [],
    target_revenue_min: null,
    target_revenue_max: null,
  });
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


// ── Enrichissement INSEE / recherche-entreprises.api.gouv.fr ────────────────
// API publique gratuite. Récupère les données légales d'une entreprise FR à
// partir de son SIREN. Met à jour uniquement les champs vides de
// l'organisation pour ne pas écraser une saisie manuelle. Trace l'origine
// via les nouvelles infos dans description (workaround : pas de colonne
// dédiée pour l'instant — à formaliser si besoin via migration).

export interface EnrichmentPreview {
  siren: string;
  name: string;
  short_name: string | null;
  forme_juridique: string | null;
  category: string | null;
  company_stage_crm: string | null;
  founded_year: number | null;
  effectif_label: string | null;
  employee_count: number | null;
  activite: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  dirigeants: Array<{ name: string; qualite: string | null }>;
}

function previewFromNormalized(n: NormalizedEntreprise): EnrichmentPreview {
  return {
    siren: n.siren,
    name: n.name,
    short_name: n.short_name,
    forme_juridique: n.forme_juridique_label,
    category: n.category,
    company_stage_crm: n.company_stage_crm,
    founded_year: n.founded_year,
    effectif_label: n.effectif_label,
    employee_count: n.effectif_midpoint,
    activite: n.activite_section ?? n.activite_principale_code,
    address: n.address,
    city: n.city,
    country: n.country,
    dirigeants: n.dirigeants,
  };
}

export async function previewEnrichmentBySiren(
  siren: string,
): Promise<{ success: true; data: EnrichmentPreview } | { success: false; error: string }> {
  try {
    const result = await fetchEntrepriseBySiren(siren);
    if (!result) return { success: false, error: "Aucune entreprise trouvée pour ce SIREN." };
    return { success: true, data: previewFromNormalized(result) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur API";
    return { success: false, error: msg };
  }
}

export async function searchEnrichmentByName(
  query: string,
): Promise<{ success: true; data: EnrichmentPreview[] } | { success: false; error: string }> {
  try {
    const results = await searchEntreprisesByName(query, 8);
    return { success: true, data: results.map(previewFromNormalized) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur API";
    return { success: false, error: msg };
  }
}

export async function applyEnrichmentToOrganisation(
  orgId: string,
  data: EnrichmentPreview,
  options: { overwrite?: boolean } = {},
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  // Charger l'org actuelle pour décider quels champs sont vides
  const { data: org, error: readErr } = await supabase
    .from("organizations")
    .select("name, sector, location, country, founded_year, employee_count, company_stage, description")
    .eq("id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readErr) return { success: false, error: readErr.message };
  if (!org) return { success: false, error: "Organisation introuvable." };

  const overwrite = options.overwrite ?? false;
  const update: Record<string, unknown> = {};
  const current = org as Record<string, unknown>;

  const setIfEmpty = (field: string, value: unknown) => {
    if (value == null || value === "") return;
    if (overwrite || current[field] == null || current[field] === "") {
      update[field] = value;
    }
  };

  setIfEmpty("founded_year", data.founded_year);
  setIfEmpty("employee_count", data.employee_count);
  setIfEmpty("company_stage", data.company_stage_crm);
  setIfEmpty("sector", data.activite);
  setIfEmpty("country", data.country);

  // Location : "address, postal_code city" si tous présents, sinon city seul
  if (!current.location || overwrite) {
    const locParts: string[] = [];
    if (data.address) locParts.push(data.address);
    if (data.city) locParts.push(data.city);
    const loc = locParts.join(", ").trim();
    if (loc) update.location = loc;
  }

  // Description : ajouter SIREN + forme juridique + dirigeants en suffixe
  // tant qu'il n'y a pas de colonne dédiée
  if (!current.description || overwrite) {
    const lines: string[] = [];
    if (data.forme_juridique) lines.push(`Forme juridique : ${data.forme_juridique}`);
    lines.push(`SIREN : ${data.siren}`);
    if (data.category) lines.push(`Catégorie INSEE : ${data.category}`);
    if (data.effectif_label) lines.push(`Effectif : ${data.effectif_label}`);
    if (data.dirigeants.length > 0) {
      const dirs = data.dirigeants
        .slice(0, 3)
        .map(d => d.qualite ? `${d.name} (${d.qualite})` : d.name)
        .join(" · ");
      lines.push(`Dirigeants : ${dirs}`);
    }
    if (lines.length > 0) {
      const existing = current.description ? `${current.description}\n\n` : "";
      const block = `[Enrichi via INSEE le ${new Date().toLocaleDateString("fr-FR")}]\n${lines.join("\n")}`;
      update.description = overwrite ? block : existing + block;
    }
  }

  if (Object.keys(update).length === 0) {
    return { success: true }; // rien à mettre à jour
  }

  const { error: updErr } = await supabase
    .from("organizations")
    .update(update)
    .eq("id", orgId)
    .eq("user_id", user.id);
  if (updErr) return { success: false, error: updErr.message };

  revalidatePath(`/protected/organisations/${orgId}`);
  return { success: true };
}
