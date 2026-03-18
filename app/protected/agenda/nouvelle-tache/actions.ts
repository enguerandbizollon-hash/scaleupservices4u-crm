"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function toNullableString(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str ? str : null;
}

export async function createTaskAction(formData: FormData) {
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Le titre est obligatoire.");

  const { data: { user } } = await supabase.auth.getUser();

  const payload = {
    title,
    description: toNullableString(formData.get("description")),
    task_status: String(formData.get("task_status") ?? "open").trim(),
    priority_level: String(formData.get("priority_level") ?? "medium").trim(),
    due_date: toNullableString(formData.get("due_date")),
    deal_id: toNullableString(formData.get("deal_id")),
    contact_id: toNullableString(formData.get("contact_id")),
    user_id: user?.id ?? null,
  };

  const { error } = await supabase.from("tasks").insert(payload);
  if (error) throw new Error(error.message);

  revalidatePath("/protected/agenda");
  redirect("/protected/agenda");
}
