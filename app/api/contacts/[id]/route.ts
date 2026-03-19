import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await req.json();

  const { error } = await supabase.from("contacts").update({
    first_name: body.first_name?.trim() || null,
    last_name: body.last_name?.trim() || null,
    email: body.email?.trim() || null,
    phone: body.phone?.trim() || null,
    title: body.title?.trim() || null,
    sector: body.sector?.trim() || null,
    linkedin_url: body.linkedin_url?.trim() || null,
    base_status: body.base_status || "to_qualify",
    notes: body.notes?.trim() || null,
  }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
