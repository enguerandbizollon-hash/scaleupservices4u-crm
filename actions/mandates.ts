"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { syncToGCal } from "@/lib/gcal/sync-helper";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MandateInput {
  name: string;
  type: string;                        // fundraising|ma_sell|ma_buy|cfo_advisor|recruitment
  client_organization_id: string;
  status?: string;                     // draft|active|on_hold|won|lost|closed
  priority?: string;                   // low|medium|high
  owner_id?: string | null;
  description?: string | null;
  start_date?: string | null;
  target_close_date?: string | null;
  end_date?: string | null;
  currency?: string;
  estimated_fee_amount?: number | null;
  retainer_monthly?: number | null;
  success_fee_percent?: number | null;
  success_fee_base?: string | null;    // ev|revenue|raise_amount|salary
  operation_amount?: number | null;    // montant de l'opération sous-jacente (EV, levée, salaire…)
  notes?: string | null;
}

export type MandateActionResult =
  | { success: true; id: string }
  | { success: false; error: string };

// ── CRUD ───────────────────────────────────────────────────────────────────────

export async function createMandate(data: MandateInput): Promise<MandateActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const name = data.name?.trim();
  if (!name) return { success: false, error: "Nom obligatoire" };
  if (!data.client_organization_id) return { success: false, error: "Client obligatoire" };

  const { data: mandate, error } = await supabase.from("mandates").insert({
    user_id:                  user.id,
    name,
    type:                     data.type,
    client_organization_id:   data.client_organization_id,
    status:                   data.status                 ?? "draft",
    priority:                 data.priority               ?? "medium",
    owner_id:                 data.owner_id               ?? null,
    description:              data.description            ?? null,
    start_date:               data.start_date             ?? null,
    target_close_date:        data.target_close_date      ?? null,
    end_date:                 data.end_date               ?? null,
    currency:                 data.currency               ?? "EUR",
    estimated_fee_amount:     data.estimated_fee_amount   ?? null,
    confirmed_fee_amount:     0,
    retainer_monthly:         data.retainer_monthly       ?? null,
    success_fee_percent:      data.success_fee_percent    ?? null,
    success_fee_base:         data.success_fee_base       ?? null,
    operation_amount:         data.operation_amount       ?? null,
    notes:                    data.notes                  ?? null,
  }).select("id").single();

  if (error) return { success: false, error: error.message };

  // Sync GCal closing mandat
  if (data.target_close_date) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    syncToGCal({
      action: "create", source_type: "mandate_closing", source_id: mandate.id,
      event: { summary: `Closing mandat : ${data.name}`, start: data.target_close_date, end: data.target_close_date, allDay: true, sourceUrl: `${baseUrl}/protected/mandats/${mandate.id}` },
    });
  }

  revalidatePath("/protected/mandats");
  return { success: true, id: mandate.id };
}

export async function updateMandate(id: string, data: Partial<MandateInput>): Promise<MandateActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name                   !== undefined) payload.name                   = data.name?.trim();
  if (data.type                   !== undefined) payload.type                   = data.type;
  if (data.status                 !== undefined) payload.status                 = data.status;
  if (data.priority               !== undefined) payload.priority               = data.priority;
  if (data.owner_id               !== undefined) payload.owner_id               = data.owner_id;
  if (data.description            !== undefined) payload.description            = data.description;
  if (data.start_date             !== undefined) payload.start_date             = data.start_date;
  if (data.target_close_date      !== undefined) payload.target_close_date      = data.target_close_date;
  if (data.end_date               !== undefined) payload.end_date               = data.end_date;
  if (data.currency               !== undefined) payload.currency               = data.currency;
  if (data.estimated_fee_amount   !== undefined) payload.estimated_fee_amount   = data.estimated_fee_amount;
  if (data.retainer_monthly       !== undefined) payload.retainer_monthly       = data.retainer_monthly;
  if (data.success_fee_percent    !== undefined) payload.success_fee_percent    = data.success_fee_percent;
  if (data.success_fee_base       !== undefined) payload.success_fee_base       = data.success_fee_base;
  if (data.operation_amount       !== undefined) payload.operation_amount       = data.operation_amount;
  if (data.notes                  !== undefined) payload.notes                  = data.notes;
  if (data.client_organization_id !== undefined) payload.client_organization_id = data.client_organization_id;

  const { error } = await supabase.from("mandates")
    .update(payload).eq("id", id).eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  // Sync GCal closing mandat
  if (data.target_close_date !== undefined) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    syncToGCal({
      action: data.target_close_date ? "update" : "delete",
      source_type: "mandate_closing", source_id: id,
      event: { summary: `Closing mandat : ${data.name ?? ""}`, start: data.target_close_date ?? "", end: data.target_close_date ?? "", allDay: true, sourceUrl: `${baseUrl}/protected/mandats/${id}` },
    });
  }

  revalidatePath("/protected/mandats");
  revalidatePath(`/protected/mandats/${id}`);
  return { success: true, id };
}

export async function deleteMandate(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase.from("mandates").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/protected/mandats");
  return { success: true };
}

// ── Lectures ───────────────────────────────────────────────────────────────────

export async function getAllMandates() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("mandates")
    .select(`
      id, name, type, status, priority, currency,
      start_date, target_close_date,
      estimated_fee_amount, confirmed_fee_amount, retainer_monthly, success_fee_percent,
      client_organization_id,
      organizations:client_organization_id(id, name)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []).map((m: any) => ({
    ...m,
    client_name: Array.isArray(m.organizations) ? m.organizations[0]?.name : m.organizations?.name,
  }));
}

export async function getMandateById(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("mandates")
    .select(`
      *,
      organizations:client_organization_id(id, name)
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return null;
  return {
    ...data,
    client_name: Array.isArray(data.organizations) ? data.organizations[0]?.name : (data.organizations as any)?.name,
    client_id:   Array.isArray(data.organizations) ? data.organizations[0]?.id  : (data.organizations as any)?.id,
  };
}

export async function getMandatesByClient(clientOrganizationId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("mandates")
    .select("id, name, type, status, estimated_fee_amount, confirmed_fee_amount, currency, start_date, target_close_date")
    .eq("client_organization_id", clientOrganizationId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return data ?? [];
}
