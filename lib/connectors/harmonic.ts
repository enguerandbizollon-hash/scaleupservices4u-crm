/**
 * lib/connectors/harmonic.ts — Connecteur Harmonic.ai
 *
 * Harmonic est spécialisé sur les données de financement (cap tables,
 * tours, signaux de croissance). Particulièrement utile pour enrichir
 * les organisations investisseurs et les cibles startup/scale-up.
 *
 * API : GraphQL via https://api.harmonic.ai/graphql avec header
 * `apikey: <HARMONIC_API_KEY>`.
 *
 * Pattern aligné sur Apollo (cf. lib/connectors/apollo.ts) :
 *   - Identification par domaine en priorité, fallback nom.
 *   - Trace dans connector_runs.
 *   - Ne JAMAIS écraser un champ déjà rempli.
 *   - Retourne null si clé absente ou erreur réseau.
 *
 * Clé requise : HARMONIC_API_KEY
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { extractDomain, finishConnectorRun, startConnectorRun } from "./base";

// ── Types ────────────────────────────────────────────────────────────────────

export interface HarmonicOrgEnrichmentResult {
  found: boolean;
  updated_fields: string[];
  external_id: string | null;
  error?: string;
}

interface HarmonicCompany {
  id?: string;
  name?: string;
  website?: { url?: string };
  description?: string;
  linkedin?: { url?: string };
  employee_count?: number;
  founded_at?: string; // ISO date
  industry?: string;
  industries?: string[];
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  funding?: {
    last_round_type?: string;
    last_round_amount?: number;
    total_raised?: number;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const HARMONIC_ENDPOINT = "https://api.harmonic.ai/graphql";

function joinLocation(loc: HarmonicCompany["location"]): string | null {
  if (!loc) return null;
  const parts = [loc.city, loc.state, loc.country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function foundedYear(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const m = isoDate.match(/^(\d{4})/);
  return m && m[1] ? parseInt(m[1], 10) : null;
}

// Recherche par domaine via GraphQL companyByDomain.
// Note : la query exacte peut varier selon la version de l'API. On structure
// pour être facilement adaptable. Si l'endpoint renvoie 4xx/5xx, on log
// silencieusement et l'orchestrateur passe à la source suivante.
async function harmonicFetchCompany(
  apiKey: string,
  variables: { domain?: string; name?: string },
): Promise<HarmonicCompany | null> {
  // Choix de la query selon ce qu'on a sous la main
  const query = variables.domain
    ? `query CompanyByDomain($domain: String!) {
         company(domain: $domain) {
           id name description
           website { url }
           linkedin { url }
           employee_count founded_at industry industries
           location { city state country }
           funding { last_round_type last_round_amount total_raised }
         }
       }`
    : `query CompanyByName($name: String!) {
         companies(query: $name, limit: 1) {
           id name description
           website { url }
           linkedin { url }
           employee_count founded_at industry industries
           location { city state country }
           funding { last_round_type last_round_amount total_raised }
         }
       }`;

  try {
    const res = await fetch(HARMONIC_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { data?: { company?: HarmonicCompany; companies?: HarmonicCompany[] } };
    return json.data?.company ?? json.data?.companies?.[0] ?? null;
  } catch {
    return null;
  }
}

// ── Enrichissement d'une organisation existante ──────────────────────────────

/**
 * Enrichit une organisation existante via Harmonic. Priorise la recherche
 * par domaine. N'écrase jamais un champ déjà rempli. Trace dans connector_runs.
 *
 * Retourne `{ found: false, error: "HARMONIC_API_KEY manquante" }` si clé
 * absente — l'orchestrateur peut alors passer au connecteur suivant sans
 * casser le flow utilisateur.
 */
export async function enrichExistingOrganizationWithHarmonic(params: {
  userId: string;
  orgId: string;
}): Promise<HarmonicOrgEnrichmentResult> {
  const apiKey = process.env.HARMONIC_API_KEY;
  if (!apiKey) {
    return { found: false, updated_fields: [], external_id: null, error: "HARMONIC_API_KEY manquante" };
  }

  const supabase = createAdminClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, website, linkedin_url, sector, description, employee_count, founded_year, location, external_ids")
    .eq("id", params.orgId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (!org) {
    return { found: false, updated_fields: [], external_id: null, error: "Organisation introuvable" };
  }

  const runId = await startConnectorRun(supabase, {
    userId: params.userId,
    sourceConnector: "harmonic",
    triggeredBy: "manual",
    queryParams: { mode: "enrich_single", org_id: params.orgId },
  });

  const domain = extractDomain(org.website);
  let company: HarmonicCompany | null = null;

  if (domain) {
    company = await harmonicFetchCompany(apiKey, { domain });
  }
  if (!company && org.name) {
    company = await harmonicFetchCompany(apiKey, { name: org.name });
  }

  if (!company || !company.id) {
    if (runId) await finishConnectorRun(supabase, { runId, status: "success", recordsFetched: 0 });
    return { found: false, updated_fields: [], external_id: null };
  }

  // Préparer les updates sans écraser
  const updates: Record<string, unknown> = {};
  if (!org.website && company.website?.url)        updates.website = company.website.url;
  if (!org.linkedin_url && company.linkedin?.url)  updates.linkedin_url = company.linkedin.url;
  if (!org.sector && company.industry)             updates.sector = company.industry;
  if (!org.description && company.description)    updates.description = company.description;
  if (!org.employee_count && company.employee_count) {
    updates.employee_count = company.employee_count;
  }
  if (!org.founded_year) {
    const fy = foundedYear(company.founded_at ?? null);
    if (fy) updates.founded_year = fy;
  }
  if (!org.location) {
    const loc = joinLocation(company.location);
    if (loc) updates.location = loc;
  }

  // external_ids.harmonic idempotent
  const currentExtIds = (org.external_ids as Record<string, unknown> | null) ?? {};
  if (currentExtIds.harmonic !== company.id) {
    updates.external_ids = { ...currentExtIds, harmonic: company.id };
  }

  if (Object.keys(updates).length > 0) {
    updates.enriched_at = new Date().toISOString();
    updates.enriched_by_source = "harmonic";
    await supabase.from("organizations").update(updates).eq("id", params.orgId);
  }

  if (runId) {
    await finishConnectorRun(supabase, {
      runId,
      status: "success",
      recordsFetched: 1,
      recordsUpdated: Object.keys(updates).length > 0 ? 1 : 0,
    });
  }

  const updatedFields = Object.keys(updates).filter(
    (k) => k !== "external_ids" && k !== "enriched_at" && k !== "enriched_by_source",
  );

  return {
    found: true,
    updated_fields: updatedFields,
    external_id: company.id,
  };
}
