"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  analyzeDealFinancials,
  type FinancialYear,
  type FinancialScoringResult,
} from "@/lib/ai/financial-scoring";
import { computeFinancials, type FinancialInputs } from "@/lib/crm/financial-calcs";

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

  // 2. Récupère les 3 exercices les plus récents (toutes colonnes pour permettre
  //    le recalcul des dérivés — ebitda, marges, equity, net_debt — depuis les
  //    composantes, cohérent avec l'affichage UI via computeFinancials).
  const { data: finRows, error: finErr } = await supabase
    .from("financial_data")
    .select("*")
    .eq("deal_id", dealId)
    .eq("user_id", user.id)
    .eq("is_forecast", false)
    .order("fiscal_year", { ascending: false })
    .limit(3);

  if (finErr) return { success: false, error: finErr.message };
  if (!finRows || finRows.length === 0) {
    return { success: false, error: "Aucune donnée financière — renseigne au moins un exercice avant d'analyser." };
  }

  // Recalcule les dérivés depuis les composantes saisies. Les champs ebitda,
  // gross_margin, ebitda_margin, net_debt, equity sont calc-only côté UI et
  // ne sont jamais persistés en saisie manuelle — sans ce recalcul, le LLM
  // les voit comme null et répond "EBITDA manquant".
  // Note : computeFinancials retourne les marges en ratio (0.15) ; le prompt
  // les formate avec "%" donc on multiplie par 100 quand on prend le calc.
  const years: FinancialYear[] = finRows.map(r => {
    const c = computeFinancials(r as FinancialInputs);
    const grossMarginPct = c.gross_margin !== null ? c.gross_margin * 100 : r.gross_margin;
    const ebitdaMarginPct = c.ebitda_margin !== null ? c.ebitda_margin * 100 : r.ebitda_margin;
    const ebitdaNormativeMarginPct = c.ebitda_normative_margin !== null ? c.ebitda_normative_margin * 100 : null;
    return {
      fiscal_year: r.fiscal_year,
      revenue: r.revenue,
      gross_margin: grossMarginPct,
      ebitda: c.ebitda ?? r.ebitda,
      ebitda_margin: ebitdaMarginPct,
      ebitda_normative: c.ebitda_normative,
      ebitda_normative_margin: ebitdaNormativeMarginPct,
      addbacks_total: c.addbacks_total,
      net_debt: c.net_debt ?? r.net_debt,
      equity: c.equity ?? r.equity,
      cash: r.cash,
      headcount: r.headcount,
      arr: r.arr,
      mrr: c.mrr ?? r.mrr,
      nrr: r.nrr,
      churn_rate: r.churn_rate,
    };
  });

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
      ai_score_growth: scoring.breakdown.growth,
      ai_score_margin: scoring.breakdown.margin,
      ai_score_balance: scoring.breakdown.balance,
      ai_score_comparables: scoring.breakdown.comparables,
      ai_anomalies: scoring.anomalies,
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
