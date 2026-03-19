import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await req.json();

  const { error } = await supabase.from("organizations").update({
    name: body.name?.trim() || null,
    organization_type: body.organization_type || "other",
    base_status: body.base_status || "to_qualify",
    sector: body.sector?.trim() || null,
    country: body.country?.trim() || null,
    website: body.website?.trim() || null,
    notes: body.notes?.trim() || null,
  }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
