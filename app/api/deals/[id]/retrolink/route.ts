import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: dealId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data: deal } = await supabase
    .from("deals").select("id, name").eq("id", dealId).maybeSingle();
  if (!deal) return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });

  const orgIds = new Set<string>();

  // 1. Orgs dont les notes ou la description mentionnent le nom du dossier
  const { data: orgsFromNotes } = await supabase
    .from("organizations")
    .select("id")
    .or(`notes.ilike.%${deal.name}%,description.ilike.%${deal.name}%`)
    .eq("user_id", user.id);
  for (const o of orgsFromNotes ?? []) orgIds.add(o.id);

  // 2. Contacts dont les notes mentionnent le dossier → leurs orgs
  const { data: contactsFromNotes } = await supabase
    .from("contacts")
    .select("id, organization_contacts(organization_id)")
    .ilike("notes", `%${deal.name}%`)
    .eq("user_id", user.id);
  for (const c of contactsFromNotes ?? []) {
    for (const oc of (c.organization_contacts as any[]) ?? []) {
      if (oc.organization_id) orgIds.add(oc.organization_id);
    }
  }

  // 3. Activités déjà liées → leurs orgs
  const { data: acts } = await supabase
    .from("activities").select("organization_id")
    .eq("deal_id", dealId).not("organization_id", "is", null);
  for (const a of acts ?? []) if (a.organization_id) orgIds.add(a.organization_id);

  // 4. Orgs déjà dans deal_organizations (recalcul)
  const { data: existing } = await supabase
    .from("deal_organizations").select("organization_id").eq("deal_id", dealId);
  for (const e of existing ?? []) orgIds.delete(e.organization_id); // déjà liées

  // 5. Créer les nouvelles liaisons
  let linked = 0;
  for (const orgId of orgIds) {
    const { error } = await supabase.from("deal_organizations").insert({
      deal_id: dealId, organization_id: orgId, user_id: user.id,
    });
    if (!error) linked++;
  }

  // Total après synchro
  const { count } = await supabase
    .from("deal_organizations").select("*", { count: "exact", head: true }).eq("deal_id", dealId);

  return NextResponse.json({ linked, total: count ?? 0 });
}
