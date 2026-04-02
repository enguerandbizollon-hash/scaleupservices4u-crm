"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
  excluded_geographies?: string[];
  target_stage?: string | null;
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

export interface TaskInput {
  title: string;
  task_type?: string;
  priority_level?: string;
  due_date?: string | null;
  due_time?: string | null;
  summary?: string | null;
  contact_ids?: string[];
  organization_id?: string | null;
}

export interface DocumentInput {
  name: string;
  document_type?: string;
  document_status?: string;
  document_url?: string | null;
  version_label?: string | null;
  note?: string | null;
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
    target_date:    data.target_date  ?? null,
    company_stage:     data.company_stage     ?? null,
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
    excluded_geographies:      data.excluded_geographies      ?? [],
    target_stage:              data.target_stage              ?? null,
  }).select("id").single();

  if (error) return { success: false, error: error.message };
  if (!deal?.id) return { success: false, error: "Erreur création dossier" };

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

// ── Tâches ────────────────────────────────────────────────────────────────────

const VALID_TASK_TYPES = [
  "todo","email_sent","email_received","call","meeting",
  "follow_up","intro","note","deck_sent","nda","document_sent","other",
];

export async function createTask(dealId: string, data: TaskInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "Non autorisé" };
  if (!data.title?.trim()) return { success: false as const, error: "Titre requis" };

  const { data: task, error } = await supabase.from("tasks").insert({
    deal_id:         dealId,
    user_id:         user.id,
    title:           data.title.trim(),
    task_type:       VALID_TASK_TYPES.includes(data.task_type ?? "") ? data.task_type : "todo",
    task_status:     "open",
    priority_level:  data.priority_level   ?? "medium",
    due_date:        data.due_date         ?? null,
    due_time:        data.due_time         ?? null,
    summary:         data.summary          ?? null,
    description:     data.summary          ?? null,
    contact_id:      data.contact_ids?.[0] ?? null,
    organization_id: data.organization_id  ?? null,
  }).select("*").single();

  if (error) return { success: false as const, error: error.message };

  if (data.contact_ids && data.contact_ids.length > 0 && task) {
    await supabase.from("task_contacts").insert(
      data.contact_ids.map(cid => ({ task_id: task.id, contact_id: cid, user_id: user.id }))
    );
  }

  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true as const, data: { ...task, contact_ids: data.contact_ids ?? [] } };
}

export async function updateTask(dealId: string, taskId: string, updates: Partial<TaskInput> & { task_status?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "Non autorisé" };

  const payload: Record<string, unknown> = {};
  if (updates.title        !== undefined) payload.title        = updates.title.trim();
  if (updates.task_type    !== undefined) payload.task_type    = VALID_TASK_TYPES.includes(updates.task_type) ? updates.task_type : "todo";
  if (updates.task_status  !== undefined) {
    payload.task_status = updates.task_status;
    if (updates.task_status === "done") payload.completed_at = new Date().toISOString();
  }
  if (updates.priority_level !== undefined) payload.priority_level = updates.priority_level;
  if (updates.due_date       !== undefined) payload.due_date       = updates.due_date;
  if (updates.due_time       !== undefined) payload.due_time       = updates.due_time;
  if (updates.summary        !== undefined) { payload.summary = updates.summary; payload.description = updates.summary; }

  const { data: task, error } = await supabase.from("tasks")
    .update(payload).eq("id", taskId).eq("deal_id", dealId).eq("user_id", user.id)
    .select("*").single();

  if (error) return { success: false as const, error: error.message };

  if (updates.contact_ids !== undefined) {
    await supabase.from("task_contacts").delete().eq("task_id", taskId);
    if (updates.contact_ids.length > 0) {
      await supabase.from("task_contacts").insert(
        updates.contact_ids.map(cid => ({ task_id: taskId, contact_id: cid, user_id: user.id }))
      );
    }
  }

  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true as const, data: task };
}

export async function deleteTask(dealId: string, taskId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase.from("tasks")
    .delete().eq("id", taskId).eq("deal_id", dealId).eq("user_id", user.id);

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

export async function linkOrganisationToDeal(dealId: string, organisationId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase.from("deal_organizations")
    .upsert({ deal_id: dealId, organization_id: organisationId, user_id: user.id }, { onConflict: "deal_id,organization_id" });

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
