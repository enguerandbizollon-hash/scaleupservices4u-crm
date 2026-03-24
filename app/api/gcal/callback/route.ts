import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Code manquant" }, { status: 400 });

  const clientId     = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri  = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/gcal/callback`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id:clientId, client_secret:clientSecret, redirect_uri:redirectUri, grant_type:"authorization_code" }),
  });
  const tokens = await res.json();
  if (!tokens.access_token) return NextResponse.json({ error: "Échec OAuth", detail: tokens }, { status: 500 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("user_settings").upsert({
      user_id:            user.id,
      gcal_access_token:  tokens.access_token,
      gcal_refresh_token: tokens.refresh_token ?? null,
      gcal_token_expiry:  tokens.expires_in ? new Date(Date.now() + tokens.expires_in*1000).toISOString() : null,
    }, { onConflict: "user_id" });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return NextResponse.redirect(`${appUrl}/protected/connecteurs?gcal=success`);
}
