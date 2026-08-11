// UNE seule source de critères pour un mandat d'acquisition : le DOSSIER.
// La chasse rattachée (screening_profiles.filters) en est une PROJECTION :
// modifier les critères du dossier (secteurs, géos, CA) re-pilote la
// recherche de cibles, au lieu de vivre à côté d'elle (retour 2026-08-11 :
// « la modification n'a pas d'impact sur la recherche, il faut lier les
// sources »). Module PUR, testable.
//
// Règles de dérivation :
//  - ca_min / ca_max        : ÉCRASÉS par target_revenue_min/max du dossier.
//  - departements / regions : ÉCRASÉS par target_geographies (codes vers
//    departements, slugs de région vers regions ; « france » = pas de filtre).
//  - naf                    : les naf_codes précis de la fiche de cadrage,
//    PLUS les codes dérivés des secteurs du dossier résolus dans la taxonomie
//    (famille vers divisions vers codes, comme le composeur de Prospection).
//  - âge dirigeant, effectifs, catégorie, rentabilité, actives : PRÉSERVÉS
//    de la chasse (affinages propres à la recherche, hors dossier).

import type { ScreeningFilters } from "@/lib/connectors/recherche-entreprises";
import type { CadrageContent } from "@/lib/ai/cadrage-engine";
import { SECTOR_TO_FAMILY, NAF_DIVISION_TO_SECTOR, GEO_REGIONS_FRANCE } from "@/lib/crm/matching-maps";
import { nafCodesForDivisions } from "@/lib/crm/naf-codes";
import { isDepartementCode } from "@/lib/crm/departements";

export interface BuyDealCriteria {
  target_sectors: string[] | null;
  target_geographies: string[] | null;
  target_revenue_min: number | null;
  target_revenue_max: number | null;
}

const REGION_SLUGS = new Set<string>(GEO_REGIONS_FRANCE);

/** Codes NAF couverts par un secteur du référentiel (feuille ou famille). */
export function nafCodesForSector(sector: string): string[] {
  const family = SECTOR_TO_FAMILY[sector];
  if (!family) return [];
  const divisions = Object.entries(NAF_DIVISION_TO_SECTOR)
    .filter(([, fam]) => fam === family)
    .map(([div]) => div);
  return nafCodesForDivisions(divisions);
}

export function deriveChasseFiltersFromDeal(
  deal: BuyDealCriteria,
  cadrage: CadrageContent | null,
  previous: ScreeningFilters | null,
): ScreeningFilters {
  const f: ScreeningFilters = {
    // Affinages préservés : ils n'existent pas sur le dossier.
    actives_seulement: previous?.actives_seulement !== false,
  };
  if (previous?.age_dirigeant_min != null) f.age_dirigeant_min = previous.age_dirigeant_min;
  if (previous?.age_dirigeant_max != null) f.age_dirigeant_max = previous.age_dirigeant_max;
  if (previous?.effectif_tranches?.length) f.effectif_tranches = previous.effectif_tranches;
  if (previous?.categorie) f.categorie = previous.categorie;
  if (previous?.resultat_net_min != null) f.resultat_net_min = previous.resultat_net_min;

  // CA : le dossier fait foi.
  if (deal.target_revenue_min != null) f.ca_min = deal.target_revenue_min;
  if (deal.target_revenue_max != null) f.ca_max = deal.target_revenue_max;

  // Géographie : le dossier fait foi. « france » = aucun filtre géo.
  const geos = deal.target_geographies ?? [];
  const departements = geos.filter((g) => isDepartementCode(g));
  const regions = geos.filter((g) => REGION_SLUGS.has(g));
  if (departements.length) f.departements = departements;
  if (regions.length) f.regions = regions;

  // NAF : précision de la fiche de cadrage + couverture des secteurs du
  // dossier résolus dans la taxonomie (un secteur libre hors référentiel ne
  // produit rien : les naf_codes de la fiche le couvrent déjà).
  const naf = new Set<string>(cadrage?.naf_codes ?? []);
  for (const s of deal.target_sectors ?? []) {
    for (const code of nafCodesForSector(s)) naf.add(code);
  }
  if (naf.size) f.naf = [...naf];

  return f;
}
