"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function ns(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

// ── createCandidateAction ────────────────────────────────────────────

export async function createCandidateAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const first_name = ns(formData.get("first_name"));
  const last_name  = ns(formData.get("last_name"));
  if (!first_name || !last_name) throw new Error("Prénom et nom obligatoires");

  const { data: candidate, error } = await supabase
    .from("candidates")
    .insert({
      first_name,
      last_name,
      email:             ns(formData.get("email")),
      phone:             ns(formData.get("phone")),
      linkedin_url:      ns(formData.get("linkedin_url")),
      title:             ns(formData.get("title")),
      current_company:   ns(formData.get("current_company")),
      location:          ns(formData.get("location")),
      seniority:         ns(formData.get("seniority")),
      remote_preference: ns(formData.get("remote_preference")),
      salary_current:    formData.get("salary_current") ? Number(formData.get("salary_current")) : null,
      salary_target:     formData.get("salary_target")  ? Number(formData.get("salary_target"))  : null,
      candidate_status:  ns(formData.get("candidate_status")) ?? "searching",
      notes_internal:    ns(formData.get("notes_internal")),
      notes_shareable:   ns(formData.get("notes_shareable")),
      available_from:    ns(formData.get("available_from")),
      source:            "manual",
      user_id:           user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Log du statut initial
  const initialStatus = ns(formData.get("candidate_status")) ?? "searching";
  const initialNote   = ns(formData.get("initial_note")) ?? "Création du profil";
  await supabase.from("candidate_status_log").insert({
    candidate_id: candidate.id,
    user_id:      user.id,
    old_status:   null,
    new_status:   initialStatus,
    note:         initialNote,
  });

  revalidatePath("/protected/candidats");
  redirect(`/protected/candidats/${candidate.id}`);
}

// ── updateCandidateAction ────────────────────────────────────────────

export async function updateCandidateAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const id = ns(formData.get("candidate_id"));
  if (!id) throw new Error("ID manquant");

  const { error } = await supabase
    .from("candidates")
    .update({
      first_name:        ns(formData.get("first_name")),
      last_name:         ns(formData.get("last_name")),
      email:             ns(formData.get("email")),
      phone:             ns(formData.get("phone")),
      linkedin_url:      ns(formData.get("linkedin_url")),
      title:             ns(formData.get("title")),
      current_company:   ns(formData.get("current_company")),
      location:          ns(formData.get("location")),
      seniority:         ns(formData.get("seniority")),
      remote_preference: ns(formData.get("remote_preference")),
      salary_current:    formData.get("salary_current") ? Number(formData.get("salary_current")) : null,
      salary_target:     formData.get("salary_target")  ? Number(formData.get("salary_target"))  : null,
      notes_internal:    ns(formData.get("notes_internal")),
      notes_shareable:   ns(formData.get("notes_shareable")),
      available_from:    ns(formData.get("available_from")),
      updated_at:        new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath(`/protected/candidats/${id}`);
  revalidatePath("/protected/candidats");
  redirect(`/protected/candidats/${id}`);
}

// ── updateCandidateStatusAction ─────────────────────────────────────
// Note obligatoire — log immuable INSERT dans candidate_status_log

export async function updateCandidateStatusAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const id         = ns(formData.get("candidate_id"));
  const new_status = ns(formData.get("new_status"));
  const note       = ns(formData.get("note"));

  if (!id)         throw new Error("ID manquant");
  if (!new_status) throw new Error("Nouveau statut manquant");
  if (!note)       throw new Error("La note est obligatoire pour changer le statut");

  // Récupérer le statut actuel
  const { data: current } = await supabase
    .from("candidates")
    .select("candidate_status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!current) throw new Error("Candidat introuvable");

  // Mettre à jour le statut
  const { error: updateError } = await supabase
    .from("candidates")
    .update({ candidate_status: new_status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateError) throw new Error(updateError.message);

  // Log immuable
  const { error: logError } = await supabase
    .from("candidate_status_log")
    .insert({
      candidate_id: id,
      user_id:      user.id,
      old_status:   current.candidate_status,
      new_status,
      note,
    });

  if (logError) throw new Error(logError.message);

  revalidatePath(`/protected/candidats/${id}`);
  revalidatePath("/protected/candidats");
  redirect(`/protected/candidats/${id}`);
}
