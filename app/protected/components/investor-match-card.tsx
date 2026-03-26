"use client";
import { useState } from "react";
import type { InvestorMatch } from "@/actions/matching";
import { setInvestorStatusAction } from "@/actions/matching";
import { GEOGRAPHIES } from "@/lib/crm/matching-maps";

const GEO_LABELS: Record<string, string> = Object.fromEntries(
  GEOGRAPHIES.map(({ value, label }) => [value, label])
);

interface InvestorMatchCardProps {
  match: InvestorMatch;
  onCreateActivity: (orgId: string, orgName: string) => void;
  onStatusChange?: (orgId: string, newStatus: "active" | "inactive") => void;
}

const PIPELINE_LABELS: Record<InvestorMatch["pipelineStatus"], { label: string; bg: string; tx: string }> = {
  non_contacte: { label: "Non contacté", bg: "var(--surface-3)", tx: "var(--text-4)" },
  contacte:     { label: "Contacté",     bg: "#DBEAFE",          tx: "#1D4ED8" },
  en_cours:     { label: "En cours",     bg: "var(--fund-bg)",   tx: "var(--fund-tx)" },
  ko:           { label: "KO",           bg: "var(--rec-bg)",    tx: "var(--rec-tx)" },
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "3px 10px", borderRadius: 20, background: "var(--surface-3)", color: "var(--text-4)", fontWeight: 600, fontSize: 11.5 }}>
        Incomplet
      </span>
    );
  }
  const bg = score >= 70 ? "#D1FAE5" : score >= 40 ? "#FEF3C7" : "#FEE2E2";
  const tx = score >= 70 ? "#065F46" : score >= 40 ? "#92400E" : "#991B1B";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 44, padding: "3px 10px", borderRadius: 20, background: bg, color: tx, fontWeight: 700, fontSize: 13 }}>
      {score}
    </span>
  );
}

function CriterionText({ label, value, earned, filled }: {
  label: string; value: string | null; earned: number; filled: boolean;
}) {
  const style = !filled
    ? { bg: "var(--surface-3)", tx: "var(--text-5)" }
    : earned > 0
    ? { bg: "#D1FAE5", tx: "#065F46" }
    : { bg: "#FEF3C7", tx: "#92400E" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 10.5, color: "var(--text-5)", minWidth: 46, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 20, background: style.bg, color: style.tx, fontWeight: 600 }}>
        {filled ? (value || "—") : "Non renseigné"}
      </span>
    </div>
  );
}

function fmtAmount(n: number | null) {
  if (!n) return null;
  return n >= 1e6 ? `${(n / 1e6).toFixed(0)}M€` : `${(n / 1e3).toFixed(0)}k€`;
}

export function InvestorMatchCard({ match, onCreateActivity, onStatusChange }: InvestorMatchCardProps) {
  const { org, score, breakdown, pipelineStatus } = match;
  const pl = PIPELINE_LABELS[pipelineStatus];
  const isInactive = org.base_status === "inactive";
  const [menuOpen, setMenuOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const ticketLabel = (org.investor_ticket_min || org.investor_ticket_max)
    ? [fmtAmount(org.investor_ticket_min), fmtAmount(org.investor_ticket_max)].filter(Boolean).join(" – ")
    : null;

  async function handleToggleStatus() {
    setDeactivating(true);
    setMenuOpen(false);
    const newStatus = isInactive ? "active" : "inactive";
    const result = await setInvestorStatusAction(org.id, newStatus);
    if (result.success) {
      onStatusChange?.(org.id, newStatus);
    }
    setDeactivating(false);
  }

  return (
    <div style={{
      background: "var(--surface)",
      border: `1px solid ${isInactive ? "var(--border)" : "var(--border)"}`,
      borderRadius: 12,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      opacity: isInactive ? 0.65 : 1,
    }}>
      {/* Ligne 1 : nom + score + badges */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {org.name}
          </div>
          {ticketLabel && (
            <div style={{ fontSize: 11.5, color: "var(--text-5)", marginTop: 2 }}>Ticket : {ticketLabel}</div>
          )}
        </div>
        {isInactive && (
          <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 20, background: "var(--surface-3)", color: "var(--text-5)", fontWeight: 600, flexShrink: 0 }}>
            Inactif
          </span>
        )}
        <ScoreBadge score={score} />
        <span style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 20, background: pl.bg, color: pl.tx, fontWeight: 600, flexShrink: 0 }}>
          {pl.label}
        </span>
        {/* Menu 3 points */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setMenuOpen(p => !p)}
            style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-4)" }}
          >
            ···
          </button>
          {menuOpen && (
            <div style={{ position: "absolute", right: 0, top: 28, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,.12)", zIndex: 50, minWidth: 180, padding: 4 }}>
              <button
                onClick={handleToggleStatus}
                disabled={deactivating}
                style={{ width: "100%", padding: "8px 12px", textAlign: "left", border: "none", background: "none", cursor: "pointer", fontSize: 13, color: isInactive ? "var(--fund-tx)" : "var(--rec-tx)", fontFamily: "inherit", borderRadius: 6 }}
              >
                {deactivating ? "…" : isInactive ? "Réactiver" : "Marquer comme inactif"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ligne 2 : critères en texte coloré — vert=match, orange=mismatch, gris=non renseigné */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <CriterionText
          label="Ticket"
          value={ticketLabel}
          earned={breakdown.ticket.earned}
          filled={breakdown.ticket.filled}
        />
        <CriterionText
          label="Secteur"
          value={org.investor_sectors.slice(0, 2).join(", ") || null}
          earned={breakdown.sector.earned}
          filled={breakdown.sector.filled}
        />
        <CriterionText
          label="Stade"
          value={org.investor_stages.slice(0, 2).join(", ") || null}
          earned={breakdown.stage.earned}
          filled={breakdown.stage.filled}
        />
        <CriterionText
          label="Géo"
          value={org.investor_geographies.slice(0, 2).map(g => GEO_LABELS[g] ?? g).join(", ") || null}
          earned={breakdown.geography.earned}
          filled={breakdown.geography.filled}
        />
      </div>

      {/* Ligne 3 : tags + action */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {org.investor_sectors.slice(0, 3).map(s => (
            <span key={s} style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 20, background: "var(--surface-2)", color: "var(--text-4)", border: "1px solid var(--border)" }}>{s}</span>
          ))}
          {org.investor_stages.slice(0, 1).map(s => (
            <span key={s} style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 20, background: "var(--surface-2)", color: "var(--text-4)", border: "1px solid var(--border)" }}>{s}</span>
          ))}
          {org.investor_geographies.slice(0, 1).map(g => (
            <span key={g} style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 20, background: "var(--surface-2)", color: "var(--text-4)", border: "1px solid var(--border)" }}>{g}</span>
          ))}
        </div>
        <button
          onClick={() => onCreateActivity(org.id, org.name)}
          style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-3)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 500, whiteSpace: "nowrap" }}
        >
          + Activité
        </button>
      </div>
    </div>
  );
}
