"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Actions du flux de signaux (v66). Lecture/update ouverts à l'authentifié
// (policies v66) ; l'ingestion reste réservée au cron via service role.

export async function markSignalRead(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase
    .from("signaux")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/protected/signaux");
  return { success: true };
}

export async function markAllSignalsRead(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase
    .from("signaux")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  if (error) return { success: false, error: error.message };
  revalidatePath("/protected/signaux");
  return { success: true };
}
