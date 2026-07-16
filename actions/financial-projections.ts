// actions/financial-projections.ts — Hypothèses + génération projections
//
// CRUD pour financial_assumptions (1 row par dossier) + génération en cascade
// d'exercices prévisionnels (is_forecast = true) dans financial_data.
//
// La génération chaîne projectYear depuis l'année de base spécifiée :
// année réelle la plus récente disponible si non précisée.

'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  projectMultipleYears,
  type FinancialAssumptions,
} from '@/lib/crm/financial-projections';
import type { FinancialInputs } from '@/lib/crm/financial-calcs';
import { upsertFinancialData } from '@/actions/financial-data';

export interface AssumptionsRow extends FinancialAssumptions {
  id: string;
  deal_id: string;
  base_fiscal_year: number | null;
  projection_years: number;
  notes: string | null;
}

export async function getAssumptions(dealId: string): Promise<AssumptionsRow | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('financial_assumptions')
    .select('*')
    .eq('deal_id', dealId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data as AssumptionsRow;
}

export interface UpsertAssumptionsInput {
  deal_id: string;
  base_fiscal_year?: number | null;
  projection_years?: number;
  revenue_growth_pct?: number | null;
  gross_margin_evolution_pp?: number | null;
  opex_growth_pct?: number | null;
  capex_pct_revenue?: number | null;
  da_pct_revenue?: number | null;
  tax_rate_pct?: number | null;
  arr_growth_pct?: number | null;
  notes?: string | null;
}

export async function upsertAssumptions(
  input: UpsertAssumptionsInput,
): Promise<{ success: true; data: AssumptionsRow } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Non autorisé' };

  const payload = {
    user_id: user.id,
    deal_id: input.deal_id,
    base_fiscal_year: input.base_fiscal_year ?? null,
    projection_years: input.projection_years ?? 3,
    revenue_growth_pct: input.revenue_growth_pct ?? null,
    gross_margin_evolution_pp: input.gross_margin_evolution_pp ?? null,
    opex_growth_pct: input.opex_growth_pct ?? null,
    capex_pct_revenue: input.capex_pct_revenue ?? null,
    da_pct_revenue: input.da_pct_revenue ?? null,
    tax_rate_pct: input.tax_rate_pct ?? 25,
    arr_growth_pct: input.arr_growth_pct ?? null,
    notes: input.notes ?? null,
  };

  const { data, error } = await supabase
    .from('financial_assumptions')
    .upsert(payload, { onConflict: 'deal_id' })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath(`/protected/dossiers/${input.deal_id}`);
  return { success: true, data: data as AssumptionsRow };
}

/**
 * Génère N exercices prévisionnels en chaînage depuis l'année de base.
 * Si une row forecast existe déjà sur une année cible, ses valeurs déjà
 * saisies (non-null) sont préservées. Les valeurs calculées remplissent
 * uniquement les champs vides.
 */
export async function generateProjections(
  dealId: string,
): Promise<{ success: true; count: number } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Non autorisé' };

  const assumptions = await getAssumptions(dealId);
  if (!assumptions) return { success: false, error: 'Aucune hypothèse saisie. Renseigne au moins la croissance CA avant de générer.' };

  // Charger l'année de base : soit la base_fiscal_year saisie, soit l'année
  // réelle la plus récente.
  const { data: rows } = await supabase
    .from('financial_data')
    .select('*')
    .eq('deal_id', dealId)
    .eq('user_id', user.id)
    .eq('is_forecast', false)
    .order('fiscal_year', { ascending: false });

  if (!rows || rows.length === 0) {
    return { success: false, error: "Aucun exercice réel disponible. Saisis au moins l'année N avant de projeter." };
  }

  const baseYear = assumptions.base_fiscal_year ?? rows[0].fiscal_year;
  const baseRow = rows.find(r => r.fiscal_year === baseYear) ?? rows[0];
  const count = assumptions.projection_years ?? 3;

  const projections = projectMultipleYears(baseRow as FinancialInputs, assumptions, count);

  // Charger les rows forecast existantes pour préserver les overrides
  const projectionYears = projections.map((_, i) => baseRow.fiscal_year + i + 1);
  const { data: existingForecasts } = await supabase
    .from('financial_data')
    .select('*')
    .eq('deal_id', dealId)
    .eq('user_id', user.id)
    .eq('is_forecast', true)
    .in('fiscal_year', projectionYears);

  const existingByYear = new Map<number, Record<string, unknown>>();
  for (const r of (existingForecasts ?? [])) {
    existingByYear.set(r.fiscal_year, r as Record<string, unknown>);
  }

  let upserted = 0;
  for (let i = 0; i < projections.length; i++) {
    const targetYear = baseRow.fiscal_year + i + 1;
    const projected = projections[i] as Record<string, unknown>;
    const existing = existingByYear.get(targetYear);

    // Préserver les valeurs déjà saisies (non-null en base) — l'override
    // utilisateur gagne sur le calcul.
    const merged: Record<string, unknown> = {
      deal_id: dealId,
      fiscal_year: targetYear,
      period_type: 'annual',
      currency: baseRow.currency ?? 'EUR',
      is_forecast: true,
      source: 'manual',
    };

    for (const [key, value] of Object.entries(projected)) {
      if (value == null) continue;
      const existingVal = existing?.[key];
      // Si l'utilisateur a déjà saisi cette colonne, on respecte
      if (existingVal != null) continue;
      merged[key] = value;
    }

    // Conserver les overrides déjà saisis sur d'autres champs (bilan, multiples)
    if (existing) {
      for (const [key, value] of Object.entries(existing)) {
        if (key === 'id' || key === 'created_at' || key === 'updated_at' || key === 'user_id') continue;
        if (value == null) continue;
        if (merged[key] == null) merged[key] = value;
      }
    }

    try {
      await upsertFinancialData(merged as unknown as Parameters<typeof upsertFinancialData>[0]);
      upserted++;
    } catch {
      // continue, on n'interrompt pas la cascade
    }
  }

  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true, count: upserted };
}

/**
 * Supprime toutes les rows forecast d'un dossier. À utiliser avant de
 * regénérer avec des hypothèses différentes si l'utilisateur veut repartir
 * de zéro.
 */
export async function clearProjections(
  dealId: string,
): Promise<{ success: true; count: number } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Non autorisé' };

  const { data, error } = await supabase
    .from('financial_data')
    .delete()
    .eq('deal_id', dealId)
    .eq('user_id', user.id)
    .eq('is_forecast', true)
    .select('id');

  if (error) return { success: false, error: error.message };
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true, count: data?.length ?? 0 };
}
