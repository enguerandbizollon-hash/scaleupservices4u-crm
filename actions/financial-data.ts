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
  
  // P&L
  revenue?: number;
  gross_profit?: number;
  gross_margin?: number;
  ebitda?: number;
  ebitda_margin?: number;
  ebit?: number;
  net_income?: number;
  
  // Bilan
  total_assets?: number;
  net_debt?: number;
  equity?: number;
  cash?: number;
  capex?: number;
  working_capital?: number;
  
  // Opérationnel
  headcount?: number;
  revenue_per_employee?: number;
  
  // SaaS
  arr?: number;
  mrr?: number;
  nrr?: number;
  grr?: number;
  churn_rate?: number;
  cagr?: number;
  ltv?: number;
  cac?: number;
  ltv_cac_ratio?: number;
  payback_months?: number;
  
  // Valorisation
  ev_estimate?: number;
  ev_revenue_multiple?: number;
  ev_ebitda_multiple?: number;
  ev_arr_multiple?: number;
  equity_value?: number;
  
  // Source
  source: string; // manual|csv|excel|gdrive|harmonic|crunchbase|pitchbook|client_upload|api|portal
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

  if (data.deal_id) {
    const { data: found } = await supabase
      .from('financial_data')
      .select('id')
      .eq('deal_id', data.deal_id)
      .eq('fiscal_year', data.fiscal_year)
      .eq('user_id', user.id)
      .maybeSingle();
    existingId = found?.id ?? null;
  } else if (data.organization_id) {
    const { data: found } = await supabase
      .from('financial_data')
      .select('id')
      .eq('organization_id', data.organization_id)
      .eq('fiscal_year', data.fiscal_year)
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
