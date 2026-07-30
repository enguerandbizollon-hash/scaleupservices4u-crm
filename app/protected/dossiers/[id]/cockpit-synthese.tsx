"use client";
// Cockpit de synthèse du dossier (Deal OS, chantier A).
// Répond à « où en est ce deal » en cinq secondes, sans aucune requête
// supplémentaire : tout vient des données déjà chargées par la page.
// Trois blocs : LA CIBLE (ce qu'on vend), LA MISSION (où on en est),
// LE MARCHÉ (à qui on le vend).

import Link from "next/link";
import { TrendingUp, Target, Users } from "lucide-react";
import { DEAL_CONTEXTS, stageLabel } from "@/lib/crm/matching-maps";
import type { FinancialRow } from "./financial-tab";
import type { SuggestionWithRelations } from "@/lib/crm/suggestions";
import type { ActionnaireNormalise } from "@/lib/connectors/pappers";

function fmtAmt(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(Math.round(n));
}

function fmtDateFr(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("fr-FR");
}

interface CockpitDeal {
  deal_type: string;
  deal_stage: string | null;
  deal_context?: string | null;
  target_date?: string | null;
  next_action_date?: string | null;
  dirigeant_nom?: string | null;
  dirigeant_titre?: string | null;
  estimated_fee_amount?: number | null;
  confirmed_fee_amount?: number | null;
  currency?: string | null;
  asking_price_min?: number | null;
  asking_price_max?: number | null;
}

