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
  mandate_id?: string | null;
  // Recrutement
  job_title?: string | null;
  required_seniority?: string | null;
  required_location?: string | null;
  required_remote?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  // Fundraising
  pre_money_valuation?: number | null;
  post_money_valuation?: number | null;
  use_of_funds?: string | null;
  runway_months?: number | null;
  current_investors?: string | null;
  round_type?: string | null;
  // M&A Sell-side
  asking_price_min?: number | null;
  asking_price_max?: number | null;
  partial_sale_ok?: boolean;
  management_retention?: boolean;
  deal_timing?: string | null;
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

export interface CommitmentInput {
  organization_id?: string | null;
  amount?: number | null;
  currency?: string;
  status?: string;
  committed_at?: string | null;
  notes?: string | null;
}

export interface DocumentInput {
  name: string;
  document_type?: string;
  document_status?: string;
  document_url?: string | null;
  version_label?: string | null;
  note?: string | null;
}

// ── Simple list (autocomplete) ────────────────────────────────────────────────

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
    deal_type:      data.deal_type    ?? "fundraising",
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
    mandate_id:        data.mandate_id        ?? null,
    // Recrutement
    job_title:          data.job_title          ?? null,
    required_seniority: data.required_seniority ?? null,
    required_location:  data.required_location  ?? null,
    required_remote:    data.required_remote    ?? null,
    salary_min:         data.salary_min         ?? null,
    salary_max:         data.salary_max         ?? null,
    // Fundraising
    pre_money_valuation:  data.pre_money_valuation  ?? null,
    post_money_valuation: data.post_money_valuation ?? null,
    use_of_funds:         data.use_of_funds         ?? null,
    runway_months:        data.runway_months         ?? null,
    current_investors:    data.current_investors     ?? null,
    round_type:           data.round_type            ?? null,
    // M&A Sell-side
    asking_price_min:     data.asking_price_min     ?? null,
    asking_price_max:     data.asking_price_max     ?? null,
    partial_sale_ok:      data.partial_sale_ok      ?? true,
    management_retention: data.management_retention ?? true,
    deal_timing:          data.deal_timing          ?? null,
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

  // M5 trigger RH : deal_status → won → flaguer candidats non-closing
  if (data.deal_status === "won") {
    const { data: current } = await supabase
      .from("deals").select("deal_status").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (current && current.deal_status !== "won") {
      await supabase.from("deal_candidates")
        .update({ needs_review: true })
        .eq("deal_id", id)
        .neq("stage", "closing");
    }
  }

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

// ── Pipeline — investor_commitments ──────────────────────────────────────────

export async function createCommitment(dealId: string, data: CommitmentInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "Non autorisé" };

  const { data: commitment, error } = await supabase
    .from("investor_commitments").insert({
      deal_id:         dealId,
      user_id:         user.id,
      organization_id: data.organization_id ?? null,
      amount:          data.amount          ?? null,
      currency:        data.currency        ?? "EUR",
      status:          data.status          ?? "indication",
      committed_at:    data.committed_at    ?? null,
      notes:           data.notes           ?? null,
    })
    .select("id,amount,currency,status,committed_at,notes,organization_id,organizations(name)")
    .single();

  if (error) return { success: false as const, error: error.message };
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true as const, data: commitment };
}

export async function updateCommitment(
  dealId: string,
  commitmentId: string,
  updates: Partial<CommitmentInput>,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "Non autorisé" };

  const payload: Record<string, unknown> = {};
  if (updates.organization_id !== undefined) payload.organization_id = updates.organization_id;
  if (updates.amount          !== undefined) payload.amount          = updates.amount ? Number(updates.amount) : null;
  if (updates.currency        !== undefined) payload.currency        = updates.currency;
  if (updates.status          !== undefined) payload.status          = updates.status;
  if (updates.committed_at    !== undefined) payload.committed_at    = updates.committed_at;
  if (updates.notes           !== undefined) payload.notes           = updates.notes;

  const { data, error } = await supabase
    .from("investor_commitments")
    .update(payload)
    .eq("id", commitmentId)
    .eq("deal_id", dealId)
    .eq("user_id", user.id)
    .select("id,amount,currency,status,committed_at,notes,organization_id,organizations(name)")
    .single();

  if (error) return { success: false as const, error: error.message };
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true as const, data };
}

export async function deleteCommitment(dealId: string, commitmentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase
    .from("investor_commitments")
    .delete()
    .eq("id", commitmentId)
    .eq("deal_id", dealId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true };
}

// ── Documents deal ────────────────────────────────────────────────────────────

export async function createDealDocument(dealId: string, data: DocumentInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "Non autorisé" };
  if (!data.name?.trim()) return { success: false as const, error: "Nom requis" };

  const { data: doc, error } = await supabase.from("deal_documents").insert({
    deal_id:         dealId,
    user_id:         user.id,
    name:            data.name.trim(),
    document_type:   data.document_type   ?? "other",
    document_status: data.document_status ?? "received",
    document_url:    data.document_url    ?? null,
    version_label:   data.version_label   ?? null,
    note:            data.note            ?? null,
    added_at:        new Date().toISOString(),
  }).select("id,name,document_type,document_status,document_url,version_label,added_at,note").single();

  if (error) return { success: false as const, error: error.message };
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true as const, data: doc };
}

export async function updateDealDocument(
  dealId: string,
  documentId: string,
  updates: Partial<DocumentInput>,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase.from("deal_documents")
    .update(updates)
    .eq("id", documentId)
    .eq("deal_id", dealId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true };
}

export async function deleteDealDocument(dealId: string, documentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase.from("deal_documents")
    .delete().eq("id", documentId).eq("deal_id", dealId).eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true };
}

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
