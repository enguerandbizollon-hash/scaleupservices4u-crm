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
import { universRowFromHit, mergeFinancesReingest } from "@/lib/crm/univers-ingest";
import { fetchSignalTypesBySiren, scoreUniversRows } from "@/lib/crm/cedabilite-ingest";
import { enqueueNotification } from "@/lib/crm/notifications";
import { startCronRun, finishCronRun } from "@/lib/crm/cron-runs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TIME_BUDGET_MS = 240_000;
const BATCH = 500;

type Supabase = ReturnType<typeof createAdminClient>;

/** État existant des fiches (score, statut, finances, actionnariat) : détecte
 * les passages à chaud, fusionne les finances (Pappers survit à la re-veille)
 * et fait participer l'actionnariat au rescoring. */
type ExistingFiche = {
  score: number | null;
  statut: string;
  finances: Record<string, Record<string, number | null | undefined>>;
  actionnariat: Array<{ type?: string | null; pourcentage_parts?: number | null }> | null;
};
async function existingFiches(
  supabase: Supabase,
  sirens: string[],
): Promise<Map<string, ExistingFiche>> {
  const map = new Map<string, ExistingFiche>();
  for (let i = 0; i < sirens.length; i += BATCH) {
    const { data } = await supabase
      .from("univers_entreprises")
      .select("siren, cedabilite_score, statut, finances, actionnariat")
      .in("siren", sirens.slice(i, i + BATCH));
    for (const r of data ?? []) {
      map.set(r.siren, { score: r.cedabilite_score, statut: r.statut, finances: r.finances ?? {}, actionnariat: r.actionnariat ?? null });
    }
  }
  return map;
}

const SEUIL_CHAUDE = 70;

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
  const runId = await startCronRun(supabase, "veille-profils");
  const started = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  const errors: string[] = [];
  const report: Record<string, { total: number; nouveaux: number; chauds?: number; skipped?: string }> = {};

  const { data: profiles, error: pErr } = await supabase
    .from("screening_profiles")
    .select("id, name, filters, user_id, deal_id, deals(name)")
    .eq("watch_enabled", true)
    .order("last_run_at", { ascending: true, nullsFirst: true });
  if (pErr) {
    await finishCronRun(supabase, runId, { ok: false, errors: [pErr.message] });
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

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
      const avant = await existingFiches(supabase, sirens);
      const known = new Set(avant.keys());

      // 1. Rafraîchir l'univers (statut et first_seen_at préservés), radar
      //    calculé à l'ingestion : la veille rescore chaque fiche revue.
      //    Fusion des finances : Pappers survit à la re-veille (revue 2026-07-30).
      const bruts = run.hits.map((h) => universRowFromHit(h, profile.id, nowIso));
      const fusionnes = bruts.map((r) => {
        const prev = avant.get(r.siren);
        return {
          ...r,
          finances: mergeFinancesReingest(prev?.finances, r.finances),
          ...(prev?.actionnariat ? { actionnariat: prev.actionnariat } : {}),
        };
      });
      const typesBySiren = await fetchSignalTypesBySiren(supabase, fusionnes.map((r) => r.siren));
      const rows = scoreUniversRows(fusionnes, typesBySiren);
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabase
          .from("univers_entreprises")
          .upsert(rows.slice(i, i + BATCH), { onConflict: "siren" });
        if (error) errors.push(`${profile.name} univers: ${error.message}`);
      }

      // Attribution durable (v77) : la veille rattache aussi ses fiches à la
      // chasse, l'onglet Cibles d'un mandat voit les nouvelles entrées.
      const hitRows = rows.map((r) => ({ siren: r.siren, profile_id: profile.id, last_seen_at: nowIso }));
      for (let i = 0; i < hitRows.length; i += BATCH) {
        const { error } = await supabase
          .from("univers_chasse_hits")
          .upsert(hitRows.slice(i, i + BATCH), { onConflict: "siren,profile_id" });
        if (error) errors.push(`${profile.name} attribution: ${error.message}`);
      }

      // 1 bis. Passages à chaud : fiches EXISTANTES qui franchissent le seuil
      // radar cette semaine (une fiche nouvelle et chaude est déjà comptée
      // dans « nouvelles cibles », revue 2026-07-30 : pas de double compte).
      // Exclusions : écartées/promues (décision prise) et échanges en cours
      // (on parle déjà au dirigeant). Les DORMANTES restent incluses : une
      // dormante qui chauffe mérite un réveil anticipé.
      const passeesChaudes = rows.filter((r) => {
        if (r.cedabilite_score < SEUIL_CHAUDE) return false;
        const prev = avant.get(r.siren);
        if (prev == null) return false;
        if (["ecarte", "promu", "echange"].includes(prev.statut)) return false;
        return prev.score == null || prev.score < SEUIL_CHAUDE;
      });

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

      // 3. La veille PARLE (audit 2026-07-30) : une notification par profil
      // qui a du neuf, dédupliquée par jour. Cloche in-app existante (v41).
      if (nouveaux.length > 0 || passeesChaudes.length > 0) {
        const topChaudes = [...passeesChaudes]
          .sort((a, b) => b.cedabilite_score - a.cedabilite_score)
          .slice(0, 3)
          .map((r) => `${r.nom} (${r.cedabilite_score})`);
        const parts: string[] = [];
        if (nouveaux.length > 0) parts.push(`${nouveaux.length} nouvelle${nouveaux.length > 1 ? "s" : ""} cible${nouveaux.length > 1 ? "s" : ""}`);
        if (passeesChaudes.length > 0) parts.push(`${passeesChaudes.length} passée${passeesChaudes.length > 1 ? "s" : ""} chaude${passeesChaudes.length > 1 ? "s" : ""}`);
        // Chasse de mandat : la notification nomme le mandat et y ramène
        // (onglet Cibles), au lieu de fondre dans la veille cédants globale.
        const dealRel = Array.isArray(profile.deals) ? profile.deals[0] : profile.deals;
        const dealName = (dealRel as { name?: string } | null)?.name ?? null;
        const notifRes = await enqueueNotification(supabase, {
          user_id: profile.user_id,
          kind: "veille_profil",
          title: profile.deal_id && dealName
            ? `Chasse « ${profile.name} » : ${parts.join(", ")} pour le mandat ${dealName}`
            : `Veille « ${profile.name} » : ${parts.join(", ")}`,
          body: topChaudes.length > 0 ? `À voir en premier : ${topChaudes.join(", ")}.` : null,
          link_url: profile.deal_id
            ? `/protected/dossiers/${profile.deal_id}?tab=sourcing`
            : "/protected/prospection",
          source_type: "screening_profile",
          source_id: profile.id,
          trigger_date: today,
        });
        if (notifRes.error) errors.push(`${profile.name} notification: ${notifRes.error}`);
      }

      report[profile.name] = { total: run.hits.length, nouveaux: nouveaux.length, chauds: passeesChaudes.length };
    } catch (e) {
      errors.push(`${profile.name}: ${e instanceof Error ? e.message : "erreur"}`);
      report[profile.name] = { total: 0, nouveaux: 0, skipped: "erreur" };
    }
  }

  await finishCronRun(supabase, runId, {
    ok: errors.length === 0,
    summary: { profils_surveilles: (profiles ?? []).length, report },
    errors,
  });

  return NextResponse.json({
    ok: errors.length === 0,
    profils_surveilles: (profiles ?? []).length,
    report,
    errors,
  });
}
