/**
 * lib/connectors/apollo.ts — Connecteur Apollo.io industrialisé (M2b)
 *
 * Cherche des organisations et contacts décideurs selon des critères
 * métier, puis upsert dans organizations + contacts + organization_contacts
 * avec déduplication triple : external_ids.apollo → normalized_name →
 * website/linkedin_url.
 *
 * Toutes les opérations sont tracées dans connector_runs pour debug,
 * contrôle budget et alerting.
 *
 * API Apollo v1 : https://apolloapi.com/docs/rest-api
 *   - POST /v1/mixed_companies/search  (orgs)
 *   - POST /v1/mixed_people/search     (contacts)
 *
 * Clé API : process.env.APOLLO_API_KEY
 *
 * Entry point principal : runApolloSearchForDeal()
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  extractDomain,
  employeeRangeForCompanyStage,
  finishConnectorRun,
  isPersonalEmailDomain,
  normalizeOrganizationName,
  startConnectorRun,
} from "./base";

// ── Types publics ────────────────────────────────────────────────────────────

export interface ApolloSearchCriteria {
  /** Noms de secteurs CRM (ex: "SaaS", "Fintech"). Seront passés en mots-clés. */
  sectors?: string[];
  /** Clés géo CRM (france, europe, etc.) traduites en locations Apollo. */
  geographies?: string[];
  /** Mots-clés libres additionnels. */
  keywords?: string[];
  /** Taille d'entreprise visée (mappée vers employee ranges Apollo). */
  company_stage?: string | null;
  /** Personnalisation explicite de la tranche employés si besoin. */
  employee_min?: number;
  employee_max?: number;
  /** Pagination. */
  per_page?: number;
  page?: number;
}

export interface ApolloRunResult {
  runId: string | null;
  status: "success" | "failure" | "partial";
  errorMessage?: string;
  orgsUpserted: Array<{ orgId: string; apolloId: string; created: boolean }>;
  contactsUpserted: Array<{ contactId: string; orgId: string; email: string | null; created: boolean }>;
  fetched: number;
}

// ── Mapping géographies CRM → chaînes Apollo ─────────────────────────────────

const GEO_TO_APOLLO: Record<string, string[]> = {
  france:         ["France"],
  suisse:         ["Switzerland"],
  dach:           ["Germany", "Austria", "Switzerland"],
  ue:             ["European Union"],
  europe:         ["Europe"],
  amerique_nord:  ["United States", "Canada"],
  amerique_sud:   ["Brazil", "Argentina", "Mexico"],
  asie:           ["Singapore", "Japan", "India", "Hong Kong"],
  moyen_orient:   ["United Arab Emirates", "Saudi Arabia", "Israel"],
  afrique:        ["South Africa", "Nigeria", "Morocco"],
  oceanie:        ["Australia"],
  global:         [],
};

function mapGeographies(geos: string[] | undefined): string[] {
  if (!geos?.length) return [];
  const out = new Set<string>();
  for (const g of geos) {
    for (const location of GEO_TO_APOLLO[g] ?? []) out.add(location);
  }
  return Array.from(out);
}

function employeeRangeString(stage: string | null | undefined, explicitMin?: number, explicitMax?: number): string[] {
  if (explicitMin || explicitMax) {
    const min = explicitMin ?? 1;
    const max = explicitMax ?? 10000;
    return [`${min},${max}`];
  }
  const range = employeeRangeForCompanyStage(stage);
  if (!range) return [];
  return [`${range[0]},${range[1]}`];
}

// ── Appels API Apollo ────────────────────────────────────────────────────────

interface ApolloOrganizationRaw {
  id: string;
  name: string;
  website_url?: string | null;
  linkedin_url?: string | null;
  primary_domain?: string | null;
  industry?: string | null;
  estimated_num_employees?: number | null;
  annual_revenue?: number | null;
  short_description?: string | null;
  city?: string | null;
  country?: string | null;
}

interface ApolloPersonRaw {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  email?: string | null;
  title?: string | null;
  seniority?: string | null;
  linkedin_url?: string | null;
  organization_id?: string | null;
}

async function apolloFetch<T>(endpoint: string, body: Record<string, unknown>): Promise<T | null> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(`https://api.apollo.io${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apollo ${res.status} ${endpoint}: ${text.slice(0, 200)}`);
  }

  return (await res.json()) as T;
}

async function searchOrganizations(criteria: ApolloSearchCriteria): Promise<ApolloOrganizationRaw[]> {
  const body: Record<string, unknown> = {
    page: criteria.page ?? 1,
    per_page: Math.min(criteria.per_page ?? 25, 100),
  };

  const geoLocations = mapGeographies(criteria.geographies);
  if (geoLocations.length) body.organization_locations = geoLocations;

  const employeeRanges = employeeRangeString(criteria.company_stage, criteria.employee_min, criteria.employee_max);
  if (employeeRanges.length) body.organization_num_employees_ranges = employeeRanges;

  const keywords = [...(criteria.sectors ?? []), ...(criteria.keywords ?? [])];
  if (keywords.length) body.q_organization_keyword_tags = keywords;

  const data = await apolloFetch<{ organizations?: ApolloOrganizationRaw[] }>(
    "/v1/mixed_companies/search",
    body,
  );
  return data?.organizations ?? [];
}

