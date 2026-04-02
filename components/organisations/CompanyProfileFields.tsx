"use client";
import { SECTORS, ORG_COMPANY_STAGES, REVENUE_RANGES } from "@/lib/crm/matching-maps";

export interface CompanyProfileData {
  founded_year:   number | null;
  employee_count: number | null;
  company_stage:  string;
  revenue_range:  string;
  sector:         string;
}

interface Props {
  data:     CompanyProfileData;
  onChange: (d: CompanyProfileData) => void;
}

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8,
  fontSize: 13.5, fontFamily: "inherit", outline: "none", background: "#fff",
  color: "#111", boxSizing: "border-box",
};
const sel: React.CSSProperties = { ...inp };
const lbl: React.CSSProperties = {
  display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5,
};
const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 };

export function CompanyProfileFields({ data, onChange }: Props) {
  function set<K extends keyof CompanyProfileData>(key: K, val: CompanyProfileData[K]) {
    onChange({ ...data, [key]: val });
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 14 }}>
        Profil entreprise
      </div>

      {/* Ligne 1 */}
      <div style={{ ...grid2, marginBottom: 14 }}>
        <div>
          <label style={lbl}>Secteur d'activité</label>
          <select style={sel} value={data.sector} onChange={e => set("sector", e.target.value)}>
            <option value="">— Sélectionner —</option>
            {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Stade / Taille</label>
          <select style={sel} value={data.company_stage} onChange={e => set("company_stage", e.target.value)}>
            <option value="">— Sélectionner —</option>
            {ORG_COMPANY_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Ligne 2 */}
      <div style={{ ...grid2, marginBottom: 0 }}>
        <div>
          <label style={lbl}>Tranche de CA</label>
          <select style={sel} value={data.revenue_range} onChange={e => set("revenue_range", e.target.value)}>
            <option value="">— Sélectionner —</option>
            {REVENUE_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Effectifs</label>
          <input
            type="number"
            min={1}
            style={inp}
            placeholder="ex : 45"
            value={data.employee_count ?? ""}
            onChange={e => set("employee_count", e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={lbl}>Année de création</label>
        <input
          type="number"
          min={1800}
          max={new Date().getFullYear()}
          style={{ ...inp, maxWidth: 160 }}
          placeholder={`ex : 2012`}
          value={data.founded_year ?? ""}
          onChange={e => set("founded_year", e.target.value ? parseInt(e.target.value) : null)}
        />
      </div>
    </div>
  );
}
