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
// Auth : session Supabase SSR (createClient), RLS appliquée (NextAuth retiré).
// Trace : connector_runs (1 ligne par appel source).
//
// Body : { org_id: uuid, org_name?: string }
// Return : { found, sources, updated_fields, details }

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enrichExistingOrganizationWithApollo } from "@/lib/connectors/apollo";
import { enrichExistingOrganizationWithHarmonic } from "@/lib/connectors/harmonic";
import { enrichExistingOrganizationWithPappers } from "@/lib/connectors/pappers";

interface EnrichmentSourceReport {
  source: "pappers" | "apollo" | "harmonic";
  ok: boolean;
  found: boolean;
  updated_fields: string[];
  message?: string;
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

  // 1. Pappers (données légales FR) — factorisé dans lib/connectors/pappers.ts
  reports.push(await enrichExistingOrganizationWithPappers(supabase, org_id, name));

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
