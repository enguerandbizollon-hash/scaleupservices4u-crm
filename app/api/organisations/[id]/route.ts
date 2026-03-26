import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();

  // Validate investor_sectors max 3
  if (Array.isArray(body.investor_sectors) && body.investor_sectors.length > 3) {
    return NextResponse.json({ error: "Un fonds peut sélectionner au maximum 3 secteurs d'investissement" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined)               updates.name = body.name?.trim() || null;
  if (body.organization_type !== undefined)  updates.organization_type = body.organization_type || "other";
  if (body.base_status !== undefined)        updates.base_status = body.base_status || "to_qualify";
  if (body.sector !== undefined)             updates.sector = body.sector?.trim() || null;
  if (body.location !== undefined)           updates.location = body.location?.trim() || null;
  if (body.website !== undefined)            updates.website = body.website?.trim() || null;
  if (body.linkedin_url !== undefined)       updates.linkedin_url = body.linkedin_url?.trim() || null;
  if (body.notes !== undefined)              updates.notes = body.notes?.trim() || null;
  if (body.description !== undefined)        updates.description = body.description?.trim() || null;
  // Legacy text fields
  if (body.investment_ticket !== undefined)  updates.investment_ticket = body.investment_ticket?.trim() || null;
  if (body.investment_stage !== undefined)   updates.investment_stage = body.investment_stage?.trim() || null;
  // New structured investor fields
  if (body.investor_ticket_min !== undefined) updates.investor_ticket_min = body.investor_ticket_min ?? null;
  if (body.investor_ticket_max !== undefined) updates.investor_ticket_max = body.investor_ticket_max ?? null;
  if (body.investor_sectors !== undefined)    updates.investor_sectors = Array.isArray(body.investor_sectors) ? body.investor_sectors : null;
  if (body.investor_stages !== undefined)     updates.investor_stages = Array.isArray(body.investor_stages) ? body.investor_stages : null;
  if (body.investor_geographies !== undefined) updates.investor_geographies = Array.isArray(body.investor_geographies) ? body.investor_geographies : null;
  if (body.investor_thesis !== undefined)     updates.investor_thesis = body.investor_thesis?.trim() || null;

  const { error } = await supabase.from("organizations").update(updates).eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
