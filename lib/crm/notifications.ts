// Brique transversale : notifications in-app.
// Consommée aujourd'hui par le cron rappels d'actions (reminder_days).
// Réutilisable demain par les alertes RGPD (rgpd_expiry_date), les fees
// en retard (fee_milestones.due_date) et toute autre échéance.

import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationKind =
  | "action_reminder"
  | "rgpd_expiry"
  | "fee_overdue"
  | "task_due";

export type NotificationSourceType =
  | "action"
  | "fee_milestone"
  | "candidate"
  | "contact";

export interface NotificationInput {
  user_id: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  link_url?: string | null;
  source_type?: NotificationSourceType | null;
  source_id?: string | null;
  trigger_date: string; // YYYY-MM-DD
}

export interface NotificationRow {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  link_url: string | null;
  source_type: string | null;
  source_id: string | null;
  trigger_date: string;
  read_at: string | null;
  created_at: string;
}

// Insère une notification si elle n'existe pas déjà pour ce tuple
// (user_id, kind, source_type, source_id, trigger_date).
// Repose sur l'unique index uq_notifications_dedupe (migration v41).
export async function enqueueNotification(
  client: SupabaseClient,
  input: NotificationInput,
): Promise<{ inserted: boolean; error: string | null }> {
  const { error } = await client
    .from("notifications")
    .upsert(
      {
        user_id: input.user_id,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        link_url: input.link_url ?? null,
        source_type: input.source_type ?? null,
        source_id: input.source_id ?? null,
        trigger_date: input.trigger_date,
      },
      {
        onConflict: "user_id,kind,source_type,source_id,trigger_date",
        ignoreDuplicates: true,
      },
    );

  if (error) return { inserted: false, error: error.message };
  return { inserted: true, error: null };
}
