"use client";

import { TrendingUp, Banknote, Target, Building2, Activity, Briefcase, Calendar } from "lucide-react";
import { stageLabel, ROUND_TYPES, SENIORITY_OPTIONS } from "@/lib/crm/matching-maps";

type Deal = {
  id: string;
  deal_type: string;
  deal_status: string;
  deal_stage: string;
  target_amount: number | null;
  currency: string | null;
  target_date: string | null;
  // Fundraising
  target_raise_amount?: number | null;
  pre_money_valuation?: number | null;
  post_money_valuation?: number | null;
  round_type?: string | null;
  runway_months?: number | null;
  // M&A Sell
  asking_price_min?: number | null;
  asking_price_max?: number | null;
  ai_valuation_low?: number | null;
  ai_valuation_high?: number | null;
  ai_financial_score?: number | null;
  // M&A Buy
  acquisition_budget_min?: number | null;
  acquisition_budget_max?: number | null;
  target_revenue_min?: number | null;
  target_revenue_max?: number | null;
  // RH
  job_title?: string | null;
  required_seniority?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
};

type FinancialRow = {
  fiscal_year: number;
  currency: string;
  revenue?: number | null;
  ebitda?: number | null;
  ebitda_margin?: number | null;
  revenue_growth?: number | null;
  arr?: number | null;
};

type MandateLite = {
  estimated_fee_amount: number | null;
  confirmed_fee_amount: number | null;
  currency: string | null;
} | null;

function fmtMoney(n: number | null | undefined, currency: string | null | undefined): string {
  if (n == null) return "—";
  const c = currency ?? "EUR";
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M ${c}`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)}k ${c}`;
  return `${n} ${c}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  const v = n > 1 ? n : n * 100;
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)} %`;
}

function fmtRange(min: number | null | undefined, max: number | null | undefined, currency: string | null | undefined): string {
  const c = currency ?? "EUR";
  const fm = (n: number) => Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : `${n}`;
  if (min != null && max != null) return `${fm(min)} – ${fm(max)} ${c}`;
  if (min != null) return `≥ ${fm(min)} ${c}`;
  if (max != null) return `≤ ${fm(max)} ${c}`;
  return "—";
}

