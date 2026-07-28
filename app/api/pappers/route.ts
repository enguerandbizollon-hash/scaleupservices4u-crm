// Proxy de recherche Pappers (endpoint /recherche, gratuit dans le forfait).
// Logique déplacée dans lib/connectors/pappers.ts (phase 2, temps 3).

import { NextRequest, NextResponse } from "next/server";
import { searchPappers, isPappersConfigured } from "@/lib/connectors/pappers";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (!isPappersConfigured()) {
    return NextResponse.json({ error: "Clé Pappers manquante dans .env.local" }, { status: 500 });
  }
  if (!q) return NextResponse.json({ resultats: [] });

  try {
    const { resultats, total } = await searchPappers(q, 10);
    return NextResponse.json({ resultats, total });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur Pappers";
    const status = message.includes("invalide") ? 401 : 500;
    return NextResponse.json({ error: message, resultats: [] }, { status });
  }
}
