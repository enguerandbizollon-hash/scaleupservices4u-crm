"use client";
import { GEOGRAPHIES } from "@/lib/crm/matching-maps";

interface GeographiesMultiSelectProps {
  value: string[];
  onChange: (geos: string[]) => void;
}

export function GeographiesMultiSelect({ value, onChange }: GeographiesMultiSelectProps) {
  function toggle(geo: string) {
    onChange(value.includes(geo) ? value.filter(g => g !== geo) : [...value, geo]);
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {GEOGRAPHIES.map(({ value: geoVal, label }) => {
          const active = value.includes(geoVal);
          return (
            <button
              key={geoVal}
              type="button"
              onClick={() => toggle(geoVal)}
              style={{
                padding: "5px 11px",
                borderRadius: 20,
                border: `1.5px solid ${active ? "#1a56db" : "#e5e7eb"}`,
                background: active ? "#eff6ff" : "#fff",
                color: active ? "#1a56db" : "#374151",
                fontSize: 12.5,
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all .1s",
              }}
            >
              {active && "✓ "}{label}
            </button>
          );
        })}
      </div>
      {value.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 11.5, color: "#6b7280" }}>
          {value.length} zone{value.length > 1 ? "s" : ""} sélectionnée{value.length > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
