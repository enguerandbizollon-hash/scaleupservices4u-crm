"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── updateDealMatchingProfile — met à jour les champs de matching M&A d'un dossier ──
// Note : le moteur de matching investisseurs (fundraising) a été extrait le 2026-07-20
// vers le bundle _extraction-fundraising-2026-07-20/ et retiré du CRM (pivot M&A).
// Seuls company_stage / company_geography (profil de matching M&A) subsistent ici.

export async function updateDealMatchingProfile(
  dealId: string,
  data: {
    company_stage?: string | null;
    company_geography?: string | null;
  },
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase
    .from("deals")
    .update({
      company_stage:     data.company_stage     ?? null,
      company_geography: data.company_geography ?? null,
    })
    .eq("id", dealId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true };
}
