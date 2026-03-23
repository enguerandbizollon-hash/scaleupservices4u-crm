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
    deal_status: ns(formData.get("deal_status"))  ?? "active",
    deal_stage:  ns(formData.get("deal_stage"))   ?? "kickoff",
    priority_level: ns(formData.get("priority_level")) ?? "medium",
    sector:      ns(formData.get("sector")),
    location:    ns(formData.get("location")),
    description: ns(formData.get("description")),
    target_amount: ns(formData.get("target_amount")) ? Number(formData.get("target_amount")) : null,
    currency: ns(formData.get("currency")) ?? "EUR",
    start_date:  ns(formData.get("start_date")),
    target_date: ns(formData.get("target_date")),
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

  const { error } = await supabase.from("deals").update({
    name:        ns(formData.get("name")),
    deal_type:   ns(formData.get("deal_type")),
    deal_status: ns(formData.get("deal_status")),
    deal_stage:  ns(formData.get("deal_stage")),
    priority_level: ns(formData.get("priority_level")),
    sector:      ns(formData.get("sector")),
    location:    ns(formData.get("location")),
    description: ns(formData.get("description")),
    start_date:  ns(formData.get("start_date")),
    target_date: ns(formData.get("target_date")),
  }).eq("id", dealId);

  if (error) throw new Error(error.message);
  revalidatePath(`/protected/dossiers/${dealId}`);
  redirect(`/protected/dossiers/${dealId}`);
}
