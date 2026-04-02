"use client";
import { SALE_READINESS_OPTIONS } from "@/lib/crm/matching-maps";

export interface MaSellerData {
  sale_readiness:  string;
  partial_sale_ok: boolean;
}

interface Props {
  data:     MaSellerData;
  onChange: (d: MaSellerData) => void;
}

const lbl: React.CSSProperties = {
  display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5,
};

export function MaSellerFields({ data, onChange }: Props) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 14 }}>
        Profil cédant M&A
      </div>

      {/* Maturité cession */}
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Maturité de cession</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SALE_READINESS_OPTIONS.map(opt => {
            const active = data.sale_readiness === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...data, sale_readiness: opt.value })}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: `1.5px solid ${active ? opt.tx : "#e5e7eb"}`,
                  background: active ? opt.bg : "#fff",
                  color: active ? opt.tx : "#6b7280",
                  fontSize: 12.5,
                  fontWeight: active ? 700 : 400,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all .1s",
                }}
              >
                {active && "✓ "}{opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cession partielle */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="checkbox"
          id="partial_sale_ok"
          checked={data.partial_sale_ok}
          onChange={e => onChange({ ...data, partial_sale_ok: e.target.checked })}
          style={{ width: 16, height: 16, cursor: "pointer" }}
        />
        <label htmlFor="partial_sale_ok" style={{ fontSize: 13, color: "#374151", cursor: "pointer" }}>
          Cession partielle acceptée (entrée au capital minoritaire)
        </label>
      </div>
    </div>
  );
}
