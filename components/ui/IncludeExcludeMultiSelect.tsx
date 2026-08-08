"use client";
import { FacetMultiSelect, type FacetGroup } from "./FacetMultiSelect";

// Deux facettes visés (vert) / exclus (rouge) sur un même référentiel groupé,
// avec disjonction garantie (ajouter en visé retire des exclus et inversement).
// Sert aussi bien les secteurs que les géographies.
export function IncludeExcludeMultiSelect({
  groups, included, excluded, onIncluded, onExcluded, includeLabel, excludeLabel,
}: {
  groups: FacetGroup[];
  included: string[];
  excluded: string[];
  onIncluded: (v: string[]) => void;
  onExcluded: (v: string[]) => void;
  includeLabel?: string;
  excludeLabel?: string;
}) {
  const setIncluded = (v: string[]) => {
    onIncluded(v);
    if (excluded.some((x) => v.includes(x))) onExcluded(excluded.filter((x) => !v.includes(x)));
  };
  const setExcluded = (v: string[]) => {
    onExcluded(v);
    if (included.some((x) => v.includes(x))) onIncluded(included.filter((x) => !v.includes(x)));
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#065F46", marginBottom: 5 }}>
          {includeLabel ?? "Visés"}{included.length > 0 ? ` · ${included.length}` : ""}
        </div>
        <FacetMultiSelect groups={groups} selected={included} onChange={setIncluded} variant="target" placeholder="Rechercher à inclure…" disabledValues={excluded} />
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#991B1B", marginBottom: 5 }}>
          {excludeLabel ?? "Exclus"}{excluded.length > 0 ? ` · ${excluded.length}` : ""}
        </div>
        <FacetMultiSelect groups={groups} selected={excluded} onChange={setExcluded} variant="exclude" placeholder="Rechercher à exclure…" disabledValues={included} />
      </div>
    </div>
  );
}
