import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().replace(/\s/g, "");
  const key = process.env.PAPPERS_API_KEY;

  if (!key) return NextResponse.json({ error: "Clé Pappers manquante" }, { status: 500 });
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

    // /entreprise retourne un objet unique — on normalise en tableau
    if (isSiret || isSiren) {
      if (data.nom_entreprise) return NextResponse.json({ resultats: [data] });
      return NextResponse.json({ resultats: [], message: data.message ?? "Entreprise non trouvée" });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
