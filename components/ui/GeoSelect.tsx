"use client";
import { useState } from "react";
import { GEO_ZONES, GEO_REGIONS_FRANCE, GEO_REGIONS_SUISSE, GEO_LABELS } from "@/lib/crm/matching-maps";

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
  );
}

function GeoSelectMulti({ value, onChange, placeholder }: GeoSelectMultiProps) {
  const [showRegionsFR, setShowRegionsFR] = useState(
    value.some(v => (GEO_REGIONS_FRANCE as readonly string[]).includes(v))
  );
  const [showRegionsCH, setShowRegionsCH] = useState(
    value.some(v => (GEO_REGIONS_SUISSE as readonly string[]).includes(v))
  );

  function toggle(geo: string) {
    if (geo === "global") {
      onChange(value.includes("global") ? [] : ["global"]);
      return;
    }
    let next = value.filter(v => v !== "global");
    if (next.includes(geo)) {
      next = next.filter(v => v !== geo);
    } else {
      next = [...next, geo];
    }
    onChange(next);
  }

  const isGlobal = value.includes("global");

  return (
    <div>
      {/* Zones */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {GEO_ZONES.map(g => {
          const active = value.includes(g);
          const disabled = g !== "global" && isGlobal;
          const isG = g === "global";
          return (
            <button key={g} type="button" disabled={disabled} onClick={() => toggle(g)}
              style={{
                padding: "5px 11px", borderRadius: 20,
                border: `1.5px solid ${active ? (isG ? "#7C3AED" : "#1a56db") : "#e5e7eb"}`,
                background: active ? (isG ? "#EDE9FE" : "#EFF6FF") : "#fff",
                color: active ? (isG ? "#5B21B6" : "#1a56db") : disabled ? "#9ca3af" : "#374151",
                fontSize: 12.5, fontWeight: active ? 600 : 400,
                cursor: disabled ? "not-allowed" : "pointer",
                fontFamily: "inherit", opacity: disabled ? 0.55 : 1,
              }}>
              {active && "✓ "}{GEO_LABELS[g] ?? g}
            </button>
          );
        })}
      </div>

      {/* Régions France (dépliable) */}
      <button type="button" onClick={() => setShowRegionsFR(p => !p)}
        style={{ fontSize: 11.5, color: "#6b7280", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", marginBottom: showRegionsFR ? 6 : 0, textDecoration: "underline" }}>
        {showRegionsFR ? "▾ Régions France" : "▸ Régions France"}
      </button>
      {showRegionsFR && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {GEO_REGIONS_FRANCE.map(g => {
            const active = value.includes(g);
            const disabled = isGlobal;
            return (
              <button key={g} type="button" disabled={disabled} onClick={() => toggle(g)}
                style={{
                  padding: "4px 9px", borderRadius: 20,
                  border: `1.5px solid ${active ? "#1a56db" : "#e5e7eb"}`,
                  background: active ? "#EFF6FF" : "#fff",
                  color: active ? "#1a56db" : disabled ? "#9ca3af" : "#374151",
                  fontSize: 11.5, fontWeight: active ? 600 : 400,
                  cursor: disabled ? "not-allowed" : "pointer",
                  fontFamily: "inherit", opacity: disabled ? 0.55 : 1,
                }}>
                {active && "✓ "}{GEO_LABELS[g] ?? g}
              </button>
            );
          })}
        </div>
      )}

      {/* Régions Suisse (dépliable) */}
      <button type="button" onClick={() => setShowRegionsCH(p => !p)}
        style={{ fontSize: 11.5, color: "#6b7280", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", marginBottom: showRegionsCH ? 6 : 0, textDecoration: "underline" }}>
        {showRegionsCH ? "▾ Régions Suisse" : "▸ Régions Suisse"}
      </button>
      {showRegionsCH && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {GEO_REGIONS_SUISSE.map(g => {
            const active = value.includes(g);
            const disabled = isGlobal;
            return (
              <button key={g} type="button" disabled={disabled} onClick={() => toggle(g)}
                style={{
                  padding: "4px 9px", borderRadius: 20,
                  border: `1.5px solid ${active ? "#1a56db" : "#e5e7eb"}`,
                  background: active ? "#EFF6FF" : "#fff",
                  color: active ? "#1a56db" : disabled ? "#9ca3af" : "#374151",
                  fontSize: 11.5, fontWeight: active ? 600 : 400,
                  cursor: disabled ? "not-allowed" : "pointer",
                  fontFamily: "inherit", opacity: disabled ? 0.55 : 1,
                }}>
                {active && "✓ "}{GEO_LABELS[g] ?? g}
              </button>
            );
          })}
        </div>
      )}

      {value.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 11.5, color: "#6b7280" }}>
          {value.length} zone{value.length > 1 ? "s" : ""} sélectionnée{value.length > 1 ? "s" : ""}
        </div>
      )}
      {value.length === 0 && placeholder && (
        <div style={{ marginTop: 4, fontSize: 11.5, color: "#9ca3af" }}>{placeholder}</div>
      )}
    </div>
  );
}
