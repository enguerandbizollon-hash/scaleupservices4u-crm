"use client";
import { GEO_ZONES, GEO_REGIONS_FRANCE, GEO_LABELS } from "@/lib/crm/matching-maps";
import { GEO_DEPT_OPTIONS } from "@/lib/crm/departements";
import { FacetMultiSelect } from "@/components/ui/FacetMultiSelect";
import { GEO_FACET_GROUPS } from "@/components/ui/referential-facets";

interface GeoSelectSingleProps {
  mode: "single";
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}

interface GeoSelectMultiProps {
  mode: "multi";
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}

type GeoSelectProps = GeoSelectSingleProps | GeoSelectMultiProps;

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1px solid #d1d5db",
  borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", outline: "none",
  background: "#fff", color: "#111", boxSizing: "border-box",
};

export function GeoSelect(props: GeoSelectProps) {
  if (props.mode === "single") return <GeoSelectSingle {...props} />;
  return <GeoSelectMulti {...props} />;
}

function GeoSelectSingle({ value, onChange, placeholder }: GeoSelectSingleProps) {
  return (
    <select
      style={inp}
      value={value ?? ""}
      onChange={e => onChange(e.target.value || null)}
    >
      <option value="">{placeholder ?? "— Non renseigné —"}</option>
      <optgroup label="France">
        {GEO_ZONES.map(v => <option key={v} value={v}>{GEO_LABELS[v] ?? v}</option>)}
      </optgroup>
      <optgroup label="Régions">
        {GEO_REGIONS_FRANCE.map(v => <option key={v} value={v}>{GEO_LABELS[v] ?? v}</option>)}
      </optgroup>
      <optgroup label="Départements">
        {GEO_DEPT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </optgroup>
    </select>
  );
}

// Géographies cibles (multi) : même sélecteur recherchable et groupé que le
// wizard de mandat (France / régions / départements).
function GeoSelectMulti({ value, onChange, placeholder }: GeoSelectMultiProps) {
  return (
    <FacetMultiSelect
      groups={GEO_FACET_GROUPS}
      selected={value}
      onChange={onChange}
      variant="target"
      placeholder={placeholder ?? "Rechercher une zone, une région, un département…"}
    />
  );
}
