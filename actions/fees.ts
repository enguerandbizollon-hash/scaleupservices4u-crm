"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { syncToGCal } from "@/lib/gcal/sync-helper";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FeeInput {
  /** Clé de rattachement depuis v65 : les jalons appartiennent au dossier. */
  deal_id?: string | null;
  /** Transitoire : disparaît avec l'entité mandat (temps 5, commit 3). */
  mandate_id?: string | null;
  name: string;
  milestone_type: string;   // retainer|success_fee|fixed|expense
  amount: number;
  currency?: string;
  due_date?: string | null;
  notes?: string | null;
  status?: string;          // pending|invoiced|paid|cancelled
  ticket_amount?: number | null;  // tranche d'opération (base calcul success fee)
}

export type FeeActionResult =
  | { success: true; id: string }
  | { success: false; error: string };

// NOTE : deals.confirmed_fee_amount est maintenu par le trigger DB
// tr_fee_milestones_recompute_deal_fee (v65, recalcul complet sur
// INSERT/UPDATE/DELETE). Aucun recalcul applicatif ici — source unique.

function revalidateFeePaths(dealId?: string | null, mandateId?: string | null) {
  if (dealId) revalidatePath(`/protected/dossiers/${dealId}`);
  if (mandateId) revalidatePath(`/protected/mandats/${mandateId}`);
}

// ── CRUD jalons ────────────────────────────────────────────────────────────────

export async function createFee(data: FeeInput): Promise<FeeActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  if (!data.name?.trim())                    return { success: false, error: "Nom du jalon requis" };
  if (!data.deal_id && !data.mandate_id)     return { success: false, error: "Dossier requis" };
  if (!(data.amount > 0))                    return { success: false, error: "Montant invalide" };

  const { data: milestone, error } = await supabase.from("fee_milestones").insert({
    user_id:        user.id,
    deal_id:        data.deal_id        ?? null,
    mandate_id:     data.mandate_id     ?? null,
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
    const sourceUrl = data.deal_id
      ? `${baseUrl}/protected/dossiers/${data.deal_id}`
      : `${baseUrl}/protected/mandats/${data.mandate_id}`;
    syncToGCal({
      action: "create", source_type: "fee_milestone", source_id: milestone.id,
      event: { summary: `Jalon : ${data.name}`, start: data.due_date, end: data.due_date, allDay: true, sourceUrl },
    });
  }

  revalidateFeePaths(data.deal_id, data.mandate_id);
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
    const today = new Date().toISOString().split("T")[0];
    // Dates cohérentes avec le statut, y compris en cas de retour arrière :
    // paid → pose paid_date (facture conservée si paiement direct) ;
    // invoiced → pose invoiced_date, efface paid_date ;
    // pending → efface les deux ; cancelled → efface paid_date, garde la facture.
    if (data.status === "paid") {
      payload.paid_date = today;
    } else if (data.status === "invoiced") {
      payload.invoiced_date = today;
      payload.paid_date = null;
    } else {
      payload.paid_date = null;
      if (data.status === "pending") payload.invoiced_date = null;
    }
  }
  // Overrides explicites du caller — prioritaires sur les dates dérivées du statut.
  if (data.invoiced_date !== undefined) payload.invoiced_date = data.invoiced_date;
  if (data.paid_date     !== undefined) payload.paid_date     = data.paid_date;

  // Rattachements pour revalidation des pages concernées
  const { data: existing } = await supabase
    .from("fee_milestones").select("deal_id, mandate_id").eq("id", id).eq("user_id", user.id).maybeSingle();

  const { error } = await supabase.from("fee_milestones")
    .update(payload).eq("id", id).eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidateFeePaths(existing?.deal_id, existing?.mandate_id);

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
    .from("fee_milestones").select("deal_id, mandate_id").eq("id", id).eq("user_id", user.id).maybeSingle();

  const { error } = await supabase.from("fee_milestones").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { success: false, error: error.message };

  revalidateFeePaths(existing?.deal_id, existing?.mandate_id);
  return { success: true };
}

// ── Lectures ───────────────────────────────────────────────────────────────────

export async function getFeesByDeal(dealId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("fee_milestones")
    .select("id,name,milestone_type,amount,currency,status,due_date,invoiced_date,paid_date,notes,ticket_amount")
    .eq("deal_id", dealId)
    .eq("user_id", user.id)
    .order("due_date", { ascending: true, nullsFirst: false });

  return data ?? [];
}

/** Transitoire : consommé par la fiche mandat, supprimé avec elle (commit 3). */
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
