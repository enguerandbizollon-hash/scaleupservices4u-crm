import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.access_token;
  if (!token) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const now = new Date().toISOString();
  const in60 = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${in60}&singleEvents=true&orderBy=startTime&maxResults=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (data.error) return NextResponse.json({ error: data.error.message }, { status: 500 });

  const events = (data.items ?? []).map((e: any) => ({
    id: e.id,
    title: e.summary,
    starts_at: e.start?.dateTime ?? e.start?.date,
    ends_at: e.end?.dateTime ?? e.end?.date,
    location: e.location ?? null,
    meet_link: e.hangoutLink ?? e.conferenceData?.entryPoints?.[0]?.uri ?? null,
    description: e.description ?? null,
    event_type: e.hangoutLink ? "meeting" : "other",
  }));

  return NextResponse.json({ events });
}
