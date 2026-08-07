"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { syncToGCal } from "@/lib/gcal/sync-helper";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DealInput {
  name: string;
  deal_type: string;
  deal_status?: string;
  deal_stage?: string;
  priority_level?: string;
  sector?: string | null;
  location?: string | null;
  description?: string | null;
  target_amount?: number | null;
  currency?: string;
  start_date?: string | null;
  target_date?: string | null;
  next_action_date?: string | null;
  company_stage?: string | null;
  company_geography?: string | null;
  // M&A Sell-side
  asking_price_min?: number | null;
  asking_price_max?: number | null;
  partial_sale_ok?: boolean;
  management_retention?: boolean;
  deal_timing?: string | null;
  deal_context?: string | null;
  // M&A Buy-side
  target_sectors?: string[];
  target_geographies?: string[];
  target_revenue_min?: number | null;
  target_revenue_max?: number | null;
  target_ev_min?: number | null;
  target_ev_max?: number | null;
  acquisition_budget_min?: number | null;
  acquisition_budget_max?: number | null;
  full_acquisition_required?: boolean;
  strategic_rationale?: string | null;
  excluded_sectors?: string[];
  target_stage?: string | null;
  // Dirigeant
  dirigeant_id?: string | null;
  dirigeant_nom?: string | null;
  dirigeant_email?: string | null;
  dirigeant_telephone?: string | null;
  dirigeant_titre?: string | null;
}

export type DealActionResult =
  | { success: true; id: string }
  | { success: false; error: string };

// DocumentInput : supprimée (V49). Remplacée par CreateDocumentInput dans
// actions/documents.ts (ma_documents + Supabase Storage).

// ── Simple list (autocomplete) ────────────────────────────────────────────────

// V54 fix : assigne une organisation cliente à un dossier qui en est
// dépourvu (cas des dossiers legacy créés avant V54). Vérifie que l'org
// appartient au user. Met à jour deal.organization_id.
export async function setDealClientOrganization(
  dealId: string,
  organizationId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!org) return { success: false, error: "Organisation introuvable" };

  const { error } = await supabase
    .from("deals")
    .update({ organization_id: organizationId })
    .eq("id", dealId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true };
}

