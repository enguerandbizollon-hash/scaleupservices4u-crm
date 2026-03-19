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

  // Réception : liste des events sélectionnés + deal_id optionnel
  const { events, deal_id } = await req.json() as {
    events: Array<{
      id: string; title: string; starts_at: string; ends_at: string | null;
      location: string | null; meet_link: string | null; description: string | null; event_type: string;
    }>;
    deal_id?: string | null;
  };

  if (!events?.length) return NextResponse.json({ imported: 0, errors: [] });

  let imported = 0;
  const errors: string[] = [];

  for (const item of events) {
    const { error } = await supabase.from("agenda_events").insert({
      title: item.title,
      description: item.description ?? null,
      location: item.location ?? null,
      starts_at: item.starts_at,
      ends_at: item.ends_at ?? null,
      meet_link: item.meet_link ?? null,
      event_type: item.event_type,
      status: "open",
      deal_id: deal_id ?? null,
      user_id: user.id,
    });

    if (error) errors.push(`${item.title}: ${error.message}`);
    else imported++;
  }

  return NextResponse.json({ imported, errors, total: events.length });
}
