"use client";
import { FacetMultiSelect } from "@/components/ui/FacetMultiSelect";
import { GEO_FACET_GROUPS } from "@/components/ui/referential-facets";

interface GeographiesMultiSelectProps {
  value: string[];
  onChange: (geos: string[]) => void;
}

// Géographies cibles (multi), recherchables et groupées France / régions /
// départements. Même référentiel que le wizard de mandat.
export function GeographiesMultiSelect({ value, onChange }: GeographiesMultiSelectProps) {
  return (
    <FacetMultiSelect
      groups={GEO_FACET_GROUPS}
      selected={value}
      onChange={onChange}
      variant="target"
      placeholder="Rechercher une zone, une région, un département…"
    />
  );
}
