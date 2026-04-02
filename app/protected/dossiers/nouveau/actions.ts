"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function ns(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

export async function createDealAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const name = ns(formData.get("name"));
  if (!name) throw new Error("Nom obligatoire");

  const { data: deal, error } = await supabase.from("deals").insert({
    name,
    deal_type:   ns(formData.get("deal_type"))   ?? "fundraising",
    deal_status: ns(formData.get("deal_status"))  ?? "open",
    deal_stage:  ns(formData.get("deal_stage"))   ?? "kickoff",
    priority_level: ns(formData.get("priority_level")) ?? "medium",
    sector:            ns(formData.get("sector")),
    location:          ns(formData.get("location")),
    description:       ns(formData.get("description")),
    target_amount:     ns(formData.get("target_amount")) ? Number(formData.get("target_amount")) : null,
    currency:          ns(formData.get("currency")) ?? "EUR",
    start_date:        ns(formData.get("start_date")),
    target_date:       ns(formData.get("target_date")),
    company_stage:     ns(formData.get("company_stage")),
    company_geography: ns(formData.get("company_geography")),
    client_organization_id: null,  // Les orgs se lient aux dossiers, pas l'inverse
    user_id: user.id,
  }).select("id").single();

  if (error) throw new Error(error.message);
  if (!deal?.id) throw new Error("Erreur création dossier");

  revalidatePath("/protected/dossiers");
  redirect(`/protected/dossiers/${deal.id}`);
}

export async function updateDealAction(formData: FormData) {
  const supabase = await createClient();
  const dealId = ns(formData.get("deal_id"));
  if (!dealId) throw new Error("ID manquant");

  // M5 : Lire le statut actuel avant mise à jour
  const { data: currentDeal } = await supabase
    .from("deals")
    .select("deal_status")
    .eq("id", dealId)
    .maybeSingle();

  const targetAmount = formData.get("target_amount");

  // Champs de base (toujours présents dans le form)
  const updateData: Record<string, unknown> = {
    name:           ns(formData.get("name")),
    deal_type:      ns(formData.get("deal_type")),
    deal_status:    ns(formData.get("deal_status")),
    deal_stage:     ns(formData.get("deal_stage")),
    priority_level: ns(formData.get("priority_level")),
    sector:         ns(formData.get("sector")),
    location:       ns(formData.get("location")),
    description:    ns(formData.get("description")),
    start_date:     ns(formData.get("start_date")),
    target_date:       ns(formData.get("target_date")),
    next_action_date:  ns(formData.get("next_action_date")),
    target_amount:     targetAmount ? Number(targetAmount) : null,
    currency:       ns(formData.get("currency")) ?? "EUR",
    mandate_id:     ns(formData.get("mandate_id")),
  };

  // Matching investisseur (fundraising / M&A) — seulement si champs présents dans le form
  if (formData.has("company_stage")) updateData.company_stage = ns(formData.get("company_stage"));
  if (formData.has("company_geography")) updateData.company_geography = ns(formData.get("company_geography"));

  // Recrutement — seulement si champs présents dans le form
  if (formData.has("job_title")) updateData.job_title = ns(formData.get("job_title"));
  if (formData.has("required_seniority")) updateData.required_seniority = ns(formData.get("required_seniority"));
  if (formData.has("required_location")) updateData.required_location = ns(formData.get("required_location"));
  if (formData.has("required_remote")) updateData.required_remote = ns(formData.get("required_remote"));
  if (formData.has("salary_min")) updateData.salary_min = formData.get("salary_min") ? Number(formData.get("salary_min")) : null;
  if (formData.has("salary_max")) updateData.salary_max = formData.get("salary_max") ? Number(formData.get("salary_max")) : null;

  const { error } = await supabase.from("deals").update(updateData).eq("id", dealId);

  if (error) throw new Error(error.message);

  // M5 trigger : deal_status → "won" → flaguer les candidats non-closing à revoir
  const newStatus = ns(formData.get("deal_status"));
  if (newStatus === "won" && currentDeal?.deal_status !== "won") {
    await supabase
      .from("deal_candidates")
      .update({ needs_review: true })
      .eq("deal_id", dealId)
      .neq("stage", "closing");
  }

  revalidatePath(`/protected/dossiers/${dealId}`);
  redirect(`/protected/dossiers/${dealId}`);
}
