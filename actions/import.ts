"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ─────────────────────────────────────────────────────────────
// Import Contacts — bulk insert avec dédoublonnage par email
// et auto-création / liaison organisation par nom.
// ─────────────────────────────────────────────────────────────

export interface ImportContactRow {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  sector?: string | null;
  linkedin_url?: string | null;
  base_status?: string | null;
  organisation_name?: string | null;
  notes?: string | null;
}

export type ImportContactsResult = {
  total: number;
  created: number;
  matched: number;
  organisations_linked: number;
  organisations_created: number;
  errors: { line: number; reason: string }[];
};

const BASE_STATUS_ALLOWED = new Set([
  "active",
  "priority",
  "qualified",
  "to_qualify",
  "dormant",
  "inactive",
  "excluded",
]);

export async function importContacts(
  rows: ImportContactRow[],
): Promise<ImportContactsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      total: rows.length,
      created: 0,
      matched: 0,
      organisations_linked: 0,
      organisations_created: 0,
      errors: [{ line: 0, reason: "Non authentifié" }],
    };
  }

  let created = 0;
  let matched = 0;
  let orgsLinked = 0;
  let orgsCreated = 0;
  const errors: { line: number; reason: string }[] = [];

  const orgaCache = new Map<string, string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 2;

    const first_name = row.first_name?.trim();
    const last_name = row.last_name?.trim();
    if (!first_name || !last_name) {
      errors.push({ line, reason: "Prénom et nom obligatoires" });
      continue;
    }

    const email = row.email ? row.email.toLowerCase().trim() : null;
    const base_status =
      row.base_status && BASE_STATUS_ALLOWED.has(row.base_status.trim())
        ? row.base_status.trim()
        : "to_qualify";

    let contactId: string | null = null;

    if (email) {
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("email", email)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing) {
        contactId = existing.id;
        matched++;
      }
    }

    if (!contactId) {
      const { data: inserted, error: insertErr } = await supabase
        .from("contacts")
        .insert({
          user_id: user.id,
          first_name,
          last_name,
          email,
          phone: row.phone?.trim() || null,
          title: row.title?.trim() || null,
          sector: row.sector?.trim() || null,
          linkedin_url: row.linkedin_url?.trim() || null,
          base_status,
          notes: row.notes?.trim() || null,
        })
        .select("id")
        .single();
      if (insertErr || !inserted?.id) {
        errors.push({
          line,
          reason: insertErr?.message ?? "Erreur création contact",
        });
        continue;
      }
      contactId = inserted.id;
      created++;
    }

    const orgName = row.organisation_name?.trim();
    if (orgName && contactId) {
      const cacheKey = orgName.toLowerCase();
      let orgId = orgaCache.get(cacheKey);
      if (!orgId) {
        const { data: existingOrg } = await supabase
          .from("organizations")
          .select("id")
          .ilike("name", orgName)
          .eq("user_id", user.id)
          .maybeSingle();
        if (existingOrg) {
          orgId = existingOrg.id;
        } else {
          const { data: newOrg, error: orgErr } = await supabase
            .from("organizations")
            .insert({ user_id: user.id, name: orgName })
            .select("id")
            .single();
          if (orgErr || !newOrg?.id) {
            errors.push({
              line,
              reason: `Organisation "${orgName}" : ${orgErr?.message ?? "création échouée"}`,
            });
          } else {
            orgId = newOrg.id;
            orgsCreated++;
          }
        }
        if (orgId) orgaCache.set(cacheKey, orgId);
      }
      if (orgId) {
        const { error: linkErr } = await supabase
          .from("organization_contacts")
          .upsert(
            {
              organization_id: orgId,
              contact_id: contactId,
              user_id: user.id,
              role_label: row.title?.trim() || null,
            },
            { onConflict: "organization_id,contact_id" },
          );
        if (!linkErr) orgsLinked++;
      }
    }
  }

  revalidatePath("/protected/contacts");
  revalidatePath("/protected/organisations");

  return {
    total: rows.length,
    created,
    matched,
    organisations_linked: orgsLinked,
    organisations_created: orgsCreated,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────
// Import Organisations
// ─────────────────────────────────────────────────────────────

export interface ImportOrganisationRow {
  name: string;
  organization_type?: string | null;
  sector?: string | null;
  location?: string | null;
  website?: string | null;
  linkedin_url?: string | null;
  description?: string | null;
  notes?: string | null;
}

export type ImportOrganisationsResult = {
  total: number;
  created: number;
  matched: number;
  errors: { line: number; reason: string }[];
};

const ORG_TYPE_ALLOWED = new Set([
  "investor",
  "business_angel",
  "family_office",
  "client",
  "prospect_client",
  "target",
  "buyer",
  "law_firm",
  "bank",
  "advisor",
  "accounting_firm",
  "corporate",
  "consulting_firm",
  "other",
]);

const ORG_TYPE_ALIASES: Record<string, string> = {
  // FR
  investisseur: "investor",
  "fonds": "investor",
  "fonds d'investissement": "investor",
  vc: "investor",
  "venture capital": "investor",
  ba: "business_angel",
  "business angel": "business_angel",
  "family office": "family_office",
  "single family office": "family_office",
  client: "client",
  prospect: "prospect_client",
  "prospect client": "prospect_client",
  cible: "target",
  target: "target",
  repreneur: "buyer",
  buyer: "buyer",
  acquereur: "buyer",
  acquéreur: "buyer",
  avocat: "law_firm",
  "law firm": "law_firm",
  "cabinet juridique": "law_firm",
  banque: "bank",
  bank: "bank",
  conseil: "advisor",
  advisor: "advisor",
  "cabinet comptable": "accounting_firm",
  "expert comptable": "accounting_firm",
  corporate: "corporate",
  "cabinet conseil": "consulting_firm",
  consulting: "consulting_firm",
};

function normalizeOrgType(raw: string | null | undefined): string {
  if (!raw) return "other";
  const v = raw.trim().toLowerCase();
  if (!v) return "other";
  if (ORG_TYPE_ALLOWED.has(v)) return v;
  const mapped = ORG_TYPE_ALIASES[v];
  if (mapped && ORG_TYPE_ALLOWED.has(mapped)) return mapped;
  return "other";
}

export async function importOrganisations(
  rows: ImportOrganisationRow[],
): Promise<ImportOrganisationsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      total: rows.length,
      created: 0,
      matched: 0,
      errors: [{ line: 0, reason: "Non authentifié" }],
    };
  }

  let created = 0;
  let matched = 0;
  const errors: { line: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 2;
    const name = row.name?.trim();
    if (!name) {
      errors.push({ line, reason: "Nom obligatoire" });
      continue;
    }

    const { data: existing } = await supabase
      .from("organizations")
      .select("id")
      .ilike("name", name)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      matched++;
      continue;
    }

    const { error } = await supabase.from("organizations").insert({
      user_id: user.id,
      name,
      organization_type: normalizeOrgType(row.organization_type),
      base_status: "to_qualify",
      sector: row.sector?.trim() || null,
      location: row.location?.trim() || null,
      website: row.website?.trim() || null,
      linkedin_url: row.linkedin_url?.trim() || null,
      description: row.description?.trim() || null,
      notes: row.notes?.trim() || null,
    });

    if (error) {
      errors.push({ line, reason: error.message });
      continue;
    }
    created++;
  }

  revalidatePath("/protected/organisations");
  return { total: rows.length, created, matched, errors };
}
