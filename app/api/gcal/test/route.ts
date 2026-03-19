import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.access_token;
  if (!token) return NextResponse.json({ error: "Non connecté", session_exists: !!session }, { status: 401 });

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=3&singleEvents=true&orderBy=startTime&timeMin=" + new Date().toISOString(),
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return NextResponse.json({
    token_ok: true,
    calendar_status: res.status,
    events_count: data.items?.length ?? 0,
    error: data.error ?? null,
  });
}
