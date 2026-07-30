// Radar de cédabilité à l'ingestion (audit 2026-07-30, cran 1).
// Le score ne doit JAMAIS attendre un clic : toute fiche qui entre ou se
// rafraîchit dans l'univers (chasse manuelle, veille hebdo, signal BODACC)
// ressort scorée. Le bouton « Recalculer le radar » devient un filet de
// sécurité, plus une étape du chemin critique.
//
// Partagé entre les Server Actions (client RLS) et les crons (service role) :
// même signature SupabaseClient que lib/connectors/base.ts.

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeCedabilite, type FicheForCedabilite } from "./cedabilite";

const BATCH = 500;

/** Types de signaux portés par chaque SIREN (croisement table signaux). */
export async function fetchSignalTypesBySiren(
  supabase: SupabaseClient,
  sirens: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  for (let i = 0; i < sirens.length; i += BATCH) {
    const { data } = await supabase
      .from("signaux")
      .select("siren, signal_type")
      .in("siren", sirens.slice(i, i + BATCH));
    for (const s of data ?? []) {
      const arr = map.get(s.siren) ?? [];
      arr.push(s.signal_type);
      map.set(s.siren, arr);
    }
  }
  return map;
}

/** Enrichit des lignes univers prêtes à l'upsert avec leur score radar. */
export function scoreUniversRows<T extends FicheForCedabilite & { siren: string }>(
  rows: T[],
  typesBySiren: Map<string, string[]>,
): Array<T & { cedabilite_score: number; cedabilite_raisons: string[] }> {
  return rows.map((row) => {
    const r = computeCedabilite(row, { types: typesBySiren.get(row.siren) ?? [] });
    return { ...row, cedabilite_score: r.score, cedabilite_raisons: r.raisons };
  });
}

/**
 * Recalcule le radar des fiches univers désignées (après l'arrivée de
 * nouveaux signaux BODACC : une procédure collective ou une cession doit
 * refroidir la fiche le jour même, pas au prochain passage manuel).
 */
export async function recomputeCedabiliteForSirens(
  supabase: SupabaseClient,
  sirens: string[],
): Promise<{ scored: number; errors: string[] }> {
  const errors: string[] = [];
  let scored = 0;
  const nowIso = new Date().toISOString();

  for (let i = 0; i < sirens.length; i += BATCH) {
    const slice = sirens.slice(i, i + BATCH);
    const { data: fiches, error } = await supabase
      .from("univers_entreprises")
      .select("siren, nom, age_dirigeant_principal, date_creation, finances, dirigeants")
      .in("siren", slice);
    if (error) {
      errors.push(error.message);
      continue;
    }
    if (!fiches || fiches.length === 0) continue;

    const typesBySiren = await fetchSignalTypesBySiren(supabase, fiches.map((f) => f.siren));
    // nom inclus : requis par le chemin INSERT de l'upsert (NOT NULL),
    // jamais emprunté en pratique puisque toutes les lignes existent.
    const updates = fiches.map((f) => {
      const r = computeCedabilite(
        {
          age_dirigeant_principal: f.age_dirigeant_principal,
          date_creation: f.date_creation,
          finances: f.finances,
          dirigeants: f.dirigeants,
        },
        { types: typesBySiren.get(f.siren) ?? [] },
      );
      return {
        siren: f.siren,
        nom: f.nom,
        cedabilite_score: r.score,
        cedabilite_raisons: r.raisons,
        updated_at: nowIso,
      };
    });

    const { error: upErr } = await supabase
      .from("univers_entreprises")
      .upsert(updates, { onConflict: "siren" });
    if (upErr) errors.push(upErr.message);
    else scored += updates.length;
  }

  return { scored, errors };
}
