/**
 * lib/sourcing/engine.ts — Types et utilitaires du moteur de sourcing (S2)
 *
 * Un SourcingCandidate est la forme normalisée produite par toutes les
 * sources (CRM interne, Apollo, Harmonic...). Permet de fusionner les
 * résultats cross-source et de produire un classement unifié.
 *
 * Le moteur fonctionne en 3 étapes orchestrées en S3 :
 *   1. Pour chaque segment du plan, exécuter les sources en parallèle
 *   2. dedupCandidates pour fusionner les doublons cross-source
 *   3. Score algo + IA optionnel, upsert dans deal_target_suggestions
 */

import type { ActorType, SourcingSegment } from "@/lib/ai/sourcing-strategy";

// ── Types publics ────────────────────────────────────────────────────────────

export interface SourcingCandidateContact {
  contact_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  title: string | null;
  linkedin_url: string | null;
  source: "crm" | "apollo" | "harmonic";
}

export interface SourcingCandidate {
  /** Clé de dédup cross-source : apollo:X | domain:Y | name:Z */
  unique_key: string;

  // Identité
  name: string;
  website: string | null;
  linkedin_url: string | null;
  normalized_name: string;
  domain: string | null;

  // Profil
  organization_type: string | null;
  sector: string | null;
  location: string | null;
  description: string | null;
  employee_count: number | null;

  // Références
  existing_org_id: string | null;  // id dans organizations si déjà en base
  apollo_id: string | null;
  harmonic_id: string | null;

  // Meta
  sources: Array<"crm" | "apollo" | "harmonic">;
  segment_name: string;
  segment_priority: number;

  // Contacts décideurs (max 3)
  contacts: SourcingCandidateContact[];
}

export interface SourcingExecutionContext {
  userId: string;
  dealId: string;
  dealType: string;
  currency: string;
  dealSector: string | null;
  dealGeography: string | null;
  latestRevenue: number | null;
  targetSectors: string[] | null;
  excludedSectors: string[] | null;
}

// ── Mapping actor_type → organization_type côté CRM ──────────────────────────
// Permet à la source CRM de filtrer les organisations pertinentes selon le
// type d'acteur recherché par le segment.

export const ACTOR_TYPE_TO_ORG_TYPE: Record<ActorType, string[]> = {
  corporate_strategic:  ["corporate", "buyer"],
  corporate_build_up:   ["corporate", "buyer"],
  private_equity:       ["investor", "family_office"],
  growth_equity:        ["investor"],
  venture_capital:      ["investor"],
  family_office:        ["family_office", "investor"],
  business_angel:       ["business_angel"],
  search_fund:          ["buyer", "investor"],
  individual_acquirer:  ["buyer"],
  investment_bank:      ["other"],
  other:                [],
};

// ── Helpers unique_key et dédup ──────────────────────────────────────────────

export function computeUniqueKey(
  normalizedName: string,
  apolloId: string | null,
  domain: string | null,
): string {
  if (apolloId)         return `apollo:${apolloId}`;
  if (domain)           return `domain:${domain}`;
  if (normalizedName)   return `name:${normalizedName}`;
  return `raw:${Math.random().toString(36).slice(2)}`;
}

/**
 * Fusionne les candidats qui partagent la même unique_key. Priorité CRM
 * (existing_org_id) puis Apollo (apollo_id). Les sources sont cumulées,
 * les contacts dédupliqués par email ou nom complet.
 */
export function dedupCandidates(all: SourcingCandidate[]): SourcingCandidate[] {
  const byKey = new Map<string, SourcingCandidate>();

  for (const c of all) {
    const existing = byKey.get(c.unique_key);
    if (!existing) {
      byKey.set(c.unique_key, { ...c, contacts: [...c.contacts] });
      continue;
    }

    // Merge sources
    existing.sources = Array.from(new Set([...existing.sources, ...c.sources]));

    // Champs texte : on garde le premier non-null
    existing.website      = existing.website      ?? c.website;
    existing.linkedin_url = existing.linkedin_url ?? c.linkedin_url;
    existing.description  = existing.description  ?? c.description;
    existing.employee_count = existing.employee_count ?? c.employee_count;
    existing.location     = existing.location     ?? c.location;
    existing.sector       = existing.sector       ?? c.sector;
    existing.organization_type = existing.organization_type ?? c.organization_type;
    existing.apollo_id    = existing.apollo_id    ?? c.apollo_id;
    existing.harmonic_id  = existing.harmonic_id  ?? c.harmonic_id;
    existing.existing_org_id = existing.existing_org_id ?? c.existing_org_id;
    existing.domain       = existing.domain       ?? c.domain;

    // Priorité au meilleur segment (priority la plus basse = la plus haute)
    if (c.segment_priority < existing.segment_priority) {
      existing.segment_name = c.segment_name;
      existing.segment_priority = c.segment_priority;
    }

    // Merge contacts (dédup par email ou first+last)
    const seen = new Set(existing.contacts.map(contactKey));
    for (const ct of c.contacts) {
      const key = contactKey(ct);
      if (!seen.has(key)) {
        existing.contacts.push(ct);
        seen.add(key);
      }
    }
    // Limiter à 3 contacts
    existing.contacts = existing.contacts.slice(0, 3);
  }

  return Array.from(byKey.values());
}

