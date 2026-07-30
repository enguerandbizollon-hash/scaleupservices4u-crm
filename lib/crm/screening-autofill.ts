// Auto-remplissage du screening à la naissance du dossier (cran 1, audit
// 2026-07-30). Demande explicite d'Enguérand : « que le screening
// s'autoremplisse, que je n'aie qu'à contrôler et push ».
//
// Tourne en tâche de fond (after() dans createDossierFromUnivers) : la
// création du dossier répond tout de suite, le brouillon arrive derrière.
// Règle absolue : ne JAMAIS écraser un champ déjà rempli. L'IA propose,
// l'utilisateur contrôle et pousse.
//
// Client injecté (service role en tâche de fond, où le contexte SSR n'existe
// plus) : chaque requête est scopée user_id explicitement.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateScreeningBrief,
  type BriefDocumentSummary,
  type BriefFinancialSnapshot,
  type ScreeningBriefInput,
} from "@/lib/ai/brief-engine";
import {
  computeScreeningScore,
  computeFinancialDepth,
  type DealScreeningSnapshot,
} from "@/lib/crm/screening";
import type { ScreeningStatus } from "@/lib/crm/matching-maps";

const isEmpty = (v: string | null | undefined) => !v || !v.trim();

export async function autofillScreeningDraft(
  supabase: SupabaseClient,
  userId: string,
  dealId: string,
): Promise<{ filled: boolean; error: string | null }> {
  const { data: deal, error: dealErr } = await supabase
    .from("deals")
    .select(`
      id, name, deal_type, sector, description, strategic_rationale, company_stage,
      asking_price_min, asking_price_max, currency, organization_id,
      screening_status, screening_score, screening_validated_by,
      screening_validated_at, screening_updated_at,
      executive_summary, motivation_narrative, competitive_landscape,
      market_context, key_differentiators, key_risks
    `)
    .eq("id", dealId)
    .eq("user_id", userId)
    .maybeSingle();
  if (dealErr || !deal) return { filled: false, error: dealErr?.message ?? "Dossier introuvable" };

  const [docsRes, finRes, finRowsRes, univRes] = await Promise.all([
    supabase
      .from("ma_documents")
      .select("document_type, file_name, ai_summary")
      .eq("deal_id", dealId)
      .eq("user_id", userId)
      .not("ai_summary", "is", null),
    supabase
      .from("financial_data")
      .select("fiscal_year, revenue, ebitda, ebitda_margin, arr, nrr, headcount, currency")
      .eq("deal_id", dealId)
      .eq("user_id", userId)
      .order("fiscal_year", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("financial_data")
      .select("fiscal_year, revenue, ebitda, net_income")
      .eq("deal_id", dealId)
      .eq("user_id", userId)
      .eq("is_forecast", false),
    deal.organization_id
      ? supabase
          .from("univers_entreprises")
          .select("synthese, website, actionnariat")
          .eq("organization_id", deal.organization_id)
          .limit(1)
      : Promise.resolve({ data: null }),
  ]);

  const documents: BriefDocumentSummary[] = (docsRes.data ?? []).map((d) => ({
    document_type: d.document_type,
    file_name: d.file_name,
    ai_summary: d.ai_summary,
  }));

  // La donnée circule (audit) : la synthèse 360 payée en prospection nourrit
  // le brouillon du dossier au lieu de rester enfermée dans son tiroir.
  const fiche = (univRes.data ?? [])[0] as
    | { synthese: string | null; website: string | null; actionnariat: Array<{ nom?: string | null; pourcentage?: number | null; age?: number | null }> | null }
    | undefined;
  if (fiche && !isEmpty(fiche.synthese)) {
    const lignes: string[] = [fiche.synthese as string];
    if (fiche.website) lignes.push(`Site officiel : ${fiche.website}`);
    if (fiche.actionnariat && fiche.actionnariat.length > 0) {
      const top = fiche.actionnariat.slice(0, 3)
        .map((a) => [a.nom, a.pourcentage != null ? `${a.pourcentage}%` : null, a.age != null ? `${a.age} ans` : null].filter(Boolean).join(" "))
        .join(", ");
      if (top) lignes.push(`Actionnariat : ${top}`);
    }
    documents.unshift({
      document_type: "fiche_360",
      file_name: "Synthèse 360 (prospection)",
      ai_summary: lignes.join("\n"),
    });
  }

  const finRow = finRes.data;
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
    company_stage: deal.company_stage,
    asking_price_min: deal.asking_price_min,
    asking_price_max: deal.asking_price_max,
    currency: deal.currency ?? "EUR",
    documents,
    financial,
  };

  const suggestion = await generateScreeningBrief(input);
  if (!suggestion) {
    return { filled: false, error: "Génération IA en échec (clé absente, crédits épuisés ou réponse invalide)" };
  }

  // Remplissage des champs VIDES uniquement.
  const patch: Record<string, unknown> = {};
  if (isEmpty(deal.executive_summary) && !isEmpty(suggestion.executive_summary)) patch.executive_summary = suggestion.executive_summary;
  if (isEmpty(deal.motivation_narrative) && !isEmpty(suggestion.motivation_narrative)) patch.motivation_narrative = suggestion.motivation_narrative;
  if (isEmpty(deal.competitive_landscape) && !isEmpty(suggestion.competitive_landscape)) patch.competitive_landscape = suggestion.competitive_landscape;
  if (isEmpty(deal.market_context) && !isEmpty(suggestion.market_context)) patch.market_context = suggestion.market_context;
  if ((deal.key_differentiators ?? []).length === 0 && suggestion.key_differentiators.length > 0) patch.key_differentiators = suggestion.key_differentiators;
  if ((deal.key_risks ?? []).length === 0 && suggestion.key_risks.length > 0) patch.key_risks = suggestion.key_risks;
  if (Object.keys(patch).length === 0) return { filled: false, error: null };

  const snapshot: DealScreeningSnapshot = {
    id: deal.id,
    user_id: userId,
    screening_status: (deal.screening_status ?? "not_started") as ScreeningStatus,
    screening_score: deal.screening_score,
    screening_validated_by: deal.screening_validated_by,
    screening_validated_at: deal.screening_validated_at,
    screening_updated_at: deal.screening_updated_at,
    executive_summary: (patch.executive_summary as string | undefined) ?? deal.executive_summary,
    motivation_narrative: (patch.motivation_narrative as string | undefined) ?? deal.motivation_narrative,
    competitive_landscape: (patch.competitive_landscape as string | undefined) ?? deal.competitive_landscape,
    market_context: (patch.market_context as string | undefined) ?? deal.market_context,
    key_differentiators: (patch.key_differentiators as string[] | undefined) ?? deal.key_differentiators,
    key_risks: (patch.key_risks as string[] | undefined) ?? deal.key_risks,
    description: deal.description,
    financialDepth: computeFinancialDepth(
      (finRowsRes.data ?? []) as Array<{ fiscal_year: number; revenue: number | null; ebitda: number | null; net_income: number | null }>,
    ),
  };
  const breakdown = computeScreeningScore(snapshot);

  const { error: upErr } = await supabase
    .from("deals")
    .update({
      ...patch,
      screening_score: breakdown.total,
      screening_status: snapshot.screening_status === "not_started" && breakdown.total > 0
        ? "drafting"
        : snapshot.screening_status,
      screening_updated_at: new Date().toISOString(),
    })
    .eq("id", dealId)
    .eq("user_id", userId);
  if (upErr) return { filled: false, error: upErr.message };

  return { filled: true, error: null };
}