// V54 : mise à jour de la taille d'entreprise (company_stage) de l'organisation
// liée au dossier. Agit sur organizations.company_stage via deal.organization_id.
// Centralise la règle "la taille vit sur l'organisation, éditée depuis le dossier
// pour l'ergonomie".
export async function updateDealOrganizationStage(
  dealId: string,
  stage: string | null,
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { data: deal } = await supabase
    .from("deals")
    .select("organization_id")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!deal?.organization_id) {
    return { success: false, error: "Dossier sans organisation liée" };
  }

  const { error } = await supabase
    .from("organizations")
    .update({ company_stage: stage || null })
    .eq("id", deal.organization_id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/protected/dossiers/${dealId}`);
  revalidatePath(`/protected/organisations/${deal.organization_id}`);
  return { success: true };
}

/**
 * Porte de signature (v75) : marque le mandat SIGNÉ. Un pré-mandat (créé au
 * screening d'un cédant, en préparation) devient un vrai mandat et quitte
 * « En préparation » pour « Signés » dans l'onglet Mandats. Propose/dispose :
 * geste explicite, jamais automatique. Idempotent (re-signer redate).
 * `signedAt` permet d'antidater (ISO), sinon maintenant.
 */
export async function markMandateSigned(dealId: string, signedAt?: string): Promise<DealActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  if (signedAt != null && Number.isNaN(Date.parse(signedAt))) {
    return { success: false, error: "Date de signature invalide" };
  }
  const when = signedAt ?? new Date().toISOString();

  const { error } = await supabase
    .from("deals")
    .update({ mandate_signed_at: when })
    .eq("id", dealId)
    .eq("user_id", user.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/protected/dossiers");
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true, id: dealId };
}

/** Annule la signature : le mandat repasse « En préparation » (misclick réversible). */
export async function unmarkMandateSigned(dealId: string): Promise<DealActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase
    .from("deals")
    .update({ mandate_signed_at: null })
    .eq("id", dealId)
    .eq("user_id", user.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/protected/dossiers");
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true, id: dealId };
}

export async function getAllDealsSimple(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("deals")
    .select("id, name")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  return (data ?? []) as { id: string; name: string }[];
}

// ── Deals CRUD ────────────────────────────────────────────────────────────────

export async function createDeal(data: DealInput): Promise<DealActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const name = data.name?.trim();
  if (!name) return { success: false, error: "Nom obligatoire" };

  const { data: deal, error } = await supabase.from("deals").insert({
    user_id:        user.id,
    name,
    deal_type:      data.deal_type    ?? "ma_sell",
    deal_status:    data.deal_status  ?? "open",
    deal_stage:     data.deal_stage   ?? "kickoff",
    priority_level: data.priority_level ?? "medium",
    sector:         data.sector       ?? null,
    location:       data.location     ?? null,
    description:    data.description  ?? null,
    target_amount:  data.target_amount ?? null,
    currency:       data.currency     ?? "EUR",
    start_date:     data.start_date   ?? null,
    target_date:        data.target_date        ?? null,
    next_action_date:   data.next_action_date   ?? null,
    company_stage:      data.company_stage      ?? null,
    company_geography: data.company_geography ?? null,
    // M&A Sell-side
    asking_price_min:     data.asking_price_min     ?? null,
    asking_price_max:     data.asking_price_max     ?? null,
    partial_sale_ok:      data.partial_sale_ok      ?? true,
    management_retention: data.management_retention ?? true,
    deal_timing:          data.deal_timing          ?? null,
    deal_context:         data.deal_context         ?? null,
    // M&A Buy-side
    target_sectors:            data.target_sectors            ?? [],
    target_geographies:        data.target_geographies        ?? [],
    target_revenue_min:        data.target_revenue_min        ?? null,
    target_revenue_max:        data.target_revenue_max        ?? null,
    target_ev_min:             data.target_ev_min             ?? null,
    target_ev_max:             data.target_ev_max             ?? null,
    acquisition_budget_min:    data.acquisition_budget_min    ?? null,
    acquisition_budget_max:    data.acquisition_budget_max    ?? null,
    full_acquisition_required: data.full_acquisition_required ?? false,
    strategic_rationale:       data.strategic_rationale       ?? null,
    excluded_sectors:          data.excluded_sectors          ?? [],
    target_stage:              data.target_stage              ?? null,
  }).select("id").single();

  if (error) return { success: false, error: error.message };
  if (!deal?.id) return { success: false, error: "Erreur création dossier" };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  // Sync GCal closing cible
  if (data.target_date) {
    syncToGCal({
      action: "create", source_type: "deal_closing", source_id: deal.id,
      event: { summary: `Closing cible : ${data.name}`, start: data.target_date, end: data.target_date, allDay: true, sourceUrl: `${baseUrl}/protected/dossiers/${deal.id}` },
    });
  }
  // Sync GCal relance
  if (data.next_action_date) {
    syncToGCal({
      action: "create", source_type: "deal_relance", source_id: deal.id,
      event: { summary: `Relance : ${data.name}`, start: data.next_action_date, end: data.next_action_date, allDay: true, sourceUrl: `${baseUrl}/protected/dossiers/${deal.id}` },
    });
  }

  revalidatePath("/protected/dossiers");
  return { success: true, id: deal.id };
}

export async function updateDeal(id: string, data: Partial<DealInput>): Promise<DealActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase.from("deals")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  // Sync GCal closing cible
  if (data.target_date !== undefined) {
    syncToGCal({
      action: data.target_date ? "update" : "delete",
      source_type: "deal_closing", source_id: id,
      event: { summary: `Closing cible : ${data.name ?? ""}`, start: data.target_date ?? "", end: data.target_date ?? "", allDay: true, sourceUrl: `${baseUrl}/protected/dossiers/${id}` },
    });
  }
  // Sync GCal relance
  if (data.next_action_date !== undefined) {
    syncToGCal({
      action: data.next_action_date ? "update" : "delete",
      source_type: "deal_relance", source_id: id,
      event: { summary: `Relance : ${data.name ?? ""}`, start: data.next_action_date ?? "", end: data.next_action_date ?? "", allDay: true, sourceUrl: `${baseUrl}/protected/dossiers/${id}` },
    });
  }

  revalidatePath("/protected/dossiers");
  revalidatePath(`/protected/dossiers/${id}`);
  return { success: true, id };
}

export async function deleteDeal(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase.from("deals").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/protected/dossiers");
  return { success: true };
}

export async function getDealById(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("deals").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  return data;
}

// Pipeline investisseurs (investor_commitments) : retiré au pivot M&A (2026-07-20).
// Le CRUD des engagements est extrait vers _extraction-fundraising-2026-07-20/.

// Documents deal : supprimés (V49). La table deal_documents a été droppée
// au profit de ma_documents + Supabase Storage. Voir actions/documents.ts.

// ── Liaison deal ↔ organisation ───────────────────────────────────────────────

export async function linkOrganisationToDeal(dealId: string, organisationId: string, roleInDossier?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase.from("deal_organizations")
    .upsert({
      deal_id: dealId,
      organization_id: organisationId,
      user_id: user.id,
      role_in_dossier: roleInDossier ?? "autre",
    }, { onConflict: "deal_id,organization_id" });

  if (error) return { success: false, error: error.message };
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true };
}

export async function updateDealDirigeant(dealId: string, data: {
  dirigeant_id?: string | null;
  dirigeant_nom?: string | null;
  dirigeant_email?: string | null;
  dirigeant_telephone?: string | null;
  dirigeant_titre?: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase.from("deals")
    .update({
      dirigeant_id: data.dirigeant_id ?? null,
      dirigeant_nom: data.dirigeant_nom ?? null,
      dirigeant_email: data.dirigeant_email ?? null,
      dirigeant_telephone: data.dirigeant_telephone ?? null,
      dirigeant_titre: data.dirigeant_titre ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dealId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true };
}

export async function updateDealOrgRole(dealId: string, organisationId: string, role: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase.from("deal_organizations")
    .update({ role_in_dossier: role })
    .eq("deal_id", dealId)
    .eq("organization_id", organisationId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true };
}

export async function unlinkOrganisationFromDeal(dealId: string, organisationId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase.from("deal_organizations")
    .delete().eq("deal_id", dealId).eq("organization_id", organisationId).eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true };
}

/**
 * Server Action dédiée au kanban : déplace un dossier d'un stage à un autre.
 * Pas de side-effect GCal (le stage ne génère pas d'événement).
 */
export async function updateDealStageAction(
  dealId: string,
  newStage: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  // V55 : validation du stade contre la séquence du type de dossier.
  // On charge deal_type puis on compare avec DEAL_STAGES_BY_TYPE.
  const { data: deal } = await supabase
    .from("deals")
    .select("deal_type")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!deal) return { success: false, error: "Dossier introuvable" };

  const { isValidStageForType } = await import("@/lib/crm/matching-maps");
  if (!isValidStageForType(deal.deal_type, newStage)) {
    return { success: false, error: `Stade "${newStage}" non valide pour ce type de dossier` };
  }

  const { error } = await supabase.from("deals")
    .update({ deal_stage: newStage, updated_at: new Date().toISOString() })
    .eq("id", dealId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/protected/dossiers");
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true };
}

// ── updateDealField ─────────────────────────────────────────────────────────
// Mise à jour générique d'un champ unique sur deals. Utilisée par les
// composants EditableField pour de l'édition inline sécurisée.
// Whitelist explicite des champs autorisés pour éviter les modifications
// non prévues. Validation de type minimale par champ.

const NUMBER_FIELDS = new Set<string>([
  "target_amount",
  "asking_price_min", "asking_price_max",
  "acquisition_budget_min", "acquisition_budget_max",
  "target_revenue_min", "target_revenue_max",
  "target_ev_min", "target_ev_max",
  // Honoraires (v65) — confirmed_fee_amount exclu : maintenu par trigger DB.
  "estimated_fee_amount", "retainer_monthly",
  "success_fee_percent", "operation_amount",
]);

const TEXT_FIELDS = new Set<string>([
  "name", "description", "sector", "location",
  "management_retention_notes", "strategic_rationale",
]);

const DATE_FIELDS = new Set<string>([
  "start_date", "target_date", "next_action_date",
]);

const SELECT_FIELDS = new Set<string>([
  "deal_status", "priority_level", "currency",
  "deal_timing", "deal_context", "company_stage", "company_geography",
  "target_stage",
  "success_fee_base",
]);

const EDITABLE_FIELDS = new Set<string>([
  ...NUMBER_FIELDS, ...TEXT_FIELDS, ...DATE_FIELDS, ...SELECT_FIELDS,
]);

export async function updateDealField(
  dealId: string,
  field: string,
  value: string | number | null,
): Promise<{ success: true } | { success: false; error: string }> {
  if (!EDITABLE_FIELDS.has(field)) {
    return { success: false, error: `Champ non éditable : ${field}` };
  }

  // Coercion par type
  let coerced: string | number | null = null;
  if (value !== null && value !== "") {
    if (NUMBER_FIELDS.has(field)) {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) return { success: false, error: "Valeur numérique invalide" };
      coerced = n;
    } else if (DATE_FIELDS.has(field)) {
      const s = String(value).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { success: false, error: "Date invalide (YYYY-MM-DD)" };
      coerced = s;
    } else {
      coerced = String(value);
    }
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase
    .from("deals")
    .update({ [field]: coerced, updated_at: new Date().toISOString() })
    .eq("id", dealId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/protected/dossiers");
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true };
}
