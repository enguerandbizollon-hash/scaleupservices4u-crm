// Facettes groupées du référentiel métier, source UNIQUE pour tous les
// multi-sélecteurs (wizard de mandat, profil acquéreur, formulaires orga).
// Dérivées des référentiels purs (matching-maps + departements) : ne jamais
// recopier une liste de secteurs ou de géos ailleurs.
import type { FacetGroup } from "@/components/ui/FacetMultiSelect";
import { SECTOR_GROUPS, GEO_REGIONS_FRANCE, GEO_LABELS } from "@/lib/crm/matching-maps";
import { GEO_DEPT_OPTIONS } from "@/lib/crm/departements";

// Secteurs par famille (feuilles précises). « Généraliste » n'est pas proposé
// à la sélection manuelle : c'est un passe-partout de scoring / classification
// NAF, pas un critère qu'on coche. Une liste de cibles vide = ouvert à tout.
export const SECTOR_FACET_GROUPS: FacetGroup[] = SECTOR_GROUPS.map((g) => ({
  label: g.family,
  options: g.options.map((o) => ({ value: o, label: o })),
}));

// Géographie France, du plus large au plus fin : France entière, régions,
// départements (code + nom).
export const GEO_FACET_GROUPS: FacetGroup[] = [
  { label: "France", options: [{ value: "france", label: "France entière" }] },
  { label: "Régions", options: [...GEO_REGIONS_FRANCE].map((r) => ({ value: r, label: GEO_LABELS[r] ?? r })) },
  { label: "Départements", options: [...GEO_DEPT_OPTIONS] },
];
