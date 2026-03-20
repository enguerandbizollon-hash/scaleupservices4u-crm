import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: dealId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const orgIds: string[] = body.org_ids ?? [];

  if (!orgIds.length) return NextResponse.json({ linked: 0 });

  let linked = 0;
  for (const orgId of orgIds) {
    const { error } = await supabase.from("deal_organizations").upsert({
      deal_id: dealId,
      organization_id: orgId,
      user_id: user.id,
    }, { onConflict: "deal_id,organization_id", ignoreDuplicates: true });
    if (!error) linked++;
  }

  return NextResponse.json({ linked });
}
