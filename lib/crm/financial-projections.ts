// Helper de projection financière : à partir d'une année réelle (N) et d'un
// jeu d'hypothèses macro, produit l'année suivante (N+1). Chainable pour
// produire N+1 → N+2 → N+3, etc.
//
// Champs projetés : P&L complet (revenue, cogs, opex, da, fin, taxes, capex)
// + récurrence (arr, recurring split) + maintien des métriques opérationnelles
// (nrr, churn, cac, growth_fcst, headcount). Pas de projection du bilan, des
// multiples ou du DCF (besoin d'hypothèses dédiées non couvertes en V60).
//
// La fonction est pure : pas d'I/O, idéale pour test et chainage côté server
// ou client.

import type { FinancialInputs } from "@/lib/crm/financial-calcs";

export interface FinancialAssumptions {
  revenue_growth_pct: number | null;          // croissance CA annuelle (%)
  gross_margin_evolution_pp: number | null;   // évolution marge brute (pp/an, positif = amélioration)
  opex_growth_pct: number | null;             // croissance opex (%)
  capex_pct_revenue: number | null;           // capex en % du CA projeté
  da_pct_revenue: number | null;              // D&A en % du CA projeté
  tax_rate_pct: number | null;                // taux IS (%)
  arr_growth_pct: number | null;              // croissance ARR (%) — fallback sur revenue_growth si null
}

type N = number | null | undefined;
const n = (v: N): number | null => (v == null ? null : v);
const sumNN = (...vals: N[]): number | null => {
  const xs = vals.map(n).filter((v): v is number => v !== null);
  return xs.length > 0 ? xs.reduce((a, b) => a + b, 0) : null;
};

/**
 * Projette une année à partir d'une année de référence et d'un jeu
 * d'hypothèses. Retourne un Partial<FinancialInputs> contenant uniquement
 * les champs projetés. L'appelant fusionne avec les overrides utilisateur.
 *
 * Le `is_forecast=true` est de la responsabilité de l'appelant (server action).
 */
export function projectYear(
  base: FinancialInputs,
  a: FinancialAssumptions,
): Partial<FinancialInputs> {
  const growth = (a.revenue_growth_pct ?? 0) / 100;
  const opexGrowth = (a.opex_growth_pct ?? a.revenue_growth_pct ?? 0) / 100;
  const arrGrowth = a.arr_growth_pct != null
    ? a.arr_growth_pct / 100
    : growth;

  const newRevenue = n(base.revenue) != null ? n(base.revenue)! * (1 + growth) : null;

  // Marge brute cible = marge actuelle + évolution pp (en ratio)
  const baseGm = (n(base.revenue) != null && n(base.cogs) != null && n(base.revenue) !== 0)
    ? (n(base.revenue)! - n(base.cogs)!) / n(base.revenue)!
    : null;
  const evolutionRatio = (a.gross_margin_evolution_pp ?? 0) / 100;
  const newGm = baseGm != null ? baseGm + evolutionRatio : null;
  const newCogs = (newRevenue != null && newGm != null)
    ? newRevenue * (1 - newGm)
    : null;

  // Opex : croissance proportionnelle sur chaque poste
  const scale = (v: N): number | null => (n(v) != null ? n(v)! * (1 + opexGrowth) : null);
  const newPayroll = scale(base.payroll);
  const newPayrollRd = scale(base.payroll_rd);
  const newPayrollSales = scale(base.payroll_sales);
  const newPayrollGa = scale(base.payroll_ga);
  const newMarketing = scale(base.marketing);
  const newRent = scale(base.rent);
  const newOtherOpex = scale(base.other_opex);

  // D&A : soit % CA si hypothèse, soit scale opex
  const newDa = (a.da_pct_revenue != null && newRevenue != null)
    ? newRevenue * (a.da_pct_revenue / 100)
    : scale(base.da);

  // Charges financières : maintien à la valeur de base (peu sensible aux hyp.)
  const newFinancialCharges = n(base.financial_charges);

  // Capex : % CA si hypothèse, sinon scale opex
  const newCapex = (a.capex_pct_revenue != null && newRevenue != null)
    ? newRevenue * (a.capex_pct_revenue / 100)
    : scale(base.capex);

  // Récurrence : maintien du ratio actuel
  const baseRecRatio = (n(base.revenue) != null && n(base.revenue_recurring) != null && n(base.revenue) !== 0)
    ? n(base.revenue_recurring)! / n(base.revenue)!
    : null;
  const newRevenueRecurring = (newRevenue != null && baseRecRatio != null)
    ? newRevenue * baseRecRatio
    : null;
  const newRevenueNonRecurring = (newRevenue != null && newRevenueRecurring != null)
    ? newRevenue - newRevenueRecurring
    : null;

  // ARR : croissance dédiée
  const newArr = n(base.arr) != null ? n(base.arr)! * (1 + arrGrowth) : null;

  // EBT projeté (en cascade) pour calcul de l'IS
  const newGrossProfit = (newRevenue != null && newCogs != null) ? newRevenue - newCogs : null;
  const newTotalOpex = sumNN(newPayroll, newMarketing, newRent, newOtherOpex);
  const newEbitda = (newGrossProfit != null && newTotalOpex != null)
    ? newGrossProfit - newTotalOpex
    : null;
  const newEbit = newEbitda != null ? newEbitda - (newDa ?? 0) : null;
  const newEbt = newEbit != null ? newEbit - (newFinancialCharges ?? 0) : null;
  const newTaxes = (newEbt != null && newEbt > 0 && a.tax_rate_pct != null)
    ? newEbt * (a.tax_rate_pct / 100)
    : (newEbt != null && newEbt > 0 ? 0 : null);

  return {
    revenue: newRevenue,
    revenue_recurring: newRevenueRecurring,
    revenue_non_recurring: newRevenueNonRecurring,
    cogs: newCogs,
    payroll: newPayroll,
    payroll_rd: newPayrollRd,
    payroll_sales: newPayrollSales,
    payroll_ga: newPayrollGa,
    marketing: newMarketing,
    rent: newRent,
    other_opex: newOtherOpex,
    da: newDa,
    financial_charges: newFinancialCharges,
    taxes: newTaxes,
    capex: newCapex,
    arr: newArr,
    // Maintien : métriques opérationnelles peu sensibles aux hypothèses macro
    nrr: n(base.nrr),
    churn_rate: n(base.churn_rate),
    cac: n(base.cac),
    growth_fcst: n(base.growth_fcst),
  };
}

/**
 * Projette `count` années consécutives à partir de `base`. Chaîne projectYear
 * sur lui-même : N → N+1 → N+2 → N+3. Retourne un tableau ordonné de
 * Partial<FinancialInputs>.
 */
export function projectMultipleYears(
  base: FinancialInputs,
  assumptions: FinancialAssumptions,
  count: number,
): Partial<FinancialInputs>[] {
  const result: Partial<FinancialInputs>[] = [];
  let current: FinancialInputs = base;
  for (let i = 0; i < count; i++) {
    const projected = projectYear(current, assumptions);
    result.push(projected);
    current = { ...current, ...projected };
  }
  return result;
}
