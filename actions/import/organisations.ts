"use server";

import { createClient } from "@/lib/supabase/server";
import {
  parseTicketText,
  normalizeStageText,
  normalizeSectorText,
  normalizeGeoText,
  parseMultiText,
} from "@/lib/crm/investor-parsers";

export interface ImportReport {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

const INVESTOR_TYPES = ["investor", "business_angel", "family_office", "corporate"];

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

      const orgType = r.organization_type?.trim() || "company";
      const isInvestor = INVESTOR_TYPES.includes(orgType);

      const payload: Record<string, unknown> = {
        user_id:           user.id,
        name,
        organization_type: orgType,
        base_status:       r.base_status?.trim()       || "to_qualify",
      };
      if (r.sector?.trim())           payload.sector           = r.sector.trim();
      if (r.location?.trim())         payload.location         = r.location.trim();
      if (website)                    payload.website          = website;
      if (r.description?.trim())      payload.description      = r.description.trim();
      if (r.notes?.trim())            payload.notes            = r.notes.trim();
      if (r.investor_thesis?.trim())  payload.investor_thesis  = r.investor_thesis.trim();
      if (r.founded_year?.trim() && !isNaN(Number(r.founded_year)))
        payload.founded_year = Number(r.founded_year);
      if (r.employee_count?.trim() && !isNaN(Number(r.employee_count)))
        payload.employee_count = Number(r.employee_count);

      // Anciennes colonnes texte (conservées pour backward compat)
      if (r.investment_ticket?.trim()) payload.investment_ticket = r.investment_ticket.trim();
      if (r.investment_stage?.trim())  payload.investment_stage  = r.investment_stage.trim();

      // Parse vers colonnes structurées si investisseur
      if (isInvestor) {
        // Ticket : CSV peut avoir investor_ticket_min/max OU investment_ticket texte
        if (r.investor_ticket_min?.trim() && !isNaN(Number(r.investor_ticket_min))) {
          payload.investor_ticket_min = Number(r.investor_ticket_min);
        }
        if (r.investor_ticket_max?.trim() && !isNaN(Number(r.investor_ticket_max))) {
          payload.investor_ticket_max = Number(r.investor_ticket_max);
        }
        // Fallback : parser le texte investment_ticket
        if (!payload.investor_ticket_min && !payload.investor_ticket_max && r.investment_ticket?.trim()) {
          const parsed = parseTicketText(r.investment_ticket);
          if (parsed) {
            payload.investor_ticket_min = parsed.min;
            payload.investor_ticket_max = parsed.max;
          }
        }

        // Secteurs : CSV peut avoir investor_sectors (comma-sep) OU sector texte
        if (r.investor_sectors?.trim()) {
          payload.investor_sectors = parseMultiText(r.investor_sectors, normalizeSectorText);
        } else if (r.sector?.trim()) {
          const parsed = parseMultiText(r.sector, normalizeSectorText);
          if (parsed.length > 0) payload.investor_sectors = parsed;
        }

        // Stages : CSV peut avoir investor_stages (comma-sep) OU investment_stage texte
        if (r.investor_stages?.trim()) {
          payload.investor_stages = parseMultiText(r.investor_stages, normalizeStageText);
        } else if (r.investment_stage?.trim()) {
          const parsed = parseMultiText(r.investment_stage, normalizeStageText);
          if (parsed.length > 0) payload.investor_stages = parsed;
        }

        // Géographies : CSV peut avoir investor_geographies (comma-sep) OU location texte
        if (r.investor_geographies?.trim()) {
          payload.investor_geographies = parseMultiText(r.investor_geographies, normalizeGeoText);
        } else if (r.location?.trim()) {
          const parsed = parseMultiText(r.location, normalizeGeoText);
          if (parsed.length > 0) payload.investor_geographies = parsed;
        }
      }

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
