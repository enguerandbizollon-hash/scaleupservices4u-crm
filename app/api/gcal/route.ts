import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  const token = (session as any)?.access_token;
  if (!token) return NextResponse.json({ error: "Non connecté à Google" }, { status: 401 });

  const now = new Date().toISOString();
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${future}&singleEvents=true&orderBy=startTime&maxResults=20`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  const token = (session as any)?.access_token;
  if (!token) return NextResponse.json({ error: "Non connecté à Google" }, { status: 401 });

  const { summary, description, start, end, attendees } = await req.json();

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary, description,
        start: { dateTime: start, timeZone: "Europe/Paris" },
        end:   { dateTime: end,   timeZone: "Europe/Paris" },
        attendees: attendees?.map((e: string) => ({ email: e })) ?? [],
        conferenceData: { createRequest: { requestId: Math.random().toString() } },
      }),
    }
  );
  const data = await res.json();
  return NextResponse.json(data);
}
