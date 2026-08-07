/**
 * lib/crm/cadrage-map.ts — Mapping PUR fiche de cadrage → système.
 *
 * Deux sorties, toutes deux testables sans I/O :
 *  - cadrageToChasseFilters : les filtres d'une chasse (API Recherche
 *    d'Entreprises) qui trouvera les cibles du repreneur.
 *  - cadrageToDealPatch : les critères ma_buy du dossier (lus par le scorer
 *    buy_to_target de lib/crm/ma-scoring.ts).
 *
 * Règle : on ne renseigne QUE les critères présents dans la fiche. Un champ
 * absent n'écrase rien (le patch ne contient pas la clé).
 */

import type { CadrageContent } from "@/lib/ai/cadrage-engine";
import type { ScreeningFilters } from "@/lib/connectors/recherche-entreprises";

/** Filtres de chasse dérivés de la fiche (NAF, CA, géo, âge dirigeant). */
export function cadrageToChasseFilters(c: CadrageContent): ScreeningFilters {
  const f: ScreeningFilters = { actives_seulement: true };
  if (c.naf_codes.length) f.naf = c.naf_codes;
  if (c.ca_min != null) f.ca_min = c.ca_min;
  if (c.ca_max != null) f.ca_max = c.ca_max;
  if (c.dirigeant_age_min != null) f.age_dirigeant_min = c.dirigeant_age_min;
  if (c.dirigeant_age_max != null) f.age_dirigeant_max = c.dirigeant_age_max;
  if (c.departements.length) f.departements = c.departements;
  if (c.regions.length) f.regions = c.regions;
  return f;
}

/**
 * Critères ma_buy du dossier. Uniquement les clés présentes dans la fiche :
 * le patch n'écrase pas un champ que la fiche ne renseigne pas.
 */
export function cadrageToDealPatch(c: CadrageContent): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (c.secteurs.length) patch.target_sectors = c.secteurs;
  const geos = [...c.departements, ...c.regions];
  if (geos.length) patch.target_geographies = geos;
  if (c.ca_min != null) patch.target_revenue_min = c.ca_min;
  if (c.ca_max != null) patch.target_revenue_max = c.ca_max;
  if (c.full_acquisition != null) patch.full_acquisition_required = c.full_acquisition;
  if (c.management_retention != null) patch.management_retention = c.management_retention;
  if (c.apport != null) patch.acquisition_budget_min = c.apport;
  if (c.projet) patch.strategic_rationale = c.projet;
  return patch;
}

/** Nom lisible d'une chasse issue d'une fiche de cadrage. */
export function cadrageChasseName(c: CadrageContent, fallback: string): string {
  const who = c.repreneur_nom?.trim();
  return who ? `Cibles pour ${who}` : `Cibles : ${fallback}`;
}
