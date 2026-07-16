"use client";

// Bandeau de KPIs financiers — vue d'ensemble en un coup d'œil.
//
// Affiche : CA + croissance YoY, EBITDA normatif + marge, trésorerie nette,
// valorisation médiane (EBITDA normatif × multiple mid si renseigné).
// Chaque KPI inclut une sparkline qui couvre N-2 → N → N+x si projections.
//
// Pas de dépendance graphique externe : sparkline SVG manuelle.

import { computeFinancials, type FinancialInputs } from "@/lib/crm/financial-calcs";

interface FinancialRowLite {
  fiscal_year: number;
  is_forecast?: boolean | null;
  revenue?: number | null;
  cogs?: number | null;
  payroll?: number | null;
  payroll_rd?: number | null;
  payroll_sales?: number | null;
  payroll_ga?: number | null;
  marketing?: number | null;
  rent?: number | null;
  other_opex?: number | null;
  da?: number | null;
  financial_charges?: number | null;
  taxes?: number | null;
  capex?: number | null;
  cash?: number | null;
  debt_lt?: number | null;
  debt_st?: number | null;
  addback_owner_compensation?: number | null;
  addback_exceptional_charges?: number | null;
  addback_property_rent?: number | null;
  addback_one_off_fees?: number | null;
  addback_other?: number | null;
  multiple_ev_ebitda_mid?: number | null;
}

interface Props {
  rows: FinancialRowLite[];
  currency: string;
}

