"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { NotificationRow } from "@/lib/crm/notifications";

// Liste les notifications de l'utilisateur courant.
// Par défaut : non lues d'abord, limit 50.
export async function listNotifications(opts?: {
  onlyUnread?: boolean;
  limit?: number;
}): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const limit = opts?.limit ?? 50;

  let q = supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts?.onlyUnread) q = q.is("read_at", null);

  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as NotificationRow[];
}

// Compteur non lues pour le badge sidebar.
export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}

export async function markAsRead(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) return { ok: false };
  revalidatePath("/protected");
  return { ok: true };
}

export async function markAllAsRead(): Promise<{ ok: boolean; count: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
    .select("id");
  if (error) return { ok: false, count: 0 };
  revalidatePath("/protected");
  return { ok: true, count: data?.length ?? 0 };
}
