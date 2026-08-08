"use client";
import { useMemo, useState } from "react";
import { Search, X, Check } from "lucide-react";

// Sélecteur multi-valeurs recherchable et groupé, avec zone « sélectionnés »
// en tags retirables et un accent visé (vert) / exclu (rouge). Tolère une
// valeur sélectionnée absente des options (affichée par son label calculé,
// utile pour les secteurs libres extraits d'une fiche de cadrage).
export interface FacetOption { value: string; label: string; hint?: string }
export interface FacetGroup { label: string; options: FacetOption[] }

const ACCENT = {
  target:  { tx: "#065F46", border: "#065F46", chipBg: "#D1FAE5", zone: "rgba(16,185,129,.10)" },
  exclude: { tx: "#991B1B", border: "#991B1B", chipBg: "#FEE2E2", zone: "rgba(239,68,68,.09)" },
} as const;

export function FacetMultiSelect({ groups, selected, onChange, variant, placeholder, disabledValues }: {
  groups: FacetGroup[];
  selected: string[];
  onChange: (v: string[]) => void;
  variant: "target" | "exclude";
  placeholder?: string;
  disabledValues?: string[];
}) {
  const [q, setQ] = useState("");
  const acc = ACCENT[variant];
  const disabled = useMemo(() => new Set(disabledValues ?? []), [disabledValues]);

  const labelOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) for (const o of g.options) m.set(o.value, o.label);
    return (v: string) => m.get(v) ?? v;
  }, [groups]);

  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  const query = q.trim().toLowerCase();
  const filtered = useMemo(
    () => groups
      .map((g) => ({ label: g.label, options: g.options.filter((o) => !query || o.label.toLowerCase().includes(query)) }))
      .filter((g) => g.options.length > 0),
    [groups, query],
  );

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", overflow: "hidden" }}>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, padding: "8px 10px", borderBottom: "1px solid var(--border)", background: acc.zone }}>
          {selected.map((v) => (
            <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11.5, fontWeight: 600, padding: "2px 5px 2px 9px", borderRadius: 14, background: acc.chipBg, color: acc.tx }}>
              {labelOf(v)}
              <button type="button" onClick={() => toggle(v)} aria-label="Retirer" style={{ background: "none", border: "none", cursor: "pointer", color: acc.tx, display: "flex", padding: 1 }}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderBottom: "1px solid var(--border)" }}>
        <Search size={13} color="var(--text-5)" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder ?? "Rechercher…"}
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: "var(--text-1)", fontFamily: "inherit" }} />
      </div>

      <div style={{ maxHeight: 240, overflowY: "auto", padding: "4px 0" }}>
        {filtered.map((g) => (
          <div key={g.label}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text-5)", padding: "8px 12px 3px" }}>{g.label}</div>
            {g.options.map((o) => {
              const active = selected.includes(o.value);
              const isDisabled = disabled.has(o.value) && !active;
              return (
                <button key={o.value} type="button" disabled={isDisabled} onClick={() => toggle(o.value)}
                  title={isDisabled ? "Déjà dans l'autre liste" : o.hint}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 12px", border: "none", background: active ? acc.zone : "transparent", cursor: isDisabled ? "not-allowed" : "pointer", textAlign: "left", fontFamily: "inherit", opacity: isDisabled ? 0.4 : 1 }}>
                  <span style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${active ? acc.border : "var(--border-2)"}`, background: active ? acc.border : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {active && <Check size={11} color="#fff" />}
                  </span>
                  <span style={{ fontSize: 12.5, color: active ? acc.tx : "var(--text-2)", fontWeight: active ? 600 : 400 }}>{o.label}</span>
                </button>
              );
            })}
          </div>
        ))}
        {filtered.length === 0 && <div style={{ padding: "14px 12px", fontSize: 12, color: "var(--text-5)" }}>Aucun résultat.</div>}
      </div>
    </div>
  );
}
