"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Save, Loader2 } from "lucide-react";
import { computeFinancials, type FinancialInputs } from "@/lib/crm/financial-calcs";
import { getBenchmark, getRatingColor } from "@/lib/crm/financial-benchmarks";
import { upsertFinancialData, getFinancialDataByDeal, deleteFinancialData } from "@/actions/financial-data";
import { FinancialImport } from "@/components/financials/FinancialImport";

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
}

interface Props {
  dealId?: string;
  organizationId?: string;
  dealType?: string;
  initialData: FinancialRow[];
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtM(v: number | null | undefined): string {
  if (v == null) return "\—";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M\u20AC`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)} k\u20AC`;
  return `${Math.round(v)} \u20AC`;
}
function fmtPct(v: number | null | undefined): string {
  if (v == null) return "\—";
  return `${(v * 100).toFixed(1)}%`;
}
function fmtPctRaw(v: number | null | undefined): string {
  if (v == null) return "\—";
  return `${v.toFixed(1)}%`;
}
function fmtX(v: number | null | undefined): string {
  return v == null ? "\—" : `${v.toFixed(1)}x`;
}
function fmtDays(v: number | null | undefined): string {
  return v == null ? "\—" : `${Math.round(v)}j`;
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

function parseNum(v: string): number | undefined {
  if (!v || v.trim() === "") return undefined;
  const n = parseFloat(v.replace(/\s/g, "").replace(",", "."));
  return isNaN(n) ? undefined : n;
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
  };
}

function calcVal(row: FinancialRow, key: string): number | null | undefined {
  const c = computeFinancials(rowToInputs(row));
  return (c as Record<string, unknown>)[key] as number | null | undefined;
}

// ── Row definitions per sub-tab ────────────────────────────────────────────────

const PL_ROWS: RowDef[] = [
  { key: "_s_cr", label: "", section: "COMPTE DE R\ÉSULTAT", field: undefined, fmt: fmtM },
  { key: "revenue", label: "Chiffre d'affaires", field: "revenue", fmt: fmtM },
  { key: "revenue_recurring", label: "  dont r\écurrent", field: "revenue_recurring", fmt: fmtM, indent: true },
  { key: "revenue_non_recurring", label: "  dont non-r\écurrent", field: "revenue_non_recurring", fmt: fmtM, indent: true },
  { key: "recurring_rate", label: "Taux de r\écurrence", calc: true, getValue: r => calcVal(r, "recurring_rate"), fmt: fmtPct, isMargin: true },
  { key: "cogs", label: "Co\ût des ventes (COGS)", field: "cogs", fmt: fmtM, invertDelta: true },
  { key: "gross_profit", label: "Marge brute", calc: true, getValue: r => calcVal(r, "gross_profit"), fmt: fmtM },
  { key: "gross_margin", label: "Taux de marge brute", calc: true, getValue: r => calcVal(r, "gross_margin"), fmt: fmtPct, isMargin: true },
  { key: "_s_opex", label: "", section: "CHARGES OP\ÉRATIONNELLES", field: undefined, fmt: fmtM },
  { key: "payroll", label: "Masse salariale", field: "payroll", fmt: fmtM, invertDelta: true },
  { key: "payroll_rd", label: "  dont R&D", field: "payroll_rd", fmt: fmtM, indent: true, invertDelta: true },
  { key: "payroll_sales", label: "  dont Commercial", field: "payroll_sales", fmt: fmtM, indent: true, invertDelta: true },
  { key: "payroll_ga", label: "  dont G&A", field: "payroll_ga", fmt: fmtM, indent: true, invertDelta: true },
  { key: "marketing", label: "Marketing", field: "marketing", fmt: fmtM, invertDelta: true },
  { key: "rent", label: "Loyers", field: "rent", fmt: fmtM, invertDelta: true },
  { key: "other_opex", label: "Autres charges", field: "other_opex", fmt: fmtM, invertDelta: true },
  { key: "_s_res", label: "", section: "R\ÉSULTAT", field: undefined, fmt: fmtM },
  { key: "ebitda", label: "EBITDA", calc: true, getValue: r => calcVal(r, "ebitda"), fmt: fmtM },
  { key: "ebitda_margin", label: "Marge EBITDA", calc: true, getValue: r => calcVal(r, "ebitda_margin"), fmt: fmtPct, isMargin: true },
  { key: "da", label: "D&A (amortissements)", field: "da", fmt: fmtM, invertDelta: true },
  { key: "ebit", label: "EBIT", calc: true, getValue: r => calcVal(r, "ebit"), fmt: fmtM },
  { key: "ebit_margin", label: "Marge EBIT", calc: true, getValue: r => calcVal(r, "ebit_margin"), fmt: fmtPct, isMargin: true },
  { key: "financial_charges", label: "Charges financi\ères", field: "financial_charges", fmt: fmtM, invertDelta: true },
  { key: "ebt", label: "R\ésultat avant imp\ôts", calc: true, getValue: r => calcVal(r, "ebt"), fmt: fmtM },
  { key: "taxes", label: "Imp\ôts", field: "taxes", fmt: fmtM, invertDelta: true },
  { key: "net_income", label: "R\ésultat net", calc: true, getValue: r => calcVal(r, "net_income"), fmt: fmtM },
  { key: "net_margin", label: "Marge nette", calc: true, getValue: r => calcVal(r, "net_margin"), fmt: fmtPct, isMargin: true },
  { key: "capex", label: "Capex", field: "capex", fmt: fmtM, invertDelta: true },
  { key: "cash_ebitda", label: "Cash EBITDA (EBITDA - Capex)", calc: true, getValue: r => calcVal(r, "cash_ebitda"), fmt: fmtM },
];

const RECURRENT_ROWS: RowDef[] = [
  { key: "revenue_recurring", label: "Revenu r\écurrent", field: "revenue_recurring", fmt: fmtM },
  { key: "recurring_rate", label: "Taux de r\écurrence", calc: true, getValue: r => calcVal(r, "recurring_rate"), fmt: fmtPct, isMargin: true },
  { key: "arr", label: "ARR", field: "arr", fmt: fmtM },
  { key: "mrr", label: "MRR", calc: true, getValue: r => calcVal(r, "mrr"), fmt: fmtM },
  { key: "churn_rate", label: "Churn rate (%)", field: "churn_rate", fmt: fmtPctRaw, invertDelta: true },
  { key: "nrr", label: "NRR (%)", field: "nrr", fmt: fmtPctRaw },
  { key: "cac", label: "CAC", field: "cac", fmt: fmtM, invertDelta: true },
  { key: "ltv", label: "LTV", calc: true, getValue: r => calcVal(r, "ltv"), fmt: fmtM },
  { key: "ltv_cac", label: "LTV / CAC", calc: true, getValue: r => calcVal(r, "ltv_cac"), fmt: fmtX },
  { key: "rule_of_40", label: "Rule of 40", calc: true, getValue: r => calcVal(r, "rule_of_40"), fmt: fmtPctRaw },
  { key: "growth_fcst", label: "Croissance pr\évue (%)", field: "growth_fcst", fmt: fmtPctRaw },
];

const BILAN_ROWS: RowDef[] = [
  { key: "_s_actif", label: "", section: "ACTIF", field: undefined, fmt: fmtM },
  { key: "intangible_assets", label: "Immobilisations incorporelles", field: "intangible_assets", fmt: fmtM },
  { key: "tangible_assets", label: "Immobilisations corporelles", field: "tangible_assets", fmt: fmtM },
  { key: "financial_assets", label: "Immobilisations financi\ères", field: "financial_assets", fmt: fmtM },
  { key: "total_fixed_assets", label: "Total actif immobilis\é", calc: true, getValue: r => calcVal(r, "total_fixed_assets"), fmt: fmtM },
  { key: "inventory", label: "Stocks", field: "inventory", fmt: fmtM },
  { key: "accounts_receivable", label: "Cr\éances clients", field: "accounts_receivable", fmt: fmtM },
  { key: "other_current_assets", label: "Autres actifs courants", field: "other_current_assets", fmt: fmtM },
  { key: "cash", label: "Tr\ésorerie", field: "cash", fmt: fmtM },
  { key: "total_current_assets", label: "Total actif circulant", calc: true, getValue: r => calcVal(r, "total_current_assets"), fmt: fmtM },
  { key: "total_assets", label: "TOTAL ACTIF", calc: true, getValue: r => calcVal(r, "total_assets"), fmt: fmtM },
  { key: "_s_passif", label: "", section: "PASSIF", field: undefined, fmt: fmtM },
  { key: "share_capital", label: "Capital social", field: "share_capital", fmt: fmtM },
  { key: "reserves", label: "R\éserves", field: "reserves", fmt: fmtM },
  { key: "net_income_bs", label: "R\ésultat de l'exercice", field: "net_income_bs", fmt: fmtM },
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
  { key: "cash_d", label: "Tr\ésorerie", field: "cash", fmt: fmtM },
  { key: "net_debt", label: "Dette nette", calc: true, getValue: r => calcVal(r, "net_debt"), fmt: fmtM, invertDelta: true },
  { key: "_s_bfr", label: "", section: "BESOIN EN FONDS DE ROULEMENT", field: undefined, fmt: fmtM },
  { key: "accounts_receivable_d", label: "Cr\éances clients", field: "accounts_receivable", fmt: fmtM },
  { key: "inventory_d", label: "Stocks", field: "inventory", fmt: fmtM },
  { key: "accounts_payable_d", label: "Dettes fournisseurs", field: "accounts_payable", fmt: fmtM },
  { key: "bfr", label: "BFR", calc: true, getValue: r => calcVal(r, "bfr"), fmt: fmtM },
  { key: "dso", label: "DSO (d\élai clients)", calc: true, getValue: r => calcVal(r, "dso"), fmt: fmtDays, invertDelta: true },
  { key: "dio", label: "DIO (d\élai stocks)", calc: true, getValue: r => calcVal(r, "dio"), fmt: fmtDays, invertDelta: true },
  { key: "dpo", label: "DPO (d\élai fournisseurs)", calc: true, getValue: r => calcVal(r, "dpo"), fmt: fmtDays },
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
];

export function FinancialTab({ dealId, organizationId, dealType = "", initialData }: Props) {
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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasRecurrent = rows.some(r => (r.revenue_recurring ?? 0) > 0 || (r.arr ?? 0) > 0);

  const refreshRows = useCallback(async () => {
    const refreshed = dealId
      ? await getFinancialDataByDeal(dealId)
      : await (await import("@/actions/financial-data")).getFinancialDataByOrganization(organizationId!);
    setRows([...(refreshed as FinancialRow[])].sort((a, b) => b.fiscal_year - a.fiscal_year));
  }, [dealId, organizationId]);

  // Get 3 years: selected, selected+1, selected+2
  const sel = rows[selectedYearIdx];
  const prev1 = rows[selectedYearIdx + 1];
  const prev2 = rows[selectedYearIdx + 2];

  // ── Auto-save with debounce ────────────────────────────────────────────────

  const autoSave = useCallback(
    (updatedRow: FinancialRow) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
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

  // ── Empty state ────────────────────────────────────────────────────────────

  if (rows.length === 0) {
    return (
      <div style={{ padding: "40px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>
          Aucune donn\ée financi\ère
        </div>
        <div style={{ fontSize: 13, color: "var(--text-5)", marginBottom: 16 }}>
          Ajoutez un exercice pour commencer la saisie
        </div>
        <button
          onClick={() => { setNewYear(CURRENT_YEAR); setModalOpen(true); }}
          style={{ padding: "8px 18px", borderRadius: 9, background: "#1a56db", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
        >
          + Ajouter un exercice
        </button>
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
              <th style={S.th}>{sel?.fiscal_year ?? "\—"} (N)</th>
              <th style={{ ...S.th, color: "var(--text-5)" }}>{prev1?.fiscal_year ?? "\—"} (N-1)</th>
              <th style={{ ...S.th, color: "var(--text-5)" }}>{prev2?.fiscal_year ?? "\—"} (N-2)</th>
              <th style={S.th}>\u0394 N/N-1</th>
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
                      <input
                        type="text"
                        style={S.input}
                        defaultValue={vN != null ? String(vN) : ""}
                        placeholder="\—"
                        onBlur={e => updateField(selectedYearIdx, def.field!, e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
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
                      <span style={{ fontSize: 11, color: "var(--text-5)" }}>\—</span>
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
                Ecart Actif / Passif : {fmtM(c.balance_check)} \— V\érifiez vos saisies
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
    const methods = [
      { label: "EV / EBITDA", fields: ["multiple_ev_ebitda_low", "multiple_ev_ebitda_mid", "multiple_ev_ebitda_high"] as const, valo: c.valo_ebitda },
      { label: "EV / EBIT", fields: ["multiple_ev_ebit_low", "multiple_ev_ebit_mid", "multiple_ev_ebit_high"] as const, valo: c.valo_ebit },
      { label: "EV / Revenue", fields: ["multiple_ev_revenue_low", "multiple_ev_revenue_mid", "multiple_ev_revenue_high"] as const, valo: c.valo_revenue },
      { label: "EV / ARR", fields: ["multiple_ev_arr_low", "multiple_ev_arr_mid", "multiple_ev_arr_high"] as const, valo: c.valo_arr },
    ];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Multiples table */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <table style={S.table}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th style={{ ...S.th, textAlign: "left", borderRight: "1px solid var(--border)" }}>M\éthode</th>
                <th style={S.th}>Multiple bas</th>
                <th style={S.th}>Multiple mid</th>
                <th style={S.th}>Multiple haut</th>
                <th style={S.th}>VE mid</th>
                <th style={S.th}>CP mid</th>
              </tr>
            </thead>
            <tbody>
              {methods.map(m => (
                <tr key={m.label}>
                  <td style={S.cellLabel}>{m.label}</td>
                  {m.fields.map((f, i) => (
                    <td key={f} style={S.cellVal(false)}>
                      <input
                        type="text"
                        style={{ ...S.input, width: 70 }}
                        defaultValue={sel[f] != null ? String(sel[f]) : ""}
                        placeholder="\—"
                        onBlur={e => updateField(selectedYearIdx, f, e.target.value)}
                      />
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
            Bridge VE \u2192 Capitaux propres
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
            {[
              { label: "Ajustements divers", field: "misc_adjustments" as keyof FinancialRow },
              { label: "Passifs contingents", field: "contingent_liabilities" as keyof FinancialRow },
              { label: "Tr\éso exc\édentaire", field: "excess_cash" as keyof FinancialRow },
            ].map(item => (
              <div key={item.field}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-4)", marginBottom: 4 }}>{item.label}</div>
                <input
                  type="text"
                  style={S.input}
                  defaultValue={sel[item.field] != null ? String(sel[item.field]) : ""}
                  placeholder="\—"
                  onBlur={e => updateField(selectedYearIdx, item.field, e.target.value)}
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
                  <input type="text" style={S.input} defaultValue={sel.wacc != null ? String(sel.wacc) : ""} placeholder="\—" onBlur={e => updateField(selectedYearIdx, "wacc", e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-4)", marginBottom: 4 }}>Taux de croissance terminal (%)</div>
                  <input type="text" style={S.input} defaultValue={sel.terminal_growth_rate != null ? String(sel.terminal_growth_rate) : ""} placeholder="\—" onBlur={e => updateField(selectedYearIdx, "terminal_growth_rate", e.target.value)} />
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-4)", marginBottom: 6 }}>FCF projet\és (N+1 \à N+5)</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 12 }}>
                {(["fcf_n1", "fcf_n2", "fcf_n3", "fcf_n4", "fcf_n5"] as const).map((f, i) => (
                  <div key={f}>
                    <div style={{ fontSize: 10, color: "var(--text-5)", marginBottom: 2 }}>N+{i + 1}</div>
                    <input type="text" style={S.input} defaultValue={sel[f] != null ? String(sel[f]) : ""} placeholder="\—" onBlur={e => updateField(selectedYearIdx, f, e.target.value)} />
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
      { label: "Marge brute", value: c.gross_margin != null ? c.gross_margin * 100 : null, fmt: v => v != null ? `${v.toFixed(1)}%` : "\—", benchLow: bench.gross_margin.low, benchHigh: bench.gross_margin.high },
      { label: "Marge EBITDA", value: c.ebitda_margin != null ? c.ebitda_margin * 100 : null, fmt: v => v != null ? `${v.toFixed(1)}%` : "\—", benchLow: bench.ebitda_margin.low, benchHigh: bench.ebitda_margin.high },
      { label: "Marge nette", value: c.net_margin != null ? c.net_margin * 100 : null, fmt: v => v != null ? `${v.toFixed(1)}%` : "\—", benchLow: 5, benchHigh: 15 },
      { label: "Leverage (DN/EBITDA)", value: c.leverage, fmt: fmtX, benchLow: bench.net_debt_ebitda.healthy, benchHigh: bench.net_debt_ebitda.lbo, lowerIsBetter: true },
      { label: "Gearing (DN/CP)", value: c.gearing, fmt: fmtX, benchLow: 0.5, benchHigh: 1.5, lowerIsBetter: true },
      { label: "Current ratio", value: c.current_ratio, fmt: fmtX, benchLow: 1, benchHigh: 2 },
      { label: "ROCE", value: c.roce != null ? c.roce * 100 : null, fmt: v => v != null ? `${v.toFixed(1)}%` : "\—", benchLow: 8, benchHigh: 15 },
      { label: "Conversion FCF", value: c.fcf_conversion != null ? c.fcf_conversion * 100 : null, fmt: v => v != null ? `${v.toFixed(1)}%` : "\—", benchLow: 50, benchHigh: 80 },
    ];

    if (hasRecurrent) {
      cards.push(
        { label: "LTV / CAC", value: c.ltv_cac, fmt: fmtX, benchLow: 3, benchHigh: 5 },
        { label: "Rule of 40", value: c.rule_of_40, fmt: v => v != null ? `${v.toFixed(0)}` : "\—", benchLow: 30, benchHigh: 40 },
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
                  Bench: {card.benchLow}\u2013{card.benchHigh}
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
      {/* Header + saving indicator */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Donn\ées financi\ères</span>
          {saving && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--text-4)" }}>
              <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Enregistrement...
            </span>
          )}
        </div>
      </div>

      {/* Year pills */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {rows.map((r, i) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button onClick={() => setSelectedYearIdx(i)} style={S.yearPill(i === selectedYearIdx)}>
              {r.fiscal_year}
              <span style={{
                fontSize: 9.5, padding: "1px 5px", borderRadius: 8, fontWeight: 600,
                background: r.is_forecast ? "#EDE9FE" : (i === selectedYearIdx ? "rgba(255,255,255,.2)" : "var(--surface-3)"),
                color: r.is_forecast ? "#6D28D9" : (i === selectedYearIdx ? "#fff" : "var(--text-5)"),
              }}>
                {r.is_forecast ? "Pr\évision" : "R\éel"}
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
        ))}
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
      </div>

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
            Ann\ée
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
          Exercice pr\évisionnel
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
            {saving ? "Cr\éation..." : "Cr\éer"}
          </button>
        </div>
      </div>
    </div>
  );
}
