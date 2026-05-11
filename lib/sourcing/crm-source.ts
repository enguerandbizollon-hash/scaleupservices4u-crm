/**
 * lib/sourcing/crm-source.ts — Source de sourcing CRM interne (S2)
 *
 * Interroge la table organizations du user pour trouver des acteurs déjà
 * qualifiés qui correspondent à un segment. La source CRM est très rapide
 * (SQL local, pas d'API externe) et retourne des acteurs que l'équipe
 * connaît déjà, donc a priori plus pertinents qu'Apollo sur le même segment.
 *
 * Règles de filtrage :
 *   - Exclut les orgs déjà marquées is_merged, inactive, ou déjà suggérées
 *     pour ce même dossier (status non rejected ni contacted)
 *   - Filtre par organization_type via ACTOR_TYPE_TO_ORG_TYPE
 *   - Filtre par employee_count range
 *   - Filtre post-fetch sur keywords (OR sur name/description/sector)
 *   - Filtre post-fetch sur géographie (location ILIKE)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeOrganizationName, extractDomain } from "@/lib/connectors/base";
import {
  ACTOR_TYPE_TO_ORG_TYPE,
  computeUniqueKey,
  type SourcingCandidate,
  type SourcingCandidateContact,
  type SourcingExecutionContext,
} from "./engine";
import type { SourcingSegment } from "@/lib/ai/sourcing-strategy";

export async function executeCrmSource(
  segment: SourcingSegment,
  context: SourcingExecutionContext,
): Promise<SourcingCandidate[]> {
  const supabase = createAdminClient();

  // 1. Charger les IDs d'orgs déjà suggérées pour ce dossier (à exclure)
  const { data: existingSuggestions } = await supabase
    .from("deal_target_suggestions")
    .select("organization_id")
    .eq("deal_id", context.dealId)
    .eq("user_id", context.userId)
    .not("status", "in", '("rejected","contacted")');

  const excludedOrgIds = new Set(
    (existingSuggestions ?? []).map((r) => r.organization_id).filter(Boolean) as string[],
  );

  // 2. Exclure aussi l'org cliente du dossier elle-même (la société traitée)
  const { data: deal } = await supabase
    .from("deals")
    .select("organization_id")
    .eq("id", context.dealId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (deal?.organization_id) excludedOrgIds.add(deal.organization_id);

  // 3. Requête principale sur organizations
  const orgTypes = ACTOR_TYPE_TO_ORG_TYPE[segment.actor_type];

  let query = supabase
    .from("organizations")
    .select(`
      id, name, normalized_name, website, linkedin_url,
      organization_type, sector, location, description,
      employee_count, base_status, is_merged, external_ids,
      organization_contacts (
        contacts ( id, first_name, last_name, email, title, linkedin_url )
      )
    `)
    .eq("user_id", context.userId)
    .eq("is_merged", false)
    .neq("base_status", "inactive");

  if (orgTypes.length > 0) {
    query = query.in("organization_type", orgTypes);
  }

  if (segment.employee_min != null) query = query.gte("employee_count", segment.employee_min);
  if (segment.employee_max != null) query = query.lte("employee_count", segment.employee_max);

  // Limite souple ; le filtrage fin se fait post-fetch
  query = query.limit(100);

  const { data: orgs, error } = await query;
  if (error || !orgs) return [];

  // 4. Filtrage applicatif : keywords + géo + exclusion
  const keywordsLower = segment.keywords.map((k) => k.toLowerCase());
  const geosLower = segment.geographies.map((g) => g.toLowerCase());

  const matchesKeyword = (org: typeof orgs[number]): boolean => {
    if (keywordsLower.length === 0) return true;
    const haystack = [org.name, org.description, org.sector]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return keywordsLower.some((k) => haystack.includes(k));
  };

  const matchesGeo = (org: typeof orgs[number]): boolean => {
    if (geosLower.length === 0) return true;
    const loc = (org.location ?? "").toLowerCase();
    if (!loc) return true;  // sans géo en base, on accepte pour ne pas trop filtrer
    return geosLower.some((g) => loc.includes(g) || matchFrenchCity(g, loc));
  };

  const filtered = orgs
    .filter((org) => !excludedOrgIds.has(org.id))
    .filter(matchesKeyword)
    .filter(matchesGeo);

  // 5. Transformation vers SourcingCandidate
  return filtered.map((org) => {
    const normalized = org.normalized_name ?? normalizeOrganizationName(org.name);
    const domain = extractDomain(org.website);
    const externalIds = (org.external_ids ?? {}) as Record<string, unknown>;
    const apolloId = typeof externalIds.apollo === "string" ? externalIds.apollo : null;
    const harmonicId = typeof externalIds.harmonic === "string" ? externalIds.harmonic : null;

    const contactsRaw = (org.organization_contacts ?? [])
      .flatMap((oc) => (Array.isArray(oc.contacts) ? oc.contacts : [oc.contacts]))
      .filter((c): c is NonNullable<typeof c> => c !== null && c !== undefined)
      .slice(0, 3);

    const contacts: SourcingCandidateContact[] = contactsRaw.map((c) => ({
      contact_id: c.id,
      first_name: c.first_name ?? "",
      last_name: c.last_name ?? "",
      email: c.email,
      title: c.title,
      linkedin_url: c.linkedin_url,
      source: "crm",
    }));

    return {
      unique_key: computeUniqueKey(normalized, apolloId, domain),
      name: org.name,
      website: org.website,
      linkedin_url: org.linkedin_url,
      normalized_name: normalized,
      domain,
      organization_type: org.organization_type,
      sector: org.sector,
      location: org.location,
      description: org.description,
      employee_count: org.employee_count,
      existing_org_id: org.id,
      apollo_id: apolloId,
      harmonic_id: harmonicId,
      sources: ["crm"],
      segment_name: segment.name,
      segment_priority: segment.priority,
      contacts,
    };
  });
}

// Matching géographique étendu pour les villes françaises principales quand
// le code est "france" (la fiche org contient souvent une ville, pas "France").
function matchFrenchCity(geoCode: string, locationLower: string): boolean {
  if (geoCode !== "france") return false;
  const cities = ["paris", "lyon", "marseille", "bordeaux", "lille", "toulouse", "nice", "nantes", "strasbourg", "rennes", "montpellier"];
  return cities.some((c) => locationLower.includes(c));
}
