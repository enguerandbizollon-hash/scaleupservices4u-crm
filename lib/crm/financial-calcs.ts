// Calculs financiers automatiques — rien stocké en base, tout calculé à la volée
// Retourne null pour tout calcul impossible (division par zéro, données manquantes)

type N = number | null | undefined;
function n(v: N): number | null { return v == null ? null : v; }
function div(a: N, b: N): number | null {
  const na = n(a), nb = n(b);
  if (na == null || nb == null || nb === 0) return null;
  return na / nb;
}
function sum(...vals: N[]): number | null {
  const nums = vals.map(n).filter((v): v is number => v !== null);
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) : null;
}
function sub(a: N, b: N): number | null {
  const na = n(a), nb = n(b);
  if (na == null || nb == null) return null;
  return na - nb;
}
function mul(a: N, b: N): number | null {
  const na = n(a), nb = n(b);
  if (na == null || nb == null) return null;
  return na * nb;
}

export interface FinancialInputs {
  revenue?: N; revenue_recurring?: N; revenue_non_recurring?: N;
  cogs?: N; payroll?: N; payroll_rd?: N; payroll_sales?: N; payroll_ga?: N;
  marketing?: N; rent?: N; other_opex?: N; da?: N;
  financial_charges?: N; taxes?: N; capex?: N;
  arr?: N; churn_rate?: N; nrr?: N; cac?: N; growth_fcst?: N;
  intangible_assets?: N; tangible_assets?: N; financial_assets?: N;
  inventory?: N; accounts_receivable?: N; other_current_assets?: N; cash?: N;
  share_capital?: N; reserves?: N; net_income_bs?: N;
  debt_lt?: N; debt_st?: N; accounts_payable?: N; other_current_liabilities?: N;
  multiple_ev_ebitda_low?: N; multiple_ev_ebitda_mid?: N; multiple_ev_ebitda_high?: N;
  multiple_ev_ebit_low?: N; multiple_ev_ebit_mid?: N; multiple_ev_ebit_high?: N;
  multiple_ev_revenue_low?: N; multiple_ev_revenue_mid?: N; multiple_ev_revenue_high?: N;
  multiple_ev_arr_low?: N; multiple_ev_arr_mid?: N; multiple_ev_arr_high?: N;
  wacc?: N; terminal_growth_rate?: N;
  fcf_n1?: N; fcf_n2?: N; fcf_n3?: N; fcf_n4?: N; fcf_n5?: N;
  misc_adjustments?: N; contingent_liabilities?: N; excess_cash?: N;
}

