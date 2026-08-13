"use server";

// Usine à livrables (Deal OS, chantier C puis plan R1 lot 6) : génération
// des documents du dossier. Teaser anonymisé (l'IA génère, le code
// anonymise) et Information Memorandum nominatif post-NDA. L'utilisateur
// contrôle avant toute diffusion.

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateTeaserContent, type TeaserContent } from "@/lib/ai/teaser-engine";
import { generateIMContent, type IMContent } from "@/lib/ai/im-engine";
import { generateProfilRepriseContent, type ProfilRepriseContent } from "@/lib/ai/profil-reprise-engine";
import type { CadrageContent } from "@/lib/ai/cadrage-engine";
import { geoLabel } from "@/lib/crm/geo-match";
import { DEAL_TIMING_OPTIONS } from "@/lib/crm/matching-maps";

export type LivrableResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function generateTeaser(
  dealId: string,
): Promise<LivrableResult<{ teaser: TeaserContent }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { data: deal } = await supabase
    .from("deals")
    .select("id, name, deal_type, sector, location, description, executive_summary, key_differentiators, deal_context, partial_sale_ok, management_retention, asking_price_min, asking_price_max, organization_id")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!deal) return { success: false, error: "Dossier introuvable" };
  if (deal.deal_type !== "ma_sell") return { success: false, error: "Le teaser se génère sur un dossier de cession" };

  const { data: org } = deal.organization_id
    ? await supabase.from("organizations").select("id, name, siren, location").eq("id", deal.organization_id).maybeSingle()
    : { data: null };
  if (!org) return { success: false, error: "Dossier sans organisation cliente : rattachez-la d'abord" };

  const [{ data: finRows }, ficheRes] = await Promise.all([
    supabase
      .from("financial_data")
      .select("fiscal_year, revenue, ebitda, net_income, headcount")
      .eq("deal_id", dealId)
      .eq("is_forecast", false)
      .order("fiscal_year", { ascending: false })
      .limit(3),
    org.siren
      ? supabase.from("univers_entreprises").select("synthese, ville").eq("siren", org.siren).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const fiche = (ficheRes as { data: { synthese: string | null; ville: string | null } | null }).data;

  const teaser = await generateTeaserContent({
    company_name: org.name,
    siren: org.siren ?? null,
    ville: fiche?.ville ?? org.location ?? null,
    sector: deal.sector ?? null,
    location_region: deal.location ?? org.location ?? null,
    description: deal.description ?? null,
    executive_summary: deal.executive_summary ?? null,
    key_differentiators: deal.key_differentiators ?? null,
    deal_context: deal.deal_context ?? null,
    partial_sale_ok: deal.partial_sale_ok ?? null,
    management_retention: deal.management_retention ?? null,
    asking_price_min: deal.asking_price_min ?? null,
    asking_price_max: deal.asking_price_max ?? null,
    finances: (finRows ?? []) as { fiscal_year: number; revenue: number | null; ebitda: number | null; net_income: number | null; headcount: number | null }[],
    synthese_fiche: fiche?.synthese ?? null,
  });
  if (!teaser) return { success: false, error: "Génération impossible : clé API absente, crédits Anthropic épuisés, ou réponse invalide (détail dans les logs serveur)" };

  const { error } = await supabase
    .from("deals")
    .update({ teaser_content: teaser, teaser_generated_at: new Date().toISOString() })
    .eq("id", dealId)
    .eq("user_id", user.id);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/protected/dossiers/${dealId}/teaser`);
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true, data: { teaser } };
}

/**
 * Profil de reprise anonyme (livrable buy, pendant du teaser) : présente le
 * repreneur et son projet au dirigeant d'une cible approchée, identité
 * scrubbée par le code. Matière : critères du dossier + fiche de cadrage.
 */
export async function generateProfilReprise(
  dealId: string,
): Promise<LivrableResult<{ profil: ProfilRepriseContent }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { data: deal } = await supabase
    .from("deals")
    .select(`
      id, deal_type, dirigeant_nom, strategic_rationale, deal_timing,
      target_sectors, target_geographies, target_revenue_min, target_revenue_max,
      acquisition_budget_min, acquisition_budget_max, full_acquisition_required,
      management_retention, cadrage_content
    `)
    .eq("id", dealId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!deal) return { success: false, error: "Dossier introuvable" };
  if (deal.deal_type !== "ma_buy") return { success: false, error: "Le profil de reprise se génère sur un mandat d'acquisition" };

  const cadrage = (deal.cadrage_content ?? null) as CadrageContent | null;
  const timingLabel = deal.deal_timing
    ? DEAL_TIMING_OPTIONS.find((t) => t.value === deal.deal_timing)?.label ?? deal.deal_timing
    : null;

  const profil = await generateProfilRepriseContent({
    repreneur_nom: deal.dirigeant_nom ?? cadrage?.repreneur_nom ?? null,
    projet: deal.strategic_rationale ?? cadrage?.projet ?? null,
    secteurs: deal.target_sectors ?? [],
    geographies: (deal.target_geographies ?? []).map((g: string) => geoLabel(g)),
    ca_min: deal.target_revenue_min ?? null,
    ca_max: deal.target_revenue_max ?? null,
    apport: deal.acquisition_budget_min ?? cadrage?.apport ?? null,
    budget_max: deal.acquisition_budget_max ?? null,
    full_acquisition: deal.full_acquisition_required ?? cadrage?.full_acquisition ?? null,
    management_retention: deal.management_retention ?? cadrage?.management_retention ?? null,
    deal_timing: timingLabel,
  });
  if (!profil) return { success: false, error: "Génération impossible : clé API absente, crédits Anthropic épuisés, ou réponse invalide (détail dans les logs serveur)" };

  const { error } = await supabase
    .from("deals")
    .update({ profil_reprise_content: profil, profil_reprise_generated_at: new Date().toISOString() })
    .eq("id", dealId)
    .eq("user_id", user.id);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/protected/dossiers/${dealId}/profil-reprise`);
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true, data: { profil } };
}

