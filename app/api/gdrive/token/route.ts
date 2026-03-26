import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Retourne le token Google (calendar+drive) au client pour le Picker
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: settings } = await supabase
    .from("user_settings")
    .select("gcal_access_token, gcal_token_expiry")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!settings?.gcal_access_token) {
    return NextResponse.json({ error: "Google non connecté" }, { status: 403 });
  }

  // Vérifier l'expiration (refresh si besoin)
  const expiry = settings.gcal_token_expiry ? new Date(settings.gcal_token_expiry) : null;
  const isExpired = expiry ? expiry.getTime() - Date.now() < 60_000 : false;

  if (isExpired) {
    // Tenter un refresh
    const { data: fullSettings } = await supabase
      .from("user_settings")
      .select("gcal_refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fullSettings?.gcal_refresh_token) {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id:     process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: fullSettings.gcal_refresh_token,
          grant_type:    "refresh_token",
        }),
      });
      const tokens = await res.json();
      if (tokens.access_token) {
        await supabase.from("user_settings").update({
          gcal_access_token: tokens.access_token,
          gcal_token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        }).eq("user_id", user.id);
        return NextResponse.json({ access_token: tokens.access_token });
      }
    }
    return NextResponse.json({ error: "Token expiré, reconnectez Google" }, { status: 403 });
  }

  return NextResponse.json({ access_token: settings.gcal_access_token });
}
