// Import d'un résultat Pappers en organisation CRM.
// Réparé au temps 3 (phase 2) : dédup par SIREN D'ABORD (colonne v64, la
// version précédente dédupliquait par nom approximatif et rangeait le SIREN
// en texte dans les notes), colonnes structurées siren/naf/sector.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sectorFromNaf } from "@/lib/crm/matching-maps";
import type { PappersSearchResult } from "@/lib/connectors/pappers";

function ns(v: unknown): string | null {
  const s = String(v ?? "").trim(); return s || null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { result } = await req.json() as { result?: PappersSearchResult };
  if (!result?.nom_entreprise) return NextResponse.json({ error: "Données manquantes" }, { status: 400 });

  const siren = String(result.siren ?? "").replace(/\D/g, "");
  const hasSiren = /^\d{9}$/.test(siren);

  // Dédup : SIREN d'abord (fiable), nom en secours (héritage).
  if (hasSiren) {
    const { data: existing } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("siren", siren)
      .maybeSingle();
    if (existing) return NextResponse.json({ error: "duplicate", id: existing.id, name: existing.name }, { status: 409 });
  }
  {
    const { data: existing } = await supabase
      .from("organizations")
      .select("id, name")
      .ilike("name", result.nom_entreprise)
      .limit(1)
      .maybeSingle();
    if (existing) return NextResponse.json({ error: "duplicate", id: existing.id, name: existing.name }, { status: 409 });
  }

  const naf = ns(result.code_naf);
  const foundedYear = result.date_creation ? parseInt(String(result.date_creation).slice(0, 4), 10) : NaN;

  // Compléments non structurés en notes (le structurel va dans ses colonnes).
  const noteLines = [
    result.forme_juridique ? `Forme juridique: ${result.forme_juridique}` : null,
    typeof result.chiffre_affaires === "number" ? `CA: ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(result.chiffre_affaires)}` : null,
    typeof result.resultat === "number" ? `Résultat: ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(result.resultat)}` : null,
    result.effectif ? `Effectif: ${result.effectif}` : null,
    result.dirigeants?.length ? `Dirigeants: ${result.dirigeants.slice(0, 5).map((d) => `${d.prenom ?? ""} ${d.nom ?? ""} (${d.qualite ?? ""})`.trim()).join(", ")}` : null,
  ].filter(Boolean).join("\n");

  const ville = result.siege?.ville ?? result.ville;
  const adresse = result.siege
    ? [result.siege.adresse_ligne_1, result.siege.code_postal, result.siege.ville].filter(Boolean).join(" ")
    : null;

  const { data: org, error } = await supabase.from("organizations").insert({
    user_id: user.id,
    name: result.nom_entreprise,
    organization_type: "other",
    base_status: "to_qualify",
    siren: hasSiren ? siren : null,
    naf,
    sector: (naf ? sectorFromNaf(naf) : null) ?? ns(result.domaine_activite),
    location: ns(adresse) ?? ns(ville),
    country: "France",
    website: ns(result.site_internet),
    founded_year: Number.isFinite(foundedYear) ? foundedYear : null,
    notes: noteLines || null,
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, id: org.id, name: result.nom_entreprise });
}
