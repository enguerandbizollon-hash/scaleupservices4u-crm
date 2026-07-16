// /api/enrich/organisation — enrichissement d'une organisation existante.
//
// Chaîne 3 sources complémentaires :
//   1. Pappers (données légales FR : SIREN, forme juridique, CA, effectif)
//   2. Apollo  (description, website, linkedin, employee_count, industrie)
//   3. Harmonic (données fonds / startup avancées : tours, total levé)
//
// Chaque source est optionnelle : si la clé API correspondante est absente
// ou si l'appel échoue, on poursuit avec les suivantes. Les champs déjà
// remplis ne sont JAMAIS écrasés (cf. CLAUDE.md "organisme vivant").
//
// Auth : session NextAuth utilisateur. RLS appliquée via createClient SSR.
// Trace : connector_runs (1 ligne par appel source).
//
// Body : { org_id: uuid, org_name?: string }
// Return : { found, sources, updated_fields, details }

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enrichExistingOrganizationWithApollo } from "@/lib/connectors/apollo";
import { enrichExistingOrganizationWithHarmonic } from "@/lib/connectors/harmonic";

interface EnrichmentSourceReport {
  source: "pappers" | "apollo" | "harmonic";
  ok: boolean;
  found: boolean;
  updated_fields: string[];
  message?: string;
}

const PAPPERS_EFFECTIF_LABELS: Record<string, string> = {
  "00": "0", "01": "1-2", "02": "3-5", "03": "6-9",
  "11": "10-19", "12": "20-49",
  "21": "50-99", "22": "100-199",
  "31": "200-249", "32": "250-499",
  "41": "500-999", "42": "1000-1999",
  "51": "2000-4999", "52": "5000-9999",
  "53": "+10000",
};

async function runPappers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  orgName: string,
): Promise<EnrichmentSourceReport> {
  const key = process.env.PAPPERS_API_KEY;
  if (!key) {
    return { source: "pappers", ok: false, found: false, updated_fields: [], message: "PAPPERS_API_KEY manquante" };
  }

  try {
    const url = `https://api.pappers.fr/v2/recherche?q=${encodeURIComponent(orgName)}&api_token=${key}&nombre=1`;
    const res = await fetch(url);
    if (!res.ok) {
      return { source: "pappers", ok: false, found: false, updated_fields: [], message: `Pappers ${res.status}` };
    }
    const data = await res.json() as { resultats?: Array<Record<string, unknown>> };
    const r = data.resultats?.[0];
    if (!r) return { source: "pappers", ok: true, found: false, updated_fields: [] };

    // Charger l'existant pour ne pas écraser
    const { data: existing } = await supabase
      .from("organizations")
      .select("location, website, employee_count, notes")
      .eq("id", orgId)
      .maybeSingle();
    if (!existing) {
      return { source: "pappers", ok: false, found: true, updated_fields: [], message: "Organisation introuvable" };
    }

    const updates: Record<string, unknown> = {};
    const ville = r.ville as string | undefined;
    const codePostal = r.code_postal as string | undefined;
    const siteInternet = r.site_internet as string | undefined;
    const trancheEffectif = r.tranche_effectif as string | undefined;

    if (!existing.location && ville) {
      updates.location = codePostal ? `${ville} (${codePostal})` : ville;
    }
    if (!existing.website && siteInternet) {
      updates.website = siteInternet;
    }
    if (!existing.employee_count && trancheEffectif) {
      // Pappers retourne une tranche. On extrait la borne basse comme proxy numérique.
      const lower = (PAPPERS_EFFECTIF_LABELS[trancheEffectif] ?? "").split(/[-+]/)[0];
      const n = parseInt(lower ?? "", 10);
      if (Number.isFinite(n) && n > 0) updates.employee_count = n;
    }

    // Notes : enregistrer SIREN / forme juridique / CA si pas déjà présent
    const noteParts: string[] = [];
    if (r.siren)            noteParts.push(`SIREN: ${r.siren}`);
    if (r.forme_juridique)  noteParts.push(`Forme: ${r.forme_juridique}`);
    if (trancheEffectif)    noteParts.push(`Effectif: ${PAPPERS_EFFECTIF_LABELS[trancheEffectif] ?? trancheEffectif}`);
    if (typeof r.chiffre_affaires === "number") {
      noteParts.push(`CA: ${(r.chiffre_affaires / 1_000_000).toFixed(1)}M€`);
    }
    const existingNotes = (existing.notes as string | null) ?? "";
    if (noteParts.length && !existingNotes.includes("[Pappers]")) {
      const enrichNote = `[Pappers] ${noteParts.join(" | ")}`;
      updates.notes = existingNotes ? `${existingNotes}\n${enrichNote}` : enrichNote;
    }

    if (Object.keys(updates).length > 0) {
      Object.assign(updates, {
        enriched_at: new Date().toISOString(),
        enriched_by_source: "pappers",
      });
      await supabase.from("organizations").update(updates).eq("id", orgId);
    }

    const updatedFields = Object.keys(updates).filter(
      (k) => k !== "enriched_at" && k !== "enriched_by_source",
    );

    return { source: "pappers", ok: true, found: true, updated_fields: updatedFields };
  } catch (err) {
    return {
      source: "pappers",
      ok: false,
      found: false,
      updated_fields: [],
      message: err instanceof Error ? err.message : "Erreur Pappers",
    };
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { org_id, org_name } = await req.json() as { org_id?: string; org_name?: string };
  if (!org_id) return NextResponse.json({ error: "org_id requis" }, { status: 400 });

  // Récupérer le nom si non fourni (et vérifier que l'orga appartient au user)
  let name = org_name;
  if (!name) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", org_id)
      .eq("user_id", user.id)
      .maybeSingle();
    name = org?.name ?? undefined;
  }
  if (!name) return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });

  const reports: EnrichmentSourceReport[] = [];

  // 1. Pappers (données légales FR)
  reports.push(await runPappers(supabase, org_id, name));

  // 2. Apollo (données B2B)
  const apolloRes = await enrichExistingOrganizationWithApollo({ userId: user.id, orgId: org_id });
  reports.push({
    source: "apollo",
    ok: !apolloRes.error,
    found: apolloRes.found,
    updated_fields: apolloRes.updated_fields,
    message: apolloRes.error,
  });

  // 3. Harmonic (financement / fonds)
  const harmonicRes = await enrichExistingOrganizationWithHarmonic({ userId: user.id, orgId: org_id });
  reports.push({
    source: "harmonic",
    ok: !harmonicRes.error,
    found: harmonicRes.found,
    updated_fields: harmonicRes.updated_fields,
    message: harmonicRes.error,
  });

  const allUpdatedFields = Array.from(new Set(reports.flatMap((r) => r.updated_fields)));
  const anyFound = reports.some((r) => r.found);

  return NextResponse.json({
    found: anyFound,
    sources: reports,
    updated: allUpdatedFields,
    keys_configured: {
      pappers: !!process.env.PAPPERS_API_KEY,
      apollo: !!process.env.APOLLO_API_KEY,
      harmonic: !!process.env.HARMONIC_API_KEY,
    },
  });
}
