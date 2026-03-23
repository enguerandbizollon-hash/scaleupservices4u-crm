import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const body = await req.json();
  const { data, error } = await supabase.from("investor_commitments").insert({
    deal_id: id, user_id: user.id,
    organization_id: body.organization_id || null,
    amount: body.amount ? Number(body.amount) : null,
    currency: body.currency || "EUR",
    status: body.status || "indication",
    committed_at: body.committed_at || null,
    notes: body.notes || null,
  }).select("id,amount,currency,status,committed_at,notes,organization_id,organizations(name)").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { commitment_id, ...updates } = await req.json();
  if (!commitment_id) return NextResponse.json({ error: "commitment_id requis" }, { status: 400 });
  if (updates.amount) updates.amount = Number(updates.amount);
  const { data, error } = await supabase.from("investor_commitments")
    .update(updates).eq("id", commitment_id).eq("deal_id", id)
    .select("id,amount,currency,status,committed_at,notes,organization_id,organizations(name)").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { commitment_id } = await req.json();
  const { error } = await supabase.from("investor_commitments")
    .delete().eq("id", commitment_id).eq("deal_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
