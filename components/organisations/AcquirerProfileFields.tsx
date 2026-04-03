"use client";
import { SectorsMultiSelect } from "./SectorsMultiSelect";
import { GeoSelect } from "@/components/ui/GeoSelect";
import { ACQUIRER_TYPES, ACQUISITION_MOTIVATIONS } from "@/lib/crm/matching-maps";

export interface AcquirerProfileData {
  acquirer_type: string;
  acquisition_motivations: string[];
  target_sectors: string[];
  target_geographies: string[];
  target_revenue_min: number | null;
  target_revenue_max: number | null;
  target_ebitda_min: number | null;
  target_ebitda_max: number | null;
  acquisition_history: string;
}

interface AcquirerProfileFieldsProps {
  data: AcquirerProfileData;
  onChange: (data: AcquirerProfileData) => void;
}

const lbl: React.CSSProperties = {
  display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5,
};
const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1px solid #d1d5db",
  borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", outline: "none",
  background: "#fff", color: "#111", boxSizing: "border-box",
};

export function AcquirerProfileFields({ data, onChange }: AcquirerProfileFieldsProps) {
  const safeMotivations = data?.acquisition_motivations ?? [];
  const safeSectors = data?.target_sectors ?? [];
  const safeGeos = data?.target_geographies ?? [];

  function toggleMotivation(v: string) {
    const next = safeMotivations.includes(v)
      ? safeMotivations.filter(m => m !== v)
      : [...safeMotivations, v];
    onChange({ ...data, acquisition_motivations: next });
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 14 }}>
        Profil Acquereur M&A
      </div>

      {/* Type d'acquéreur */}
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Type d&apos;acquereur</label>
        <select
          style={inp}
          value={data.acquirer_type ?? ""}
          onChange={e => onChange({ ...data, acquirer_type: e.target.value })}
        >
          <option value="">— Non renseigne —</option>
          {ACQUIRER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Motivations d'acquisition */}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, marginBottom: 16 }}>
        <label style={lbl}>Motivations d&apos;acquisition</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ACQUISITION_MOTIVATIONS.map(m => {
            const active = safeMotivations.includes(m.value);
            return (
              <button key={m.value} type="button" onClick={() => toggleMotivation(m.value)}
                style={{
                  padding: "5px 11px", borderRadius: 20,
                  border: `1.5px solid ${active ? "#1a56db" : "#e5e7eb"}`,
                  background: active ? "#EFF6FF" : "#fff",
                  color: active ? "#1a56db" : "#374151",
                  fontSize: 12.5, fontWeight: active ? 600 : 400,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                {active && "\u2713 "}{m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Secteurs cibles */}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, marginBottom: 16 }}>
        <label style={lbl}>Secteurs cibles</label>
        <SectorsMultiSelect value={safeSectors} onChange={val => onChange({ ...data, target_sectors: val })} />
      </div>

      {/* Géographies cibles */}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, marginBottom: 16 }}>
        <label style={lbl}>Geographies cibles</label>
        <GeoSelect mode="multi" value={safeGeos} onChange={val => onChange({ ...data, target_geographies: val })} />
      </div>

      {/* CA cible */}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, marginBottom: 16 }}>
        <label style={lbl}>Chiffre d&apos;affaires cible</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280" }}>Min</label>
            <input type="number" placeholder="ex: 1000000" value={data.target_revenue_min ?? ""} style={inp}
              onChange={e => onChange({ ...data, target_revenue_min: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280" }}>Max</label>
            <input type="number" placeholder="ex: 10000000" value={data.target_revenue_max ?? ""} style={inp}
              onChange={e => onChange({ ...data, target_revenue_max: e.target.value ? Number(e.target.value) : null })} />
          </div>
        </div>
      </div>

      {/* EBITDA cible */}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, marginBottom: 16 }}>
        <label style={lbl}>EBITDA cible</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280" }}>Min</label>
            <input type="number" placeholder="ex: 200000" value={data.target_ebitda_min ?? ""} style={inp}
              onChange={e => onChange({ ...data, target_ebitda_min: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280" }}>Max</label>
            <input type="number" placeholder="ex: 2000000" value={data.target_ebitda_max ?? ""} style={inp}
              onChange={e => onChange({ ...data, target_ebitda_max: e.target.value ? Number(e.target.value) : null })} />
          </div>
        </div>
      </div>

      {/* Historique acquisitions */}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
        <label style={lbl}>Historique d&apos;acquisitions</label>
        <textarea rows={3} style={{ ...inp, resize: "vertical" }}
          placeholder="Acquisitions passees, build-up en cours..."
          value={data.acquisition_history ?? ""}
          onChange={e => onChange({ ...data, acquisition_history: e.target.value })} />
      </div>
    </div>
  );
}
