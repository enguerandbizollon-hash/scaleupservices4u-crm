import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "Nom requis" }, { status: 400 });

  const { data, error } = await supabase.from("deal_documents").insert({
    deal_id:       id,
    user_id:       user.id,
    name:          body.name,
    document_url:  body.document_url || null,
    version_label: body.version_label || null,
    document_type: "other",
    document_status: "received",
    added_at: new Date().toISOString(),
  }).select("id,name,document_type,document_status,document_url,version_label,added_at").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { document_id } = await req.json();
  const { error } = await supabase.from("deal_documents").delete()
    .eq("id", document_id).eq("deal_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
