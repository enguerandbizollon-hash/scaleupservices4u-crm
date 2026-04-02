"use server";

import { createClient } from "@/lib/supabase/server";

export async function getGCalStatus(): Promise<{ connected: boolean; email?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { connected: false };

  const { data } = await supabase
    .from("user_settings")
    .select("gcal_access_token, gcal_email")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    connected: !!data?.gcal_access_token,
    email: (data as any)?.gcal_email ?? undefined,
  };
}
