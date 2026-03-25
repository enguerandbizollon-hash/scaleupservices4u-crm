import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { type, ids } = await req.json() as { type: "organisations" | "contacts"; ids: string[] };
  if (!ids?.length) return NextResponse.json({ enriched: 0 });

  const key = process.env.PAPPERS_API_KEY;
  const hunterKey = process.env.HUNTER_API_KEY;
  let enriched = 0;

  if (type === "organisations" && key) {
    const { data: orgs } = await supabase.from("organizations")
      .select("id,name,location,website,notes").in("id", ids.slice(0,50))
      .not("notes","ilike","%[Pappers]%");

    for (const org of orgs ?? []) {
      try {
        const res = await fetch(`https://api.pappers.fr/v2/recherche?q=${encodeURIComponent(org.name)}&api_token=${key}&nombre=1`);
        if (!res.ok) continue;
        const data = await res.json();
        const r = data.resultats?.[0];
        if (!r) continue;

        const updates: Record<string,any> = {};
        if (!org.location && r.ville) updates.location = `${r.ville}${r.code_postal?` (${r.code_postal})`:""}`;
        if (!org.website && r.site_internet) updates.website = r.site_internet;

        const noteParts: string[] = [];
        if (r.siren) noteParts.push(`SIREN: ${r.siren}`);
        if (r.tranche_effectif) {
          const eff: Record<string,string> = {"00":"0","01":"1-2","02":"3-5","11":"10-19","12":"20-49","21":"50-99","22":"100-199"};
          noteParts.push(`Effectif: ${eff[r.tranche_effectif]??r.tranche_effectif}`);
        }
        if (r.chiffre_affaires) noteParts.push(`CA: ${(r.chiffre_affaires/1000000).toFixed(1)}M€`);

        if (noteParts.length) updates.notes = org.notes ? `${org.notes}\n[Pappers] ${noteParts.join(" | ")}` : `[Pappers] ${noteParts.join(" | ")}`;
        if (Object.keys(updates).length) { await supabase.from("organizations").update(updates).eq("id",org.id); enriched++; }
        await new Promise(r=>setTimeout(r,600));
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[Pappers batch enrichment error]", msg);
      }
  }

  if (type === "contacts" && hunterKey) {
    const { data: contacts } = await supabase.from("contacts")
      .select("id,first_name,last_name,email,organization_contacts(organizations(name,website))")
      .in("id",ids.slice(0,20)).is("email",null);

    for (const c of contacts??[]) {
      try {
        const orgs = (c.organization_contacts as any[])??[];
        const org = Array.isArray(orgs[0]?.organizations)?orgs[0].organizations[0]:orgs[0]?.organizations;
        if (!org?.website) continue;
        const domain = new URL(org.website.startsWith("http")?org.website:`https://${org.website}`).hostname.replace("www.","");
        const res = await fetch(`https://api.hunter.io/v2/email-finder?domain=${domain}&first_name=${encodeURIComponent(c.first_name)}&last_name=${encodeURIComponent(c.last_name)}&api_key=${hunterKey}`);
        const data = await res.json();
        if (data.data?.email) {
          const upd: Record<string,any> = {email:data.data.email};
          if (data.data.linkedin) upd.linkedin_url = data.data.linkedin;
          await supabase.from("contacts").update(upd).eq("id",c.id);
          enriched++;
        }
        await new Promise(r=>setTimeout(r,1000));
      } catch {}
    }
  }

  return NextResponse.json({ enriched, keys: { pappers: !!key, hunter: !!hunterKey } });
}
