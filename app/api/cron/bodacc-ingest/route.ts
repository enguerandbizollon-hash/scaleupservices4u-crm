// /api/cron/bodacc-ingest — ingestion quotidienne des signaux BODACC (v66).
//
// Authentification : header Authorization: Bearer <CRON_SECRET>
// Vercel Cron injecte automatiquement ce header si CRON_SECRET est défini.
//
// Stratégie (validée, phase 2 temps 1) :
//   - Ventes/cessions, procédures collectives, radiations : ingérées en
//     ENTIER (~2 000/jour réels).
//   - Dépôts des comptes (~12 000/jour) : uniquement les SIREN déjà connus
//     (organisations CRM + univers de veille).
//   - Fenêtre glissante ?days=N (défaut 3, max 30) : rejouable sans doublon
//     grâce à UNIQUE(source, external_id) — un run raté se rattrape seul.
//   - Rattachement organization_id par SIREN (colonne v64).
//   - Purge des signaux non rattachés > 12 mois (fonction v66).
//
// Écritures via service role (les policies v66 réservent l'INSERT au cron).

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FULL_INGEST_FAMILLES,
  CROSS_ONLY_FAMILLE,
  fetchAnnoncesFamille,
  normalizeAnnonce,
  type NormalizedSignal,
} from "@/lib/connectors/bodacc";
import { recomputeCedabiliteForSirens } from "@/lib/crm/cedabilite-ingest";
import { startCronRun, finishCronRun } from "@/lib/crm/cron-runs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UPSERT_BATCH = 500;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

type Supabase = ReturnType<typeof createAdminClient>;

/** Tous les SIREN connus : organisations CRM + univers de veille. */
async function loadKnownSirens(supabase: Supabase): Promise<{
  known: Set<string>;
  orgBySiren: Map<string, string>;
  universSirens: Set<string>;
}> {
  const known = new Set<string>();
  const orgBySiren = new Map<string, string>();
  const universSirens = new Set<string>();

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, siren")
    .not("siren", "is", null);
  for (const o of orgs ?? []) {
    if (o.siren) {
      known.add(o.siren);
      orgBySiren.set(o.siren, o.id);
    }
  }

  // Univers : pagination par 1000 (limite PostgREST), jusqu'à 50k fiches.
  for (let from = 0; ; from += 1000) {
    const { data: page } = await supabase
      .from("univers_entreprises")
      .select("siren")
      .range(from, from + 999);
    for (const u of page ?? []) {
      known.add(u.siren);
      universSirens.add(u.siren);
    }
    if (!page || page.length < 1000) break;
  }

  return { known, orgBySiren, universSirens };
}

async function upsertSignals(
  supabase: Supabase,
  signals: NormalizedSignal[],
  orgBySiren: Map<string, string>,
): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < signals.length; i += UPSERT_BATCH) {
    const batch = signals.slice(i, i + UPSERT_BATCH).map((s) => ({
      siren: s.siren,
      source: "bodacc",
      signal_type: s.signal_type,
      signal_date: s.signal_date,
      titre: s.titre,
      severity: s.severity,
      payload: s.payload,
      external_id: s.external_id,
      // Rattachement : premier SIREN de l'annonce présent dans le CRM.
      organization_id: s.sirens.map((x) => orgBySiren.get(x)).find(Boolean) ?? null,
    }));

    const { data, error } = await supabase
      .from("signaux")
      .upsert(batch, { onConflict: "source,external_id", ignoreDuplicates: true })
      .select("id");

    if (error) errors.push(`upsert: ${error.message}`);
    else inserted += data?.length ?? 0;
  }

  return { inserted, skipped: signals.length - inserted, errors };
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const days = Math.min(30, Math.max(1, parseInt(url.searchParams.get("days") ?? "3", 10) || 3));
  const fromDate = isoDaysAgo(days - 1);
  const toDate = isoDaysAgo(0);

  const supabase = createAdminClient();
  const runId = await startCronRun(supabase, "bodacc-ingest");
  const errors: string[] = [];
  const perFamille: Record<string, { fetched: number; inserted: number; skipped: number }> = {};

  const { known, orgBySiren, universSirens } = await loadKnownSirens(supabase);
  // Fiches univers touchées par un signal de la fenêtre : leur radar est
  // recalculé en fin de run (une procédure collective ou une cession doit
  // refroidir la fiche le jour même, pas au prochain recalcul manuel).
  const touchedUnivers = new Set<string>();

  // ── 1. Familles ingérées en entier ────────────────────────────────────────
  for (const famille of FULL_INGEST_FAMILLES) {
    try {
      const raw = await fetchAnnoncesFamille(famille, fromDate, toDate);
      const normalized = raw
        .map(normalizeAnnonce)
        .filter((s): s is NormalizedSignal => s !== null);
      for (const s of normalized) if (universSirens.has(s.siren)) touchedUnivers.add(s.siren);
      const res = await upsertSignals(supabase, normalized, orgBySiren);
      perFamille[famille] = { fetched: raw.length, inserted: res.inserted, skipped: res.skipped };
      errors.push(...res.errors);
    } catch (e) {
      errors.push(`${famille}: ${e instanceof Error ? e.message : "erreur"}`);
      perFamille[famille] = { fetched: 0, inserted: 0, skipped: 0 };
    }
  }

  // ── 2. Dépôts des comptes : SIREN connus uniquement ───────────────────────
  try {
    const raw = await fetchAnnoncesFamille(CROSS_ONLY_FAMILLE, fromDate, toDate);
    const normalized = raw
      .map(normalizeAnnonce)
      .filter((s): s is NormalizedSignal => s !== null)
      .filter((s) => s.sirens.some((x) => known.has(x)));
    for (const s of normalized) if (universSirens.has(s.siren)) touchedUnivers.add(s.siren);
    const res = await upsertSignals(supabase, normalized, orgBySiren);
    perFamille[CROSS_ONLY_FAMILLE] = {
      fetched: raw.length,
      inserted: res.inserted,
      skipped: res.skipped,
    };
    errors.push(...res.errors);
  } catch (e) {
    errors.push(`${CROSS_ONLY_FAMILLE}: ${e instanceof Error ? e.message : "erreur"}`);
    perFamille[CROSS_ONLY_FAMILLE] = { fetched: 0, inserted: 0, skipped: 0 };
  }

  // ── 2 bis. Radar : rescorer les fiches univers touchées ──────────────────
  let radarRescored = 0;
  if (touchedUnivers.size > 0) {
    const rec = await recomputeCedabiliteForSirens(supabase, [...touchedUnivers]);
    radarRescored = rec.scored;
    errors.push(...rec.errors.map((m) => `radar: ${m}`));
  }

  // ── 3. Purge des signaux non rattachés > 12 mois ──────────────────────────
  let purged = 0;
  {
    const { data, error } = await supabase.rpc("purge_signaux_non_rattaches");
    if (error) errors.push(`purge: ${error.message}`);
    else purged = (data as number) ?? 0;
  }

  await finishCronRun(supabase, runId, {
    ok: errors.length === 0,
    summary: { window: { fromDate, toDate, days }, known_sirens: known.size, perFamille, radar_rescored: radarRescored, purged },
    errors,
  });

  return NextResponse.json({
    ok: errors.length === 0,
    window: { fromDate, toDate, days },
    known_sirens: known.size,
    perFamille,
    radar_rescored: radarRescored,
    purged,
    errors,
  });
}
