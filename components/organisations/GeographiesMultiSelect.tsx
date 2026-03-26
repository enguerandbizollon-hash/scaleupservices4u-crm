"use client";
import { GEOGRAPHIES } from "@/lib/crm/matching-maps";

interface GeographiesMultiSelectProps {
  value: string[];
  onChange: (geos: string[]) => void;
}

export function GeographiesMultiSelect({ value, onChange }: GeographiesMultiSelectProps) {
  function toggle(geo: string) {
    if (geo === "global") {
      // Global est exclusif : sélectionne tout ou rien
      if (value.includes("global")) {
        onChange([]);
      } else {
        onChange(["global"]);
      }
      return;
    }
    // Si Global est actif, retirer Global d'abord
    const base = value.filter(g => g !== "global");
    if (base.includes(geo)) {
      onChange(base.filter(g => g !== geo));
    } else {
      onChange([...base, geo]);
    }
  }

  const isGlobal = value.includes("global");

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {GEOGRAPHIES.map(({ value: geoVal, label }) => {
          const active = value.includes(geoVal);
          const disabled = !active && isGlobal && geoVal !== "global";
          return (
            <button
              key={geoVal}
              type="button"
              disabled={disabled}
              onClick={() => toggle(geoVal)}
              style={{
                padding: "5px 11px",
                borderRadius: 20,
                border: `1.5px solid ${active ? "#1a56db" : "#e5e7eb"}`,
                background: active ? "#eff6ff" : "#fff",
                color: active ? "#1a56db" : disabled ? "#9ca3af" : "#374151",
                fontSize: 12.5,
                fontWeight: active ? 600 : 400,
                cursor: disabled ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: disabled ? 0.55 : 1,
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
