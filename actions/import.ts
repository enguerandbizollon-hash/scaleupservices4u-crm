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
