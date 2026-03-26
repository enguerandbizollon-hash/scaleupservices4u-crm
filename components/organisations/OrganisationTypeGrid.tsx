"use client";

export const ORG_TYPES = [
  { value: "investor",          label: "Investisseur",        desc: "VC, PE, Growth" },
  { value: "business_angel",    label: "Business Angel",      desc: "Investisseur individuel" },
  { value: "family_office",     label: "Family Office",       desc: "SFO, MFO, GFI" },
  { value: "corporate",         label: "Corporate / CVC",     desc: "Investisseur corporate" },
  { value: "bank",              label: "Banque",              desc: "Banque privée, commerciale" },
  { value: "client",            label: "Client",              desc: "Société accompagnée" },
  { value: "prospect_client",   label: "Prospect client",     desc: "Cible commerciale" },
  { value: "target",            label: "Cible M&A",           desc: "Cible d'acquisition" },
  { value: "buyer",             label: "Repreneur",           desc: "Acquéreur potentiel" },
  { value: "law_firm",          label: "Cabinet juridique",   desc: "Avocat, notaire" },
  { value: "advisor",           label: "Conseil",             desc: "Banque d'affaires, advisor" },
  { value: "accounting_firm",   label: "Cabinet comptable",   desc: "Expert-comptable, audit" },
  { value: "consulting_firm",   label: "Cabinet de conseil",  desc: "Conseil stratégique" },
  { value: "other",             label: "Autre",               desc: "" },
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
