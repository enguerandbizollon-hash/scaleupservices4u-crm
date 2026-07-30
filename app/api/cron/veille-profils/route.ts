// /api/cron/veille-profils — veille hebdomadaire des profils de chasse (v66).
//
// Authentification : header Authorization: Bearer <CRON_SECRET>
//
// Pour chaque profil watch_enabled : rejoue le screening, rafraîchit
// l'univers (upsert qui préserve le statut de tri), et crée un signal
// `entree_screening` pour chaque SIREN qui ENTRE dans les critères
// (dirigeant qui franchit l'âge, CA qui passe le seuil, création récente...).
// Idempotence : external_id = `${profil}:${siren}` → une entrée signalée
// une seule fois par profil, à vie (UNIQUE source+external_id).
//
// Garde-fous : profils > 10 000 cibles ignorés (à affiner), budget temps
// global 240 s (les profils restants passent à la semaine suivante).

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  countScreening,
  runScreening,
  type ScreeningFilters,
} from "@/lib/connectors/recherche-entreprises";
import { universRowFromHit } from "@/lib/crm/univers-ingest";
import { fetchSignalTypesBySiren, scoreUniversRows } from "@/lib/crm/cedabilite-ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TIME_BUDGET_MS = 240_000;
const BATCH = 500;

type Supabase = ReturnType<typeof createAdminClient>;

async function existingSirens(supabase: Supabase, sirens: string[]): Promise<Set<string>> {
  const known = new Set<string>();
  for (let i = 0; i < sirens.length; i += BATCH) {
    const { data } = await supabase
      .from("univers_entreprises")
      .select("siren")
      .in("siren", sirens.slice(i, i + BATCH));
    for (const r of data ?? []) known.add(r.siren);
  }
  return known;
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

  const supabase = createAdminClient();
  const started = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  const errors: string[] = [];
  const report: Record<string, { total: number; nouveaux: number; skipped?: string }> = {};

  const { data: profiles, error: pErr } = await supabase
    .from("screening_profiles")
    .select("id, name, filters")
    .eq("watch_enabled", true)
    .order("last_run_at", { ascending: true, nullsFirst: true });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  for (const profile of profiles ?? []) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      report[profile.name] = { total: 0, nouveaux: 0, skipped: "budget temps épuisé, repassera" };
      continue;
    }
    const filters = (profile.filters ?? {}) as ScreeningFilters;

    try {
      const total = await countScreening(filters);
      if (total > 10_000) {
        report[profile.name] = { total, nouveaux: 0, skipped: "plus de 10 000 cibles, profil à affiner" };
        continue;
      }

      const run = await runScreening(filters, { maxResults: 10_000 });
      const sirens = run.hits.map((h) => h.raw.siren);
      const known = await existingSirens(supabase, sirens);

      // 1. Rafraîchir l'univers (statut et first_seen_at préservés), radar
      //    calculé à l'ingestion : la veille rescore chaque fiche revue.
      const bruts = run.hits.map((h) => universRowFromHit(h, profile.id, nowIso));
      const typesBySiren = await fetchSignalTypesBySiren(supabase, bruts.map((r) => r.siren));
      const rows = scoreUniversRows(bruts, typesBySiren);
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabase
          .from("univers_entreprises")
          .upsert(rows.slice(i, i + BATCH), { onConflict: "siren" });
        if (error) errors.push(`${profile.name} univers: ${error.message}`);
      }

      // 2. Signaler les entrées (nouveaux SIREN uniquement).
      const nouveaux = run.hits.filter((h) => !known.has(h.raw.siren));
      const signals = nouveaux.map((h) => ({
        siren: h.raw.siren,
        source: "recherche_entreprises",
        signal_type: "entree_screening",
        signal_date: today,
        titre: `Nouvelle cible : ${h.normalized.name}${h.normalized.city ? ` (${h.normalized.city})` : ""} — profil ${profile.name}`,
        severity: "opportunite",
        payload: {
          profil: profile.name,
          profile_id: profile.id,
          secteur: h.normalized.activite_principale_code,
          ville: h.normalized.city,
          age_dirigeant: h.dirigeant_principal?.age ?? null,
        },
        external_id: `${profile.id}:${h.raw.siren}`,
        organization_id: null,
      }));
      for (let i = 0; i < signals.length; i += BATCH) {
        const { error } = await supabase
          .from("signaux")
          .upsert(signals.slice(i, i + BATCH), { onConflict: "source,external_id", ignoreDuplicates: true });
        if (error) errors.push(`${profile.name} signaux: ${error.message}`);
      }

      await supabase
        .from("screening_profiles")
        .update({ last_run_at: nowIso, last_total_results: run.hits.length })
        .eq("id", profile.id);

      report[profile.name] = { total: run.hits.length, nouveaux: nouveaux.length };
    } catch (e) {
      errors.push(`${profile.name}: ${e instanceof Error ? e.message : "erreur"}`);
      report[profile.name] = { total: 0, nouveaux: 0, skipped: "erreur" };
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    profils_surveilles: (profiles ?? []).length,
    report,
    errors,
  });
}
