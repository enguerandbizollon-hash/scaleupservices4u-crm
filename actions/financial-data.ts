// actions/financial-data.ts — CRUD données financières (multi-canal)
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface FinancialDataInput {
  deal_id?: string;
  organization_id?: string;
  fiscal_year: number;
  period_type?: string;
  period_label?: string;
  currency: string;
  is_forecast?: boolean;

  // P&L détaillé
  revenue?: number;
  revenue_recurring?: number;
  revenue_non_recurring?: number;
  cogs?: number;
  gross_profit?: number;
  gross_margin?: number;
  payroll?: number;
  payroll_rd?: number;
  payroll_sales?: number;
  payroll_ga?: number;
  marketing?: number;
  rent?: number;
  other_opex?: number;
  ebitda?: number;
  ebitda_margin?: number;
  da?: number;
  ebit?: number;
  financial_charges?: number;
  taxes?: number;
  net_income?: number;
  capex?: number;

  // Bilan détaillé
  intangible_assets?: number;
  tangible_assets?: number;
  financial_assets?: number;
  inventory?: number;
  accounts_receivable?: number;
  other_current_assets?: number;
  cash?: number;
  share_capital?: number;
  reserves?: number;
  net_income_bs?: number;
  debt_lt?: number;
  debt_st?: number;
  accounts_payable?: number;
  other_current_liabilities?: number;
  total_assets?: number;
  net_debt?: number;
  equity?: number;
  working_capital?: number;

  // Opérationnel
  headcount?: number;
  revenue_per_employee?: number;

  // Récurrent
  arr?: number;
  mrr?: number;
  nrr?: number;
  grr?: number;
  churn_rate?: number;
  cagr?: number;
  cac?: number;
  ltv?: number;
  ltv_cac_ratio?: number;
  payback_months?: number;
  growth_fcst?: number;

  // Valorisation multiples
  ev_estimate?: number;
  ev_revenue_multiple?: number;
  ev_ebitda_multiple?: number;
  ev_arr_multiple?: number;
  equity_value?: number;
  multiple_ev_ebitda_low?: number;
  multiple_ev_ebitda_mid?: number;
  multiple_ev_ebitda_high?: number;
  multiple_ev_ebit_low?: number;
  multiple_ev_ebit_mid?: number;
  multiple_ev_ebit_high?: number;
  multiple_ev_revenue_low?: number;
  multiple_ev_revenue_mid?: number;
  multiple_ev_revenue_high?: number;
  multiple_ev_arr_low?: number;
  multiple_ev_arr_mid?: number;
  multiple_ev_arr_high?: number;

  // DCF
  wacc?: number;
  terminal_growth_rate?: number;
  fcf_n1?: number;
  fcf_n2?: number;
  fcf_n3?: number;
  fcf_n4?: number;
  fcf_n5?: number;

  // Ajustements
  misc_adjustments?: number;
  contingent_liabilities?: number;
  excess_cash?: number;

  // Métadonnées
  sector?: string;
  source: string;
  external_id?: string;
  raw_data?: Record<string, unknown>;
  ai_extracted?: boolean;
  ai_confidence_score?: number;
  ai_extraction_notes?: string;
}

export async function createFinancialData(data: FinancialDataInput) {
  const supabase = await createClient();
  
  // Vérifier que l'utilisateur est authentifié
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Unauthorized');
  
  // Au moins deal_id ou organization_id requis
  if (!data.deal_id && !data.organization_id) {
    throw new Error('deal_id or organization_id required');
  }

  const { data: result, error } = await supabase
    .from('financial_data')
    .insert({
      user_id: user.id,
      ...data,
      ai_analyzed_at: data.ai_extracted ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) throw error;
  
  revalidatePath('/protected/dossiers');
  revalidatePath('/protected/organisations');
  return result;
}

export async function updateFinancialData(
  id: string,
  data: Partial<FinancialDataInput>
) {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Unauthorized');

  const { data: result, error } = await supabase
    .from('financial_data')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
      ai_analyzed_at: data.ai_extracted ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  
  revalidatePath('/protected/dossiers');
  revalidatePath('/protected/organisations');
  return result;
}

export async function getFinancialDataByDeal(dealId: string) {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('financial_data')
    .select('*')
    .eq('deal_id', dealId)
    .eq('user_id', user.id)
    .order('fiscal_year', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getFinancialDataByOrganization(organizationId: string) {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('financial_data')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .order('fiscal_year', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Upsert : crée ou met à jour selon deal_id + fiscal_year.
 * Évite les doublons par exercice.
 */
export async function upsertFinancialData(data: FinancialDataInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  if (!data.deal_id && !data.organization_id) throw new Error('deal_id or organization_id required');

  let existingId: string | null = null;

  const isForecast = data.is_forecast ?? false;
  if (data.deal_id) {
    const { data: found } = await supabase
      .from('financial_data')
      .select('id')
      .eq('deal_id', data.deal_id)
      .eq('fiscal_year', data.fiscal_year)
      .eq('is_forecast', isForecast)
      .eq('user_id', user.id)
      .maybeSingle();
    existingId = found?.id ?? null;
  } else if (data.organization_id) {
    const { data: found } = await supabase
      .from('financial_data')
      .select('id')
      .eq('organization_id', data.organization_id)
      .eq('fiscal_year', data.fiscal_year)
      .eq('is_forecast', isForecast)
      .eq('user_id', user.id)
      .maybeSingle();
    existingId = found?.id ?? null;
  }

  if (existingId) {
    return updateFinancialData(existingId, data);
  }
  return createFinancialData(data);
}

export async function deleteFinancialData(id: string) {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('financial_data')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  
  revalidatePath('/protected/dossiers');
  revalidatePath('/protected/organisations');
}
