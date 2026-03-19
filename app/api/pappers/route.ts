import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const siret = searchParams.get("siret");
  const key = process.env.PAPPERS_API_KEY;
  if (!key) return NextResponse.json({ error: "Clé Pappers manquante" }, { status: 500 });

  try {
    // Recherche par nom ou SIRET
    const url = siret
      ? `https://api.pappers.fr/v2/entreprise?siret=${siret}&api_token=${key}`
      : `https://api.pappers.fr/v2/recherche?q=${encodeURIComponent(q ?? "")}&api_token=${key}`;

    const res = await fetch(url);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
