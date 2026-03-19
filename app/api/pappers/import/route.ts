import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function ns(v: any): string | null {
  const s = String(v ?? "").trim(); return s || null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { result } = await req.json();
  if (!result?.nom_entreprise) return NextResponse.json({ error: "Données manquantes" }, { status: 400 });

  // Vérifier si l'organisation existe déjà (par SIREN ou nom)
  if (result.siren) {
    const { data: existing } = await supabase
      .from("organizations")
      .select("id, name")
      .ilike("name", result.nom_entreprise)
      .limit(1)
      .maybeSingle();
    if (existing) return NextResponse.json({ error: "duplicate", id: existing.id, name: existing.name }, { status: 409 });
  }

  // Construire les notes avec toutes les données Pappers
  const noteLines = [
    result.siren ? `SIREN: ${result.siren}` : null,
    result.siret ? `SIRET: ${result.siret}` : null,
    result.forme_juridique ? `Forme juridique: ${result.forme_juridique}` : null,
    result.date_creation ? `Création: ${result.date_creation}` : null,
    result.chiffre_affaires ? `CA: ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(result.chiffre_affaires)}` : null,
    result.resultat ? `Résultat: ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(result.resultat)}` : null,
    result.effectif ? `Effectif: ${result.effectif}` : null,
    result.dirigeants?.length ? `Dirigeants: ${result.dirigeants.slice(0, 5).map((d: any) => `${d.prenom ?? ""} ${d.nom ?? ""} (${d.qualite ?? ""})`.trim()).join(", ")}` : null,
  ].filter(Boolean).join("\n");

  const adresse = result.siege
    ? [result.siege.adresse_ligne_1, result.siege.code_postal, result.siege.ville].filter(Boolean).join(" ")
    : null;

  const { data: org, error } = await supabase.from("organizations").insert({
    name: result.nom_entreprise,
    organization_type: "other",
    base_status: "to_qualify",
    sector: ns(result.domaine_activite),
    country: "France",
    website: ns(result.site_web),
    notes: noteLines || null,
    user_id: user.id,
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, id: org.id, name: result.nom_entreprise });
}
