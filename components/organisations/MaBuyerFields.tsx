"use client";
import { FacetMultiSelect } from "@/components/ui/FacetMultiSelect";
import { SECTOR_FACET_GROUPS } from "@/components/ui/referential-facets";

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

export function MaBuyerFields({ data, onChange }: Props) {
  function set<K extends keyof MaBuyerData>(key: K, val: MaBuyerData[K]) {
    onChange({ ...data, [key]: val });
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 14 }}>
        Critères d&apos;acquisition
      </div>

      {/* Rationale */}
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Rationale stratégique</label>
        <textarea
          rows={2}
          style={{ ...inp, resize: "vertical" }}
          placeholder="ex : croissance externe dans les logiciels industriels pour renforcer l'offre..."
          value={data.acquisition_rationale}
          onChange={e => set("acquisition_rationale", e.target.value)}
        />
      </div>

      {/* Secteurs exclus — deal breakers */}
      <div>
        <label style={lbl}>Secteurs exclus (deal breakers)</label>
        <FacetMultiSelect
          groups={SECTOR_FACET_GROUPS}
          selected={data.excluded_sectors}
          onChange={v => set("excluded_sectors", v)}
          variant="exclude"
          placeholder="Rechercher un secteur à exclure…"
        />
      </div>
    </div>
  );
}
