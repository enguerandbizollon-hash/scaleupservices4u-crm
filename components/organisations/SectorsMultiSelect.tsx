"use client";
import { FacetMultiSelect } from "@/components/ui/FacetMultiSelect";
import { SECTOR_FACET_GROUPS } from "@/components/ui/referential-facets";

interface SectorsMultiSelectProps {
  value: string[];
  onChange: (sectors: string[]) => void;
}

// Secteurs cibles (multi), recherchables et groupés par famille. Tolère une
// valeur héritée hors référentiel (ex. « Généraliste » stocké autrefois) :
// FacetMultiSelect l'affiche par son libellé et permet de la retirer.
export function SectorsMultiSelect({ value, onChange }: SectorsMultiSelectProps) {
  return (
    <FacetMultiSelect
      groups={SECTOR_FACET_GROUPS}
      selected={value}
      onChange={onChange}
      variant="target"
      placeholder="Rechercher un secteur…"
    />
  );
}
