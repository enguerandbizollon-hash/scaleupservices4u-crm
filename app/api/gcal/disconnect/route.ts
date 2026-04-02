import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "401" }, { status: 401 });

  await supabase
    .from("user_settings")
    .update({
      gcal_access_token: null,
      gcal_refresh_token: null,
      gcal_token_expiry: null,
    })
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
