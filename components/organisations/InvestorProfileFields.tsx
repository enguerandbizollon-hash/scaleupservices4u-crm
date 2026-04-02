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

// Stades d'investissement — multi-select (TEXT[] en base)
// "Généraliste" = investit dans tous les stades
export const STAGE_OPTIONS = [
  "Généraliste", "Seed", "Pré-Série A", "Série A", "Série B", "Growth", "Late Stage",
] as const;

export function ticketKeyFromMinMax(min: number | null, max: number | null): string {
  if (!min && !max) return "";
  for (const t of TICKET_OPTIONS) {
    if (t.min === min && t.max === max) return t.key;
  }
  const opt = TICKET_OPTIONS.find(t => t.min === min || t.max === max);
  return opt?.key ?? "";
}

export interface InvestorProfileData {
  ticketKey: string;
  stages: string[];
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

function StagesMultiSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  function toggle(stage: string) {
    if (stage === "Généraliste") {
      // Toggle Généraliste = soit tout, soit rien
      onChange(value.includes("Généraliste") ? [] : ["Généraliste"]);
      return;
    }
    // Si on sélectionne un stade spécifique, retirer Généraliste
    let next = value.filter(s => s !== "Généraliste");
    if (next.includes(stage)) {
      next = next.filter(s => s !== stage);
    } else {
      next = [...next, stage];
    }
    onChange(next);
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {STAGE_OPTIONS.map(s => {
        const selected = value.includes(s);
        const isGen = s === "Généraliste";
        return (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            style={{
              padding: "5px 12px",
              borderRadius: 20,
              border: `1.5px solid ${selected ? (isGen ? "#7C3AED" : "#1a56db") : "#d1d5db"}`,
              background: selected ? (isGen ? "#EDE9FE" : "#EFF6FF") : "#fff",
              color: selected ? (isGen ? "#5B21B6" : "#1a56db") : "#6b7280",
              fontSize: 12.5,
              fontWeight: selected ? 600 : 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {selected ? "✓ " : ""}{s}
          </button>
        );
      })}
    </div>
  );
}

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
          <label style={lbl}>Ticket d&apos;investissement</label>
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

        {/* Stades — multi-select */}
        <div>
          <label style={lbl}>Stades d&apos;investissement</label>
          <StagesMultiSelect value={data.stages} onChange={val => set("stages")(val)} />
        </div>
      </div>

      {/* Secteurs */}
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Secteurs d&apos;investissement <span style={{ fontWeight: 400, color: "#9ca3af" }}>(max 3)</span></label>
        <SectorsMultiSelect value={data.sectors} onChange={val => set("sectors")(val)} />
      </div>

      {/* Géographies */}
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Géographies d&apos;investissement</label>
        <GeographiesMultiSelect value={data.geographies} onChange={val => set("geographies")(val)} />
      </div>

      {/* Thèse */}
      <div>
        <label style={lbl}>Thèse / Profil d&apos;investissement</label>
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
