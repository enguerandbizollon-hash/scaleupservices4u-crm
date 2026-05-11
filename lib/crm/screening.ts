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
  hasFinancialData: boolean;
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
      filled: snapshot.hasFinancialData,
    },
  ];

  const enriched = items.map((i) => ({ ...i, earned: i.filled ? i.max : 0 }));
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

  const { count } = await supabase
    .from("financial_data")
    .select("id", { count: "exact", head: true })
    .eq("deal_id", dealId)
    .eq("user_id", user.id);

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
    hasFinancialData: (count ?? 0) > 0,
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
