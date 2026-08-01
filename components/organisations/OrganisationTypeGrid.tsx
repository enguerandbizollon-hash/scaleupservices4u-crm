"use client";
import { organizationTypeLabels as L } from "@/lib/crm/labels";

// Grille de sélection du type : libellés depuis la source unique
// (lib/crm/labels.ts), descriptions métier M&A small cap, familles
// acquéreurs regroupées.
export const ORG_TYPES = [
  { value: "client",            label: L.client,            desc: "Société sous mandat" },
  { value: "prospect_client",   label: L.prospect_client,   desc: "Cédant potentiel" },
  { value: "target",            label: L.target,            desc: "Cible d'acquisition" },
  { value: "buyer",             label: L.buyer,             desc: "Acquéreur qualifié" },
  { value: "corporate",         label: L.corporate,         desc: "Industriel, consolidateur" },
  { value: "investor",          label: L.investor,          desc: "PE, growth, search fund" },
  { value: "business_angel",    label: L.business_angel,    desc: "Personne physique qui reprend" },
  { value: "family_office",     label: L.family_office,     desc: "SFO, MFO, GFI" },
  { value: "bank",              label: L.bank,              desc: "Banque privée, commerciale" },
  { value: "advisor",           label: L.advisor,           desc: "Banque d'affaires, advisor" },
  { value: "law_firm",          label: L.law_firm,          desc: "Avocat, notaire" },
  { value: "accounting_firm",   label: L.accounting_firm,   desc: "Expertise comptable, audit" },
  { value: "consulting_firm",   label: L.consulting_firm,   desc: "Conseil stratégique" },
  { value: "other",             label: L.other,             desc: "" },
];

export const INVESTOR_TYPES = ["investor", "business_angel", "family_office", "corporate"];

interface OrganisationTypeGridProps {
  value: string;
  onChange: (type: string) => void;
}

export function OrganisationTypeGrid({ value, onChange }: OrganisationTypeGridProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {ORG_TYPES.map(t => {
        const active = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 9,
              border: `1.5px solid ${active ? "#1a56db" : "#e5e7eb"}`,
              background: active ? "#eff6ff" : "#fff",
              color: active ? "#1a56db" : "#374151",
              cursor: "pointer",
              textAlign: "left",
              fontFamily: "inherit",
              transition: "all .1s",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</div>
            {t.desc && (
              <div style={{ fontSize: 11, color: active ? "#3b82f6" : "#9ca3af", marginTop: 2 }}>
                {t.desc}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
