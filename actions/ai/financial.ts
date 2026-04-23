"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  analyzeDealFinancials,
  type FinancialYear,
  type FinancialScoringResult,
} from "@/lib/ai/financial-scoring";

export type AnalyzeFinancialResult =
  | { success: true; result: FinancialScoringResult & { analyzed_at: string } }
  | { success: false; error: string };

/**
 * Analyse IA de la performance financière d'un dossier.
 * Lit le deal + ses 3 derniers exercices financial_data, appelle Claude,
 * persiste le résultat dans deals.ai_* + retourne au client pour affichage.
 */
export async function analyzeFinancialDataAction(
  dealId: string,
): Promise<AnalyzeFinancialResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  // 1. Récupère le contexte deal
  const { data: deal, error: dealErr } = await supabase
    .from("deals")
    .select("id,name,deal_type,sector,currency,company_stage")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (dealErr) return { success: false, error: dealErr.message };
  if (!deal) return { success: false, error: "Dossier introuvable" };

  // 2. Récupère les 3 exercices les plus récents
  const { data: finRows, error: finErr } = await supabase
    .from("financial_data")
    .select("fiscal_year,revenue,gross_margin,ebitda,ebitda_margin,net_debt,equity,cash,headcount,arr,mrr,nrr,churn_rate")
    .eq("deal_id", dealId)
    .eq("user_id", user.id)
    .eq("is_forecast", false)
    .order("fiscal_year", { ascending: false })
    .limit(3);

  if (finErr) return { success: false, error: finErr.message };
  if (!finRows || finRows.length === 0) {
    return { success: false, error: "Aucune donnée financière — renseigne au moins un exercice avant d'analyser." };
  }

  const years: FinancialYear[] = finRows.map(r => ({
    fiscal_year: r.fiscal_year,
    revenue: r.revenue,
    gross_margin: r.gross_margin,
    ebitda: r.ebitda,
    ebitda_margin: r.ebitda_margin,
    net_debt: r.net_debt,
    equity: r.equity,
    cash: r.cash,
    headcount: r.headcount,
    arr: r.arr,
    mrr: r.mrr,
    nrr: r.nrr,
    churn_rate: r.churn_rate,
  }));

  // 3. Appel IA
  const scoring = await analyzeDealFinancials({
    deal_name: deal.name,
    deal_type: deal.deal_type,
    sector: deal.sector,
    currency: deal.currency ?? "EUR",
    company_stage: deal.company_stage,
    years,
  });

  if (!scoring) {
    return { success: false, error: "L'IA n'a pas pu produire d'analyse. Vérifie ANTHROPIC_API_KEY et les données financières." };
  }

  // 4. Persistance dans deals.ai_*
  const analyzedAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("deals")
    .update({
      ai_financial_score: scoring.score,
      ai_valuation_low: scoring.valuation_low,
      ai_valuation_high: scoring.valuation_high,
      ai_financial_notes: scoring.notes,
      ai_analyzed_at: analyzedAt,
    })
    .eq("id", dealId)
    .eq("user_id", user.id);

  if (updErr) return { success: false, error: updErr.message };

  revalidatePath(`/protected/dossiers/${dealId}`);
  return {
    success: true,
    result: { ...scoring, analyzed_at: analyzedAt },
  };
}
