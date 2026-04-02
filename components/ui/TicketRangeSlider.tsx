"use client";
import { useState, useCallback } from "react";

// Paliers logarithmiques fixes
const STEPS = [0, 100_000, 250_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000];
const MAX_INDEX = STEPS.length - 1;

function valueToIndex(v: number | null): number {
  if (v === null) return MAX_INDEX;
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i] >= v) return i;
  }
  return MAX_INDEX;
}

function indexToValue(i: number): number | null {
  if (i >= MAX_INDEX) return null; // 100M+ = pas de plafond
  return STEPS[i];
}

function formatAmount(v: number | null): string {
  if (v === null || v >= 100_000_000) return "100M+";
  if (v === 0) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

interface TicketRangeSliderProps {
  value: { min: number | null; max: number | null };
  onChange: (v: { min: number | null; max: number | null }) => void;
}

export function TicketRangeSlider({ value, onChange }: TicketRangeSliderProps) {
  const [minIdx, setMinIdx] = useState(() => value.min !== null ? valueToIndex(value.min) : 0);
  const [maxIdx, setMaxIdx] = useState(() => valueToIndex(value.max));

  const handleMinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let idx = Number(e.target.value);
    if (idx > maxIdx) idx = maxIdx;
    setMinIdx(idx);
    onChange({ min: STEPS[idx] === 0 ? null : STEPS[idx], max: indexToValue(maxIdx) });
  }, [maxIdx, onChange]);

  const handleMaxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let idx = Number(e.target.value);
    if (idx < minIdx) idx = minIdx;
    setMaxIdx(idx);
    onChange({ min: STEPS[minIdx] === 0 ? null : STEPS[minIdx], max: indexToValue(idx) });
  }, [minIdx, onChange]);

  const minPercent = (minIdx / MAX_INDEX) * 100;
  const maxPercent = (maxIdx / MAX_INDEX) * 100;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1a56db" }}>
          {STEPS[minIdx] === 0 ? "Min" : `${formatAmount(STEPS[minIdx])}€`}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1a56db" }}>
          {maxIdx >= MAX_INDEX ? "100M€+" : `${formatAmount(STEPS[maxIdx])}€`}
        </span>
      </div>

      <div style={{ position: "relative", height: 32 }}>
        {/* Track background */}
        <div style={{ position: "absolute", top: 14, left: 0, right: 0, height: 4, borderRadius: 2, background: "#e5e7eb" }} />
        {/* Active range */}
        <div style={{ position: "absolute", top: 14, left: `${minPercent}%`, width: `${maxPercent - minPercent}%`, height: 4, borderRadius: 2, background: "#1a56db" }} />

        {/* Min slider */}
        <input
          type="range"
          min={0}
          max={MAX_INDEX}
          step={1}
          value={minIdx}
          onChange={handleMinChange}
          style={{
            position: "absolute", top: 4, left: 0, width: "100%", height: 24,
            WebkitAppearance: "none", appearance: "none", background: "transparent",
            pointerEvents: "none", zIndex: 3,
          }}
          className="ticket-range-thumb"
        />
        {/* Max slider */}
        <input
          type="range"
          min={0}
          max={MAX_INDEX}
          step={1}
          value={maxIdx}
          onChange={handleMaxChange}
          style={{
            position: "absolute", top: 4, left: 0, width: "100%", height: 24,
            WebkitAppearance: "none", appearance: "none", background: "transparent",
            pointerEvents: "none", zIndex: 4,
          }}
          className="ticket-range-thumb"
        />
      </div>

      {/* Paliers labels */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        {[0, 2, 4, 6, 8, 10].map(i => (
          <span key={i} style={{ fontSize: 9.5, color: "#9ca3af" }}>
            {formatAmount(STEPS[i])}
          </span>
        ))}
      </div>

      <style>{`
        .ticket-range-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px; height: 16px;
          border-radius: 50%;
          background: #1a56db;
          border: 2px solid #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,.2);
          cursor: pointer;
          pointer-events: auto;
        }
        .ticket-range-thumb::-moz-range-thumb {
          width: 16px; height: 16px;
          border-radius: 50%;
          background: #1a56db;
          border: 2px solid #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,.2);
          cursor: pointer;
          pointer-events: auto;
        }
      `}</style>
    </div>
  );
}
