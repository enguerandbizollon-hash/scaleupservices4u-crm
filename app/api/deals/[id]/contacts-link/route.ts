import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { contact_id, organization_id, role_label } = await req.json();
  if (!contact_id || !organization_id) return NextResponse.json({ error: "contact_id et organization_id requis" }, { status: 400 });

  await supabase.from("deal_organizations").upsert(
    { deal_id: id, organization_id, user_id: user.id },
    { onConflict: "deal_id,organization_id", ignoreDuplicates: true }
  );

  const { error } = await supabase.from("organization_contacts").upsert(
    { organization_id, contact_id, role_label: role_label || null, is_primary: false, user_id: user.id },
    { onConflict: "organization_id,contact_id", ignoreDuplicates: true }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
