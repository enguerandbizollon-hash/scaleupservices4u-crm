import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().replace(/\s/g, "");
  const key = process.env.PAPPERS_API_KEY;

  if (!key) return NextResponse.json({ error: "Clé Pappers manquante dans .env.local" }, { status: 500 });
  if (!q) return NextResponse.json({ resultats: [] });

  try {
    const isSiret = /^\d{14}$/.test(q);
    const isSiren = /^\d{9}$/.test(q);

    let url: string;
    if (isSiret) {
      url = `https://api.pappers.fr/v2/entreprise?siret=${q}&api_token=${key}`;
    } else if (isSiren) {
      url = `https://api.pappers.fr/v2/entreprise?siren=${q}&api_token=${key}`;
    } else {
      url = `https://api.pappers.fr/v2/recherche?q=${encodeURIComponent(q)}&api_token=${key}&nombre=10`;
    }

    const res = await fetch(url);
    const data = await res.json();

    // Log pour debug
    console.log("[Pappers] query:", q, "type:", isSiret?"siret":isSiren?"siren":"nom", "status:", res.status);
    if (data.error || data.message) console.log("[Pappers] error:", data.error ?? data.message);

    // Entreprise unique (SIRET/SIREN)
    if (isSiret || isSiren) {
      if (data.nom_entreprise) return NextResponse.json({ resultats: [data] });
      // Essayer aussi avec recherche par nom si SIRET ne trouve rien
      return NextResponse.json({ 
        resultats: [], 
        debug: { status: res.status, message: data.message ?? data.error ?? "Entreprise non trouvée", query: q }
      });
    }

    // Recherche par nom — normaliser si Pappers retourne resultats ou entreprises
    const resultats = data.resultats ?? data.entreprises ?? [];
    return NextResponse.json({ resultats, total: data.total ?? resultats.length });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
