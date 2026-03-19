import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.access_token;
  if (!token) return NextResponse.json({ error: "Non connecté à Google" }, { status: 401 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const now = new Date().toISOString();
  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${in30}&singleEvents=true&orderBy=startTime&maxResults=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const gcal = await res.json();
  if (gcal.error) return NextResponse.json({ error: gcal.error.message }, { status: 500 });

  let imported = 0;
  const errors: string[] = [];

  for (const item of gcal.items ?? []) {
    if (!item.summary) continue;
    const startsAt = item.start?.dateTime ?? item.start?.date;
    const endsAt = item.end?.dateTime ?? item.end?.date;
    const meetLink = item.hangoutLink ?? item.conferenceData?.entryPoints?.[0]?.uri ?? null;

    const { error } = await supabase.from("agenda_events").insert({
      title: item.summary,
      description: item.description ?? null,
      location: item.location ?? null,
      starts_at: startsAt,
      ends_at: endsAt ?? null,
      meet_link: meetLink,
      event_type: item.hangoutLink ? "meeting" : "other",
      status: "open",
      deal_id: null,      // ← optionnel, pas de dossier associé par défaut
      user_id: user.id,
    });

    if (error) {
      errors.push(`${item.summary}: ${error.message}`);
    } else {
      imported++;
    }
  }

  return NextResponse.json({ imported, errors, total: gcal.items?.length ?? 0 });
}
