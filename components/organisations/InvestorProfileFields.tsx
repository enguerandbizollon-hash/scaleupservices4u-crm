"use client";
import { SectorsMultiSelect } from "./SectorsMultiSelect";
import { GeographiesMultiSelect } from "./GeographiesMultiSelect";
import { TicketRangeSlider } from "@/components/ui/TicketRangeSlider";
import { StageRangeSelector } from "@/components/ui/StageRangeSelector";

// Conservé pour backward compat (ticketKeyFromMinMax utilisé ailleurs)
export const TICKET_OPTIONS = [
  { key: "",        label: "— Non renseigné —", min: null,       max: null },
  { key: "lt_500k", label: "< 500K€",           min: null,       max: 500000 },
  { key: "500k_1m", label: "500K – 1M€",        min: 500000,     max: 1000000 },
  { key: "1m_3m",   label: "1M – 3M€",          min: 1000000,    max: 3000000 },
  { key: "3m_10m",  label: "3M – 10M€",         min: 3000000,    max: 10000000 },
  { key: "10m_25m", label: "10M – 25M€",        min: 10000000,   max: 25000000 },
  { key: "gt_25m",  label: "> 25M€",            min: 25000000,   max: null },
];

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
  ticketMin: number | null;
  ticketMax: number | null;
  stageMin: string | null;
  stageMax: string | null;
  sectors: string[];
  geographies: string[];
  thesis: string;
}

interface InvestorProfileFieldsProps {
  orgType: string;
  data: InvestorProfileData;
  onChange: (data: InvestorProfileData) => void;
}

const lbl: React.CSSProperties = {
  display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5,
};
const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1px solid #d1d5db",
  borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", outline: "none",
  background: "#fff", color: "#111", boxSizing: "border-box",
};

const profileTitle: Record<string, string> = {
  investor:       "Profil Investisseur",
  business_angel: "Profil Business Angel",
  family_office:  "Profil Family Office",
  corporate:      "Profil Corporate / CVC",
};

export function InvestorProfileFields({ orgType, data, onChange }: InvestorProfileFieldsProps) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 14 }}>
        {profileTitle[orgType] ?? "Profil Investisseur"}
      </div>

      {/* Ticket — range slider */}
      <div style={{ marginBottom: 18 }}>
        <label style={lbl}>Ticket d&apos;investissement</label>
        <TicketRangeSlider
          value={{ min: data.ticketMin, max: data.ticketMax }}
          onChange={v => onChange({ ...data, ticketMin: v.min, ticketMax: v.max })}
        />
      </div>

      {/* Stades — range selector */}
      <div style={{ marginBottom: 18 }}>
        <label style={lbl}>Stades d&apos;investissement</label>
        <StageRangeSelector
          value={{ min: data.stageMin, max: data.stageMax }}
          onChange={v => onChange({ ...data, stageMin: v.min, stageMax: v.max })}
        />
      </div>

      {/* Secteurs */}
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Secteurs d&apos;investissement <span style={{ fontWeight: 400, color: "#9ca3af" }}>(max 3)</span></label>
        <SectorsMultiSelect value={data.sectors} onChange={val => onChange({ ...data, sectors: val })} />
      </div>

      {/* Géographies */}
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Géographies d&apos;investissement</label>
        <GeographiesMultiSelect value={data.geographies} onChange={val => onChange({ ...data, geographies: val })} />
      </div>

      {/* Thèse */}
      <div>
        <label style={lbl}>Thèse / Profil d&apos;investissement</label>
        <textarea
          rows={3}
          style={{ ...inp, resize: "vertical" }}
          placeholder="ex: Spécialiste SaaS B2B Europe, tickets Seed à Série A..."
          value={data.thesis}
          onChange={e => onChange({ ...data, thesis: e.target.value })}
        />
      </div>
    </div>
  );
}
