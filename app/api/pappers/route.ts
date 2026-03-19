import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().replace(/\s/g, "");
  const key = process.env.PAPPERS_API_KEY;

  if (!key) return NextResponse.json({ error: "Clé Pappers manquante dans .env.local" }, { status: 500 });
  if (!q) return NextResponse.json({ resultats: [] });

  try {
    // Toujours utiliser /recherche (gratuit) — fonctionne avec nom ET SIRET/SIREN
    const url = `https://api.pappers.fr/v2/recherche?q=${encodeURIComponent(q)}&api_token=${key}&nombre=10`;
    const res = await fetch(url);
    const data = await res.json();

    console.log("[Pappers] query:", q, "status:", res.status, "resultats:", data.resultats?.length ?? 0);

    if (res.status === 401) {
      return NextResponse.json({ error: "Clé API Pappers invalide ou expirée", resultats: [] }, { status: 401 });
    }

    const resultats = data.resultats ?? data.entreprises ?? [];
    return NextResponse.json({ resultats, total: data.total ?? resultats.length });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
