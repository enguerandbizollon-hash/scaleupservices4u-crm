import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidToken, createGCalEvent, updateGCalEvent, deleteGCalEvent } from "@/lib/gcal/gcal-client";

const TABLE_MAP: Record<string, { table: string; col: string }> = {
  activity:        { table: "actions",        col: "gcal_event_id" },
  task:            { table: "tasks",          col: "gcal_event_id" },
  deal_relance:    { table: "deals",          col: "gcal_relance_event_id" },
  deal_closing:    { table: "deals",          col: "gcal_closing_event_id" },
  mandate_closing: { table: "mandates",       col: "gcal_closing_event_id" },
  fee_milestone:   { table: "fee_milestones", col: "gcal_event_id" },
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "401" }, { status: 401 });

  const { action, source_type, source_id, event } = await req.json();

  const token = await getValidToken(user.id);
  if (!token) return NextResponse.json({ synced: false, reason: "not_connected" });

  const mapping = TABLE_MAP[source_type];
  if (!mapping) return NextResponse.json({ error: "unknown source_type" }, { status: 400 });

  // Récupérer gcal_event_id existant (avec ownership check)
  const { data: record } = await supabase
    .from(mapping.table)
    .select(`${mapping.col}`)
    .eq("id", source_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const existingGcalId = (record as unknown as Record<string, unknown>)?.[mapping.col] as string | null ?? null;

  if (action === "create" || (action === "update" && !existingGcalId)) {
    const gcalId = await createGCalEvent(token, event);
    if (gcalId) {
      await supabase.from(mapping.table).update({ [mapping.col]: gcalId }).eq("id", source_id).eq("user_id", user.id);
    }
    return NextResponse.json({ synced: !!gcalId, gcal_event_id: gcalId });
  }

  if (action === "update" && existingGcalId) {
    await updateGCalEvent(token, existingGcalId, event);
    return NextResponse.json({ synced: true });
  }

  if (action === "delete" && existingGcalId) {
    await deleteGCalEvent(token, existingGcalId);
    await supabase.from(mapping.table).update({ [mapping.col]: null }).eq("id", source_id).eq("user_id", user.id);
    return NextResponse.json({ synced: true });
  }

  return NextResponse.json({ synced: false, reason: "no_action" });
}
