"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ObjectType = "organisation" | "contact" | "deal" | "candidate" | "mandate";

export interface TagInput {
  name: string;
  category?: string;
  color?: string;
}

export interface Tag {
  id: string;
  name: string;
  category: string;
  color: string;
  created_at: string;
}

// ── Tags CRUD ─────────────────────────────────────────────────────────────────

export async function createTag(data: TagInput): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const name = data.name?.trim();
  if (!name) return { success: false, error: "Nom obligatoire" };

  // Upsert : si le tag existe déjà (même nom, même user), on le retourne
  const { data: existing } = await supabase
    .from("tags")
    .select("id")
    .eq("user_id", user.id)
    .ilike("name", name)
    .maybeSingle();

  if (existing) return { success: true, id: existing.id };

  const { data: tag, error } = await supabase.from("tags").insert({
    user_id:  user.id,
    name,
    category: data.category ?? "autre",
    color:    data.color    ?? "#6B7280",
  }).select("id").single();

  if (error) return { success: false, error: error.message };
  return { success: true, id: tag.id };
}

export async function deleteTag(tagId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  // CASCADE supprime automatiquement les object_tags liés
  const { error } = await supabase.from("tags").delete().eq("id", tagId).eq("user_id", user.id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function getAllTags(): Promise<Tag[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("tags")
    .select("id,name,category,color,created_at")
    .eq("user_id", user.id)
    .order("name");

  return (data ?? []) as Tag[];
}

// ── Liaison tag ↔ objet ───────────────────────────────────────────────────────

export async function addTagToObject(
  tagId: string,
  objectType: ObjectType,
  objectId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase.from("object_tags").upsert(
    { user_id: user.id, tag_id: tagId, object_type: objectType, object_id: objectId },
    { onConflict: "user_id,tag_id,object_type,object_id" },
  );

  if (error) return { success: false, error: error.message };
  revalidatePath(`/protected/${objectType}s/${objectId}`);
  return { success: true };
}

export async function removeTagFromObject(
  tagId: string,
  objectType: ObjectType,
  objectId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase.from("object_tags")
    .delete()
    .eq("tag_id", tagId)
    .eq("object_type", objectType)
    .eq("object_id", objectId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/protected/${objectType}s/${objectId}`);
  return { success: true };
}

/**
 * Retourne tous les tags attachés à un objet donné.
 */
export async function getTagsForObject(objectType: ObjectType, objectId: string): Promise<Tag[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("object_tags")
    .select("tags(id,name,category,color,created_at)")
    .eq("user_id", user.id)
    .eq("object_type", objectType)
    .eq("object_id", objectId);

  return (data ?? []).map((row: any) => {
    const t = Array.isArray(row.tags) ? row.tags[0] : row.tags;
    return t as Tag;
  }).filter(Boolean);
}

/**
 * Retourne tous les objets d'un type donnés qui ont TOUS les tags spécifiés (ET logique).
 * Utile pour les filtres de liste.
 */
export async function getObjectIdsByTags(
  objectType: ObjectType,
  tagIds: string[],
): Promise<string[]> {
  if (!tagIds.length) return [];

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("object_tags")
    .select("object_id, tag_id")
    .eq("user_id", user.id)
    .eq("object_type", objectType)
    .in("tag_id", tagIds);

  if (!data?.length) return [];

  // Garder les object_id qui ont TOUS les tags (intersection)
  const countByObject: Record<string, number> = {};
  for (const row of data) {
    countByObject[row.object_id] = (countByObject[row.object_id] ?? 0) + 1;
  }
  return Object.entries(countByObject)
    .filter(([, count]) => count === tagIds.length)
    .map(([id]) => id);
}

/**
 * Crée un tag et le lie immédiatement à un objet.
 * Raccourci pour le flux UX "nouveau tag + attacher".
 */
export async function createAndAttachTag(
  tagData: TagInput,
  objectType: ObjectType,
  objectId: string,
): Promise<{ success: boolean; tagId?: string; error?: string }> {
  const created = await createTag(tagData);
  if (!created.success || !created.id) return created;

  const linked = await addTagToObject(created.id, objectType, objectId);
  if (!linked.success) return linked;

  return { success: true, tagId: created.id };
}
