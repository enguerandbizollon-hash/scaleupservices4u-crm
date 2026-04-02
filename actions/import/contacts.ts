"use server";

import { createClient } from "@/lib/supabase/server";
import { ImportReport } from "./organisations";

export async function importContacts(rows: Record<string, string>[]): Promise<ImportReport> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autorisé");

  let created = 0, updated = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const first = r.first_name?.trim() || "";
    const last  = r.last_name?.trim()  || "";
    if (!first && !last) { errors.push({ row: i + 2, message: "first_name ou last_name requis" }); continue; }

    try {
      const email = r.email?.trim() || null;

      // Chercher doublon par email si fourni
      let existingId: string | null = null;
      if (email) {
        const { data } = await supabase.from("contacts").select("id")
          .eq("email", email).eq("user_id", user.id).maybeSingle();
        existingId = data?.id ?? null;
      }

      const payload: Record<string, unknown> = {
        user_id:    user.id,
        first_name: first || null,
        last_name:  last  || null,
        base_status: r.base_status?.trim() || "to_qualify",
      };
      if (email)                       payload.email             = email;
      if (r.phone?.trim())             payload.phone             = r.phone.trim();
      if (r.title?.trim())             payload.title             = r.title.trim();
      if (r.linkedin_url?.trim())      payload.linkedin_url      = r.linkedin_url.trim();
      if (r.last_contact_date?.trim()) payload.last_contact_date = r.last_contact_date.trim();
      if (r.sector?.trim())            payload.sector            = r.sector.trim();
      if (r.country?.trim())           payload.country           = r.country.trim();
      if (r.notes?.trim())             payload.notes             = r.notes.trim();

      let contactId: string;
      if (existingId) {
        const { error } = await supabase.from("contacts").update(payload).eq("id", existingId);
        if (error) throw new Error(error.message);
        contactId = existingId;
        updated++;
      } else {
        const { data, error } = await supabase.from("contacts").insert(payload).select("id").single();
        if (error) throw new Error(error.message);
        contactId = data.id;
        created++;
      }

      // Lier à l'organisation si organisation_name fourni
      const orgName = r.organisation_name?.trim() || r.organization_name?.trim();
      if (orgName && contactId) {
        const { data: org } = await supabase.from("organizations").select("id")
          .ilike("name", orgName).eq("user_id", user.id).maybeSingle();
        if (org) {
          const { data: existing } = await supabase.from("organization_contacts").select("id")
            .eq("organization_id", org.id).eq("contact_id", contactId).maybeSingle();
          if (!existing) {
            await supabase.from("organization_contacts").insert({
              organization_id: org.id,
              contact_id:      contactId,
              user_id:         user.id,
              role_label:      r.role_label?.trim() || null,
              is_primary:      false,
            });
          }
        }
      }
    } catch (e: unknown) {
      errors.push({ row: i + 2, message: e instanceof Error ? e.message : String(e) });
    }
  }

  return { created, updated, errors };
}
