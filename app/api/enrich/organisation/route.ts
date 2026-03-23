import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { org_id, org_name } = await req.json();
  if (!org_id && !org_name) return NextResponse.json({ error: "org_id ou org_name requis" }, { status: 400 });

  const key = process.env.PAPPERS_API_KEY;
  if (!key) return NextResponse.json({ error: "Clé Pappers manquante dans .env.local" }, { status: 500 });

  // Récupérer le nom de l'org si seulement l'id est fourni
  let name = org_name;
  if (!name && org_id) {
    const { data: org } = await supabase.from("organizations").select("name").eq("id", org_id).single();
    name = org?.name;
  }
  if (!name) return NextResponse.json({ error: "Nom d'organisation introuvable" }, { status: 404 });

  // Appel Pappers
  const url = `https://api.pappers.fr/v2/recherche?q=${encodeURIComponent(name)}&api_token=${key}&nombre=1`;
  const res = await fetch(url);
  if (!res.ok) return NextResponse.json({ error: `Pappers erreur ${res.status}` }, { status: 502 });

  const data = await res.json();
  const resultats = data.resultats ?? [];
  if (!resultats.length) return NextResponse.json({ found: false, message: "Aucun résultat Pappers" });

  const r = resultats[0];

  // Données extraites
  const enriched: Record<string, any> = {};
  if (r.siren)           enriched.siren        = r.siren;
  if (r.siret)           enriched.siret        = r.siret;
  if (r.forme_juridique) enriched.legal_form   = r.forme_juridique;
  if (r.ville)           enriched.location     = `${r.ville}${r.code_postal ? ` (${r.code_postal})` : ""}`;
  if (r.site_internet)   enriched.website      = r.site_internet;
  if (r.tranche_effectif) {
    const eff: Record<string, string> = {
      "00":"0","01":"1-2","02":"3-5","03":"6-9","11":"10-19","12":"20-49",
      "21":"50-99","22":"100-199","31":"200-249","32":"250-499","41":"500-999",
      "42":"1000-1999","51":"2000-4999","52":"5000-9999","53":"+10000"
    };
    enriched.employee_count = eff[r.tranche_effectif] ?? r.tranche_effectif;
  }
  if (r.chiffre_affaires) enriched.revenue = r.chiffre_affaires;

  // Stocker dans notes enrichies si pas de colonnes dédiées
  const notesParts = [];
  if (enriched.siren)          notesParts.push(`SIREN: ${enriched.siren}`);
  if (enriched.siret)          notesParts.push(`SIRET: ${enriched.siret}`);
  if (enriched.legal_form)     notesParts.push(`Forme: ${enriched.legal_form}`);
  if (enriched.employee_count) notesParts.push(`Effectif: ${enriched.employee_count}`);
  if (enriched.revenue)        notesParts.push(`CA: ${(enriched.revenue/1000000).toFixed(1)}M€`);

  // Mettre à jour l'organisation
  const updates: Record<string, any> = {};
  if (enriched.location && !await hasValue(supabase, org_id, "location")) updates.location = enriched.location;
  if (enriched.website  && !await hasValue(supabase, org_id, "website"))  updates.website  = enriched.website;
  if (notesParts.length) {
    const { data: existing } = await supabase.from("organizations").select("notes").eq("id", org_id).single();
    const existingNotes = existing?.notes ?? "";
    const enrichNote = `[Pappers] ${notesParts.join(" | ")}`;
    if (!existingNotes.includes("[Pappers]")) {
      updates.notes = existingNotes ? `${existingNotes}\n${enrichNote}` : enrichNote;
    }
  }

  if (Object.keys(updates).length && org_id) {
    await supabase.from("organizations").update(updates).eq("id", org_id);
  }

  return NextResponse.json({
    found: true,
    data: enriched,
    updated: Object.keys(updates),
    pappers: {
      nom: r.nom_entreprise,
      siren: r.siren,
      forme: r.forme_juridique,
      ville: r.ville,
      effectif: enriched.employee_count,
      ca: enriched.revenue,
    }
  });
}

async function hasValue(supabase: any, id: string, field: string): Promise<boolean> {
  if (!id) return false;
  const { data } = await supabase.from("organizations").select(field).eq("id", id).single();
  return !!data?.[field];
}
