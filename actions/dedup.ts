"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { normalizeOrgName, extractDomain, type DuplicateCandidate } from "@/lib/dedup/organisations";

/**
 * Cherche les doublons potentiels pour une organisation (à la création ou édition).
 * Critères : normalized_name identique OU website (domaine) identique OU linkedin_url identique.
 * Exclut les orgs déjà fusionnées et l'org elle-même (si excludeId fourni).
 */
export async function checkDuplicates(
  name: string,
  website: string | null,
  linkedinUrl: string | null,
  excludeId?: string,
): Promise<DuplicateCandidate[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const normalized = normalizeOrgName(name);
  const domain = extractDomain(website);
  const candidates: DuplicateCandidate[] = [];
  const seenIds = new Set<string>();

  // 1. Chercher par normalized_name
  if (normalized.length >= 3) {
    const { data } = await supabase
      .from("organizations")
      .select("id, name, website, linkedin_url, normalized_name")
      .eq("user_id", user.id)
      .eq("normalized_name", normalized)
      .eq("is_merged", false)
      .limit(5);

    for (const row of data ?? []) {
      if (row.id === excludeId) continue;
      if (seenIds.has(row.id)) continue;
      seenIds.add(row.id);
      candidates.push({ ...row, matchType: "name" });
    }
  }

  // 2. Chercher par website (domaine)
  if (domain) {
    const { data } = await supabase
      .from("organizations")
      .select("id, name, website, linkedin_url, normalized_name")
      .eq("user_id", user.id)
      .eq("is_merged", false)
      .ilike("website", `%${domain}%`)
      .limit(5);

    for (const row of data ?? []) {
      if (row.id === excludeId) continue;
      if (seenIds.has(row.id)) continue;
      seenIds.add(row.id);
      candidates.push({ ...row, matchType: "website" });
    }
  }

  // 3. Chercher par linkedin_url
  if (linkedinUrl && linkedinUrl.length > 10) {
    const { data } = await supabase
      .from("organizations")
      .select("id, name, website, linkedin_url, normalized_name")
      .eq("user_id", user.id)
      .eq("is_merged", false)
      .eq("linkedin_url", linkedinUrl)
      .limit(5);

    for (const row of data ?? []) {
      if (row.id === excludeId) continue;
      if (seenIds.has(row.id)) continue;
      seenIds.add(row.id);
      candidates.push({ ...row, matchType: "linkedin" });
    }
  }

  return candidates;
}

/**
 * Fusionne org secondaire dans org maître.
 * - Toutes les FK (deals, contacts, actions, tags, commitments) pointent vers le maître
 * - L'org secondaire passe is_merged=true, merged_into_id=masterId
 */
export async function mergeOrganisations(
  masterId: string,
  secondaryId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };
  if (masterId === secondaryId) return { success: false, error: "Impossible de fusionner une org avec elle-même" };

  // Vérifier que les deux orgs existent et appartiennent à l'utilisateur
  const { data: master } = await supabase.from("organizations").select("id").eq("id", masterId).eq("user_id", user.id).maybeSingle();
  const { data: secondary } = await supabase.from("organizations").select("id").eq("id", secondaryId).eq("user_id", user.id).maybeSingle();
  if (!master || !secondary) return { success: false, error: "Organisation introuvable" };

  // Transférer les relations FK vers le maître
  const transfers = [
    supabase.from("deal_organizations").update({ organization_id: masterId }).eq("organization_id", secondaryId).eq("user_id", user.id),
    supabase.from("organization_contacts").update({ organization_id: masterId }).eq("organization_id", secondaryId),
    supabase.from("actions").update({ organization_id: masterId }).eq("organization_id", secondaryId).eq("user_id", user.id),
    supabase.from("investor_commitments").update({ organization_id: masterId }).eq("organization_id", secondaryId).eq("user_id", user.id),
    supabase.from("object_tags").update({ object_id: masterId }).eq("object_id", secondaryId).eq("object_type", "organisation"),
  ];

  const results = await Promise.allSettled(transfers);
  const errors = results.filter(r => r.status === "rejected").map(r => (r as PromiseRejectedResult).reason?.message);
  if (errors.length > 0) {
    return { success: false, error: `Erreurs lors du transfert : ${errors.join(", ")}` };
  }

  // Marquer l'org secondaire comme fusionnée
  const { error } = await supabase
    .from("organizations")
    .update({ is_merged: true, merged_into_id: masterId, base_status: "inactive" })
    .eq("id", secondaryId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/protected/organisations");
  revalidatePath(`/protected/organisations/${masterId}`);
  return { success: true };
}

/**
 * Liste tous les doublons potentiels (pour la page de dédup globale).
 * Retourne les groupes de normalized_name avec COUNT > 1.
 */
export async function getAllDuplicateGroups(): Promise<{
  groups: { normalized_name: string; orgs: { id: string; name: string; website: string | null; base_status: string }[] }[];
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { groups: [] };

  // Requête : orgs non-fusionnées, regroupées par normalized_name avec doublons
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, website, base_status, normalized_name")
    .eq("user_id", user.id)
    .eq("is_merged", false)
    .not("normalized_name", "is", null)
    .order("normalized_name");

  if (!orgs || orgs.length === 0) return { groups: [] };

  // Grouper par normalized_name
  const map = new Map<string, typeof orgs>();
  for (const o of orgs) {
    if (!o.normalized_name) continue;
    const list = map.get(o.normalized_name) ?? [];
    list.push(o);
    map.set(o.normalized_name, list);
  }

  // Garder seulement les groupes avec doublons
  const groups = Array.from(map.entries())
    .filter(([, list]) => list.length > 1)
    .map(([normalized_name, list]) => ({ normalized_name, orgs: list }));

  return { groups };
}
