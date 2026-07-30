"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Save, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { computeFinancials, type FinancialInputs } from "@/lib/crm/financial-calcs";
import { getBenchmark, getRatingColor } from "@/lib/crm/financial-benchmarks";
import { upsertFinancialData, getFinancialDataByDeal, deleteFinancialData } from "@/actions/financial-data";
import { importFinancesFromFiche } from "@/actions/prospection";
import { FinancialImport } from "@/components/financials/FinancialImport";
import { FinancialKpiBanner } from "@/components/financials/FinancialKpiBanner";
import { analyzeFinancialDataAction } from "@/actions/ai/financial";
import {
  getAssumptions,
  upsertAssumptions,
  generateProjections,
  clearProjections,
  type AssumptionsRow,
} from "@/actions/financial-projections";

// ── Exported type ──────────────────────────────────────────────────────────────

export interface FinancialRow {
  id: string;
  fiscal_year: number;
  period_type: string;
  currency: string;
  source?: string | null;
  ai_extracted?: boolean;
  is_forecast?: boolean;
  // P&L
  revenue?: number | null;
  revenue_recurring?: number | null;
  revenue_non_recurring?: number | null;
  cogs?: number | null;
  gross_profit?: number | null;
  gross_margin?: number | null;
  payroll?: number | null;
  payroll_rd?: number | null;
  payroll_sales?: number | null;
  payroll_ga?: number | null;
  marketing?: number | null;
  rent?: number | null;
  other_opex?: number | null;
  ebitda?: number | null;
  ebitda_margin?: number | null;
  da?: number | null;
  ebit?: number | null;
  financial_charges?: number | null;
  taxes?: number | null;
  net_income?: number | null;
  capex?: number | null;
  // Bilan
  intangible_assets?: number | null;
  tangible_assets?: number | null;
  financial_assets?: number | null;
  inventory?: number | null;
  accounts_receivable?: number | null;
  other_current_assets?: number | null;
  cash?: number | null;
  share_capital?: number | null;
  reserves?: number | null;
  net_income_bs?: number | null;
  equity?: number | null;
  total_assets?: number | null;
  debt_lt?: number | null;
  debt_st?: number | null;
  accounts_payable?: number | null;
  other_current_liabilities?: number | null;
  net_debt?: number | null;
  working_capital?: number | null;
  // SaaS / Récurrent
  arr?: number | null;
  mrr?: number | null;
  nrr?: number | null;
  grr?: number | null;
  churn_rate?: number | null;
  cagr?: number | null;
  ltv?: number | null;
  cac?: number | null;
  ltv_cac_ratio?: number | null;
  payback_months?: number | null;
  growth_fcst?: number | null;
  // Valorisation
  ev_estimate?: number | null;
  ev_ebitda_multiple?: number | null;
  ev_revenue_multiple?: number | null;
  ev_arr_multiple?: number | null;
  equity_value?: number | null;
  multiple_ev_ebitda_low?: number | null;
  multiple_ev_ebitda_mid?: number | null;
  multiple_ev_ebitda_high?: number | null;
  multiple_ev_ebit_low?: number | null;
  multiple_ev_ebit_mid?: number | null;
  multiple_ev_ebit_high?: number | null;
  multiple_ev_revenue_low?: number | null;
  multiple_ev_revenue_mid?: number | null;
  multiple_ev_revenue_high?: number | null;
  multiple_ev_arr_low?: number | null;
  multiple_ev_arr_mid?: number | null;
  multiple_ev_arr_high?: number | null;
  wacc?: number | null;
  terminal_growth_rate?: number | null;
  fcf_n1?: number | null;
  fcf_n2?: number | null;
  fcf_n3?: number | null;
  fcf_n4?: number | null;
  fcf_n5?: number | null;
  misc_adjustments?: number | null;
  contingent_liabilities?: number | null;
  excess_cash?: number | null;
  sector?: string | null;
  // Opérationnel
  headcount?: number | null;
  revenue_per_employee?: number | null;
  // Retraitements EBITDA normatif
  addback_owner_compensation?: number | null;
  addback_exceptional_charges?: number | null;
  addback_property_rent?: number | null;
  addback_one_off_fees?: number | null;
  addback_other?: number | null;
  addback_notes?: string | null;
}

export interface InitialAiAnalysis {
  ai_financial_score: number | null;
  ai_valuation_low: number | null;
  ai_valuation_high: number | null;
  ai_financial_notes: string | null;
  ai_analyzed_at: string | null;
  ai_score_growth?: number | null;
  ai_score_margin?: number | null;
  ai_score_balance?: number | null;
  ai_score_comparables?: number | null;
  ai_anomalies?: string[] | null;
}

interface Props {
  dealId?: string;
  organizationId?: string;
  dealType?: string;
  currency?: string;
  initialData: FinancialRow[];
  initialAi?: InitialAiAnalysis | null;
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtM(v: number | null | undefined): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M€`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)} k€`;
  return `${Math.round(v)} €`;
}
function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}
function fmtPctRaw(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}
function fmtX(v: number | null | undefined): string {
  return v == null ? "—" : `${v.toFixed(1)}x`;
}
function fmtDays(v: number | null | undefined): string {
  return v == null ? "—" : `${Math.round(v)}j`;
}

