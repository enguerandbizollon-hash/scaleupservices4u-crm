"use server";

import { createClient } from "@/lib/supabase/server";
import { ImportReport } from "./organisations";

export async function importCandidates(rows: Record<string, string>[]): Promise<ImportReport> {
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

      let existingId: string | null = null;
      if (email) {
        const { data } = await supabase.from("candidates").select("id")
          .eq("email", email).eq("user_id", user.id).maybeSingle();
        existingId = data?.id ?? null;
      }

      const payload: Record<string, unknown> = {
        user_id:      user.id,
        first_name:   first || null,
        last_name:    last  || null,
        global_status: r.global_status?.trim() || "searching",
      };
      if (email)                            payload.email                 = email;
      if (r.phone?.trim())                  payload.phone                 = r.phone.trim();
      if (r.linkedin_url?.trim())           payload.linkedin_url          = r.linkedin_url.trim();
      if (r.current_title?.trim())          payload.current_title         = r.current_title.trim();
      if (r.current_company?.trim())        payload.current_company       = r.current_company.trim();
      if (r.location?.trim())               payload.location              = r.location.trim();
      if (r.seniority_level?.trim())        payload.seniority_level       = r.seniority_level.trim();
      if (r.remote_preference?.trim())      payload.remote_preference     = r.remote_preference.trim();
      if (r.notes_shareable?.trim())        payload.notes_shareable       = r.notes_shareable.trim();
      if (r.notes_internal?.trim())         payload.notes_internal        = r.notes_internal.trim();
      if (r.desired_salary_min?.trim() && !isNaN(Number(r.desired_salary_min)))
        payload.desired_salary_min = Number(r.desired_salary_min);
      if (r.desired_salary_max?.trim() && !isNaN(Number(r.desired_salary_max)))
        payload.desired_salary_max = Number(r.desired_salary_max);

      if (existingId) {
        const { error } = await supabase.from("candidates").update(payload).eq("id", existingId);
        if (error) throw new Error(error.message);
        updated++;
      } else {
        const { error } = await supabase.from("candidates").insert(payload);
        if (error) throw new Error(error.message);
        created++;
      }
    } catch (e: unknown) {
      errors.push({ row: i + 2, message: e instanceof Error ? e.message : String(e) });
    }
  }

  return { created, updated, errors };
}
