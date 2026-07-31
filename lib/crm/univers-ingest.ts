// Mapping ScreeningHit → ligne univers_entreprises, partagé entre la chasse
// manuelle (actions/prospection.ts) et la veille hebdo (cron veille-profils).
// Extrait à l'audit du 2026-07-30 : la copie du cron avait dérivé (elle
// oubliait les dirigeants, donc la relève familiale était invisible en veille).

import type { ScreeningHit } from "@/lib/connectors/recherche-entreprises";
import { sectorFromNaf } from "@/lib/crm/matching-maps";

type FinanceYearLoose = Record<string, number | null | undefined>;

/**
 * Fusion des finances à la re-ingestion (revue 2026-07-30) : l'API gratuite
 * rafraîchit CA et résultat net mais ne doit JAMAIS effacer les champs
 * ramenés par Pappers (ebitda, dettes, trésorerie, caf...) ni les exercices
 * qu'elle ne connaît pas. Une valeur fraîche non nulle gagne, le reste
 * survit. Sans cette fusion, chaque chasse ou veille appauvrissait la fiche
 * et le radar était rescoré sur des finances dégradées.
 */
export function mergeFinancesReingest(
  existing: Record<string, FinanceYearLoose> | null | undefined,
  fresh: Record<string, FinanceYearLoose> | null | undefined,
): Record<string, FinanceYearLoose> {
  const out: Record<string, FinanceYearLoose> = {};
  for (const [year, vals] of Object.entries(existing ?? {})) {
    out[year] = { ...(vals ?? {}) };
  }
  for (const [year, vals] of Object.entries(fresh ?? {})) {
    out[year] = { ...(out[year] ?? {}) };
    for (const [k, v] of Object.entries(vals ?? {})) {
      if (v != null) out[year][k] = v;
    }
  }
  return out;
}

export function universRowFromHit(hit: ScreeningHit, profileId: string | null, nowIso: string) {
  const { raw, normalized } = hit;
  const naf = normalized.activite_principale_code;
  const dirigeants = (raw.dirigeants ?? [])
    .filter((d) => !d.denomination && d.nom)
    .map((d) => ({
      nom: d.nom ?? null,
      prenoms: d.prenoms ?? null,
      qualite: d.qualite ?? d.type_dirigeant ?? null,
      date_de_naissance: d.date_de_naissance ?? null,
    }));

  return {
    siren: raw.siren,
    nom: normalized.name,
    naf,
    secteur: naf ? sectorFromNaf(naf) : null,
    departement: raw.siege?.departement ?? normalized.postal_code?.slice(0, 2) ?? null,
    ville: normalized.city,
    date_creation: raw.date_creation ?? null,
    effectif_code: raw.tranche_effectif_salarie ?? null,
    effectif_label: normalized.effectif_label,
    categorie: normalized.category,
    finances: raw.finances ?? {},
    dirigeants,
    age_dirigeant_principal: hit.dirigeant_principal?.age ?? null,
    source_profile_id: profileId,
    last_seen_at: nowIso,
    updated_at: nowIso,
    // statut et first_seen_at ABSENTS volontairement : préservés à l'upsert.
  };
}