export function CockpitSynthese({ deal, financialData, suggestions, clientOrg, onOpenMarket }: {
  deal: CockpitDeal;
  financialData: FinancialRow[];
  suggestions: SuggestionWithRelations[];
  clientOrg: { id: string; name: string; actionnariat?: ActionnaireNormalise[] | null } | null;
  onOpenMarket: () => void;
}) {
  const c = deal.currency ?? "EUR";

  // La cible : 3 derniers exercices réels.
  const reels = financialData
    .filter((f) => !f.is_forecast)
    .sort((a, b) => b.fiscal_year - a.fiscal_year)
    .slice(0, 3);
  const actionnaires = (clientOrg?.actionnariat ?? []).slice(0, 3);

  // La mission.
  const contexteLabel = deal.deal_context
    ? DEAL_CONTEXTS.find((x) => x.value === deal.deal_context)?.label ?? deal.deal_context
    : null;
  const daysToTarget = deal.target_date
    ? Math.ceil((new Date(deal.target_date).getTime() - Date.now()) / 86_400_000)
    : null;
  const estime = deal.estimated_fee_amount ?? null;
  const encaisse = deal.confirmed_fee_amount ?? 0;
  const collectPct = estime && estime > 0 ? Math.min(100, Math.round((encaisse / estime) * 100)) : null;

  // Le marché : statuts d'approche + top scores.
  const counts = { approved: 0, contacted: 0, suggested: 0, deferred: 0 };
  for (const s of suggestions) {
    if (s.status in counts) counts[s.status as keyof typeof counts] += 1;
  }
  const top = [...suggestions]
    .map((s) => ({ name: s.organization?.name ?? "—", score: (s as { score_combined?: number | null; score_ai?: number | null; score_algo?: number | null }).score_combined ?? (s as { score_ai?: number | null }).score_ai ?? (s as { score_algo?: number | null }).score_algo ?? null }))
    .filter((s) => s.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 3);
  const marketLabel = deal.deal_type === "ma_buy" ? "cibles" : "acquéreurs";

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
    padding: "12px 15px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0,
  };
  const cardTitle: React.CSSProperties = {
    fontSize: 10.5, fontWeight: 800, color: "var(--text-4)", textTransform: "uppercase",
    letterSpacing: ".07em", display: "flex", alignItems: "center", gap: 6,
  };
  const kv: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 12.5 };
  const kLabel: React.CSSProperties = { color: "var(--text-5)", fontSize: 11.5, flexShrink: 0 };
  const kValue: React.CSSProperties = { fontWeight: 700, color: "var(--text-1)", textAlign: "right" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10, marginBottom: 16 }}>

      {/* LA CIBLE */}
      <div style={card}>
        <div style={cardTitle}><TrendingUp size={11} /> La cible</div>
        {reels.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ color: "var(--text-5)", fontSize: 10 }}>
                <th style={{ textAlign: "left", fontWeight: 600 }}></th>
                {reels.map((f) => <th key={f.fiscal_year} style={{ textAlign: "right", fontWeight: 700 }}>{f.fiscal_year}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ color: "var(--text-5)", fontSize: 11 }}>CA</td>
                {reels.map((f) => <td key={f.fiscal_year} style={{ textAlign: "right", fontWeight: 700, color: "var(--text-1)" }}>{fmtAmt(f.revenue)}</td>)}
              </tr>
              <tr>
                <td style={{ color: "var(--text-5)", fontSize: 11 }}>EBITDA</td>
                {reels.map((f) => <td key={f.fiscal_year} style={{ textAlign: "right", fontWeight: 600, color: "var(--text-2)" }}>{fmtAmt(f.ebitda)}</td>)}
              </tr>
              <tr>
                <td style={{ color: "var(--text-5)", fontSize: 11 }}>RN</td>
                {reels.map((f) => {
                  const rn = f.net_income ?? null;
                  return <td key={f.fiscal_year} style={{ textAlign: "right", color: rn == null ? "var(--text-5)" : rn >= 0 ? "#065F46" : "#991B1B" }}>{fmtAmt(rn)}</td>;
                })}
              </tr>
            </tbody>
          </table>
        ) : (
          <div style={{ fontSize: 12, color: "var(--text-5)" }}>Aucun exercice saisi (onglet Cible, Financier).</div>
        )}
        {(deal.asking_price_min != null || deal.asking_price_max != null) && (
          <div style={kv}><span style={kLabel}>Prix demandé</span>
            <span style={kValue}>{fmtAmt(deal.asking_price_min)} – {fmtAmt(deal.asking_price_max)} {c}</span></div>
        )}
        {deal.dirigeant_nom && (
          <div style={kv}><span style={kLabel}>Dirigeant</span>
            <span style={{ ...kValue, fontWeight: 600 }}>{deal.dirigeant_nom}{deal.dirigeant_titre ? ` · ${deal.dirigeant_titre}` : ""}</span></div>
        )}
        {actionnaires.length > 0 && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
            {actionnaires.map((a, i) => (
              <div key={i} style={{ ...kv, fontSize: 12 }}>
                <span style={{ color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[a.prenom, a.nom].filter(Boolean).join(" ")}{a.age != null ? `, ${a.age} ans` : ""}
                </span>
                <span style={{ fontWeight: 700, color: "var(--text-2)", flexShrink: 0 }}>
                  {a.pourcentage_parts != null ? `${a.pourcentage_parts}%` : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LA MISSION */}
      <div style={card}>
        <div style={cardTitle}><Target size={11} /> La mission</div>
        <div style={kv}><span style={kLabel}>Stade</span><span style={kValue}>{stageLabel(deal.deal_stage)}</span></div>
        {contexteLabel && (
          <div style={kv}><span style={kLabel}>Contexte</span><span style={{ ...kValue, fontWeight: 600 }}>{contexteLabel}</span></div>
        )}
        <div style={kv}>
          <span style={kLabel}>Closing cible</span>
          <span style={{ ...kValue, color: daysToTarget != null && daysToTarget < 0 ? "#991B1B" : "var(--text-1)" }}>
            {deal.target_date ? `${fmtDateFr(deal.target_date)}${daysToTarget != null ? ` (${daysToTarget >= 0 ? "J-" + daysToTarget : daysToTarget + " j"})` : ""}` : "—"}
          </span>
        </div>
        <div style={kv}><span style={kLabel}>Prochaine action</span><span style={kValue}>{fmtDateFr(deal.next_action_date) ?? "—"}</span></div>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 6 }}>
          <div style={kv}>
            <span style={kLabel}>Honoraires</span>
            <span style={kValue}>{fmtAmt(encaisse)} / {fmtAmt(estime)} {c}</span>
          </div>
          {collectPct != null && (
            <div style={{ height: 5, borderRadius: 3, background: "var(--surface-3)", overflow: "hidden", marginTop: 5 }}>
              <div style={{ width: `${collectPct}%`, height: "100%", background: "#0F766E", borderRadius: 3 }} />
            </div>
          )}
        </div>
      </div>

      {/* LE MARCHÉ */}
      <div style={card}>
        <div style={cardTitle}><Users size={11} /> Le marché</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { label: "approuvés", n: counts.approved, bg: "#D1FAE5", tx: "#065F46" },
            { label: "contactés", n: counts.contacted, bg: "#DBEAFE", tx: "#1D4ED8" },
            { label: "suggérés", n: counts.suggested, bg: "var(--surface-2)", tx: "var(--text-4)" },
          ].map((s) => (
            <span key={s.label} style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: s.bg, color: s.tx }}>
              {s.n} {s.label}
            </span>
          ))}
        </div>
        {top.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {top.map((t, i) => (
              <div key={i} style={kv}>
                <span style={{ color: "var(--text-2)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                <span style={{ fontWeight: 800, color: "var(--text-1)", flexShrink: 0 }}>{t.score}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "var(--text-5)" }}>Aucun {marketLabel.slice(0, -1)} scoré pour l&apos;instant.</div>
        )}
        <button onClick={onOpenMarket}
          style={{ alignSelf: "flex-start", marginTop: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#0F766E", padding: 0, fontFamily: "inherit" }}>
          Travailler les {marketLabel} →
        </button>
      </div>
    </div>
  );
}

export type { CockpitDeal };