function fmtMoney(v: number | null | undefined): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)} k`;
  return `${Math.round(v)}`;
}
function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}
function fmtRawPct(v: number | null | undefined, digits = 1): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

// ─── Sparkline ─────────────────────────────────────────────────────────────
// Polyline SVG normalisée. Couleur dynamique selon évolution
// (dernière > première = vert, sinon ambre). Hauteur fixe 32px.

function Sparkline({
  points, width = 110, height = 32, color, forecastFromIndex,
}: {
  points: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
  forecastFromIndex?: number; // index à partir duquel le tracé est forecast (pointillé)
}) {
  const valid = points.map(p => (p == null ? NaN : p));
  const cleaned = valid.filter(v => Number.isFinite(v));
  if (cleaned.length < 2) {
    return (
      <div style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--text-5)" }}>
        Données insuffisantes
      </div>
    );
  }
  const min = Math.min(...cleaned);
  const max = Math.max(...cleaned);
  const range = max - min || Math.abs(max) || 1;
  const padY = 4;
  const xStep = (width - 4) / (points.length - 1);

  const segments: { x: number; y: number; isForecast: boolean }[] = [];
  for (let i = 0; i < points.length; i++) {
    const v = points[i];
    if (v == null) continue;
    const x = 2 + i * xStep;
    const yRatio = (v - min) / range;
    const y = height - padY - yRatio * (height - 2 * padY);
    segments.push({ x, y, isForecast: forecastFromIndex != null && i >= forecastFromIndex });
  }

  // Couleur auto si non fournie : vert si croissance, ambre sinon
  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  const stroke = color ?? (last >= first ? "#059669" : "#D97706");
  const fill = stroke === "#059669" ? "#D1FAE5" : stroke === "#D97706" ? "#FEF3C7" : "#E0E7FF";

  // Build path segments — split réel / forecast en deux paths
  const realPts = segments.filter(s => !s.isForecast);
  const fcastPts = segments.filter(s => s.isForecast);
  const realPath = realPts.map((s, i) => `${i === 0 ? "M" : "L"} ${s.x} ${s.y}`).join(" ");
  // Pour le forecast : démarrer du dernier point réel pour continuité
  const lastReal = realPts[realPts.length - 1];
  const fcastPath = (lastReal && fcastPts.length > 0)
    ? [`M ${lastReal.x} ${lastReal.y}`, ...fcastPts.map(s => `L ${s.x} ${s.y}`)].join(" ")
    : fcastPts.length > 0 ? fcastPts.map((s, i) => `${i === 0 ? "M" : "L"} ${s.x} ${s.y}`).join(" ") : "";

  // Aire sous courbe : ferme le path réel jusqu'au bas
  const areaPath = realPts.length > 0
    ? `${realPath} L ${realPts[realPts.length - 1].x} ${height - 1} L ${realPts[0].x} ${height - 1} Z`
    : "";

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {areaPath && <path d={areaPath} fill={fill} opacity={0.5} />}
      {realPath && <path d={realPath} fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />}
      {fcastPath && <path d={fcastPath} fill="none" stroke={stroke} strokeWidth={1.6} strokeDasharray="3 2" strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />}
      {segments.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={i === segments.length - 1 ? 2.5 : 1.5} fill={stroke} opacity={s.isForecast ? 0.5 : 1} />
      ))}
    </svg>
  );
}

// ─── Card KPI ──────────────────────────────────────────────────────────────

function Card({
  label, value, sub, sparkline, tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: { text: string; tone: "good" | "bad" | "neutral" };
  sparkline: React.ReactNode;
  tone?: "good" | "bad" | "neutral";
}) {
  const toneColors: Record<typeof tone, { bg: string; border: string }> = {
    good: { bg: "linear-gradient(135deg, #ECFDF5 0%, #F0FDF4 100%)", border: "#A7F3D0" },
    bad: { bg: "linear-gradient(135deg, #FEF2F2 0%, #FFF1F2 100%)", border: "#FECACA" },
    neutral: { bg: "var(--surface)", border: "var(--border)" },
  };
  const c = toneColors[tone];
  const subToneColor = sub?.tone === "good" ? "#065F46" : sub?.tone === "bad" ? "#991B1B" : "var(--text-4)";
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: "12px 14px",
      display: "flex", flexDirection: "column", gap: 4, minWidth: 0,
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-1)", lineHeight: 1.1 }}>{value}</div>
          {sub && (
            <div style={{ fontSize: 11.5, fontWeight: 600, color: subToneColor, marginTop: 2 }}>
              {sub.text}
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0 }}>{sparkline}</div>
      </div>
    </div>
  );
}

// ─── Banner principal ──────────────────────────────────────────────────────

export function FinancialKpiBanner({ rows, currency }: Props) {
  if (!rows || rows.length === 0) return null;

  // Tri chronologique ascendant pour les sparklines (passé → futur)
  const sorted = [...rows].sort((a, b) => a.fiscal_year - b.fiscal_year);

  // Année réelle la plus récente — sert de "N" de référence
  const reals = sorted.filter(r => !r.is_forecast);
  if (reals.length === 0) return null;
  const lastReal = reals[reals.length - 1];
  const prevReal = reals.length >= 2 ? reals[reals.length - 2] : null;
  const calcLast = computeFinancials(lastReal as FinancialInputs);
  const calcPrev = prevReal ? computeFinancials(prevReal as FinancialInputs) : null;

  // Index à partir duquel le tracé est forecast (dans le tableau trié asc)
  const forecastFromIndex = sorted.findIndex(r => r.is_forecast);
  const forecastIdx = forecastFromIndex >= 0 ? forecastFromIndex : undefined;

  // Séries pour les sparklines (toutes années confondues, réelles + forecast)
  const revenueSeries = sorted.map(r => (r.revenue == null ? null : r.revenue));
  const ebitdaSeries = sorted.map(r => {
    const c = computeFinancials(r as FinancialInputs);
    return c.ebitda_normative ?? c.ebitda;
  });
  const ebitdaMarginSeries = sorted.map(r => {
    const c = computeFinancials(r as FinancialInputs);
    const m = c.ebitda_normative_margin ?? c.ebitda_margin;
    return m == null ? null : m;
  });
  const netCashSeries = sorted.map(r => {
    const c = computeFinancials(r as FinancialInputs);
    return c.net_debt == null ? null : -c.net_debt; // trésorerie nette = -dette nette
  });

  // KPI 1 — Chiffre d'affaires + croissance YoY
  const revenue = lastReal.revenue;
  const revenuePrev = prevReal?.revenue ?? null;
  const revenueGrowth = revenue != null && revenuePrev != null && revenuePrev !== 0
    ? ((revenue - revenuePrev) / Math.abs(revenuePrev)) * 100
    : null;
  const growthTone: "good" | "bad" | "neutral" =
    revenueGrowth == null ? "neutral" : revenueGrowth >= 15 ? "good" : revenueGrowth >= 0 ? "neutral" : "bad";

  // KPI 2 — EBITDA normatif + marge
  const ebitdaNorm = calcLast.ebitda_normative;
  const ebitdaMarginNorm = calcLast.ebitda_normative_margin;
  const ebitdaTone: "good" | "bad" | "neutral" =
    ebitdaMarginNorm == null ? "neutral" : ebitdaMarginNorm >= 0.15 ? "good" : ebitdaMarginNorm >= 0.05 ? "neutral" : "bad";

  // KPI 3 — Trésorerie nette (= cash - dette financière)
  const netCash = calcLast.net_debt == null ? null : -calcLast.net_debt;
  const netCashTone: "good" | "bad" | "neutral" =
    netCash == null ? "neutral" : netCash > 0 ? "good" : "bad";
  const netDebtPrev = calcPrev?.net_debt;
  const netCashDelta = netCash != null && netDebtPrev != null ? netCash - (-netDebtPrev) : null;

  // KPI 4 — Valorisation médiane (EBITDA normatif × multiple mid)
  const evMid = calcLast.valo_ebitda_normative?.ev_mid ?? null;
  const eqMid = calcLast.valo_ebitda_normative?.eq_mid ?? null;
  const valuationLabel = evMid != null
    ? `${fmtMoney(evMid)} ${currency}`
    : "—";
  const valuationSub = eqMid != null
    ? { text: `CP ${fmtMoney(eqMid)} ${currency}`, tone: "neutral" as const }
    : ebitdaNorm != null
      ? { text: "Multiple non saisi", tone: "neutral" as const }
      : { text: "EBITDA normatif manquant", tone: "neutral" as const };

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: 12,
      marginBottom: 16,
    }}>
      <Card
        label={`Chiffre d'affaires (${lastReal.fiscal_year})`}
        value={`${fmtMoney(revenue)} ${currency}`}
        sub={revenueGrowth != null
          ? { text: `${fmtRawPct(revenueGrowth)} YoY`, tone: growthTone }
          : undefined}
        sparkline={<Sparkline points={revenueSeries} forecastFromIndex={forecastIdx} />}
        tone={growthTone}
      />
      <Card
        label={`EBITDA normatif (${lastReal.fiscal_year})`}
        value={`${fmtMoney(ebitdaNorm)} ${currency}`}
        sub={ebitdaMarginNorm != null
          ? { text: `Marge ${fmtPct(ebitdaMarginNorm)}`, tone: ebitdaTone }
          : { text: "Renseigne les opex", tone: "neutral" }}
        sparkline={
          <Sparkline
            points={ebitdaSeries}
            forecastFromIndex={forecastIdx}
            color={ebitdaTone === "good" ? "#059669" : ebitdaTone === "bad" ? "#DC2626" : "#1a56db"}
          />
        }
        tone={ebitdaTone}
      />
      <Card
        label={`Trésorerie nette (${lastReal.fiscal_year})`}
        value={`${fmtMoney(netCash)} ${currency}`}
        sub={netCashDelta != null
          ? { text: `${netCashDelta >= 0 ? "+" : ""}${fmtMoney(netCashDelta)} vs N-1`, tone: netCashDelta >= 0 ? "good" : "bad" }
          : { text: netCash != null ? (netCash >= 0 ? "Cash > dette" : "Dette > cash") : "Bilan incomplet", tone: netCashTone }}
        sparkline={<Sparkline points={netCashSeries} forecastFromIndex={forecastIdx} />}
        tone={netCashTone}
      />
      <Card
        label={`Valorisation médiane (EV mid)`}
        value={valuationLabel}
        sub={valuationSub}
        sparkline={<Sparkline points={ebitdaMarginSeries.map(m => m == null ? null : m * 100)} forecastFromIndex={forecastIdx} color="#7C3AED" />}
        tone="neutral"
      />
    </div>
  );
}