function fmtDateShort(d: string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

type KPI = { label: string; value: string; sublabel?: string; icon: typeof TrendingUp; tone?: "positive" | "neutral" | "warning" };

export function DealOverviewBlock({
  deal,
  financialData,
  mandate,
}: {
  deal: Deal;
  financialData?: FinancialRow[];
  mandate?: MandateLite;
}) {
  const kpis = buildKPIs(deal, financialData ?? [], mandate ?? null);
  if (kpis.length === 0) return null;

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: "14px 16px",
      marginBottom: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <TrendingUp size={14} color="var(--text-4)" />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".06em" }}>
          Vue d&apos;ensemble
        </span>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 8,
      }}>
        {kpis.map((k, i) => {
          const Icon = k.icon;
          const toneColor =
            k.tone === "positive" ? "#065F46" :
            k.tone === "warning"  ? "#B45309" :
            "var(--text-1)";
          return (
            <div key={i} style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "10px 12px",
              display: "flex", flexDirection: "column", gap: 4,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: "var(--text-5)", textTransform: "uppercase", letterSpacing: ".05em" }}>
                <Icon size={11} />
                <span>{k.label}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: toneColor, lineHeight: 1.2 }}>
                {k.value}
              </div>
              {k.sublabel && (
                <div style={{ fontSize: 11, color: "var(--text-5)", lineHeight: 1.3 }}>{k.sublabel}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildKPIs(deal: Deal, financialData: FinancialRow[], mandate: MandateLite): KPI[] {
  const out: KPI[] = [];
  const currency = deal.currency ?? "EUR";

  // Stade actuel — toujours pertinent
  out.push({
    label: "Stade",
    value: stageLabel(deal.deal_stage),
    icon: Activity,
  });

  // Closing cible — toujours pertinent si présent
  if (deal.target_date) {
    out.push({
      label: "Closing cible",
      value: fmtDateShort(deal.target_date),
      icon: Calendar,
    });
  }

  // KPIs spécifiques par type
  switch (deal.deal_type) {
    case "fundraising": {
      if (deal.target_raise_amount != null) {
        out.push({
          label: "Montant cible",
          value: fmtMoney(deal.target_raise_amount, currency),
          sublabel: deal.round_type ? (ROUND_TYPES.find(r => r.value === deal.round_type)?.label ?? deal.round_type) : undefined,
          icon: Target,
          tone: "positive",
        });
      }
      if (deal.pre_money_valuation != null) {
        out.push({
          label: "Valorisation pré",
          value: fmtMoney(deal.pre_money_valuation, currency),
          sublabel: deal.post_money_valuation != null ? `Post : ${fmtMoney(deal.post_money_valuation, currency)}` : undefined,
          icon: Banknote,
        });
      }
      if (deal.runway_months != null) {
        out.push({
          label: "Runway",
          value: `${deal.runway_months} mois`,
          icon: Activity,
          tone: deal.runway_months < 6 ? "warning" : "neutral",
        });
      }
      break;
    }
    case "ma_sell": {
      const askingRange = (deal.asking_price_min != null || deal.asking_price_max != null)
        ? fmtRange(deal.asking_price_min, deal.asking_price_max, currency)
        : null;
      if (askingRange) {
        out.push({ label: "Asking price", value: askingRange, icon: Target, tone: "positive" });
      }
      if (deal.ai_valuation_low != null || deal.ai_valuation_high != null) {
        out.push({
          label: "Valorisation IA",
          value: fmtRange(deal.ai_valuation_low, deal.ai_valuation_high, currency),
          sublabel: deal.ai_financial_score != null ? `Score ${deal.ai_financial_score}/100` : undefined,
          icon: Banknote,
        });
      }
      break;
    }
    case "ma_buy": {
      if (deal.acquisition_budget_min != null || deal.acquisition_budget_max != null) {
        out.push({
          label: "Budget acquisition",
          value: fmtRange(deal.acquisition_budget_min, deal.acquisition_budget_max, currency),
          icon: Target,
          tone: "positive",
        });
      }
      if (deal.target_revenue_min != null || deal.target_revenue_max != null) {
        out.push({
          label: "Cible CA",
          value: fmtRange(deal.target_revenue_min, deal.target_revenue_max, currency),
          icon: TrendingUp,
        });
      }
      break;
    }
    case "recruitment": {
      if (deal.job_title) {
        out.push({ label: "Poste", value: deal.job_title, icon: Briefcase });
      }
      if (deal.required_seniority) {
        const sen = SENIORITY_OPTIONS.find(s => s.value === deal.required_seniority);
        out.push({
          label: "Séniorité",
          value: sen?.label ?? deal.required_seniority,
          icon: Activity,
        });
      }
      if (deal.salary_min != null || deal.salary_max != null) {
        out.push({
          label: "Fourchette salaire",
          value: fmtRange(deal.salary_min, deal.salary_max, currency),
          icon: Banknote,
          tone: "positive",
        });
      }
      break;
    }
  }

  // KPIs financiers (si données disponibles) — pour fundraising, ma_sell, ma_buy
  if (deal.deal_type !== "recruitment" && deal.deal_type !== "cfo_advisor" && financialData.length > 0) {
    const sorted = [...financialData].sort((a, b) => b.fiscal_year - a.fiscal_year);
    const latest = sorted[0]!;
    if (latest.revenue != null) {
      out.push({
        label: `CA ${latest.fiscal_year}`,
        value: fmtMoney(latest.revenue, latest.currency ?? currency),
        sublabel: latest.revenue_growth != null ? `Croissance ${fmtPct(latest.revenue_growth)}` : undefined,
        icon: TrendingUp,
        tone: latest.revenue_growth != null && latest.revenue_growth > 0 ? "positive" : "neutral",
      });
    }
    if (latest.ebitda != null) {
      out.push({
        label: `EBITDA ${latest.fiscal_year}`,
        value: fmtMoney(latest.ebitda, latest.currency ?? currency),
        sublabel: latest.ebitda_margin != null ? `Marge ${fmtPct(latest.ebitda_margin)}` : undefined,
        icon: Banknote,
        tone: latest.ebitda > 0 ? "positive" : "warning",
      });
    }
    if (latest.arr != null && latest.arr > 0) {
      out.push({
        label: `ARR ${latest.fiscal_year}`,
        value: fmtMoney(latest.arr, latest.currency ?? currency),
        icon: TrendingUp,
        tone: "positive",
      });
    }
  }

  // Fees du mandat (si présent et estimés)
  if (mandate && mandate.estimated_fee_amount != null && mandate.estimated_fee_amount > 0) {
    out.push({
      label: "Fees estimés",
      value: fmtMoney(mandate.estimated_fee_amount, mandate.currency ?? currency),
      sublabel: mandate.confirmed_fee_amount != null && mandate.confirmed_fee_amount > 0
        ? `Confirmés : ${fmtMoney(mandate.confirmed_fee_amount, mandate.currency ?? currency)}`
        : undefined,
      icon: Building2,
      tone: "neutral",
    });
  }

  return out;
}
