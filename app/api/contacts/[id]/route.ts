import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await req.json();

  const updates: Record<string, any> = {};
  if (body.first_name !== undefined)      updates.first_name = body.first_name?.trim() || null;
  if (body.last_name !== undefined)       updates.last_name = body.last_name?.trim() || null;
  if (body.email !== undefined)           updates.email = body.email?.trim() || null;
  if (body.phone !== undefined)           updates.phone = body.phone?.trim() || null;
  if (body.title !== undefined)           updates.title = body.title?.trim() || null;
  if (body.sector !== undefined)          updates.sector = body.sector?.trim() || null;
  if (body.linkedin_url !== undefined)    updates.linkedin_url = body.linkedin_url?.trim() || null;
  if (body.base_status !== undefined)     updates.base_status = body.base_status;
  if (body.last_contact_date !== undefined) updates.last_contact_date = body.last_contact_date || null;
  if (body.notes !== undefined)           updates.notes = body.notes?.trim() || null;

  const { error } = await supabase.from("contacts").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
