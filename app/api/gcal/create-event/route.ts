import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getAccessToken(userId: string, supabase: any): Promise<string|null> {
  const { data: s } = await supabase.from("user_settings")
    .select("gcal_access_token,gcal_refresh_token,gcal_token_expiry")
    .eq("user_id", userId).maybeSingle();
  if (!s?.gcal_access_token) return null;

  // Token valide ?
  if (!s.gcal_token_expiry || new Date(s.gcal_token_expiry) > new Date()) return s.gcal_access_token;

  // Rafraîchir
  if (!s.gcal_refresh_token) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: s.gcal_refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const t = await res.json();
  if (!t.access_token) return null;
  await supabase.from("user_settings").update({
    gcal_access_token: t.access_token,
    gcal_token_expiry: new Date(Date.now() + t.expires_in*1000).toISOString(),
  }).eq("user_id", userId);
  return t.access_token;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { title, date, time, summary, attendee_emails } = await req.json();
  if (!title || !date) return NextResponse.json({ error: "Titre et date requis" }, { status: 400 });

  const token = await getAccessToken(user.id, supabase);
  if (!token) return NextResponse.json({ error: "Google Calendar non connecté", connect_url: "/api/gcal" }, { status: 403 });

  const tz   = "Europe/Paris";
  const t    = time || "09:00";
  const endH = String(Number(t.split(":")[0]) + (Number(t.split(":")[1]) >= 30 ? 1 : 0)).padStart(2,"0");
  const endM = String((Number(t.split(":")[1]) + 30) % 60).padStart(2,"0");

  const event: any = {
    summary:     title,
    description: summary || "",
    start: { dateTime: `${date}T${t}:00`, timeZone: tz },
    end:   { dateTime: `${date}T${endH}:${endM}:00`, timeZone: tz },
  };
  if (attendee_emails?.length) event.attendees = attendee_emails.map((e:string) => ({ email: e }));

  const gcalRes = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
    { method:"POST", headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" }, body:JSON.stringify(event) }
  );
  const data = await gcalRes.json();
  if (!gcalRes.ok) return NextResponse.json({ error: data.error?.message ?? "Erreur Google" }, { status: 500 });
  return NextResponse.json({ ok:true, html_link: data.htmlLink });
}
