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
import { normalizeSectorText, normalizeGeoText } from "@/lib/crm/investor-parsers";

/** Filtres de chasse dérivés de la fiche (NAF, CA, géo, âge dirigeant).
 * Les régions IA (libellés libres) sont rabattues sur les slugs du
 * référentiel : c'est ce que la conversion INSEE de l'appel API sait lire. */
export function cadrageToChasseFilters(c: CadrageContent): ScreeningFilters {
  const f: ScreeningFilters = { actives_seulement: true };
  if (c.naf_codes.length) f.naf = c.naf_codes;
  if (c.ca_min != null) f.ca_min = c.ca_min;
  if (c.ca_max != null) f.ca_max = c.ca_max;
  if (c.dirigeant_age_min != null) f.age_dirigeant_min = c.dirigeant_age_min;
  if (c.dirigeant_age_max != null) f.age_dirigeant_max = c.dirigeant_age_max;
  if (c.departements.length) f.departements = c.departements;
  if (c.regions.length) f.regions = c.regions.map((r) => normalizeGeoText(r) ?? r);
  return f;
}

/**
 * Critères ma_buy du dossier. Uniquement les clés présentes dans la fiche :
 * le patch n'écrase pas un champ que la fiche ne renseigne pas.
 */
export function cadrageToDealPatch(c: CadrageContent): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (c.secteurs.length) patch.target_sectors = c.secteurs;
  // Régions rabattues sur les slugs du référentiel (scoring géo, affichage).
  const geos = [...c.departements, ...c.regions.map((r) => normalizeGeoText(r) ?? r)];
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

export interface CadrageWizardPrefill {
  targetSectors: string[];
  targetGeographies: string[];
  targetRevenueMin: string;
  targetRevenueMax: string;
  acquisitionBudgetMin: string;
  fullAcquisitionRequired: boolean;
  managementRetention: boolean;
  strategicRationale: string;
}

/**
 * Pré-remplit les états du wizard ma_buy à partir d'une fiche de cadrage.
 * Corrige le mélange codes/labels de cadrageToDealPatch pour l'UI : les
 * secteurs texte libre sont rabattus sur le référentiel (sinon conservés comme
 * tag libre à corriger), les régions sont normalisées en slugs, les codes
 * départements conservés tels quels. Pur, testable.
 */
export function cadrageToWizardPrefill(c: CadrageContent): CadrageWizardPrefill {
  const targetSectors = [
    ...new Set(c.secteurs.map((s) => normalizeSectorText(s) ?? s.trim()).filter((s) => s.length > 0)),
  ];
  const geoFromRegions = c.regions
    .map((r) => normalizeGeoText(r))
    .filter((x): x is string => !!x);
  const targetGeographies = [...new Set([...c.departements, ...geoFromRegions])];
  return {
    targetSectors,
    targetGeographies,
    targetRevenueMin: c.ca_min != null ? String(c.ca_min) : "",
    targetRevenueMax: c.ca_max != null ? String(c.ca_max) : "",
    acquisitionBudgetMin: c.apport != null ? String(c.apport) : "",
    fullAcquisitionRequired: c.full_acquisition ?? false,
    managementRetention: c.management_retention ?? true,
    strategicRationale: c.projet ?? "",
  };
}
