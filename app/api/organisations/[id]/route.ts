import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await req.json();

  const updates: Record<string, any> = {};
  if (body.name !== undefined)              updates.name = body.name?.trim() || null;
  if (body.organization_type !== undefined) updates.organization_type = body.organization_type || "other";
  if (body.base_status !== undefined)       updates.base_status = body.base_status || "to_qualify";
  if (body.sector !== undefined)            updates.sector = body.sector?.trim() || null;
  if (body.location !== undefined)          updates.location = body.location?.trim() || null;
  if (body.country !== undefined)           updates.country = body.location?.trim() || body.country?.trim() || null;
  if (body.website !== undefined)           updates.website = body.website?.trim() || null;
  if (body.notes !== undefined)             updates.notes = body.notes?.trim() || null;
  if (body.investment_ticket !== undefined) updates.investment_ticket = body.investment_ticket?.trim() || null;
  if (body.investment_stage !== undefined)  updates.investment_stage = body.investment_stage?.trim() || null;
  if (body.description !== undefined)       updates.description = body.description?.trim() || null;

  const { error } = await supabase.from("organizations").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
