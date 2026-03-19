import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  const token = (session as any)?.access_token;
  if (!token) return NextResponse.json({ error: "Non connecté à Google" }, { status: 401 });

  const supabase = await createClient();
  const today = new Date().toISOString();
  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: events } = await supabase
    .from("agenda_events")
    .select("id, title, description, starts_at, ends_at, location, meet_link")
    .eq("status", "open")
    .gte("starts_at", today)
    .lte("starts_at", in30);

  let synced = 0;
  const errors: string[] = [];

  for (const ev of events ?? []) {
    const gcalEvent = {
      summary: ev.title,
      description: ev.description ?? "",
      location: ev.location ?? "",
      start: { dateTime: ev.starts_at, timeZone: "Europe/Paris" },
      end: { dateTime: ev.ends_at ?? ev.starts_at, timeZone: "Europe/Paris" },
      ...(ev.meet_link ? { conferenceData: undefined } : {}),
    };

    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(gcalEvent),
    });
    const data = await res.json();
    if (data.error) errors.push(`${ev.title}: ${data.error.message}`);
    else synced++;
  }

  return NextResponse.json({ synced, errors, total: events?.length ?? 0 });
}