export async function generateIM(
  dealId: string,
): Promise<LivrableResult<{ im: IMContent }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { data: deal } = await supabase
    .from("deals")
    .select("id, name, deal_type, sector, description, executive_summary, motivation_narrative, competitive_landscape, market_context, key_differentiators, key_risks, deal_context, partial_sale_ok, management_retention, dirigeant_nom, dirigeant_titre, organization_id")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!deal) return { success: false, error: "Dossier introuvable" };
  if (deal.deal_type !== "ma_sell") return { success: false, error: "L'IM se génère sur un dossier de cession" };

  const { data: org } = deal.organization_id
    ? await supabase.from("organizations").select("id, name, siren, location").eq("id", deal.organization_id).maybeSingle()
    : { data: null };
  if (!org) return { success: false, error: "Dossier sans organisation cliente : rattachez-la d'abord" };

  const [{ data: finRows }, ficheRes] = await Promise.all([
    // Contrairement au teaser : projections INCLUSES (présentées comme telles).
    supabase
      .from("financial_data")
      .select("fiscal_year, revenue, ebitda, net_income, headcount, is_forecast")
      .eq("deal_id", dealId)
      .order("fiscal_year", { ascending: false })
      .limit(6),
    org.siren
      ? supabase.from("univers_entreprises").select("synthese, ville").eq("siren", org.siren).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const fiche = (ficheRes as { data: { synthese: string | null; ville: string | null } | null }).data;

  const im = await generateIMContent({
    company_name: org.name,
    siren: org.siren ?? null,
    ville: fiche?.ville ?? org.location ?? null,
    sector: deal.sector ?? null,
    description: deal.description ?? null,
    executive_summary: deal.executive_summary ?? null,
    motivation_narrative: deal.motivation_narrative ?? null,
    competitive_landscape: deal.competitive_landscape ?? null,
    market_context: deal.market_context ?? null,
    key_differentiators: deal.key_differentiators ?? null,
    key_risks: deal.key_risks ?? null,
    deal_context: deal.deal_context ?? null,
    partial_sale_ok: deal.partial_sale_ok ?? null,
    management_retention: deal.management_retention ?? null,
    dirigeant_nom: deal.dirigeant_nom ?? null,
    dirigeant_titre: deal.dirigeant_titre ?? null,
    finances: ((finRows ?? []) as { fiscal_year: number; revenue: number | null; ebitda: number | null; net_income: number | null; headcount: number | null; is_forecast: boolean | null }[])
      .map(f => ({ ...f, is_forecast: !!f.is_forecast })),
    synthese_fiche: fiche?.synthese ?? null,
  });
  if (!im) return { success: false, error: "Génération impossible : clé API absente, crédits Anthropic épuisés, ou réponse invalide (détail dans les logs serveur)" };

  const { error } = await supabase
    .from("deals")
    .update({ im_content: im, im_generated_at: new Date().toISOString() })
    .eq("id", dealId)
    .eq("user_id", user.id);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/protected/dossiers/${dealId}/im`);
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true, data: { im } };
}
