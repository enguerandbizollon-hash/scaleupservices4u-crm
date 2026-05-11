"use server";

import { createClient } from "@/lib/supabase/server";
import {
  generateScreeningBrief,
  type BriefDocumentSummary,
  type BriefFinancialSnapshot,
  type ScreeningBriefInput,
  type ScreeningBriefSuggestion,
} from "@/lib/ai/brief-engine";

export type ScreeningBriefResult =
  | { success: true; suggestion: ScreeningBriefSuggestion }
  | { success: false; error: string };

// Génère un brouillon IA des champs narratifs du screening d'un dossier.
// N'écrit rien en base : retourne une proposition que l'utilisateur applique
// champ par champ via ScreeningSection.
export async function suggestScreeningBrief(dealId: string): Promise<ScreeningBriefResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { data: deal, error: dealErr } = await supabase
    .from("deals")
    .select(`
      id, name, deal_type, sector, description,
      strategic_rationale, use_of_funds, company_stage,
      target_amount, asking_price_min, asking_price_max, currency
    `)
    .eq("id", dealId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (dealErr || !deal) return { success: false, error: "Dossier introuvable" };

  const { data: docsRaw } = await supabase
    .from("ma_documents")
    .select("document_type, file_name, ai_summary")
    .eq("deal_id", dealId)
    .eq("user_id", user.id)
    .not("ai_summary", "is", null);

  const documents: BriefDocumentSummary[] = (docsRaw ?? []).map((d) => ({
    document_type: d.document_type,
    file_name: d.file_name,
    ai_summary: d.ai_summary,
  }));

  const { data: finRow } = await supabase
    .from("financial_data")
    .select("fiscal_year, revenue, ebitda, ebitda_margin, arr, nrr, headcount, currency")
    .eq("deal_id", dealId)
    .eq("user_id", user.id)
    .order("fiscal_year", { ascending: false })
    .limit(1)
    .maybeSingle();

  const financial: BriefFinancialSnapshot | null = finRow
    ? {
        fiscal_year: finRow.fiscal_year,
        revenue: finRow.revenue,
        ebitda: finRow.ebitda,
        ebitda_margin: finRow.ebitda_margin,
        arr: finRow.arr,
        nrr: finRow.nrr,
        headcount: finRow.headcount,
        currency: finRow.currency ?? deal.currency ?? "EUR",
      }
    : null;

  const input: ScreeningBriefInput = {
    deal_name: deal.name,
    deal_type: deal.deal_type,
    sector: deal.sector,
    description: deal.description,
    strategic_rationale: deal.strategic_rationale,
    use_of_funds: deal.use_of_funds,
    company_stage: deal.company_stage,
    target_raise_amount: deal.target_amount,
    asking_price_min: deal.asking_price_min,
    asking_price_max: deal.asking_price_max,
    currency: deal.currency ?? "EUR",
    documents,
    financial,
  };

  const suggestion = await generateScreeningBrief(input);
  if (!suggestion) {
    return { success: false, error: "L'IA n'a pas pu générer de brouillon (clé API manquante ou réponse invalide)." };
  }

  return { success: true, suggestion };
}
