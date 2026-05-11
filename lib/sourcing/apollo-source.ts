/**
 * lib/sourcing/apollo-source.ts — Source de sourcing Apollo.io (S2)
 *
 * Wrapper autour de lib/connectors/apollo.ts qui exécute une recherche pour
 * un segment donné. Apollo upserte les orgs + contacts dans la base, on
 * recharge ensuite le profil complet pour le transformer en SourcingCandidate
 * aligné avec la source CRM.
 *
 * Limite dure : max 25 orgs Apollo par segment pour contrôler le coût et
 * rester dans les quotas du plan Apollo.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { runApolloSearchForDeal } from "@/lib/connectors/apollo";
import { normalizeOrganizationName, extractDomain } from "@/lib/connectors/base";
import {
  computeUniqueKey,
  type SourcingCandidate,
  type SourcingCandidateContact,
  type SourcingExecutionContext,
} from "./engine";
import type { SourcingSegment } from "@/lib/ai/sourcing-strategy";

export async function executeApolloSource(
  segment: SourcingSegment,
  context: SourcingExecutionContext,
): Promise<SourcingCandidate[]> {
  const supabase = createAdminClient();

  // 1. Appel Apollo via le connecteur (upsert orgs + contacts décideurs)
  const apolloResult = await runApolloSearchForDeal({
    userId: context.userId,
    dealId: context.dealId,
    criteria: {
      keywords: segment.keywords,
      geographies: segment.geographies,
      employee_min: segment.employee_min ?? undefined,
      employee_max: segment.employee_max ?? undefined,
      per_page: 25,
      page: 1,
    },
    contactsPerOrg: 3,
    triggeredBy: "manual",
  });

  if (apolloResult.status !== "success") return [];
  if (apolloResult.orgsUpserted.length === 0) return [];

  // 2. Recharger les orgs upsertées avec profil complet + contacts liés
  const orgIds = apolloResult.orgsUpserted.map((o) => o.orgId);

  const { data: orgs, error } = await supabase
    .from("organizations")
    .select(`
      id, name, normalized_name, website, linkedin_url,
      organization_type, sector, location, description,
      employee_count, external_ids,
      organization_contacts (
        contacts ( id, first_name, last_name, email, title, linkedin_url )
      )
    `)
    .in("id", orgIds);

  if (error || !orgs) return [];

  // 3. Transformation
  return orgs.map((org) => {
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
      source: "apollo",
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
      existing_org_id: org.id,  // Apollo upserte → l'org est toujours en base
      apollo_id: apolloId,
      harmonic_id: harmonicId,
      sources: ["apollo"],
      segment_name: segment.name,
      segment_priority: segment.priority,
      contacts,
    };
  });
}
