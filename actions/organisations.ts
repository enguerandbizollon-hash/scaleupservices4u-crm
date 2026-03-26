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

  if (data.investor_sectors.length > 3) {
    return { success: false, error: "Un fonds peut sélectionner au maximum 3 secteurs d'investissement" };
  }

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

  if (data.investor_sectors.length > 3) {
    return { success: false, error: "Un fonds peut sélectionner au maximum 3 secteurs d'investissement" };
  }

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
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/protected/organisations");
  revalidatePath(`/protected/organisations/${id}`);
  return { success: true, id };
}
