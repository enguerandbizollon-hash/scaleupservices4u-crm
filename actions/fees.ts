"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { syncToGCal } from "@/lib/gcal/sync-helper";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FeeInput {
  mandate_id: string;
  deal_id?: string | null;
  name: string;
  milestone_type: string;   // retainer|success_fee|fixed|expense
  amount: number;
  currency?: string;
  due_date?: string | null;
  notes?: string | null;
  status?: string;          // pending|invoiced|paid|cancelled
  ticket_amount?: number | null;  // tranche d'investissement (base calcul success fee)
}

export type FeeActionResult =
  | { success: true; id: string }
  | { success: false; error: string };

// ── CRUD jalons ────────────────────────────────────────────────────────────────

export async function createFee(data: FeeInput): Promise<FeeActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  if (!data.name?.trim())    return { success: false, error: "Nom du jalon requis" };
  if (!data.mandate_id)      return { success: false, error: "Mandat requis" };
  if (!(data.amount > 0))    return { success: false, error: "Montant invalide" };

  const { data: milestone, error } = await supabase.from("fee_milestones").insert({
    user_id:        user.id,
    mandate_id:     data.mandate_id,
    deal_id:        data.deal_id        ?? null,
    name:           data.name.trim(),
    milestone_type: data.milestone_type ?? "fixed",
    amount:         data.amount,
    currency:       data.currency       ?? "EUR",
    due_date:       data.due_date       ?? null,
    notes:          data.notes          ?? null,
    status:         data.status         ?? "pending",
    ticket_amount:  data.ticket_amount  ?? null,
  }).select("id").single();

  if (error) return { success: false, error: error.message };

  // Sync GCal jalon
  if (data.due_date) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    syncToGCal({
      action: "create", source_type: "fee_milestone", source_id: milestone.id,
      event: { summary: `Jalon : ${data.name}`, start: data.due_date, end: data.due_date, allDay: true, sourceUrl: `${baseUrl}/protected/mandats/${data.mandate_id}` },
    });
  }

  revalidatePath(`/protected/mandats/${data.mandate_id}`);
  return { success: true, id: milestone.id };
}

export async function updateFee(
  id: string,
  data: Partial<Pick<FeeInput, "name" | "amount" | "currency" | "due_date" | "notes" | "milestone_type" | "ticket_amount">> & { status?: string; invoiced_date?: string | null; paid_date?: string | null }
): Promise<FeeActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const payload: Record<string, unknown> = {};
  if (data.name           !== undefined) payload.name           = data.name?.trim();
  if (data.amount         !== undefined) payload.amount         = data.amount;
  if (data.currency       !== undefined) payload.currency       = data.currency;
  if (data.due_date       !== undefined) payload.due_date       = data.due_date;
  if (data.notes          !== undefined) payload.notes          = data.notes;
  if (data.milestone_type !== undefined) payload.milestone_type = data.milestone_type;
  if (data.ticket_amount  !== undefined) payload.ticket_amount  = data.ticket_amount;
  if (data.status         !== undefined) {
    payload.status = data.status;
    if (data.status === "invoiced") payload.invoiced_date = new Date().toISOString().split("T")[0];
    if (data.status === "paid")     payload.paid_date     = new Date().toISOString().split("T")[0];
  }

  // Récupérer le mandate_id pour revalidatePath
  const { data: existing } = await supabase
    .from("fee_milestones").select("mandate_id").eq("id", id).eq("user_id", user.id).maybeSingle();

  const { error } = await supabase.from("fee_milestones")
    .update(payload).eq("id", id).eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  if (existing?.mandate_id) {
    // Sync confirmed_fee_amount si statut paid
    if (data.status === "paid") {
      const { data: paidRows } = await supabase
        .from("fee_milestones")
        .select("amount")
        .eq("mandate_id", existing.mandate_id)
        .eq("user_id", user.id)
        .eq("status", "paid");
      const total = (paidRows ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
      await supabase.from("mandates")
        .update({ confirmed_fee_amount: total })
        .eq("id", existing.mandate_id)
        .eq("user_id", user.id);
    }
    revalidatePath(`/protected/mandats/${existing.mandate_id}`);
  }

  // Sync GCal jalon update
  if (data.due_date !== undefined) {
    syncToGCal({
      action: data.due_date ? "update" : "delete",
      source_type: "fee_milestone", source_id: id,
      event: { summary: `Jalon : ${data.name ?? ""}`, start: data.due_date ?? "", end: data.due_date ?? "", allDay: true },
    });
  }

  return { success: true, id };
}

export async function deleteFee(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { data: existing } = await supabase
    .from("fee_milestones").select("mandate_id").eq("id", id).eq("user_id", user.id).maybeSingle();

  const { error } = await supabase.from("fee_milestones").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { success: false, error: error.message };

  if (existing?.mandate_id) revalidatePath(`/protected/mandats/${existing.mandate_id}`);
  return { success: true };
}

// ── Lectures ───────────────────────────────────────────────────────────────────

export async function getFeesByMandate(mandateId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("fee_milestones")
    .select("id,name,milestone_type,amount,currency,status,due_date,invoiced_date,paid_date,notes,deal_id,ticket_amount")
    .eq("mandate_id", mandateId)
    .eq("user_id", user.id)
    .order("due_date", { ascending: true, nullsFirst: false });

  return data ?? [];
}

/** KPIs globaux fees pour le dashboard */
export async function getFeesKpis() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { pending: 0, invoiced: 0, paid_ytd: 0, currency: "EUR" };

  const year = new Date().getFullYear();

  const { data } = await supabase
    .from("fee_milestones")
    .select("amount, currency, status, paid_date")
    .eq("user_id", user.id)
    .neq("status", "cancelled");

  const rows = data ?? [];
  const pending    = rows.filter(r => r.status === "pending").reduce((s, r) => s + (r.amount ?? 0), 0);
  const invoiced   = rows.filter(r => r.status === "invoiced").reduce((s, r) => s + (r.amount ?? 0), 0);
  const paid_ytd   = rows
    .filter(r => r.status === "paid" && r.paid_date?.startsWith(String(year)))
    .reduce((s, r) => s + (r.amount ?? 0), 0);

  return { pending, invoiced, paid_ytd, currency: "EUR" };
}
