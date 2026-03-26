"use client";
import { SECTORS } from "@/lib/crm/matching-maps";

// Alias pour la compatibilité des imports existants
export const SECTOR_OPTIONS = [...SECTORS];

interface SectorsMultiSelectProps {
  value: string[];
  onChange: (sectors: string[]) => void;
}

export function SectorsMultiSelect({ value, onChange }: SectorsMultiSelectProps) {
  const isGeneraliste = value.includes("Généraliste");
  const atMax = value.length >= 3;

  function toggle(sector: string) {
    if (sector === "Généraliste") {
      // Généraliste est exclusif : désactive tous les autres
      if (isGeneraliste) {
        onChange([]);
      } else {
        onChange(["Généraliste"]);
      }
      return;
    }
    // Si Généraliste est actif, on le retire d'abord
    const base = value.filter(s => s !== "Généraliste");
    if (base.includes(sector)) {
      onChange(base.filter(s => s !== sector));
    } else if (base.length < 3) {
      onChange([...base, sector]);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {SECTOR_OPTIONS.map(sector => {
          const active = value.includes(sector);
          const disabled = !active && (
            (sector === "Généraliste" && value.length > 0 && !isGeneraliste) ||
            (sector !== "Généraliste" && (isGeneraliste || atMax))
          );
          return (
            <button
              key={sector}
              type="button"
              disabled={disabled}
              onClick={() => toggle(sector)}
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
              {active && "✓ "}{sector}
            </button>
          );
        })}
      </div>
      {value.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 11.5, color: "#6b7280" }}>
          {value.length}/3 secteur{value.length > 1 ? "s" : ""} sélectionné{value.length > 1 ? "s" : ""}
          {atMax && !isGeneraliste && (
            <span style={{ color: "#92400E", fontWeight: 600 }}> · Maximum 3 secteurs atteint</span>
          )}
        </div>
      )}
    </div>
  );
}
