"use client";
import { SECTORS } from "@/lib/crm/matching-maps";

export interface MaBuyerData {
  acquisition_rationale: string;
  excluded_sectors:      string[];
}

interface Props {
  data:     MaBuyerData;
  onChange: (d: MaBuyerData) => void;
}

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8,
  fontSize: 13.5, fontFamily: "inherit", outline: "none", background: "#fff",
  color: "#111", boxSizing: "border-box",
};
const lbl: React.CSSProperties = {
  display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5,
};

function SectorPills({
  selected,
  onChange,
  label,
  accent = "#dc2626",
  accentBg = "#fef2f2",
}: {
  selected:  string[];
  onChange:  (s: string[]) => void;
  label:     string;
  accent?:   string;
  accentBg?: string;
}) {
  function toggle(s: string) {
    selected.includes(s)
      ? onChange(selected.filter(x => x !== s))
      : onChange([...selected, s]);
  }
  return (
    <div>
      <label style={lbl}>{label}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {SECTORS.filter(s => s !== "Généraliste").map(s => {
          const active = selected.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              style={{
                padding: "4px 10px",
                borderRadius: 20,
                border: `1.5px solid ${active ? accent : "#e5e7eb"}`,
                background: active ? accentBg : "#fff",
                color: active ? accent : "#374151",
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all .1s",
              }}
            >
              {active && "✓ "}{s}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div style={{ marginTop: 4, fontSize: 11.5, color: "#6b7280" }}>
          {selected.length} secteur{selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

export function MaBuyerFields({ data, onChange }: Props) {
  function set<K extends keyof MaBuyerData>(key: K, val: MaBuyerData[K]) {
    onChange({ ...data, [key]: val });
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 14 }}>
        Critères d'acquisition
      </div>

      {/* Rationale */}
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Rationale stratégique</label>
        <textarea
          rows={2}
          style={{ ...inp, resize: "vertical" }}
          placeholder="ex: Croissance externe dans les logiciels industriels pour renforcer l'offre SaaS..."
          value={data.acquisition_rationale}
          onChange={e => set("acquisition_rationale", e.target.value)}
        />
      </div>

      {/* Secteurs exclus — deal breakers */}
      <div>
        <SectorPills
          label="Secteurs exclus (deal breakers)"
          selected={data.excluded_sectors}
          onChange={v => set("excluded_sectors", v)}
          accent="#dc2626"
          accentBg="#fef2f2"
        />
      </div>
    </div>
  );
}