function contactKey(ct: SourcingCandidateContact): string {
  if (ct.email) return `email:${ct.email.toLowerCase()}`;
  return `name:${ct.first_name.toLowerCase()}|${ct.last_name.toLowerCase()}`;
}

// ── Score algorithmique par candidat ────────────────────────────────────────
// 0 à 100. Logique :
//   - Secteur aligné : 30 pts
//   - Taille dans range attendu : 20 pts
//   - Géographie alignée : 15 pts
//   - Origine CRM (acteur déjà qualifié humain) : bonus 10 pts
//   - Contact décideur identifié avec email : bonus 10 pts
//   - Source multiple (CRM + Apollo, robustesse du match) : bonus 5 pts
//   - Description substantielle : 10 pts
// Drop-dead : secteur dans excludedSectors → 0

export function computeQuickAlgoScore(
  candidate: SourcingCandidate,
  segment: SourcingSegment,
  context: SourcingExecutionContext,
): number {
  let score = 0;

  // Drop-dead secteur
  if (candidate.sector && context.excludedSectors?.length) {
    const excluded = context.excludedSectors.map(s => s.toLowerCase());
    if (excluded.includes(candidate.sector.toLowerCase())) return 0;
  }

  // Secteur aligné (30)
  const keywordsLower = segment.keywords.map(k => k.toLowerCase());
  const haystack = [candidate.name, candidate.sector, candidate.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (keywordsLower.length === 0) {
    score += 15;
  } else if (keywordsLower.some(k => haystack.includes(k))) {
    score += 30;
  } else if (candidate.sector) {
    score += 8;
  }

  // Taille (20)
  if (candidate.employee_count != null) {
    const minOk = segment.employee_min == null || candidate.employee_count >= segment.employee_min;
    const maxOk = segment.employee_max == null || candidate.employee_count <= segment.employee_max;
    if (minOk && maxOk) score += 20;
    else score += 5;
  } else {
    score += 8;  // info manquante, neutre
  }

  // Géographie (15)
  if (candidate.location && segment.geographies.length > 0) {
    const loc = candidate.location.toLowerCase();
    const matched = segment.geographies.some(g => matchGeography(g, loc));
    score += matched ? 15 : 3;
  } else {
    score += 6;
  }

  // Bonus origine CRM
  if (candidate.sources.includes("crm")) score += 10;

  // Bonus contact décideur identifié avec email
  if (candidate.contacts.some(c => c.email)) score += 10;

  // Bonus source multiple
  if (candidate.sources.length > 1) score += 5;

  // Bonus description substantielle
  if (candidate.description && candidate.description.length > 60) score += 10;

  return Math.min(100, Math.max(0, score));
}

// Mapping grossier code géo → termes à chercher dans une location textuelle
function matchGeography(geoCode: string, locationLower: string): boolean {
  const mapping: Record<string, string[]> = {
    france: ["france", "paris", "lyon", "marseille", "bordeaux", "lille", "toulouse"],
    suisse: ["switzerland", "suisse", "genève", "geneva", "zurich", "lausanne"],
    dach: ["germany", "austria", "switzerland", "berlin", "munich", "vienna"],
    ue: ["european union", "europe"],
    europe: ["france", "germany", "uk", "italy", "spain", "netherlands", "belgium", "europe"],
    amerique_nord: ["united states", "usa", "canada", "new york", "california"],
    amerique_sud: ["brazil", "argentina", "mexico", "chile"],
    asie: ["singapore", "japan", "india", "hong kong", "china"],
    moyen_orient: ["dubai", "saudi arabia", "israel", "emirates"],
    afrique: ["south africa", "nigeria", "morocco", "kenya"],
    oceanie: ["australia", "new zealand"],
    global: [],
  };
  const terms = mapping[geoCode.toLowerCase()] ?? [geoCode.toLowerCase()];
  if (terms.length === 0) return true;
  return terms.some(t => locationLower.includes(t));
}
