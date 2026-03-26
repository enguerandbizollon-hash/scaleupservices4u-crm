"use client";
import { SectorsMultiSelect } from "./SectorsMultiSelect";
import { GeographiesMultiSelect } from "./GeographiesMultiSelect";

export const TICKET_OPTIONS = [
  { key: "",        label: "— Non renseigné —", min: null,       max: null },
  { key: "lt_500k", label: "< 500K€",           min: null,       max: 500000 },
  { key: "500k_1m", label: "500K – 1M€",        min: 500000,     max: 1000000 },
  { key: "1m_3m",   label: "1M – 3M€",          min: 1000000,    max: 3000000 },
  { key: "3m_10m",  label: "3M – 10M€",         min: 3000000,    max: 10000000 },
  { key: "10m_25m", label: "10M – 25M€",        min: 10000000,   max: 25000000 },
  { key: "gt_25m",  label: "> 25M€",            min: 25000000,   max: null },
];

// Valeurs UI investisseur = union de toutes les valeurs compatibles dans STAGE_MAP
// L'ordre reflète la progression des stades
export const STAGE_OPTIONS = [
  "", "Seed", "Pré-Série A", "Série A", "Série B", "Growth", "Late Stage",
];
// Note : ces libellés correspondent aux valeurs stockées dans investor_stages (TEXT[])
// et sont utilisés comme clés dans STAGE_MAP côté scoring

export function ticketKeyFromMinMax(min: number | null, max: number | null): string {
  if (!min && !max) return "";
  for (const t of TICKET_OPTIONS) {
    if (t.min === min && t.max === max) return t.key;
  }
  // fallback: find closest
  const opt = TICKET_OPTIONS.find(t => t.min === min || t.max === max);
  return opt?.key ?? "";
}

export interface InvestorProfileData {
  ticketKey: string;
  stage: string;
  sectors: string[];
  geographies: string[];
  thesis: string;
}

interface InvestorProfileFieldsProps {
  orgType: string;
  data: InvestorProfileData;
  onChange: (data: InvestorProfileData) => void;
}

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1px solid #d1d5db",
  borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", outline: "none",
  background: "#fff", color: "#111", boxSizing: "border-box",
};
const lbl: React.CSSProperties = {
  display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5,
};

const profileTitle: Record<string, string> = {
  investor:       "Profil Investisseur",
  business_angel: "Profil Business Angel",
  family_office:  "Profil Family Office",
  corporate:      "Profil Corporate / CVC",
};

export function InvestorProfileFields({ orgType, data, onChange }: InvestorProfileFieldsProps) {
  const set = (key: keyof InvestorProfileData) => (val: unknown) =>
    onChange({ ...data, [key]: val });

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 14 }}>
        {profileTitle[orgType] ?? "Profil Investisseur"}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* Ticket */}
        <div>
          <label style={lbl}>Ticket d'investissement</label>
          <select
            style={{ ...inp }}
            value={data.ticketKey}
            onChange={e => set("ticketKey")(e.target.value)}
          >
            {TICKET_OPTIONS.map(t => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Stade */}
        <div>
          <label style={lbl}>Stade d'investissement</label>
          <select
            style={{ ...inp }}
            value={data.stage}
            onChange={e => set("stage")(e.target.value)}
          >
            {STAGE_OPTIONS.map(s => (
              <option key={s} value={s}>{s || "— Non renseigné —"}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Secteurs */}
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Secteurs d'investissement <span style={{ fontWeight: 400, color: "#9ca3af" }}>(max 3)</span></label>
        <SectorsMultiSelect value={data.sectors} onChange={val => set("sectors")(val)} />
      </div>

      {/* Géographies */}
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Géographies d'investissement</label>
        <GeographiesMultiSelect value={data.geographies} onChange={val => set("geographies")(val)} />
      </div>

      {/* Thèse */}
      <div>
        <label style={lbl}>Thèse / Profil d'investissement</label>
        <textarea
          rows={3}
          style={{ ...inp, resize: "vertical" }}
          placeholder="ex: Spécialiste SaaS B2B Europe, tickets Seed à Série A..."
          value={data.thesis}
          onChange={e => set("thesis")(e.target.value)}
        />
      </div>
    </div>
  );
}
