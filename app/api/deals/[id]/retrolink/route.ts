import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: dealId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data: deal } = await supabase.from("deals").select("id, name").eq("id", dealId).maybeSingle();
  if (!deal) return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });

  const orgIds = new Set<string>();

  // 1. Contacts dont les notes mentionnent le nom du dossier
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, organization_contacts(organization_id)")
    .ilike("notes", `%${deal.name}%`)
    .eq("user_id", user.id);

  for (const c of contacts ?? []) {
    for (const oc of (c.organization_contacts as any[]) ?? []) {
      if (oc.organization_id) orgIds.add(oc.organization_id);
    }
  }

  // 2. Activités déjà liées au dossier
  const { data: acts } = await supabase
    .from("activities").select("organization_id")
    .eq("deal_id", dealId).not("organization_id", "is", null);
  for (const a of acts ?? []) orgIds.add(a.organization_id);

  // 3. Créer les liaisons
  let linked = 0;
  for (const orgId of orgIds) {
    const { error } = await supabase.from("deal_organizations").upsert({
      deal_id: dealId, organization_id: orgId, user_id: user.id,
    }, { onConflict: "deal_id,organization_id", ignoreDuplicates: true });
    if (!error) linked++;
  }

  return NextResponse.json({ linked, total: orgIds.size });
}