async function fetchContactsForOrganization(apolloOrgId: string, limit = 5): Promise<ApolloPersonRaw[]> {
  const body = {
    organization_ids: [apolloOrgId],
    person_seniorities: ["c_suite", "owner", "founder", "director", "partner"],
    per_page: Math.min(limit, 25),
    page: 1,
  };
  const data = await apolloFetch<{ people?: ApolloPersonRaw[] }>(
    "/v1/mixed_people/search",
    body,
  );
  return data?.people ?? [];
}

// ── Upsert organisation ──────────────────────────────────────────────────────

interface UpsertOrgResult {
  orgId: string;
  created: boolean;
}

async function upsertOrganizationFromApollo(
  supabase: SupabaseClient,
  userId: string,
  raw: ApolloOrganizationRaw,
): Promise<UpsertOrgResult | null> {
  if (!raw.name?.trim()) return null;

  // 1. Par external_ids.apollo (le plus fiable)
  const { data: byExt } = await supabase
    .from("organizations")
    .select("id, external_ids")
    .eq("user_id", userId)
    .contains("external_ids", { apollo: raw.id })
    .limit(1)
    .maybeSingle();

  if (byExt) {
    await enrichOrgIfEmpty(supabase, byExt.id, raw);
    return { orgId: byExt.id, created: false };
  }

  // 2. Par normalized_name
  const normalized = normalizeOrganizationName(raw.name);
  if (normalized) {
    const { data: byName } = await supabase
      .from("organizations")
      .select("id, external_ids")
      .eq("user_id", userId)
      .eq("normalized_name", normalized)
      .limit(1)
      .maybeSingle();

    if (byName) {
      await mergeApolloIdIntoOrg(supabase, byName.id, byName.external_ids, raw);
      await enrichOrgIfEmpty(supabase, byName.id, raw);
      return { orgId: byName.id, created: false };
    }
  }

  // 3. Par domaine website
  const domain = extractDomain(raw.website_url ?? raw.primary_domain ?? null);
  if (domain) {
    const { data: byDomain } = await supabase
      .from("organizations")
      .select("id, external_ids")
      .eq("user_id", userId)
      .ilike("website", `%${domain}%`)
      .limit(1)
      .maybeSingle();

    if (byDomain) {
      await mergeApolloIdIntoOrg(supabase, byDomain.id, byDomain.external_ids, raw);
      await enrichOrgIfEmpty(supabase, byDomain.id, raw);
      return { orgId: byDomain.id, created: false };
    }
  }

  // 4. Création
  const locationParts = [raw.city, raw.country].filter(Boolean) as string[];
  const { data: created, error } = await supabase
    .from("organizations")
    .insert({
      user_id: userId,
      name: raw.name,
      website: raw.website_url ?? null,
      linkedin_url: raw.linkedin_url ?? null,
      organization_type: "other",
      base_status: "to_qualify",
      sector: raw.industry ?? null,
      employee_count: raw.estimated_num_employees ?? null,
      location: locationParts.join(", ") || null,
      description: raw.short_description ?? null,
      external_ids: { apollo: raw.id },
    })
    .select("id")
    .single();

  if (error || !created) return null;
  return { orgId: created.id, created: true };
}

async function mergeApolloIdIntoOrg(
  supabase: SupabaseClient,
  orgId: string,
  currentExtIds: Record<string, unknown> | null | undefined,
  raw: ApolloOrganizationRaw,
): Promise<void> {
  const merged = { ...(currentExtIds ?? {}), apollo: raw.id };
  await supabase.from("organizations").update({ external_ids: merged }).eq("id", orgId);
}

async function enrichOrgIfEmpty(
  supabase: SupabaseClient,
  orgId: string,
  raw: ApolloOrganizationRaw,
): Promise<void> {
  const { data: existing } = await supabase
    .from("organizations")
    .select("website, linkedin_url, sector, description, employee_count, location")
    .eq("id", orgId)
    .maybeSingle();
  if (!existing) return;

  const updates: Record<string, unknown> = {};
  if (!existing.website && raw.website_url)            updates.website = raw.website_url;
  if (!existing.linkedin_url && raw.linkedin_url)      updates.linkedin_url = raw.linkedin_url;
  if (!existing.sector && raw.industry)                updates.sector = raw.industry;
  if (!existing.description && raw.short_description) updates.description = raw.short_description;
  if (!existing.employee_count && raw.estimated_num_employees) {
    updates.employee_count = raw.estimated_num_employees;
  }
  if (!existing.location) {
    const loc = [raw.city, raw.country].filter(Boolean).join(", ");
    if (loc) updates.location = loc;
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from("organizations").update(updates).eq("id", orgId);
  }
}

// ── Upsert contact ──────────────────────────────────────────────────────────

interface UpsertContactResult {
  contactId: string;
  created: boolean;
}

