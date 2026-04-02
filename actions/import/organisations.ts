"use server";

import { createClient } from "@/lib/supabase/server";

export interface ImportReport {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

export async function importOrganisations(rows: Record<string, string>[]): Promise<ImportReport> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autorisé");

  let created = 0, updated = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = r.name?.trim();
    if (!name) { errors.push({ row: i + 2, message: "Colonne 'name' manquante" }); continue; }

    try {
      // Chercher doublon par website puis par nom
      let existingId: string | null = null;
      const website = r.website?.trim() || null;
      if (website) {
        const { data } = await supabase.from("organizations").select("id")
          .eq("website", website).eq("user_id", user.id).maybeSingle();
        existingId = data?.id ?? null;
      }
      if (!existingId) {
        const { data } = await supabase.from("organizations").select("id")
          .ilike("name", name).eq("user_id", user.id).maybeSingle();
        existingId = data?.id ?? null;
      }

      const payload: Record<string, unknown> = {
        user_id:           user.id,
        name,
        organization_type: r.organization_type?.trim() || "company",
        base_status:       r.base_status?.trim()       || "to_qualify",
      };
      if (r.sector?.trim())           payload.sector           = r.sector.trim();
      if (r.location?.trim())         payload.location         = r.location.trim();
      if (website)                    payload.website          = website;
      if (r.description?.trim())      payload.description      = r.description.trim();
      if (r.notes?.trim())            payload.notes            = r.notes.trim();
      if (r.investment_ticket?.trim()) payload.investment_ticket = r.investment_ticket.trim();
      if (r.investment_stage?.trim()) payload.investment_stage = r.investment_stage.trim();
      if (r.investor_thesis?.trim())  payload.investor_thesis  = r.investor_thesis.trim();
      if (r.founded_year?.trim() && !isNaN(Number(r.founded_year)))
        payload.founded_year = Number(r.founded_year);
      if (r.employee_count?.trim() && !isNaN(Number(r.employee_count)))
        payload.employee_count = Number(r.employee_count);

      if (existingId) {
        const { error } = await supabase.from("organizations").update(payload).eq("id", existingId);
        if (error) throw new Error(error.message);
        updated++;
      } else {
        const { error } = await supabase.from("organizations").insert(payload);
        if (error) throw new Error(error.message);
        created++;
      }
    } catch (e: unknown) {
      errors.push({ row: i + 2, message: e instanceof Error ? e.message : String(e) });
    }
  }

  return { created, updated, errors };
}
