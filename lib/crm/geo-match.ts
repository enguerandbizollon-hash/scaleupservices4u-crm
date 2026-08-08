// Compatibilité géographique France (pont département <-> région <-> France).
// Sépare cette logique de matching-maps (qui ne porte que les référentiels) et
// la rend testable. Utilisée par le scoring géo (lib/crm/ma-scoring.ts) : une
// cible « 44 » matche un acquéreur ciblant « pays_de_la_loire » ou « france ».

import { GEO_REGIONS_FRANCE } from "@/lib/crm/matching-maps";
import { DEPT_TO_REGION, REGION_TO_DEPTS, isDepartementCode } from "@/lib/crm/departements";

const ALL_REGIONS: string[] = [...GEO_REGIONS_FRANCE];
const ALL_DEPTS: string[] = Object.keys(DEPT_TO_REGION);

/** Sous-arbre de compatibilité d'une valeur : elle-même + parents + enfants. */
export function expandGeo(v: string): string[] {
  if (v === "france") return ["france", ...ALL_REGIONS, ...ALL_DEPTS];
  if (isDepartementCode(v)) return [v, DEPT_TO_REGION[v], "france"];
  if (ALL_REGIONS.includes(v)) return [v, "france", ...(REGION_TO_DEPTS[v] ?? [])];
  return [v];
}

/** Deux géos compatibles si identiques ou si l'une contient l'autre. */
export function geoCompatiblePair(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return expandGeo(a).includes(b) || expandGeo(b).includes(a);
}

/** Une valeur géo est-elle compatible avec au moins un des critères ? */
export function geoIsCompatible(
  value: string | null | undefined,
  criteria: string[] | null | undefined,
): boolean {
  if (!value || !criteria?.length) return false;
  return criteria.some((c) => geoCompatiblePair(value, c));
}
