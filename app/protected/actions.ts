"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function deleteDealAction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("ID manquant.");
  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/protected/dossiers");
  redirect("/protected/dossiers");
}

export async function deleteContactAction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("ID manquant.");
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/protected/contacts");
  redirect("/protected/contacts");
}

export async function deleteOrganizationAction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("ID manquant.");
  const { error } = await supabase.from("organizations").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/protected/organisations");
  redirect("/protected/organisations");
}

export async function deleteTaskAction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("ID manquant.");
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/protected/agenda");
  revalidatePath("/protected/dossiers");
  redirect("/protected/agenda");
}

export async function deleteEventAction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("ID manquant.");
  const { error } = await supabase.from("agenda_events").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/protected/agenda");
  redirect("/protected/agenda");
}

export async function updateTaskStatusAction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const dealId = String(formData.get("deal_id") ?? "").trim();
  if (!id || !status) throw new Error("ID et statut obligatoires.");
  const { error } = await supabase.from("tasks").update({ task_status: status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/protected/agenda");
  if (dealId) revalidatePath(`/protected/dossiers/${dealId}`);
  revalidatePath("/protected/dossiers");
}

export async function updateDealStageAction(formData: FormData) {
  const supabase = await createClient();
  const dealId = String(formData.get("deal_id") ?? "").trim();
  const stage = String(formData.get("stage") ?? "").trim();
  if (!dealId || !stage) throw new Error("ID et étape obligatoires.");
  const { error } = await supabase.from("deals").update({ deal_stage: stage }).eq("id", dealId);
  if (error) throw new Error(error.message);
  revalidatePath(`/protected/dossiers/${dealId}`);
}
