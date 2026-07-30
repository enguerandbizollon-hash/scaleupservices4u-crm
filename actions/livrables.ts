"use server";

// Usine à livrables (Deal OS, chantier C) : génération des documents du
// dossier. Passe 1 : le teaser anonymisé. L'IA génère, le code anonymise,
// l'utilisateur contrôle avant tout envoi.

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateTeaserContent, type TeaserContent } from "@/lib/ai/teaser-engine";

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
  if (!teaser) return { success: false, error: "Génération impossible (clé IA absente ou réponse invalide)" };

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