async function upsertContactFromApollo(
  supabase: SupabaseClient,
  userId: string,
  orgId: string,
  raw: ApolloPersonRaw,
): Promise<UpsertContactResult | null> {
  const firstName = (raw.first_name ?? raw.name?.split(" ")[0] ?? "").trim();
  const lastName  = (raw.last_name  ?? raw.name?.split(" ").slice(1).join(" ") ?? "").trim();
  if (!firstName && !lastName) return null;

  const email = raw.email?.trim().toLowerCase() || null;

  // Dédup 1 : email (si présent et B2B)
  if (email) {
    const domain = extractDomain(email);
    if (domain && !isPersonalEmailDomain(domain)) {
      const { data: byEmail } = await supabase
        .from("contacts")
        .select("id")
        .eq("user_id", userId)
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (byEmail) {
        await ensureContactLinkedToOrg(supabase, userId, byEmail.id, orgId);
        return { contactId: byEmail.id, created: false };
      }
    }
  }

  // Dédup 2 : first_name + last_name + org liée
  const { data: byName } = await supabase
    .from("contacts")
    .select("id, organization_contacts!inner(organization_id)")
    .eq("user_id", userId)
    .ilike("first_name", firstName)
    .ilike("last_name", lastName)
    .eq("organization_contacts.organization_id", orgId)
    .limit(1)
    .maybeSingle();

  if (byName) {
    return { contactId: byName.id, created: false };
  }

  // Création
  const { data: created, error } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      first_name: firstName || "—",
      last_name: lastName || "—",
      email: email,
      title: raw.title ?? null,
      linkedin_url: raw.linkedin_url ?? null,
      base_status: "to_qualify",
    })
    .select("id")
    .single();

  if (error || !created) return null;

  await ensureContactLinkedToOrg(supabase, userId, created.id, orgId);
  return { contactId: created.id, created: true };
}

async function ensureContactLinkedToOrg(
  supabase: SupabaseClient,
  userId: string,
  contactId: string,
  orgId: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from("organization_contacts")
    .select("id")
    .eq("contact_id", contactId)
    .eq("organization_id", orgId)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  await supabase
    .from("organization_contacts")
    .insert({
      user_id: userId,
      contact_id: contactId,
      organization_id: orgId,
      role_label: "décideur",
    });
}

// ── Entry point principal ───────────────────────────────────────────────────

// Exécute une recherche Apollo complète pour un dossier. Trace dans
// connector_runs. Retourne la liste des orgs/contacts upsertés pour que
// l'orchestrateur (M2e) puisse créer les deal_target_suggestions.
export async function runApolloSearchForDeal(params: {
  userId: string;
  dealId: string;
  criteria: ApolloSearchCriteria;
  triggeredBy?: "manual" | "cron" | "api";
  contactsPerOrg?: number;
}): Promise<ApolloRunResult> {
  const supabase = createAdminClient();

  const runId = await startConnectorRun(supabase, {
    userId: params.userId,
    sourceConnector: "apollo",
    dealId: params.dealId,
    triggeredBy: params.triggeredBy ?? "manual",
    queryParams: params.criteria as Record<string, unknown>,
  });

  const result: ApolloRunResult = {
    runId,
    status: "success",
    orgsUpserted: [],
    contactsUpserted: [],
    fetched: 0,
  };

  try {
    const apolloOrgs = await searchOrganizations(params.criteria);
    result.fetched = apolloOrgs.length;

    let created = 0;
    let updated = 0;

    for (const apolloOrg of apolloOrgs) {
      const upsert = await upsertOrganizationFromApollo(supabase, params.userId, apolloOrg);
      if (!upsert) continue;
      result.orgsUpserted.push({ orgId: upsert.orgId, apolloId: apolloOrg.id, created: upsert.created });
      if (upsert.created) created++; else updated++;

      // Récupérer les contacts décideurs (bornage pour contrôler le coût)
      const contactLimit = params.contactsPerOrg ?? 3;
      if (contactLimit > 0) {
        try {
          const apolloContacts = await fetchContactsForOrganization(apolloOrg.id, contactLimit);
          for (const apolloContact of apolloContacts) {
            const contactUpsert = await upsertContactFromApollo(
              supabase,
              params.userId,
              upsert.orgId,
              apolloContact,
            );
            if (contactUpsert) {
              result.contactsUpserted.push({
                contactId: contactUpsert.contactId,
                orgId: upsert.orgId,
                email: apolloContact.email ?? null,
                created: contactUpsert.created,
              });
            }
          }
        } catch (contactErr) {
          // Un échec sur les contacts n'empêche pas l'org d'être conservée
          console.error(`[apollo] contacts error for ${apolloOrg.id}:`, contactErr);
        }
      }
    }

    if (runId) {
      await finishConnectorRun(supabase, {
        runId,
        status: "success",
        recordsFetched: result.fetched,
        recordsCreated: created,
        recordsUpdated: updated,
        recordsSkipped: 0,
      });
    }

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue Apollo";
    result.status = "failure";
    result.errorMessage = msg;
    if (runId) {
      await finishConnectorRun(supabase, {
        runId,
        status: "failure",
        recordsFetched: result.fetched,
        errorMessage: msg,
      });
    }
    return result;
  }
}
