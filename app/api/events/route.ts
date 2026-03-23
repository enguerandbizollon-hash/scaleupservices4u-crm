import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dealId = searchParams.get("deal_id");
  const contactId = searchParams.get("contact_id");
  const orgId = searchParams.get("org_id");
  const status = searchParams.get("status") ?? "open";

  let q = supabase.from("events")
    .select("id,title,event_type,status,due_date,reminder_date,notes,deal_id,organization_id,contact_id,deals(name),organizations(name),contacts(first_name,last_name)")
    .eq("user_id", user.id)
    .eq("status", status)
    .order("due_date", { ascending: true });

  if (dealId) q = q.eq("deal_id", dealId);
  if (contactId) q = q.eq("contact_id", contactId);
  if (orgId) q = q.eq("organization_id", orgId);

  const { data, error } = await q.limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  if (!body.title || !body.due_date) return NextResponse.json({ error: "Titre et date requis" }, { status: 400 });

  const { data, error } = await supabase.from("events").insert({
    title:           body.title,
    event_type:      body.event_type || "follow_up",
    status:          "open",
    due_date:        body.due_date,
    reminder_date:   body.reminder_date || null,
    notes:           body.notes || null,
    deal_id:         body.deal_id || null,
    organization_id: body.organization_id || null,
    contact_id:      body.contact_id || null,
    user_id:         user.id,
  }).select("id,title,event_type,status,due_date,reminder_date,notes,deal_id,organization_id,contact_id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  if (updates.status === "done") (updates as any).completed_at = new Date().toISOString();

  const { data, error } = await supabase.from("events")
    .update(updates).eq("id", id).eq("user_id", user.id)
    .select("id,title,event_type,status,due_date,reminder_date,notes").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await req.json();
  const { error } = await supabase.from("events").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
