// Mapping ScreeningHit → ligne univers_entreprises, partagé entre la chasse
// manuelle (actions/prospection.ts) et la veille hebdo (cron veille-profils).
// Extrait à l'audit du 2026-07-30 : la copie du cron avait dérivé (elle
// oubliait les dirigeants, donc la relève familiale était invisible en veille).

import type { ScreeningHit } from "@/lib/connectors/recherche-entreprises";
import { sectorFromNaf } from "@/lib/crm/matching-maps";

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
