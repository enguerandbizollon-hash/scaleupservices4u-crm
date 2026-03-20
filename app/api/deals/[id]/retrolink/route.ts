import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: dealId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data: deal } = await supabase.from("deals").select("id,name").eq("id", dealId).maybeSingle();
  if (!deal) return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });

  const orgIds = new Set<string>();

  // SOURCE 1 : deal_name_hint sur les organisations (le plus fiable — stocké à l'import)
  const { data: orgsHint } = await supabase
    .from("organizations")
    .select("id")
    .ilike("deal_name_hint", `%${deal.name}%`)
    .eq("user_id", user.id);
  for (const o of orgsHint ?? []) orgIds.add(o.id);

  // SOURCE 2 : activités déjà liées au dossier
  const { data: acts } = await supabase
    .from("activities").select("organization_id")
    .eq("deal_id", dealId).not("organization_id", "is", null);
  for (const a of acts ?? []) if (a.organization_id) orgIds.add(a.organization_id);

  // SOURCE 3 : contacts dont les notes mentionnent le dossier → leurs orgs
  const { data: contacts } = await supabase
    .from("contacts")
    .select("organization_contacts(organization_id)")
    .ilike("notes", `%${deal.name}%`)
    .eq("user_id", user.id);
  for (const c of contacts ?? []) {
    for (const oc of (c.organization_contacts as any[]) ?? []) {
      if (oc.organization_id) orgIds.add(oc.organization_id);
    }
  }

  // Enlever les orgs déjà liées
  const { data: alreadyLinked } = await supabase
    .from("deal_organizations").select("organization_id").eq("deal_id", dealId);
  const alreadySet = new Set((alreadyLinked ?? []).map((r: any) => r.organization_id));
  const toLink = [...orgIds].filter(id => !alreadySet.has(id));

  // Créer les nouvelles liaisons
  let linked = 0;
  for (const orgId of toLink) {
    const { error } = await supabase.from("deal_organizations").insert({
      deal_id: dealId, organization_id: orgId, user_id: user.id,
    });
    if (!error) linked++;
  }

  const { count } = await supabase
    .from("deal_organizations").select("*", { count:"exact", head:true }).eq("deal_id", dealId);

  return NextResponse.json({ linked, already: alreadySet.size, total: count ?? 0 });
}
