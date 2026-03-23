import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const body = await req.json();
  const { data, error } = await supabase.from("activities").insert({
    deal_id: id, user_id: user.id,
    title: body.title,
    activity_type: body.activity_type || "email",
    activity_date: body.activity_date || new Date().toISOString().split("T")[0],
    summary: body.summary || null,
    organization_id: body.organization_id || null,
    contact_id: body.contact_id || null,
  }).select("id,title,activity_type,activity_date,summary,organization_id,contact_id,organizations(name),contacts(first_name,last_name)").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { activity_id, ...updates } = await req.json();
  const { data, error } = await supabase.from("activities")
    .update(updates).eq("id", activity_id).eq("deal_id", id)
    .select("id,title,activity_type,activity_date,summary,organization_id,contact_id,organizations(name),contacts(first_name,last_name)").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { activity_id } = await req.json();
  const { error } = await supabase.from("activities").delete().eq("id", activity_id).eq("deal_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
