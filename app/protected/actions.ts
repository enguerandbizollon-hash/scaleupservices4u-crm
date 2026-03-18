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