export function computeFinancials(d: FinancialInputs) {
  // P&L
  const gross_profit = sub(d.revenue, d.cogs);
  const gross_margin = div(gross_profit, d.revenue);
  const total_payroll_detail = sum(d.payroll_rd, d.payroll_sales, d.payroll_ga);
  const payroll_effective = n(total_payroll_detail) !== null ? total_payroll_detail : n(d.payroll);
  const total_opex = sum(payroll_effective, d.marketing, d.rent, d.other_opex);
  const ebitda = sub(gross_profit, total_opex);
  const ebitda_margin = div(ebitda, d.revenue);
  const ebit = sub(ebitda, d.da);
  const ebit_margin = div(ebit, d.revenue);
  const ebt = sub(ebit, d.financial_charges);
  const net_income = sub(ebt, d.taxes);
  const net_margin = div(net_income, d.revenue);
  const cash_ebitda = sub(ebitda, d.capex);
  const recurring_rate = div(d.revenue_recurring, d.revenue);

  // Récurrent
  const mrr = div(d.arr, 12);
  const ltv = (n(d.arr) && n(d.churn_rate) && n(d.churn_rate)! > 0 && gross_margin !== null)
    ? (n(d.arr)! / n(d.churn_rate)! * 100) * gross_margin : null;
  const ltv_cac = div(ltv, d.cac);
  const rule_of_40 = (n(d.growth_fcst) !== null && ebitda_margin !== null)
    ? n(d.growth_fcst)! + ebitda_margin * 100 : null;

  // Bilan
  const total_fixed_assets = sum(d.intangible_assets, d.tangible_assets, d.financial_assets);
  const total_current_assets = sum(d.inventory, d.accounts_receivable, d.other_current_assets, d.cash);
  const total_assets = sum(total_fixed_assets, total_current_assets);
  const equity = sum(d.share_capital, d.reserves, d.net_income_bs);
  const total_liabilities = sum(equity, d.debt_lt, d.debt_st, d.accounts_payable, d.other_current_liabilities);
  const balance_check = sub(total_assets, total_liabilities);

  // Dette nette & BFR
  const net_debt = sub(sum(d.debt_lt, d.debt_st), d.cash);
  const bfr = sub(sum(d.accounts_receivable, d.inventory), d.accounts_payable);
  const dso = mul(div(d.accounts_receivable, d.revenue), 365);
  const dio = mul(div(d.inventory, d.cogs), 365);
  const dpo = mul(div(d.accounts_payable, d.cogs), 365);
  const ccc = (dso !== null && dio !== null && dpo !== null) ? dso + dio - dpo : null;
  const fcf = sub(ebitda, d.capex);
  const fcf_conversion = div(fcf, ebitda);

  // Valorisation multiples
  function evMethod(baseMetric: number | null, low: N, mid: N, high: N) {
    return {
      ev_low:  mul(baseMetric, low),
      ev_mid:  mul(baseMetric, mid),
      ev_high: mul(baseMetric, high),
      eq_low:  equityFromEv(mul(baseMetric, low)),
      eq_mid:  equityFromEv(mul(baseMetric, mid)),
      eq_high: equityFromEv(mul(baseMetric, high)),
    };
  }
  function equityFromEv(ev: number | null): number | null {
    if (ev == null) return null;
    return ev - (n(net_debt) ?? 0) - (n(d.contingent_liabilities) ?? 0) + (n(d.excess_cash) ?? 0) + (n(d.misc_adjustments) ?? 0);
  }

  const valo_ebitda  = evMethod(ebitda, d.multiple_ev_ebitda_low, d.multiple_ev_ebitda_mid, d.multiple_ev_ebitda_high);
  const valo_ebit    = evMethod(ebit, d.multiple_ev_ebit_low, d.multiple_ev_ebit_mid, d.multiple_ev_ebit_high);
  const valo_revenue = evMethod(n(d.revenue), d.multiple_ev_revenue_low, d.multiple_ev_revenue_mid, d.multiple_ev_revenue_high);
  const valo_arr     = evMethod(n(d.arr), d.multiple_ev_arr_low, d.multiple_ev_arr_mid, d.multiple_ev_arr_high);

  // DCF
  let ev_dcf: number | null = null;
  let equity_dcf: number | null = null;
  const w = n(d.wacc);
  const tg = n(d.terminal_growth_rate);
  const fcfs = [d.fcf_n1, d.fcf_n2, d.fcf_n3, d.fcf_n4, d.fcf_n5].map(n);
  if (w && w > 0 && tg !== null && w > tg && fcfs.every(f => f !== null)) {
    const pvs = fcfs.map((f, i) => f! / Math.pow(1 + w / 100, i + 1));
    const tv = (fcfs[4]! * (1 + tg / 100)) / ((w - tg) / 100);
    const pvTv = tv / Math.pow(1 + w / 100, 5);
    ev_dcf = pvs.reduce((a, b) => a + b, 0) + pvTv;
    equity_dcf = equityFromEv(ev_dcf);
  }

  // Ratios
  const leverage = div(net_debt, ebitda);
  const gearing = div(net_debt, equity);
  const current_ratio = div(total_current_assets, sum(d.debt_st, d.accounts_payable));
  const roce = div(ebit, sum(equity, d.debt_lt));

  return {
    // P&L
    gross_profit, gross_margin, total_payroll: payroll_effective, total_opex,
    ebitda, ebitda_margin, ebit, ebit_margin, ebt, net_income, net_margin,
    cash_ebitda, recurring_rate,
    // Récurrent
    mrr, ltv, ltv_cac, rule_of_40,
    // Bilan
    total_fixed_assets, total_current_assets, total_assets,
    equity, total_liabilities, balance_check,
    // Dette & BFR
    net_debt, bfr, dso, dio, dpo, ccc, fcf, fcf_conversion,
    // Valorisation
    valo_ebitda, valo_ebit, valo_revenue, valo_arr,
    ev_dcf, equity_dcf,
    // Ratios
    leverage, gearing, current_ratio, roce,
  };
}
