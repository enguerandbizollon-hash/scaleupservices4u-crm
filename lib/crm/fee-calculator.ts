// lib/crm/fee-calculator.ts — Calcul honoraires par deal_type
// Règles : fundraising | ma_sell | ma_buy | recruitment | cfo_advisor

export interface DealData {
  id: string;
  name: string;
  deal_type: string;
  amount?: number; // raise_amount | acquisition_price | salary
  valuation?: number; // enterprise value M&A
  status?: string;
  created_at?: string;
}

export interface MandateData {
  id: string;
  type: string;
  success_fee_percent?: number;
  success_fee_base?: string; // ev|revenue|raise_amount|salary
  retainer_monthly?: number;
  currency: string;
}

/**
 * calculateSuccessFee — Calcula success fee selon deal_type
 * 
 * FUNDRAISING :
 *   success_fee = raise_amount × success_fee_percent (base = raise_amount)
 *   Ex: levée 3M CHF × 3% = 90K CHF
 * 
 * M&A SELL-SIDE :
 *   success_fee = ev_deal × success_fee_percent (base = ev)
 *   + min_fee possible
 * 
 * M&A BUY-SIDE :
 *   success_fee = acquisition_price × success_fee_percent (base = ev ou revenue)
 *   OU forfait si défini
 * 
 * RECRUITMENT :
 *   success_fee = annual_salary × success_fee_percent
 *   Standard : 15-25% du salaire annuel brut
 * 
 * CFO ADVISORY :
 *   retainer_monthly × duration + forfaits livrables
 */

export function calculateSuccessFee(
  dealType: string,
  deal: DealData,
  mandate: MandateData
): number | null {
  if (!mandate.success_fee_percent) return null;

  const percent = mandate.success_fee_percent / 100;

  switch (dealType.toLowerCase()) {
    case 'fundraising':
      // Base : raise_amount du deal
      if (!deal.amount) return null;
      return Math.round(deal.amount * percent * 100) / 100;

    case 'ma_sell':
    case 'ma_sell_side':
      // Base : EV deal
      if (!deal.valuation) return null;
      return Math.round(deal.valuation * percent * 100) / 100;

    case 'ma_buy':
    case 'ma_buy_side':
      // Base : acquisition_price ou EV
      if (!deal.amount && !deal.valuation) return null;
      const base = deal.amount || deal.valuation;
      return Math.round((base || 0) * percent * 100) / 100;

    case 'recruitment':
      // Base : annual_salary (amount = salary annuel)
      if (!deal.amount) return null;
      return Math.round(deal.amount * percent * 100) / 100;

    case 'cfo_advisor':
      // Les CFO Advisory sont souvent retainer ou forfait
      // Retourner null pour success fee (géré en manuel)
      return null;

    default:
      return null;
  }
}

/**
 * calculateRetainerAmount — Calcule montant retainer mensuel × durée
 * Utile pour CFO Advisory ou contrats long terme
 */
export function calculateRetainerAmount(
  monthlyRetainer: number,
  durationMonths: number
): number {
  return Math.round(monthlyRetainer * durationMonths * 100) / 100;
}

/**
 * estimateMancreateFeeTotal — Estime le montant total honoraires d'un mandat
 * Combines : retainer + success fees estimés
 */
export function estimateMancreateFeeTotal(
  retainerMonthly: number | null,
  durationMonths: number | null,
  successFeeDeal: number | null
): number {
  let total = 0;

  if (retainerMonthly && durationMonths) {
    total += calculateRetainerAmount(retainerMonthly, durationMonths);
  }

  if (successFeeDeal) {
    total += successFeeDeal;
  }

  return total;
}

/**
 * getFeeMilestoneSchedule — Suggestion de jalons calendaires
 * Basé sur deal_type et timing
 */
export interface FeeSchedule {
  name: string;
  offset_days: number;
  amount_percent: number; // % du total
  type: string; // retainer|success_fee|fixed
}

export function getFeeMilestoneSchedule(
  dealType: string,
  totalFee: number
): FeeSchedule[] {
  const schedule: FeeSchedule[] = [];

  switch (dealType.toLowerCase()) {
    case 'fundraising':
      // Signature mandat (20%) + Closing (80%)
      schedule.push(
        { name: 'Signing mandate', offset_days: 0, amount_percent: 20, type: 'fixed' },
        { name: 'Closing deal', offset_days: 90, amount_percent: 80, type: 'success_fee' }
      );
      break;

    case 'ma_sell':
    case 'ma_sell_side':
      // Signature (25%) + Signing (50%) + Closing (25%)
      schedule.push(
        { name: 'Signing mandat', offset_days: 0, amount_percent: 25, type: 'fixed' },
        { name: 'Signing LOI', offset_days: 60, amount_percent: 50, type: 'fixed' },
        { name: 'Closing', offset_days: 150, amount_percent: 25, type: 'success_fee' }
      );
      break;

    case 'ma_buy':
    case 'ma_buy_side':
      // Signature (30%) + Closing (70%)
      schedule.push(
        { name: 'Signing mandat', offset_days: 0, amount_percent: 30, type: 'fixed' },
        { name: 'Closing acquisition', offset_days: 120, amount_percent: 70, type: 'success_fee' }
      );
      break;

    case 'recruitment':
      // À la signature (50%) + à l'embauche (50%)
      schedule.push(
        { name: 'Signature candidat', offset_days: 0, amount_percent: 50, type: 'fixed' },
        { name: 'Embauche confirmée', offset_days: 30, amount_percent: 50, type: 'success_fee' }
      );
      break;

    case 'cfo_advisor':
      // Retainer mensuel
      schedule.push(
        { name: 'Monthly retainer', offset_days: 0, amount_percent: 100, type: 'retainer' }
      );
      break;

    default:
      break;
  }

  return schedule;
}

/**
 * convertFeeAmountByCurrency — Convertit montant entre devises
 * Utilise taux depuis exchange_rates (implanté dans actions)
 */
export function convertFeeAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number
): number {
  if (fromCurrency === toCurrency) return amount;
  return Math.round(amount * rate * 100) / 100;
}
