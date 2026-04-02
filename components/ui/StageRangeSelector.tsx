"use client";
import { useState } from "react";

const STAGES = [
  { value: "Seed",          label: "Seed",       index: 0 },
  { value: "Pré-Série A",   label: "Pré-A",      index: 1 },
  { value: "Série A",       label: "Série A",     index: 2 },
  { value: "Série B",       label: "Série B",     index: 3 },
  { value: "Growth",        label: "Growth",      index: 4 },
  { value: "Late Stage",    label: "Late Stage",  index: 5 },
] as const;

function stageIndex(value: string | null): number | null {
  if (!value) return null;
  const s = STAGES.find(s => s.value === value);
  return s?.index ?? null;
}

interface StageRangeSelectorProps {
  value: { min: string | null; max: string | null };
  onChange: (v: { min: string | null; max: string | null }) => void;
}

export function StageRangeSelector({ value, onChange }: StageRangeSelectorProps) {
  const [selectingMin, setSelectingMin] = useState(true);

  const minIdx = stageIndex(value.min);
  const maxIdx = stageIndex(value.max);
  const hasSelection = minIdx !== null && maxIdx !== null;

  function handleClick(stage: typeof STAGES[number]) {
    if (!hasSelection) {
      // Première sélection = min
      onChange({ min: stage.value, max: stage.value });
      setSelectingMin(false);
      return;
    }

    if (selectingMin) {
      // Sélection du min
      const newMin = stage.index;
      const currentMax = maxIdx!;
      if (newMin <= currentMax) {
        onChange({ min: stage.value, max: value.max });
      } else {
        // Si min > max actuel, réinitialiser
        onChange({ min: stage.value, max: stage.value });
      }
      setSelectingMin(false);
    } else {
      // Sélection du max
      const currentMin = minIdx!;
      const newMax = stage.index;
      if (newMax >= currentMin) {
        onChange({ min: value.min, max: stage.value });
      } else {
        // Si max < min actuel, réinitialiser
        onChange({ min: stage.value, max: stage.value });
      }
      setSelectingMin(true);
    }
  }

  function handleClear() {
    onChange({ min: null, max: null });
    setSelectingMin(true);
  }

  const spread = hasSelection ? Math.abs(maxIdx! - minIdx!) : 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
        {STAGES.map(stage => {
          const isInRange = hasSelection && stage.index >= minIdx! && stage.index <= maxIdx!;
          const isEndpoint = hasSelection && (stage.index === minIdx || stage.index === maxIdx);

          return (
            <button
              key={stage.value}
              type="button"
              onClick={() => handleClick(stage)}
              style={{
                flex: 1,
                padding: "7px 4px",
                borderRadius: 8,
                border: `1.5px solid ${isEndpoint ? "#1a56db" : isInRange ? "#93c5fd" : "#d1d5db"}`,
                background: isEndpoint ? "#1a56db" : isInRange ? "#eff6ff" : "#fff",
                color: isEndpoint ? "#fff" : isInRange ? "#1a56db" : "#6b7280",
                fontSize: 11,
                fontWeight: isInRange ? 600 : 500,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all .12s",
              }}
            >
              {stage.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>
          {hasSelection
            ? spread === 0
              ? `${value.min} uniquement`
              : `${value.min} → ${value.max} (${spread} stade${spread > 1 ? "s" : ""})`
            : "Tous stages"
          }
        </span>
        {hasSelection && (
          <button
            type="button"
            onClick={handleClear}
            style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}
          >
            Réinitialiser
          </button>
        )}
      </div>
    </div>
  );
}
