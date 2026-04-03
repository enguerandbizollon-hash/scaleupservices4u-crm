"use client";
import { useState } from "react";
import { GEO_ZONES, GEO_REGIONS_FRANCE, GEO_REGIONS_SUISSE, GEO_LABELS } from "@/lib/crm/matching-maps";

/**
 * GeoSelect wrapper for native <form> submissions.
 * Renders a visible <select> with geo options + syncs to a hidden <input name=...>.
 * Can be embedded in Server Component forms.
 */
interface GeoSelectFieldProps {
  name: string;
  defaultValue?: string;
  label?: string;
  placeholder?: string;
  style?: React.CSSProperties;
}

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1px solid #d1d5db",
  borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", outline: "none",
  background: "#fff", color: "#111", boxSizing: "border-box",
};

export function GeoSelectField({ name, defaultValue, placeholder, style }: GeoSelectFieldProps) {
  const [value, setValue] = useState(defaultValue ?? "");

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <select
        style={style ?? inp}
        value={value}
        onChange={e => setValue(e.target.value)}
      >
        <option value="">{placeholder ?? "— Non renseignée —"}</option>
        <optgroup label="Zones">
          {GEO_ZONES.map(v => <option key={v} value={v}>{GEO_LABELS[v] ?? v}</option>)}
        </optgroup>
        <optgroup label="Régions France">
          {GEO_REGIONS_FRANCE.map(v => <option key={v} value={v}>{GEO_LABELS[v] ?? v}</option>)}
        </optgroup>
        <optgroup label="Régions Suisse">
          {GEO_REGIONS_SUISSE.map(v => <option key={v} value={v}>{GEO_LABELS[v] ?? v}</option>)}
        </optgroup>
      </select>
    </>
  );
}
