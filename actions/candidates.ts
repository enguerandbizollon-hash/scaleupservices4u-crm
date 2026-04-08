"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { syncToGCal } from "@/lib/gcal/sync-helper";

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

  const { data: current } = await supabase
    .from("candidates")
    .select("candidate_status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!current) throw new Error("Candidat introuvable");

  const { error: updateError } = await supabase
    .from("candidates")
    .update({ candidate_status: new_status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateError) throw new Error(updateError.message);

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

// ── addJobAction ─────────────────────────────────────────────────────

export async function addJobAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const candidate_id = ns(formData.get("candidate_id"));
  const title        = ns(formData.get("title"));
  if (!candidate_id) throw new Error("ID candidat manquant");
  if (!title)        throw new Error("Intitulé de poste obligatoire");

  const is_current = formData.get("is_current") === "on";

  const { error } = await supabase.from("candidate_jobs").insert({
    candidate_id,
    user_id:      user.id,
    title,
    company_name: ns(formData.get("company_name")),
    start_date:   ns(formData.get("start_date")),
    end_date:     is_current ? null : ns(formData.get("end_date")),
    is_current,
    description:  ns(formData.get("description")),
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/protected/candidats/${candidate_id}`);
  redirect(`/protected/candidats/${candidate_id}`);
}

// ── deleteJobAction ──────────────────────────────────────────────────

export async function deleteJobAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const job_id       = ns(formData.get("job_id"));
  const candidate_id = ns(formData.get("candidate_id"));
  if (!job_id || !candidate_id) throw new Error("IDs manquants");

  const { error } = await supabase
    .from("candidate_jobs")
    .delete()
    .eq("id", job_id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath(`/protected/candidats/${candidate_id}`);
  redirect(`/protected/candidats/${candidate_id}`);
}

// ── addSkillAction ───────────────────────────────────────────────────

export async function addSkillAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const candidate_id = ns(formData.get("candidate_id"));
  const skill_name   = ns(formData.get("skill_name"));
  if (!candidate_id) throw new Error("ID candidat manquant");
  if (!skill_name)   throw new Error("Compétence obligatoire");

  const { error } = await supabase.from("candidate_skills").insert({
    candidate_id,
    user_id:      user.id,
    skill_name,
    level:        ns(formData.get("level")),
    is_shareable: formData.get("is_shareable") !== "false",
    weight:       formData.get("weight") ? Number(formData.get("weight")) : 1,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/protected/candidats/${candidate_id}`);
  redirect(`/protected/candidats/${candidate_id}`);
}

// ── deleteSkillAction ────────────────────────────────────────────────

export async function deleteSkillAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const skill_id     = ns(formData.get("skill_id"));
  const candidate_id = ns(formData.get("candidate_id"));
  if (!skill_id || !candidate_id) throw new Error("IDs manquants");

  const { error } = await supabase
    .from("candidate_skills")
    .delete()
    .eq("id", skill_id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath(`/protected/candidats/${candidate_id}`);
  redirect(`/protected/candidats/${candidate_id}`);
}

// ── addInterviewAction ───────────────────────────────────────────────

export async function addInterviewAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const candidate_id = ns(formData.get("candidate_id"));
  if (!candidate_id) throw new Error("ID candidat manquant");

  const scoreRaw = formData.get("score");
  const score    = scoreRaw && String(scoreRaw).trim() !== "" ? Number(scoreRaw) : null;

  const { error } = await supabase.from("candidate_interviews").insert({
    candidate_id,
    user_id:         user.id,
    deal_id:         ns(formData.get("deal_id")),
    interviewer:     ns(formData.get("interviewer")),
    interview_date:  ns(formData.get("interview_date")),
    interview_type:  ns(formData.get("interview_type")),
    score,
    feedback:        ns(formData.get("feedback")),
    recommendation:  ns(formData.get("recommendation")),
    is_confidential: formData.get("is_confidential") === "on",
  });

  if (error) throw new Error(error.message);

  // Mettre à jour last_contact_date du candidat
  await supabase
    .from("candidates")
    .update({ last_contact_date: new Date().toISOString().split("T")[0], updated_at: new Date().toISOString() })
    .eq("id", candidate_id)
    .eq("user_id", user.id);

  // M5 trigger : entretien avec date → GCal (non-bloquant via syncToGCal)
  const interviewDate = ns(formData.get("interview_date"));
  if (interviewDate) {
    const interviewTypeLabel: Record<string, string> = {
      rh: "Entretien RH", client: "Entretien client", technique: "Technique", autre: "Entretien",
    };
    const typeRaw = ns(formData.get("interview_type")) ?? "autre";
    const typeLabel = interviewTypeLabel[typeRaw] ?? "Entretien";

    const { data: cand } = await supabase
      .from("candidates")
      .select("first_name,last_name")
      .eq("id", candidate_id)
      .single();
    const candidateName = cand ? `${cand.first_name} ${cand.last_name}` : "Candidat";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    syncToGCal({
      action: "create",
      source_type: "activity",
      source_id: candidate_id,
      event: {
        summary: `${typeLabel} — ${candidateName}`,
        description: ns(formData.get("feedback")) ?? "",
        start: interviewDate,
        end: interviewDate,
        allDay: true,
        sourceUrl: `${baseUrl}/protected/candidats/${candidate_id}`,
      },
    });
  }

  revalidatePath(`/protected/candidats/${candidate_id}`);
  redirect(`/protected/candidats/${candidate_id}`);
}

// ── addCandidateDocumentAction ───────────────────────────────────────
// Appelée depuis DriveDocumentPicker (client) après sélection Drive

export async function addCandidateDocumentAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const candidate_id  = ns(formData.get("candidate_id"));
  const drive_file_id = ns(formData.get("drive_file_id"));
  const file_name     = ns(formData.get("file_name"));
  const file_url      = ns(formData.get("file_url"));

  if (!candidate_id)  throw new Error("ID candidat manquant");
  if (!drive_file_id) throw new Error("ID fichier Drive manquant");
  if (!file_name)     throw new Error("Nom de fichier manquant");
  if (!file_url)      throw new Error("URL fichier manquante");

  const { error } = await supabase.from("candidate_documents").insert({
    candidate_id,
    user_id:       user.id,
    drive_file_id,
    file_name,
    file_url,
    mime_type:     ns(formData.get("mime_type")),
    document_type: ns(formData.get("document_type")) ?? "other",
    source:        "google_drive",
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/protected/candidats/${candidate_id}`);
}

// ── deleteCandidateDocumentAction ────────────────────────────────────

export async function deleteCandidateDocumentAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const doc_id       = ns(formData.get("doc_id"));
  const candidate_id = ns(formData.get("candidate_id"));
  if (!doc_id || !candidate_id) throw new Error("IDs manquants");

  const { error } = await supabase
    .from("candidate_documents")
    .delete()
    .eq("id", doc_id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath(`/protected/candidats/${candidate_id}`);
  redirect(`/protected/candidats/${candidate_id}`);
}

// ── generateReportAction ─────────────────────────────────────────────
// M6 : crée un token de rapport partageable (30 jours)

export async function generateReportAction(formData: FormData): Promise<{ token: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const candidate_id = ns(formData.get("candidate_id"));
  const label        = ns(formData.get("label"));
  if (!candidate_id) throw new Error("ID candidat manquant");

  const { data, error } = await supabase
    .from("candidate_reports")
    .insert({ candidate_id, user_id: user.id, label })
    .select("token")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/protected/candidats/${candidate_id}`);
  return { token: data.token };
}

// ── deleteReportAction ───────────────────────────────────────────────

export async function deleteReportAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const report_id    = ns(formData.get("report_id"));
  const candidate_id = ns(formData.get("candidate_id"));
  if (!report_id || !candidate_id) throw new Error("IDs manquants");

  await supabase
    .from("candidate_reports")
    .delete()
    .eq("id", report_id)
    .eq("user_id", user.id);

  revalidatePath(`/protected/candidats/${candidate_id}`);
  redirect(`/protected/candidats/${candidate_id}`);
}

// ── getAllCandidatesSimple — autocomplete ActionModal ────────────────

export async function getAllCandidatesSimple(): Promise<
  { id: string; first_name: string; last_name: string; email: string | null }[]
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("candidates")
    .select("id, first_name, last_name, email")
    .eq("user_id", user.id)
    .order("last_name", { ascending: true });

  return (data ?? []) as { id: string; first_name: string; last_name: string; email: string | null }[];
}