function varDelta(
  cur: number | null | undefined,
  prev: number | null | undefined,
  isMargin = false,
): { text: string; favorable: boolean } | null {
  if (cur == null || prev == null) return null;
  if (isMargin) {
    const pp = (cur - prev) * 100;
    return { text: (pp >= 0 ? "+" : "") + pp.toFixed(1) + "pp", favorable: pp >= 0 };
  }
  if (prev === 0) return null;
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  return { text: (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%", favorable: pct >= 0 };
}

// Parse permissif. Accepte espaces fines / non-cassables, virgules décimales,
// symbole €, et raccourcis de magnitude : "624k" → 624 000, "1.2M" → 1 200 000,
// "1,5 m€" → 1 500 000. Tolère le "%" muet (le contexte de la ligne décide du sens).
function parseNum(v: string): number | undefined {
  if (!v || v.trim() === "") return undefined;
  let body = v
    .replace(/ | /g, "")     // espaces insécables
    .replace(/\s/g, "")
    .replace(/€|\$|CHF/gi, "")
    .replace(/%/g, "")
    .replace(",", ".")
    .trim()
    .toLowerCase();
  let mult = 1;
  if (body.endsWith("m")) { mult = 1_000_000; body = body.slice(0, -1); }
  else if (body.endsWith("k")) { mult = 1_000; body = body.slice(0, -1); }
  const n = parseFloat(body);
  return isNaN(n) ? undefined : n * mult;
}

// Champ d'hypothèse de projection : libellé + input avec suffixe (%, pp, ans).
function ProjAssumptionField({ label, suffix, value, onCommit }: {
  label: string;
  suffix: string;
  value: number | null | undefined;
  onCommit: (raw: string) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "#6D28D9", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input
          type="text"
          defaultValue={value != null ? String(value) : ""}
          placeholder="—"
          onBlur={e => onCommit(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          style={{
            flex: 1, width: 60, padding: "5px 8px", border: "1px solid #DDD6FE", borderRadius: 6,
            fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff",
            color: "var(--text-1)", textAlign: "right", boxSizing: "border-box",
          }}
        />
        <span style={{ fontSize: 11, color: "#6D28D9", fontWeight: 600, whiteSpace: "nowrap" }}>{suffix}</span>
      </div>
    </div>
  );
}

// Input numérique formaté. Affichage compact au repos (k€/M€ en mode "money",
// nombre brut en mode "raw" pour les multiples/ratios/%) ; bascule en valeur
// brute sélectionnée au focus pour permettre un override en 1 frappe.
// Accepte les raccourcis k/M via parseNum au blur.
function MoneyInput({ value, onCommit, width = 100, placeholder = "—", format = "money", suffix }: {
  value: number | null | undefined;
  onCommit: (raw: string) => void;
  width?: number;
  placeholder?: string;
  format?: "money" | "raw";
  suffix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const display = value == null
    ? ""
    : format === "raw"
      ? `${value}${suffix ?? ""}`
      : fmtM(value);
  return (
    <input
      type="text"
      style={{ ...S.input, width }}
      value={editing ? draft : display}
      placeholder={placeholder}
      onFocus={e => {
        setEditing(true);
        setDraft(value != null ? String(value) : "");
        setTimeout(() => e.target.select(), 0);
      }}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => {
        onCommit(draft);
        setEditing(false);
      }}
      onKeyDown={e => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        else if (e.key === "Escape") { setEditing(false); (e.target as HTMLInputElement).blur(); }
      }}
    />
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const S = {
  tab: (active: boolean): React.CSSProperties => ({
    padding: "7px 14px", fontSize: 12.5, fontWeight: active ? 700 : 500, cursor: "pointer",
    color: active ? "var(--text-1)" : "var(--text-4)",
    borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0,
    borderBottomWidth: 2, borderBottomStyle: "solid",
    borderBottomColor: active ? "#1a56db" : "transparent",
    background: "none", fontFamily: "inherit", whiteSpace: "nowrap",
  }),
  yearPill: (active: boolean): React.CSSProperties => ({
    padding: "5px 12px", borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
    background: active ? "#1a56db" : "var(--surface-2)", color: active ? "#fff" : "var(--text-3)",
    border: active ? "none" : "1px solid var(--border)", fontFamily: "inherit", display: "flex",
    alignItems: "center", gap: 5,
  }),
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: {
    padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-4)",
    textTransform: "uppercase" as const, letterSpacing: ".06em", textAlign: "right" as const,
    borderBottom: "1px solid var(--border)",
  },
  section: {
    padding: "6px 12px", fontSize: 10.5, fontWeight: 700, color: "var(--text-4)",
    textTransform: "uppercase" as const, letterSpacing: ".07em", background: "var(--surface-2)",
  },
  cellLabel: {
    padding: "6px 12px", fontSize: 12.5, color: "var(--text-3)", fontWeight: 500,
    borderRight: "1px solid var(--border)", whiteSpace: "nowrap" as const,
  },
  cellVal: (bold = false): React.CSSProperties => ({
    padding: "6px 12px", fontSize: 13, fontWeight: bold ? 700 : 400,
    color: bold ? "var(--text-1)" : "var(--text-3)", textAlign: "right",
  }),
  calcRow: { background: "#F8F9FA" },
  input: {
    width: 100, padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 6,
    fontSize: 12.5, fontFamily: "inherit", outline: "none", background: "var(--surface)",
    color: "var(--text-1)", textAlign: "right" as const, boxSizing: "border-box" as const,
  },
  badge: (favorable: boolean): React.CSSProperties => ({
    fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 10,
    background: favorable ? "#D1FAE5" : "#FEE2E2",
    color: favorable ? "#065F46" : "#991B1B",
  }),
  ratingBadge: (c: "green" | "yellow" | "red"): React.CSSProperties => ({
    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
    background: c === "green" ? "#D1FAE5" : c === "yellow" ? "#FEF3C7" : "#FEE2E2",
    color: c === "green" ? "#065F46" : c === "yellow" ? "#92400E" : "#991B1B",
  }),
};

// ── Sub-tab types ──────────────────────────────────────────────────────────────

type SubTab = "pl" | "recurrent" | "bilan" | "dette" | "valorisation" | "ratios";

const SUB_TAB_LABELS: Record<SubTab, string> = {
  pl: "P&L", recurrent: "Récurrent", bilan: "Bilan",
  dette: "Dette & BFR", valorisation: "Valorisation", ratios: "Ratios",
};

// ── Row builder helpers ────────────────────────────────────────────────────────

type RowDef = {
  key: string;
  label: string;
  field?: keyof FinancialRow;
  calc?: true;
  getValue?: (row: FinancialRow) => number | null | undefined;
  fmt: (v: number | null | undefined) => string;
  invertDelta?: boolean;
  isMargin?: boolean;
  indent?: boolean;
  section?: string;
};

function rowToInputs(r: FinancialRow): FinancialInputs {
  return {
    revenue: r.revenue, revenue_recurring: r.revenue_recurring,
    revenue_non_recurring: r.revenue_non_recurring, cogs: r.cogs,
    payroll: r.payroll, payroll_rd: r.payroll_rd, payroll_sales: r.payroll_sales,
    payroll_ga: r.payroll_ga, marketing: r.marketing, rent: r.rent,
    other_opex: r.other_opex, da: r.da, financial_charges: r.financial_charges,
    taxes: r.taxes, capex: r.capex, arr: r.arr, churn_rate: r.churn_rate,
    nrr: r.nrr, cac: r.cac, growth_fcst: r.growth_fcst,
    intangible_assets: r.intangible_assets, tangible_assets: r.tangible_assets,
    financial_assets: r.financial_assets, inventory: r.inventory,
    accounts_receivable: r.accounts_receivable, other_current_assets: r.other_current_assets,
    cash: r.cash, share_capital: r.share_capital, reserves: r.reserves,
    net_income_bs: r.net_income_bs, debt_lt: r.debt_lt, debt_st: r.debt_st,
    accounts_payable: r.accounts_payable, other_current_liabilities: r.other_current_liabilities,
    multiple_ev_ebitda_low: r.multiple_ev_ebitda_low, multiple_ev_ebitda_mid: r.multiple_ev_ebitda_mid,
    multiple_ev_ebitda_high: r.multiple_ev_ebitda_high,
    multiple_ev_ebit_low: r.multiple_ev_ebit_low, multiple_ev_ebit_mid: r.multiple_ev_ebit_mid,
    multiple_ev_ebit_high: r.multiple_ev_ebit_high,
    multiple_ev_revenue_low: r.multiple_ev_revenue_low, multiple_ev_revenue_mid: r.multiple_ev_revenue_mid,
    multiple_ev_revenue_high: r.multiple_ev_revenue_high,
    multiple_ev_arr_low: r.multiple_ev_arr_low, multiple_ev_arr_mid: r.multiple_ev_arr_mid,
    multiple_ev_arr_high: r.multiple_ev_arr_high,
    wacc: r.wacc, terminal_growth_rate: r.terminal_growth_rate,
    fcf_n1: r.fcf_n1, fcf_n2: r.fcf_n2, fcf_n3: r.fcf_n3, fcf_n4: r.fcf_n4, fcf_n5: r.fcf_n5,
    misc_adjustments: r.misc_adjustments, contingent_liabilities: r.contingent_liabilities,
    excess_cash: r.excess_cash,
    addback_owner_compensation: r.addback_owner_compensation,
    addback_exceptional_charges: r.addback_exceptional_charges,
    addback_property_rent: r.addback_property_rent,
    addback_one_off_fees: r.addback_one_off_fees,
    addback_other: r.addback_other,
  };
}

function calcVal(row: FinancialRow, key: string): number | null | undefined {
  const c = computeFinancials(rowToInputs(row));
  return (c as Record<string, unknown>)[key] as number | null | undefined;
}

// ── Row definitions per sub-tab ────────────────────────────────────────────────

const PL_ROWS: RowDef[] = [
  { key: "_s_cr", label: "", section: "COMPTE DE RÉSULTAT", field: undefined, fmt: fmtM },
  { key: "revenue", label: "Chiffre d'affaires", field: "revenue", fmt: fmtM },
  { key: "revenue_recurring", label: "  dont récurrent", field: "revenue_recurring", fmt: fmtM, indent: true },
  { key: "revenue_non_recurring", label: "  dont non-récurrent", field: "revenue_non_recurring", fmt: fmtM, indent: true },
  { key: "recurring_rate", label: "Taux de récurrence", calc: true, getValue: r => calcVal(r, "recurring_rate"), fmt: fmtPct, isMargin: true },
  { key: "cogs", label: "Coût des ventes (COGS)", field: "cogs", fmt: fmtM, invertDelta: true },
  { key: "gross_profit", label: "Marge brute", calc: true, getValue: r => calcVal(r, "gross_profit"), fmt: fmtM },
  { key: "gross_margin", label: "Taux de marge brute", calc: true, getValue: r => calcVal(r, "gross_margin"), fmt: fmtPct, isMargin: true },
  { key: "_s_opex", label: "", section: "CHARGES OPÉRATIONNELLES", field: undefined, fmt: fmtM },
  { key: "payroll", label: "Masse salariale", field: "payroll", fmt: fmtM, invertDelta: true },
  { key: "payroll_rd", label: "  dont R&D", field: "payroll_rd", fmt: fmtM, indent: true, invertDelta: true },
  { key: "payroll_sales", label: "  dont Commercial", field: "payroll_sales", fmt: fmtM, indent: true, invertDelta: true },
  { key: "payroll_ga", label: "  dont G&A", field: "payroll_ga", fmt: fmtM, indent: true, invertDelta: true },
  { key: "marketing", label: "Marketing", field: "marketing", fmt: fmtM, invertDelta: true },
  { key: "rent", label: "Loyers", field: "rent", fmt: fmtM, invertDelta: true },
  { key: "other_opex", label: "Autres charges", field: "other_opex", fmt: fmtM, invertDelta: true },
  { key: "_s_res", label: "", section: "RÉSULTAT", field: undefined, fmt: fmtM },
  { key: "ebitda", label: "EBITDA reporté", calc: true, getValue: r => calcVal(r, "ebitda"), fmt: fmtM },
  { key: "ebitda_margin", label: "Marge EBITDA", calc: true, getValue: r => calcVal(r, "ebitda_margin"), fmt: fmtPct, isMargin: true },
  { key: "_s_norm", label: "", section: "RETRAITEMENTS (EBITDA NORMATIF)", field: undefined, fmt: fmtM },
  { key: "addback_owner_compensation", label: "Rémunération dirigeant excédentaire", field: "addback_owner_compensation", fmt: fmtM },
  { key: "addback_exceptional_charges", label: "Charges exceptionnelles non récurrentes", field: "addback_exceptional_charges", fmt: fmtM },
  { key: "addback_property_rent", label: "Loyer marché (propriétaire)", field: "addback_property_rent", fmt: fmtM },
  { key: "addback_one_off_fees", label: "Frais ponctuels (audit, conseil, restructuration)", field: "addback_one_off_fees", fmt: fmtM },
  { key: "addback_other", label: "Autres ajustements", field: "addback_other", fmt: fmtM },
  { key: "addbacks_total", label: "Σ retraitements", calc: true, getValue: r => calcVal(r, "addbacks_total"), fmt: fmtM },
  { key: "ebitda_normative", label: "EBITDA NORMATIF", calc: true, getValue: r => calcVal(r, "ebitda_normative"), fmt: fmtM },
  { key: "ebitda_normative_margin", label: "Marge EBITDA normative", calc: true, getValue: r => calcVal(r, "ebitda_normative_margin"), fmt: fmtPct, isMargin: true },
  { key: "_s_post_ebitda", label: "", section: "RÉSULTAT (suite)", field: undefined, fmt: fmtM },
  { key: "da", label: "D&A (amortissements)", field: "da", fmt: fmtM, invertDelta: true },
  { key: "ebit", label: "EBIT", calc: true, getValue: r => calcVal(r, "ebit"), fmt: fmtM },
  { key: "ebit_margin", label: "Marge EBIT", calc: true, getValue: r => calcVal(r, "ebit_margin"), fmt: fmtPct, isMargin: true },
  { key: "financial_charges", label: "Charges financières", field: "financial_charges", fmt: fmtM, invertDelta: true },
  { key: "ebt", label: "Résultat avant impôts", calc: true, getValue: r => calcVal(r, "ebt"), fmt: fmtM },
  { key: "taxes", label: "Impôts", field: "taxes", fmt: fmtM, invertDelta: true },
  { key: "net_income", label: "Résultat net", calc: true, getValue: r => calcVal(r, "net_income"), fmt: fmtM },
  { key: "net_margin", label: "Marge nette", calc: true, getValue: r => calcVal(r, "net_margin"), fmt: fmtPct, isMargin: true },
  { key: "capex", label: "Capex", field: "capex", fmt: fmtM, invertDelta: true },
  { key: "cash_ebitda", label: "Cash EBITDA (EBITDA - Capex)", calc: true, getValue: r => calcVal(r, "cash_ebitda"), fmt: fmtM },
];

const RECURRENT_ROWS: RowDef[] = [
  { key: "revenue_recurring", label: "Revenu récurrent", field: "revenue_recurring", fmt: fmtM },
  { key: "recurring_rate", label: "Taux de récurrence", calc: true, getValue: r => calcVal(r, "recurring_rate"), fmt: fmtPct, isMargin: true },
  { key: "arr", label: "ARR", field: "arr", fmt: fmtM },
  { key: "mrr", label: "MRR", calc: true, getValue: r => calcVal(r, "mrr"), fmt: fmtM },
  { key: "churn_rate", label: "Churn rate (%)", field: "churn_rate", fmt: fmtPctRaw, invertDelta: true },
  { key: "nrr", label: "NRR (%)", field: "nrr", fmt: fmtPctRaw },
  { key: "cac", label: "CAC", field: "cac", fmt: fmtM, invertDelta: true },
  { key: "ltv", label: "LTV", calc: true, getValue: r => calcVal(r, "ltv"), fmt: fmtM },
  { key: "ltv_cac", label: "LTV / CAC", calc: true, getValue: r => calcVal(r, "ltv_cac"), fmt: fmtX },
  { key: "rule_of_40", label: "Rule of 40", calc: true, getValue: r => calcVal(r, "rule_of_40"), fmt: fmtPctRaw },
  { key: "growth_fcst", label: "Croissance prévue (%)", field: "growth_fcst", fmt: fmtPctRaw },
];

const BILAN_ROWS: RowDef[] = [
  { key: "_s_actif", label: "", section: "ACTIF", field: undefined, fmt: fmtM },
  { key: "intangible_assets", label: "Immobilisations incorporelles", field: "intangible_assets", fmt: fmtM },
  { key: "tangible_assets", label: "Immobilisations corporelles", field: "tangible_assets", fmt: fmtM },
  { key: "financial_assets", label: "Immobilisations financières", field: "financial_assets", fmt: fmtM },
  { key: "total_fixed_assets", label: "Total actif immobilisé", calc: true, getValue: r => calcVal(r, "total_fixed_assets"), fmt: fmtM },
  { key: "inventory", label: "Stocks", field: "inventory", fmt: fmtM },
  { key: "accounts_receivable", label: "Créances clients", field: "accounts_receivable", fmt: fmtM },
  { key: "other_current_assets", label: "Autres actifs courants", field: "other_current_assets", fmt: fmtM },
  { key: "cash", label: "Trésorerie", field: "cash", fmt: fmtM },
  { key: "total_current_assets", label: "Total actif circulant", calc: true, getValue: r => calcVal(r, "total_current_assets"), fmt: fmtM },
  { key: "total_assets", label: "TOTAL ACTIF", calc: true, getValue: r => calcVal(r, "total_assets"), fmt: fmtM },
  { key: "_s_passif", label: "", section: "PASSIF", field: undefined, fmt: fmtM },
  { key: "share_capital", label: "Capital social", field: "share_capital", fmt: fmtM },
  { key: "reserves", label: "Réserves", field: "reserves", fmt: fmtM },
  { key: "net_income_bs", label: "Résultat de l'exercice", field: "net_income_bs", fmt: fmtM },
  { key: "equity_calc", label: "Capitaux propres", calc: true, getValue: r => calcVal(r, "equity"), fmt: fmtM },
  { key: "debt_lt", label: "Dettes long terme", field: "debt_lt", fmt: fmtM, invertDelta: true },
  { key: "debt_st", label: "Dettes court terme", field: "debt_st", fmt: fmtM, invertDelta: true },
  { key: "accounts_payable", label: "Dettes fournisseurs", field: "accounts_payable", fmt: fmtM },
  { key: "other_current_liabilities", label: "Autres passifs courants", field: "other_current_liabilities", fmt: fmtM },
  { key: "total_liabilities", label: "TOTAL PASSIF", calc: true, getValue: r => calcVal(r, "total_liabilities"), fmt: fmtM },
];

const DETTE_ROWS: RowDef[] = [
  { key: "_s_dette", label: "", section: "DETTE NETTE", field: undefined, fmt: fmtM },
  { key: "debt_lt", label: "Dettes long terme", field: "debt_lt", fmt: fmtM, invertDelta: true },
  { key: "debt_st", label: "Dettes court terme", field: "debt_st", fmt: fmtM, invertDelta: true },
  { key: "cash_d", label: "Trésorerie", field: "cash", fmt: fmtM },
  { key: "net_debt", label: "Dette nette", calc: true, getValue: r => calcVal(r, "net_debt"), fmt: fmtM, invertDelta: true },
  { key: "_s_bfr", label: "", section: "BESOIN EN FONDS DE ROULEMENT", field: undefined, fmt: fmtM },
  { key: "accounts_receivable_d", label: "Créances clients", field: "accounts_receivable", fmt: fmtM },
  { key: "inventory_d", label: "Stocks", field: "inventory", fmt: fmtM },
  { key: "accounts_payable_d", label: "Dettes fournisseurs", field: "accounts_payable", fmt: fmtM },
  { key: "bfr", label: "BFR", calc: true, getValue: r => calcVal(r, "bfr"), fmt: fmtM },
  { key: "dso", label: "DSO (délai clients)", calc: true, getValue: r => calcVal(r, "dso"), fmt: fmtDays, invertDelta: true },
  { key: "dio", label: "DIO (délai stocks)", calc: true, getValue: r => calcVal(r, "dio"), fmt: fmtDays, invertDelta: true },
  { key: "dpo", label: "DPO (délai fournisseurs)", calc: true, getValue: r => calcVal(r, "dpo"), fmt: fmtDays },
  { key: "ccc", label: "Cycle de conversion cash", calc: true, getValue: r => calcVal(r, "ccc"), fmt: fmtDays, invertDelta: true },
  { key: "_s_fcf", label: "", section: "FREE CASH FLOW", field: undefined, fmt: fmtM },
  { key: "fcf", label: "FCF (EBITDA - Capex)", calc: true, getValue: r => calcVal(r, "fcf"), fmt: fmtM },
  { key: "fcf_conversion", label: "Conversion FCF / EBITDA", calc: true, getValue: r => calcVal(r, "fcf_conversion"), fmt: fmtPct, isMargin: true },
];

// ── Main component ─────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();

const EDITABLE_FIELDS: (keyof FinancialRow)[] = [
  "revenue", "revenue_recurring", "revenue_non_recurring", "cogs",
  "payroll", "payroll_rd", "payroll_sales", "payroll_ga",
  "marketing", "rent", "other_opex", "da", "financial_charges", "taxes", "capex",
  "arr", "churn_rate", "nrr", "cac", "growth_fcst",
  "intangible_assets", "tangible_assets", "financial_assets",
  "inventory", "accounts_receivable", "other_current_assets", "cash",
  "share_capital", "reserves", "net_income_bs",
  "debt_lt", "debt_st", "accounts_payable", "other_current_liabilities",
  "multiple_ev_ebitda_low", "multiple_ev_ebitda_mid", "multiple_ev_ebitda_high",
  "multiple_ev_ebit_low", "multiple_ev_ebit_mid", "multiple_ev_ebit_high",
  "multiple_ev_revenue_low", "multiple_ev_revenue_mid", "multiple_ev_revenue_high",
  "multiple_ev_arr_low", "multiple_ev_arr_mid", "multiple_ev_arr_high",
  "wacc", "terminal_growth_rate",
  "fcf_n1", "fcf_n2", "fcf_n3", "fcf_n4", "fcf_n5",
  "misc_adjustments", "contingent_liabilities", "excess_cash",
  "headcount", "nrr", "grr",
  "addback_owner_compensation", "addback_exceptional_charges",
  "addback_property_rent", "addback_one_off_fees", "addback_other",
];

export function FinancialTab({ dealId, organizationId, dealType = "", currency = "EUR", initialData, initialAi }: Props) {
  const [rows, setRows] = useState<FinancialRow[]>(
    [...initialData].sort((a, b) => b.fiscal_year - a.fiscal_year),
  );
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("pl");
  const [selectedYearIdx, setSelectedYearIdx] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newYear, setNewYear] = useState(CURRENT_YEAR);
  const [newIsForecast, setNewIsForecast] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dcfOpen, setDcfOpen] = useState(false);
  const [ficheImporting, setFicheImporting] = useState(false);
  const [ficheImportError, setFicheImportError] = useState<string | null>(null);

  // Analyse IA financière (V50)
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiExpanded, setAiExpanded] = useState(true);
  const [aiState, setAiState] = useState<InitialAiAnalysis | null>(initialAi ?? null);

  // Projections (V60) — hypothèses de croissance + génération N+1..N+x
  const [showProjections, setShowProjections] = useState(false);
  const [assumptions, setAssumptions] = useState<AssumptionsRow | null>(null);
  const [savingAssumptions, setSavingAssumptions] = useState(false);
  const [projecting, setProjecting] = useState(false);
  const [projectionError, setProjectionError] = useState<string | null>(null);
  const [projectionMessage, setProjectionMessage] = useState<string | null>(null);

  // Deux debounces distincts : données financières et hypothèses de projection
  // peuvent être éditées dans la même fenêtre, un ref partagé annulerait
  // silencieusement la sauvegarde de l'autre.
  const dataDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assumptionsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasRecurrent = rows.some(r => (r.revenue_recurring ?? 0) > 0 || (r.arr ?? 0) > 0);

  const refreshRows = useCallback(async () => {
    const refreshed = dealId
      ? await getFinancialDataByDeal(dealId)
      : await (await import("@/actions/financial-data")).getFinancialDataByOrganization(organizationId!);
    setRows([...(refreshed as FinancialRow[])].sort((a, b) => b.fiscal_year - a.fiscal_year));
  }, [dealId, organizationId]);

  // Charge les hypothèses de projection à l'ouverture (1 fois)
  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;
    (async () => {
      const a = await getAssumptions(dealId);
      if (!cancelled) setAssumptions(a);
    })();
    return () => { cancelled = true; };
  }, [dealId]);

  function patchAssumption(field: keyof AssumptionsRow, value: number | null) {
    if (!dealId) return;
    setAssumptions(prev => {
      const next = { ...(prev ?? {} as AssumptionsRow), [field]: value };
      return next as AssumptionsRow;
    });
    // Debounced save (réutilise le pattern autoSave)
    if (assumptionsDebounceRef.current) clearTimeout(assumptionsDebounceRef.current);
    setSavingAssumptions(true);
    assumptionsDebounceRef.current = setTimeout(async () => {
      try {
        await upsertAssumptions({
          deal_id: dealId,
          base_fiscal_year: assumptions?.base_fiscal_year ?? null,
          projection_years: assumptions?.projection_years ?? 3,
          revenue_growth_pct: assumptions?.revenue_growth_pct ?? null,
          gross_margin_evolution_pp: assumptions?.gross_margin_evolution_pp ?? null,
          opex_growth_pct: assumptions?.opex_growth_pct ?? null,
          capex_pct_revenue: assumptions?.capex_pct_revenue ?? null,
          da_pct_revenue: assumptions?.da_pct_revenue ?? null,
          tax_rate_pct: assumptions?.tax_rate_pct ?? 25,
          arr_growth_pct: assumptions?.arr_growth_pct ?? null,
          notes: assumptions?.notes ?? null,
          [field]: value,
        } as Parameters<typeof upsertAssumptions>[0]);
      } catch (e) {
        console.error("Save assumptions failed:", e);
      }
      setSavingAssumptions(false);
    }, 600);
  }

  async function handleGenerateProjections() {
    if (!dealId) return;
    setProjecting(true);
    setProjectionError(null);
    setProjectionMessage(null);
    // Sauvegarde immédiate des hypothèses avant génération
    if (assumptions) {
      await upsertAssumptions({
        deal_id: dealId,
        base_fiscal_year: assumptions.base_fiscal_year ?? null,
        projection_years: assumptions.projection_years ?? 3,
        revenue_growth_pct: assumptions.revenue_growth_pct ?? null,
        gross_margin_evolution_pp: assumptions.gross_margin_evolution_pp ?? null,
        opex_growth_pct: assumptions.opex_growth_pct ?? null,
        capex_pct_revenue: assumptions.capex_pct_revenue ?? null,
        da_pct_revenue: assumptions.da_pct_revenue ?? null,
        tax_rate_pct: assumptions.tax_rate_pct ?? 25,
        arr_growth_pct: assumptions.arr_growth_pct ?? null,
        notes: assumptions.notes ?? null,
      });
    }
    const res = await generateProjections(dealId);
    if (!res.success) {
      setProjectionError(res.error);
    } else {
      setProjectionMessage(`${res.count} exercice${res.count > 1 ? "s" : ""} prévisionnel${res.count > 1 ? "s" : ""} généré${res.count > 1 ? "s" : ""}`);
      await refreshRows();
    }
    setProjecting(false);
  }

  async function handleClearProjections() {
    if (!dealId) return;
    if (!confirm("Supprimer toutes les projections de ce dossier ?")) return;
    setProjecting(true);
    setProjectionError(null);
    setProjectionMessage(null);
    const res = await clearProjections(dealId);
    if (!res.success) {
      setProjectionError(res.error);
    } else {
      setProjectionMessage(`${res.count} exercice${res.count > 1 ? "s" : ""} supprimé${res.count > 1 ? "s" : ""}`);
      await refreshRows();
    }
    setProjecting(false);
  }

  // Get 3 years: selected, selected+1, selected+2
  const sel = rows[selectedYearIdx];
  const prev1 = rows[selectedYearIdx + 1];
  const prev2 = rows[selectedYearIdx + 2];

  // Libellé colonne dynamique : offset par rapport à l'année réelle la plus
  // récente. (N) = dernier réel, (N+x) = projection, (N-x) = historique.
  const realYears = rows.filter(r => !r.is_forecast).map(r => r.fiscal_year);
  const mostRecentReal = realYears.length > 0 ? Math.max(...realYears) : null;
  function yearOffsetLabel(year: number | undefined): string {
    if (year == null || mostRecentReal == null) return "";
    const offset = year - mostRecentReal;
    if (offset === 0) return "(N)";
    if (offset > 0) return `(N+${offset})`;
    return `(N${offset})`;
  }

  // ── Auto-save with debounce ────────────────────────────────────────────────

  const autoSave = useCallback(
    (updatedRow: FinancialRow) => {
      if (dataDebounceRef.current) clearTimeout(dataDebounceRef.current);
      dataDebounceRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          const payload: Record<string, unknown> = {
            deal_id: dealId || undefined,
            organization_id: organizationId || undefined,
            fiscal_year: updatedRow.fiscal_year,
            period_type: updatedRow.period_type || "annual",
            currency: updatedRow.currency || "EUR",
            source: "manual",
          };
          for (const f of EDITABLE_FIELDS) {
            const v = updatedRow[f];
            if (v !== undefined) payload[f] = v;
          }
          payload.is_forecast = updatedRow.is_forecast ?? false;
          await upsertFinancialData(payload as unknown as Parameters<typeof upsertFinancialData>[0]);
        } catch (e) {
          console.error("Auto-save failed:", e);
        }
        setSaving(false);
      }, 800);
    },
    [dealId, organizationId],
  );

  function updateField(yearIdx: number, field: keyof FinancialRow, value: string) {
    setRows(prev => {
      const next = [...prev];
      const row = { ...next[yearIdx] };
      (row as Record<string, unknown>)[field] = parseNum(value) ?? null;
      next[yearIdx] = row;
      autoSave(row);
      return next;
    });
  }

  // ── Add year ───────────────────────────────────────────────────────────────

  async function addYear() {
    if (rows.some(r => r.fiscal_year === newYear)) return;
    setSaving(true);
    try {
      await upsertFinancialData({
        deal_id: dealId,
        fiscal_year: newYear,
        period_type: "annual",
        currency: "EUR",
        source: "manual",
        is_forecast: newIsForecast,
      } as Parameters<typeof upsertFinancialData>[0]);
      const refreshed = dealId
        ? await getFinancialDataByDeal(dealId)
        : await (await import("@/actions/financial-data")).getFinancialDataByOrganization(organizationId!);
      const sorted = [...(refreshed as FinancialRow[])].sort((a, b) => b.fiscal_year - a.fiscal_year);
      setRows(sorted);
      setSelectedYearIdx(sorted.findIndex(r => r.fiscal_year === newYear));
      setModalOpen(false);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteFinancialData(id);
      setRows(r => {
        const next = r.filter(x => x.id !== id);
        if (selectedYearIdx >= next.length) setSelectedYearIdx(Math.max(0, next.length - 1));
        return next;
      });
    } catch { /* silent */ }
    setDeletingId(null);
  }

  async function handleAiAnalyze() {
    if (!dealId) return;
    setAiAnalyzing(true);
    setAiError(null);
    const res = await analyzeFinancialDataAction(dealId);
    setAiAnalyzing(false);
    if (!res.success) {
      setAiError(res.error);
      return;
    }
    setAiState({
      ai_financial_score: res.result.score,
      ai_valuation_low: res.result.valuation_low,
      ai_valuation_high: res.result.valuation_high,
      ai_financial_notes: res.result.notes,
      ai_analyzed_at: res.result.analyzed_at,
      ai_score_growth: res.result.breakdown.growth,
      ai_score_margin: res.result.breakdown.margin,
      ai_score_balance: res.result.breakdown.balance,
      ai_score_comparables: res.result.breakdown.comparables,
      ai_anomalies: res.result.anomalies,
    });
    setAiExpanded(true);
  }

  // ── Empty state ────────────────────────────────────────────────────────────

  if (rows.length === 0) {
    return (
      <div style={{ padding: "40px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>
          Aucune donnée financière
        </div>
        <div style={{ fontSize: 13, color: "var(--text-5)", marginBottom: 16 }}>
          Importez les exercices publiés de la fiche prospection, ou saisissez un exercice
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {dealId && (
          <button
            onClick={async () => {
              if (ficheImporting) return;
              setFicheImporting(true);
              setFicheImportError(null);
              const res = await importFinancesFromFiche(dealId);
              setFicheImporting(false);
              if (res.success) {
                setRows([...(res.data.rows as unknown as FinancialRow[])].sort((a, b) => b.fiscal_year - a.fiscal_year));
              } else {
                setFicheImportError(res.error);
              }
            }}
            disabled={ficheImporting}
            style={{ padding: "8px 18px", borderRadius: 9, background: "#0F766E", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: ficheImporting ? 0.6 : 1 }}
          >
            {ficheImporting ? "Import…" : "Importer depuis la fiche prospection"}
          </button>
          )}
          <button
            onClick={() => { setNewYear(CURRENT_YEAR); setModalOpen(true); }}
            style={{ padding: "8px 18px", borderRadius: 9, background: "#1a56db", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            + Ajouter un exercice
          </button>
        </div>
        {ficheImportError && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: "#991B1B" }}>{ficheImportError}</div>
        )}
        {modalOpen && <AddYearModal newYear={newYear} setNewYear={setNewYear} newIsForecast={newIsForecast} setNewIsForecast={setNewIsForecast} saving={saving} onAdd={addYear} onClose={() => setModalOpen(false)} />}
      </div>
    );
  }

  // ── Render table for a given sub-tab ───────────────────────────────────────

  function getVal(row: FinancialRow | undefined, def: RowDef): number | null | undefined {
    if (!row) return undefined;
    if (def.calc && def.getValue) return def.getValue(row);
    if (def.field) return row[def.field] as number | null | undefined;
    return undefined;
  }

  function renderDataTable(defs: RowDef[]) {
    return (
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <table style={S.table}>
          <thead>
            <tr style={{ background: "var(--surface-2)" }}>
              <th style={{ ...S.th, textAlign: "left", minWidth: 180, borderRight: "1px solid var(--border)" }}>Indicateur</th>
              <th style={{ ...S.th, color: sel?.is_forecast ? "#5B21B6" : undefined }}>
                {sel?.fiscal_year ?? "—"} {yearOffsetLabel(sel?.fiscal_year)}
                {sel?.is_forecast && <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 700, padding: "1px 5px", background: "#EDE9FE", color: "#6D28D9", borderRadius: 6 }}>PRÉV.</span>}
              </th>
              <th style={{ ...S.th, color: prev1?.is_forecast ? "#7C3AED" : "var(--text-5)" }}>
                {prev1?.fiscal_year ?? "—"} {yearOffsetLabel(prev1?.fiscal_year)}
              </th>
              <th style={{ ...S.th, color: prev2?.is_forecast ? "#7C3AED" : "var(--text-5)" }}>
                {prev2?.fiscal_year ?? "—"} {yearOffsetLabel(prev2?.fiscal_year)}
              </th>
              <th style={S.th}>Δ</th>
            </tr>
          </thead>
          <tbody>
            {defs.map(def => {
              if (def.section) {
                return (
                  <tr key={def.key}>
                    <td colSpan={5} style={S.section}>{def.section}</td>
                  </tr>
                );
              }
              const vN = getVal(sel, def);
              const vN1 = getVal(prev1, def);
              const vN2 = getVal(prev2, def);
              const delta = varDelta(vN, vN1, def.isMargin);
              const isCalc = !!def.calc;
              const isEditable = !isCalc && !!def.field;
              const rowStyle = isCalc ? S.calcRow : {};

              return (
                <tr key={def.key} style={rowStyle}>
                  <td style={{ ...S.cellLabel, paddingLeft: def.indent ? 28 : 12 }}>{def.label}</td>
                  <td style={S.cellVal(true)}>
                    {isEditable && sel ? (
                      <MoneyInput
                        value={vN}
                        onCommit={raw => updateField(selectedYearIdx, def.field!, raw)}
                      />
                    ) : (
                      <span style={{ fontWeight: isCalc ? 700 : 400 }}>{def.fmt(vN)}</span>
                    )}
                  </td>
                  <td style={S.cellVal(false)}>{def.fmt(vN1)}</td>
                  <td style={S.cellVal(false)}>{def.fmt(vN2)}</td>
                  <td style={{ ...S.cellVal(false), textAlign: "right" }}>
                    {delta ? (
                      <span style={S.badge(def.invertDelta ? !delta.favorable : delta.favorable)}>
                        {delta.text}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-5)" }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* Balance check alert for bilan */}
        {activeSubTab === "bilan" && sel && (() => {
          const c = computeFinancials(rowToInputs(sel));
          if (c.balance_check != null && Math.abs(c.balance_check) > 1) {
            return (
              <div style={{ padding: "8px 14px", background: "#FEF2F2", borderTop: "1px solid #FCA5A5", fontSize: 12.5, color: "#DC2626", fontWeight: 600 }}>
                Ecart Actif / Passif : {fmtM(c.balance_check)} — Vérifiez vos saisies
              </div>
            );
          }
          return null;
        })()}
      </div>
    );
  }

  // ── Valorisation tab ───────────────────────────────────────────────────────

  function renderValorisationTab() {
    if (!sel) return null;
    const c = computeFinancials(rowToInputs(sel));
    type ValoMethod = {
      label: string;
      fields: readonly [keyof FinancialRow, keyof FinancialRow, keyof FinancialRow];
      valo: ReturnType<typeof computeFinancials>["valo_ebitda"];
      readonlyMultiples?: boolean;
      highlight?: boolean;
    };
    const methods: ValoMethod[] = [
      { label: "EV / EBITDA reporté", fields: ["multiple_ev_ebitda_low", "multiple_ev_ebitda_mid", "multiple_ev_ebitda_high"], valo: c.valo_ebitda },
      { label: "EV / EBITDA normatif", fields: ["multiple_ev_ebitda_low", "multiple_ev_ebitda_mid", "multiple_ev_ebitda_high"], valo: c.valo_ebitda_normative, readonlyMultiples: true, highlight: true },
      { label: "EV / EBIT", fields: ["multiple_ev_ebit_low", "multiple_ev_ebit_mid", "multiple_ev_ebit_high"], valo: c.valo_ebit },
      { label: "EV / Revenue", fields: ["multiple_ev_revenue_low", "multiple_ev_revenue_mid", "multiple_ev_revenue_high"], valo: c.valo_revenue },
      { label: "EV / ARR", fields: ["multiple_ev_arr_low", "multiple_ev_arr_mid", "multiple_ev_arr_high"], valo: c.valo_arr },
    ];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Multiples table */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <table style={S.table}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th style={{ ...S.th, textAlign: "left", borderRight: "1px solid var(--border)" }}>Méthode</th>
                <th style={S.th}>Multiple bas</th>
                <th style={S.th}>Multiple mid</th>
                <th style={S.th}>Multiple haut</th>
                <th style={S.th}>VE mid</th>
                <th style={S.th}>CP mid</th>
              </tr>
            </thead>
            <tbody>
              {methods.map(m => (
                <tr key={m.label} style={m.highlight ? { background: "#EFF6FF" } : {}}>
                  <td style={{ ...S.cellLabel, fontWeight: m.highlight ? 700 : 500, color: m.highlight ? "var(--text-1)" : S.cellLabel.color }}>{m.label}</td>
                  {m.fields.map(f => (
                    <td key={f} style={S.cellVal(false)}>
                      {m.readonlyMultiples ? (
                        <span style={{ fontSize: 12, color: "var(--text-4)" }}>
                          {sel[f] != null ? `${sel[f]}x` : "—"}
                        </span>
                      ) : (
                        <MoneyInput
                          value={sel[f] as number | null | undefined}
                          onCommit={raw => updateField(selectedYearIdx, f, raw)}
                          width={70}
                          format="raw"
                          suffix="x"
                        />
                      )}
                    </td>
                  ))}
                  <td style={S.cellVal(true)}>{fmtM(m.valo?.ev_mid)}</td>
                  <td style={S.cellVal(false)}>{fmtM(m.valo?.eq_mid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bridge VE -> CP */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 10 }}>
            Bridge VE → Capitaux propres
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
            {[
              { label: "Ajustements divers", field: "misc_adjustments" as keyof FinancialRow },
              { label: "Passifs contingents", field: "contingent_liabilities" as keyof FinancialRow },
              { label: "Tréso excédentaire", field: "excess_cash" as keyof FinancialRow },
            ].map(item => (
              <div key={item.field}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-4)", marginBottom: 4 }}>{item.label}</div>
                <MoneyInput
                  value={sel[item.field] as number | null | undefined}
                  onCommit={raw => updateField(selectedYearIdx, item.field, raw)}
                />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-4)", marginBottom: 4 }}>Dette nette (calc.)</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", padding: "4px 0" }}>{fmtM(c.net_debt)}</div>
            </div>
          </div>
        </div>

        {/* DCF section */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <button
            onClick={() => setDcfOpen(p => !p)}
            style={{ width: "100%", padding: "10px 16px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: "var(--text-2)" }}
          >
            {dcfOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            DCF (Discounted Cash Flow)
          </button>
          {dcfOpen && (
            <div style={{ padding: "0 16px 16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-4)", marginBottom: 4 }}>WACC (%)</div>
                  <MoneyInput
                    value={sel.wacc}
                    onCommit={raw => updateField(selectedYearIdx, "wacc", raw)}
                    format="raw"
                    suffix="%"
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-4)", marginBottom: 4 }}>Taux de croissance terminal (%)</div>
                  <MoneyInput
                    value={sel.terminal_growth_rate}
                    onCommit={raw => updateField(selectedYearIdx, "terminal_growth_rate", raw)}
                    format="raw"
                    suffix="%"
                  />
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-4)", marginBottom: 6 }}>FCF projetés (N+1 à N+5)</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 12 }}>
                {(["fcf_n1", "fcf_n2", "fcf_n3", "fcf_n4", "fcf_n5"] as const).map((f, i) => (
                  <div key={f}>
                    <div style={{ fontSize: 10, color: "var(--text-5)", marginBottom: 2 }}>N+{i + 1}</div>
                    <MoneyInput
                      value={sel[f]}
                      onCommit={raw => updateField(selectedYearIdx, f, raw)}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 24, padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-4)", fontWeight: 600 }}>VE (DCF)</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>{fmtM(c.ev_dcf)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-4)", fontWeight: 600 }}>Capitaux propres (DCF)</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>{fmtM(c.equity_dcf)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Ratios tab ─────────────────────────────────────────────────────────────

  function renderRatiosTab() {
    if (!sel) return null;
    const c = computeFinancials(rowToInputs(sel));
    const bench = getBenchmark(sel.sector);

    const cards: { label: string; value: number | null | undefined; fmt: (v: number | null | undefined) => string; benchLow: number; benchHigh: number; lowerIsBetter?: boolean }[] = [
      { label: "Marge brute", value: c.gross_margin != null ? c.gross_margin * 100 : null, fmt: v => v != null ? `${v.toFixed(1)}%` : "—", benchLow: bench.gross_margin.low, benchHigh: bench.gross_margin.high },
      { label: "Marge EBITDA", value: c.ebitda_margin != null ? c.ebitda_margin * 100 : null, fmt: v => v != null ? `${v.toFixed(1)}%` : "—", benchLow: bench.ebitda_margin.low, benchHigh: bench.ebitda_margin.high },
      { label: "Marge nette", value: c.net_margin != null ? c.net_margin * 100 : null, fmt: v => v != null ? `${v.toFixed(1)}%` : "—", benchLow: 5, benchHigh: 15 },
      { label: "Leverage (DN/EBITDA)", value: c.leverage, fmt: fmtX, benchLow: bench.net_debt_ebitda.healthy, benchHigh: bench.net_debt_ebitda.lbo, lowerIsBetter: true },
      { label: "Gearing (DN/CP)", value: c.gearing, fmt: fmtX, benchLow: 0.5, benchHigh: 1.5, lowerIsBetter: true },
      { label: "Current ratio", value: c.current_ratio, fmt: fmtX, benchLow: 1, benchHigh: 2 },
      { label: "ROCE", value: c.roce != null ? c.roce * 100 : null, fmt: v => v != null ? `${v.toFixed(1)}%` : "—", benchLow: 8, benchHigh: 15 },
      { label: "Conversion FCF", value: c.fcf_conversion != null ? c.fcf_conversion * 100 : null, fmt: v => v != null ? `${v.toFixed(1)}%` : "—", benchLow: 50, benchHigh: 80 },
    ];

    if (hasRecurrent) {
      cards.push(
        { label: "LTV / CAC", value: c.ltv_cac, fmt: fmtX, benchLow: 3, benchHigh: 5 },
        { label: "Rule of 40", value: c.rule_of_40, fmt: v => v != null ? `${v.toFixed(0)}` : "—", benchLow: 30, benchHigh: 40 },
      );
    }

    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        {cards.map(card => {
          const rating = card.value != null
            ? getRatingColor(card.value, card.benchLow, card.benchHigh, card.lowerIsBetter)
            : null;
          return (
            <div key={card.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-4)", marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", marginBottom: 6 }}>
                {card.fmt(card.value)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {rating && <span style={S.ratingBadge(rating)}>{rating === "green" ? "Bon" : rating === "yellow" ? "Moyen" : "Faible"}</span>}
                <span style={{ fontSize: 10, color: "var(--text-5)" }}>
                  Bench: {card.benchLow}–{card.benchHigh}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "20px 0" }}>
      {/* Header + saving indicator + bouton Analyser IA */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Données financières</span>
          {saving && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--text-4)" }}>
              <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Enregistrement...
            </span>
          )}
        </div>
        {dealId && rows.length > 0 && (
          <button
            type="button"
            onClick={handleAiAnalyze}
            disabled={aiAnalyzing}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 9, border: "none",
              background: aiAnalyzing ? "var(--surface-3)" : "linear-gradient(135deg, #1a56db, #5A8CD0)",
              color: aiAnalyzing ? "var(--text-5)" : "#fff",
              fontSize: 13, fontWeight: 600, cursor: aiAnalyzing ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {aiAnalyzing
              ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Analyse en cours...</>
              : <><Sparkles size={13} /> {aiState?.ai_analyzed_at ? "Re-analyser" : "Analyser avec l'IA"}</>
            }
          </button>
        )}
      </div>

      {/* Bandeau KPIs (vue d'ensemble) */}
      {rows.length > 0 && <FinancialKpiBanner rows={rows} currency={currency} />}

      {/* Panel résultat IA */}
      {(aiState?.ai_financial_score !== null && aiState?.ai_financial_score !== undefined) && (
        <AiAnalysisPanel
          ai={aiState!}
          currency={currency}
          expanded={aiExpanded}
          onToggle={() => setAiExpanded(e => !e)}
        />
      )}
      {aiError && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fee2e2", color: "#b91c1c", fontSize: 13, marginBottom: 14 }}>
          {aiError}
        </div>
      )}

      {/* Year pills */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {rows.map((r, i) => {
          const active = i === selectedYearIdx;
          const forecast = !!r.is_forecast;
          const pillStyle: React.CSSProperties = forecast
            ? {
                ...S.yearPill(active),
                background: active ? "#7C3AED" : "#F5F3FF",
                color: active ? "#fff" : "#5B21B6",
                border: active ? "none" : "1px dashed #C4B5FD",
              }
            : S.yearPill(active);
          return (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button onClick={() => setSelectedYearIdx(i)} style={pillStyle}>
              {r.fiscal_year}
              <span style={{
                fontSize: 9.5, padding: "1px 5px", borderRadius: 8, fontWeight: 600,
                background: forecast ? (active ? "rgba(255,255,255,.2)" : "#EDE9FE") : (active ? "rgba(255,255,255,.2)" : "var(--surface-3)"),
                color: forecast ? (active ? "#fff" : "#6D28D9") : (active ? "#fff" : "var(--text-5)"),
              }}>
                {forecast ? "Prévision" : "Réel"}
              </span>
            </button>
            <button
              onClick={() => handleDelete(r.id)}
              disabled={deletingId === r.id}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-5)", padding: 2, lineHeight: 1 }}
              title="Supprimer"
            >
              <Trash2 size={11} />
            </button>
          </div>
          );
        })}
        <button
          onClick={() => {
            const next = rows.length > 0 ? rows[0].fiscal_year + 1 : CURRENT_YEAR;
            setNewYear(next);
            setNewIsForecast(false);
            setModalOpen(true);
          }}
          style={{ ...S.yearPill(false), background: "none", border: "1px dashed var(--border)", color: "var(--text-4)", fontSize: 12 }}
        >
          <Plus size={12} /> Exercice
        </button>
        <button
          onClick={() => setShowImport(p => !p)}
          style={{ ...S.yearPill(false), background: "none", border: "1px dashed var(--border)", color: "var(--text-4)", fontSize: 12 }}
        >
          {showImport ? "✕ Fermer import" : "↑ Importer CSV / Excel"}
        </button>
        {dealId && (
          <button
            onClick={() => setShowProjections(p => !p)}
            style={{
              ...S.yearPill(showProjections),
              background: showProjections ? "#6D28D9" : "none",
              border: showProjections ? "none" : "1px dashed #8B5CF6",
              color: showProjections ? "#fff" : "#6D28D9",
              fontSize: 12,
            }}
          >
            <TrendingUp size={12} /> {showProjections ? "✕ Fermer projections" : "Projections"}
          </button>
        )}
      </div>

      {/* Panel Projections — hypothèses + génération */}
      {showProjections && dealId && (
        <div style={{ marginBottom: 16, padding: 18, background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#5B21B6" }}>
              Hypothèses de projection
              {savingAssumptions && <span style={{ marginLeft: 8, fontSize: 11, color: "#7C3AED", fontWeight: 500 }}>Enregistrement…</span>}
            </div>
            <div style={{ fontSize: 11.5, color: "#6D28D9" }}>
              Les valeurs déjà saisies manuellement sur les exercices prévisionnels sont préservées.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
            <ProjAssumptionField
              label="Croissance CA"
              suffix="%/an"
              value={assumptions?.revenue_growth_pct}
              onCommit={raw => patchAssumption("revenue_growth_pct", parseNum(raw) ?? null)}
            />
            <ProjAssumptionField
              label="Évolution marge brute"
              suffix="pp/an"
              value={assumptions?.gross_margin_evolution_pp}
              onCommit={raw => patchAssumption("gross_margin_evolution_pp", parseNum(raw) ?? null)}
            />
            <ProjAssumptionField
              label="Croissance Opex"
              suffix="%/an"
              value={assumptions?.opex_growth_pct}
              onCommit={raw => patchAssumption("opex_growth_pct", parseNum(raw) ?? null)}
            />
            <ProjAssumptionField
              label="Capex"
              suffix="% CA"
              value={assumptions?.capex_pct_revenue}
              onCommit={raw => patchAssumption("capex_pct_revenue", parseNum(raw) ?? null)}
            />
            <ProjAssumptionField
              label="D&A"
              suffix="% CA"
              value={assumptions?.da_pct_revenue}
              onCommit={raw => patchAssumption("da_pct_revenue", parseNum(raw) ?? null)}
            />
            <ProjAssumptionField
              label="Taux IS"
              suffix="%"
              value={assumptions?.tax_rate_pct ?? 25}
              onCommit={raw => patchAssumption("tax_rate_pct", parseNum(raw) ?? null)}
            />
            <ProjAssumptionField
              label="Croissance ARR"
              suffix="%/an"
              value={assumptions?.arr_growth_pct}
              onCommit={raw => patchAssumption("arr_growth_pct", parseNum(raw) ?? null)}
            />
            <ProjAssumptionField
              label="Nombre d'années"
              suffix="ans"
              value={assumptions?.projection_years ?? 3}
              onCommit={raw => {
                const n = parseNum(raw);
                if (n != null && n >= 1 && n <= 10) patchAssumption("projection_years", Math.round(n));
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={handleGenerateProjections}
              disabled={projecting}
              style={{ padding: "8px 16px", borderRadius: 8, background: "#6D28D9", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: projecting ? "wait" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}
            >
              {projecting ? <Loader2 size={13} className="animate-spin" /> : <TrendingUp size={13} />}
              Générer {assumptions?.projection_years ?? 3} projection{(assumptions?.projection_years ?? 3) > 1 ? "s" : ""}
            </button>
            <button
              onClick={handleClearProjections}
              disabled={projecting}
              style={{ padding: "8px 14px", borderRadius: 8, background: "transparent", color: "#6D28D9", border: "1px solid #8B5CF6", fontSize: 12.5, fontWeight: 600, cursor: projecting ? "wait" : "pointer", fontFamily: "inherit" }}
            >
              Effacer les projections
            </button>
            {projectionMessage && (
              <span style={{ fontSize: 12, color: "#065F46", fontWeight: 600 }}>{projectionMessage}</span>
            )}
            {projectionError && (
              <span style={{ fontSize: 12, color: "#991B1B", fontWeight: 600 }}>{projectionError}</span>
            )}
          </div>
        </div>
      )}

      {/* Import CSV/Excel */}
      {showImport && (
        <div style={{ marginBottom: 16 }}>
          <FinancialImport
            dealId={dealId}
            organizationId={organizationId}
            onImported={async () => {
              setShowImport(false);
              await refreshRows();
            }}
          />
        </div>
      )}

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 0, borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "var(--border)", marginBottom: 16, overflowX: "auto" }}>
        {(Object.keys(SUB_TAB_LABELS) as SubTab[])
          .filter(t => t !== "recurrent" || hasRecurrent)
          .map(t => (
            <button key={t} onClick={() => setActiveSubTab(t)} style={S.tab(activeSubTab === t)}>
              {SUB_TAB_LABELS[t]}
            </button>
          ))}
      </div>

      {/* Tab content */}
      {activeSubTab === "pl" && renderDataTable(PL_ROWS)}
      {activeSubTab === "recurrent" && renderDataTable(RECURRENT_ROWS)}
      {activeSubTab === "bilan" && renderDataTable(BILAN_ROWS)}
      {activeSubTab === "dette" && renderDataTable(DETTE_ROWS)}
      {activeSubTab === "valorisation" && renderValorisationTab()}
      {activeSubTab === "ratios" && renderRatiosTab()}

      {/* Add year modal */}
      {modalOpen && (
        <AddYearModal
          newYear={newYear}
          setNewYear={setNewYear}
          newIsForecast={newIsForecast}
          setNewIsForecast={setNewIsForecast}
          saving={saving}
          onAdd={addYear}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* Spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Add Year Modal ─────────────────────────────────────────────────────────────

function AddYearModal({
  newYear, setNewYear, newIsForecast, setNewIsForecast, saving, onAdd, onClose,
}: {
  newYear: number; setNewYear: (y: number) => void;
  newIsForecast: boolean; setNewIsForecast: (v: boolean) => void;
  saving: boolean; onAdd: () => void; onClose: () => void;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 16, padding: 24, width: 340 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>
          Ajouter un exercice
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--text-4)", marginBottom: 4 }}>
            Année
          </label>
          <input
            type="number"
            min={1900}
            max={2100}
            value={newYear}
            onChange={e => setNewYear(parseInt(e.target.value) || CURRENT_YEAR)}
            style={{ width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none", background: "var(--surface)", color: "var(--text-1)", boxSizing: "border-box" }}
          />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-3)", marginBottom: 16, cursor: "pointer" }}>
          <input type="checkbox" checked={newIsForecast} onChange={e => setNewIsForecast(e.target.checked)} />
          Exercice prévisionnel
        </label>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
          >
            Annuler
          </button>
          <button
            onClick={onAdd}
            disabled={saving}
            style={{ padding: "8px 20px", borderRadius: 8, background: "#1a56db", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Création..." : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Panel d'analyse IA financière (V50) ───────────────────────────────────

function AiAnalysisPanel({ ai, currency, expanded, onToggle }: {
  ai: InitialAiAnalysis;
  currency: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const score = ai.ai_financial_score ?? 0;
  const scoreColor = score >= 70 ? "#15A348" : score >= 50 ? "#D97706" : "#B91C1C";

  function fmtEvVal(n: number | null): string {
    if (n === null || n === undefined) return "—";
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M ${currency}`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)}k ${currency}`;
    return `${n} ${currency}`;
  }

  function fmtAnalyzedAt(iso: string | null): string {
    if (!iso) return "—";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  }

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderLeft: `3px solid ${scoreColor}`,
      borderRadius: 12,
      marginBottom: 16,
      overflow: "hidden",
    }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px", background: "transparent", border: "none",
          cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        }}
      >
        <Sparkles size={16} color={scoreColor} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>
            Analyse IA financière
            <span style={{ marginLeft: 10, fontSize: 18, fontWeight: 800, color: scoreColor }}>
              {score}/100
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-5)", marginTop: 2 }}>
            Analysé le {fmtAnalyzedAt(ai.ai_analyzed_at)}
          </div>
        </div>
        {expanded ? <ChevronDown size={16} color="var(--text-4)" /> : <ChevronRight size={16} color="var(--text-4)" />}
      </button>

      {expanded && (
        <div style={{ padding: "0 16px 16px 16px", borderTop: "1px solid var(--border)" }}>
          {/* Barre de score */}
          <div style={{ marginTop: 12, marginBottom: 14 }}>
            <div style={{ height: 8, background: "var(--surface-3)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${Math.max(0, Math.min(100, score))}%`,
                background: scoreColor, transition: "width .3s",
              }} />
            </div>
          </div>

          {/* Score décomposé en 4 sous-critères */}
          {(ai.ai_score_growth != null || ai.ai_score_margin != null || ai.ai_score_balance != null || ai.ai_score_comparables != null) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
              {[
                { label: "Croissance", value: ai.ai_score_growth, hint: "Évolution YoY du CA" },
                { label: "Marge", value: ai.ai_score_margin, hint: "Rentabilité EBITDA vs secteur" },
                { label: "Bilan", value: ai.ai_score_balance, hint: "Solidité financière, dette nette" },
                { label: "Comparables", value: ai.ai_score_comparables, hint: "Positionnement vs multiples sectoriels" },
              ].map(b => {
                const v = b.value ?? 0;
                const pct = (v / 25) * 100;
                const c = v >= 18 ? "#15A348" : v >= 12 ? "#D97706" : "#B91C1C";
                return (
                  <div key={b.label} title={b.hint} style={{
                    padding: "8px 10px", background: "var(--surface-2)", borderRadius: 8,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".04em" }}>{b.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: c }}>{v}<span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-5)" }}>/25</span></span>
                    </div>
                    <div style={{ height: 4, background: "var(--surface-3)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, background: c, transition: "width .3s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Anomalies détectées */}
          {ai.ai_anomalies && ai.ai_anomalies.length > 0 && (
            <div style={{
              marginBottom: 12, padding: "10px 12px", background: "#FEF3C7",
              border: "1px solid #FCD34D", borderRadius: 8,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>
                ⚠ Anomalies détectées
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#78350F", lineHeight: 1.55 }}>
                {ai.ai_anomalies.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          {/* Fourchette valorisation */}
          {(ai.ai_valuation_low !== null || ai.ai_valuation_high !== null) && (
            <div style={{
              display: "flex", gap: 12, marginBottom: 12,
              padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-5)", textTransform: "uppercase", letterSpacing: ".05em" }}>
                  Valorisation basse
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", marginTop: 2 }}>
                  {fmtEvVal(ai.ai_valuation_low)}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-5)", textTransform: "uppercase", letterSpacing: ".05em" }}>
                  Valorisation haute
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", marginTop: 2 }}>
                  {fmtEvVal(ai.ai_valuation_high)}
                </div>
              </div>
            </div>
          )}

          {/* Notes IA */}
          {ai.ai_financial_notes && (
            <div style={{
              fontSize: 13, color: "var(--text-2)", lineHeight: 1.55,
              padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8,
              whiteSpace: "pre-wrap",
            }}>
              {ai.ai_financial_notes}
            </div>
          )}

          <div style={{ fontSize: 10.5, color: "var(--text-5)", marginTop: 10, fontStyle: "italic" }}>
            Généré par Claude · L'IA suggère, l'équipe valide.
          </div>
        </div>
      )}
    </div>
  );
}
