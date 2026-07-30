import { createClient } from "@/lib/supabase/server";
import {
  isScreeningReady,
  SCREENING_READY,
  type ScreeningStatus,
} from "@/lib/crm/matching-maps";

// Score minimum requis pour passer à ready_for_outreach.
// Permet de garantir que les blocs majeurs (pitch, motivation, diff/risques)
// sont remplis avant toute ouverture vers l'extérieur.
export const SCREENING_READY_MIN_SCORE = 60;

// Seuils de longueur pour qu'un champ narratif soit considéré "rempli".
const MIN_CHARS_PITCH = 80;
const MIN_CHARS_LONG  = 50;

export interface DealScreeningSnapshot {
  id: string;
  user_id: string;
  screening_status: ScreeningStatus;
  screening_score: number | null;
  screening_validated_by: string | null;
  screening_validated_at: string | null;
  screening_updated_at: string | null;
  executive_summary: string | null;
  motivation_narrative: string | null;
  competitive_landscape: string | null;
  market_context: string | null;
  key_differentiators: string[] | null;
  key_risks: string[] | null;
  description: string | null;
  /** Profondeur des données financières, 0 à 5 (computeFinancialDepth). */
  financialDepth: number;
}

/**
 * Profondeur financière 0-5 (recette 2026-07-30 : « 5/5 juste avec un CA »
 * était flatteur). Barème M&A : le CA ouvre, la pluri-annualité et le
 * résultat consolident, l'EBITDA (la métrique du métier) donne le dernier
 * point : +2 CA présent, +1 au moins 2 exercices, +1 résultat net sur le
 * dernier exercice, +1 EBITDA sur le dernier exercice.
 */
export function computeFinancialDepth(
  rows: Array<{ fiscal_year: number; revenue: number | null; ebitda: number | null; net_income: number | null }>,
): number {
  const withCa = rows.filter((r) => r.revenue != null);
  if (withCa.length === 0) return 0;
  let depth = 2;
  if (withCa.length >= 2) depth += 1;
  const latest = [...rows].sort((a, b) => b.fiscal_year - a.fiscal_year)[0];
  if (latest?.net_income != null) depth += 1;
  if (latest?.ebitda != null) depth += 1;
  return depth;
}

export interface ScreeningScoreBreakdown {
  total: number;
  items: Array<{
    key: string;
    label: string;
    earned: number;
    max: number;
    filled: boolean;
  }>;
}

function isFilledText(value: string | null | undefined, minChars: number): boolean {
  return typeof value === "string" && value.trim().length >= minChars;
}

function isFilledArray(value: string[] | null | undefined, minItems: number): boolean {
  return Array.isArray(value) && value.filter((v) => v && v.trim()).length >= minItems;
}

// Calcul déterministe du score de complétude 0 à 100.
// Doit être reproductible côté serveur comme côté client (utilisé pour
// affichage en temps réel dans le wizard de screening).
export function computeScreeningScore(snapshot: DealScreeningSnapshot): ScreeningScoreBreakdown {
  const items = [
    {
      key: "executive_summary",
      label: "Pitch exécutif",
      max: 25,
      filled: isFilledText(snapshot.executive_summary, MIN_CHARS_PITCH),
    },
    {
      key: "motivation_narrative",
      label: "Motivation",
      max: 15,
      filled: isFilledText(snapshot.motivation_narrative, MIN_CHARS_LONG),
    },
    {
      key: "key_differentiators",
      label: "Différenciateurs",
      max: 15,
      filled: isFilledArray(snapshot.key_differentiators, 2),
    },
    {
      key: "key_risks",
      label: "Points d'attention",
      max: 10,
      filled: isFilledArray(snapshot.key_risks, 1),
    },
    {
      key: "competitive_landscape",
      label: "Concurrence",
      max: 10,
      filled: isFilledText(snapshot.competitive_landscape, MIN_CHARS_LONG),
    },
    {
      key: "market_context",
      label: "Contexte marché",
      max: 10,
      filled: isFilledText(snapshot.market_context, MIN_CHARS_LONG),
    },
    {
      key: "description",
      label: "Description dossier",
      max: 10,
      filled: isFilledText(snapshot.description, 100),
    },
    {
      key: "financial_data",
      label: "Données financières",
      max: 5,
      filled: snapshot.financialDepth >= 5,
      earnedOverride: snapshot.financialDepth,
    },
  ] as Array<{ key: string; label: string; max: number; filled: boolean; earnedOverride?: number }>;

  const enriched = items.map(({ earnedOverride, ...i }) => ({
    ...i,
    earned: earnedOverride ?? (i.filled ? i.max : 0),
  }));
  const total = enriched.reduce((sum, i) => sum + i.earned, 0);
  return { total, items: enriched };
}

// Charge le snapshot screening d'un dossier. RLS fait le filtrage par user_id.
export async function getDealScreening(dealId: string): Promise<DealScreeningSnapshot | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: deal, error } = await supabase
    .from("deals")
    .select(`
      id, user_id,
      screening_status, screening_score,
      screening_validated_by, screening_validated_at, screening_updated_at,
      executive_summary, motivation_narrative,
      competitive_landscape, market_context,
      key_differentiators, key_risks,
      description
    `)
    .eq("id", dealId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !deal) return null;

  const { data: finRows } = await supabase
    .from("financial_data")
    .select("fiscal_year, revenue, ebitda, net_income")
    .eq("deal_id", dealId)
    .eq("user_id", user.id)
    .eq("is_forecast", false);

  return {
    id: deal.id,
    user_id: deal.user_id,
    screening_status: (deal.screening_status ?? "not_started") as ScreeningStatus,
    screening_score: deal.screening_score,
    screening_validated_by: deal.screening_validated_by,
    screening_validated_at: deal.screening_validated_at,
    screening_updated_at: deal.screening_updated_at,
    executive_summary: deal.executive_summary,
    motivation_narrative: deal.motivation_narrative,
    competitive_landscape: deal.competitive_landscape,
    market_context: deal.market_context,
    key_differentiators: deal.key_differentiators,
    key_risks: deal.key_risks,
    description: deal.description,
    financialDepth: computeFinancialDepth(
      (finRows ?? []) as Array<{ fiscal_year: number; revenue: number | null; ebitda: number | null; net_income: number | null }>,
    ),
  };
}

// Gate proactif : utilisé par le Module 2 (suggestions) et Module 3 (campagnes).
// Le matching réactif (onglet Matching dans la fiche dossier) n'appelle pas ce
// gate : l'utilisateur peut toujours visualiser les scores.
export async function isProactiveAllowedForDeal(dealId: string): Promise<boolean> {
  const snap = await getDealScreening(dealId);
  if (!snap) return false;
  return isScreeningReady(snap.screening_status);
}

export { SCREENING_READY, isScreeningReady };
