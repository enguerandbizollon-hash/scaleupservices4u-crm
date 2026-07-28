/**
 * lib/connectors/recherche-entreprises.ts
 *
 * Connecteur public vers recherche-entreprises.api.gouv.fr (INSEE/SIRENE
 * exposé par data.gouv.fr). API gratuite, sans clé, sans rate-limit
 * documenté restrictif. Source pour enrichir les organisations FR à partir
 * d'un SIREN ou d'un nom.
 *
 * Doc : https://recherche-entreprises.api.gouv.fr/
 *
 * Sortie normalisée : ConnectorRecord générique partageable avec d'autres
 * sources d'enrichissement (Pappers, Harmonic, Apollo).
 */

import type { ConnectorRecord } from "./base";

const API_BASE = "https://recherche-entreprises.api.gouv.fr";

// ── Forme brute de l'API (subset utilisé) ─────────────────────────────────
export interface RawEntreprise {
  siren: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  sigle?: string | null;
  tranche_effectif_salarie?: string | null;
  date_creation?: string | null;
  categorie_entreprise?: string | null; // PME | ETI | GE
  nature_juridique?: string | null;
  activite_principale?: string | null;
  section_activite_principale?: string | null;
  est_societe_mission?: boolean;
  siege?: {
    siret?: string;
    activite_principale?: string;
    adresse?: string;
    code_postal?: string;
    commune?: string;
    libelle_commune?: string;
    departement?: string;
    pays?: string;
  };
  dirigeants?: Array<{
    nom?: string;
    prenoms?: string;
    qualite?: string;
    type_dirigeant?: string;
    date_de_naissance?: string | null;   // "AAAA-MM" (précision mois, vérifié en réel)
    annee_de_naissance?: string | null;
    siren?: string; // si personne morale
    denomination?: string; // si personne morale
  }>;
  finances?: Record<string, { ca?: number | null; resultat_net?: number | null }>;
  complements?: {
    est_societe_mission?: boolean;
    est_finess?: boolean;
    est_rge?: boolean;
    est_ess?: boolean;
    est_bio?: boolean;
  };
}

interface SearchResponse {
  results: RawEntreprise[];
  total_results: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ── Mapping vers structure normalisée pour le CRM ─────────────────────────

// Mapping INSEE tranche_effectif_salarie → nombre de salariés moyen
// Codes INSEE officiels : https://www.insee.fr/fr/information/2028207
const EFFECTIF_LABELS: Record<string, { label: string; midpoint: number }> = {
  "NN": { label: "Non employeur", midpoint: 0 },
  "00": { label: "0 salarié", midpoint: 0 },
  "01": { label: "1 à 2 salariés", midpoint: 2 },
  "02": { label: "3 à 5 salariés", midpoint: 4 },
  "03": { label: "6 à 9 salariés", midpoint: 8 },
  "11": { label: "10 à 19 salariés", midpoint: 15 },
  "12": { label: "20 à 49 salariés", midpoint: 35 },
  "21": { label: "50 à 99 salariés", midpoint: 75 },
  "22": { label: "100 à 199 salariés", midpoint: 150 },
  "31": { label: "200 à 249 salariés", midpoint: 225 },
  "32": { label: "250 à 499 salariés", midpoint: 375 },
  "41": { label: "500 à 999 salariés", midpoint: 750 },
  "42": { label: "1000 à 1999 salariés", midpoint: 1500 },
  "51": { label: "2000 à 4999 salariés", midpoint: 3500 },
  "52": { label: "5000 à 9999 salariés", midpoint: 7500 },
  "53": { label: "10000 salariés et plus", midpoint: 12000 },
};

// Mapping catégorie INSEE → company_stage CRM
function mapCategoryToStage(category: string | null | undefined): string | null {
  if (!category) return null;
  switch (category.toUpperCase()) {
    case "PME":  return "pme";
    case "ETI":  return "eti";
    case "GE":   return "grand_groupe";
    default:     return null;
  }
}

export interface NormalizedEntreprise {
  siren: string;
  name: string;
  short_name: string | null;
  nature_juridique: string | null;
  forme_juridique_label: string | null; // Libellé "SAS", "SARL"... approximé depuis nature_juridique INSEE
  category: string | null; // PME | ETI | GE
  company_stage_crm: string | null; // mappé pour CRM
  founded_year: number | null;
  effectif_label: string | null;
  effectif_midpoint: number | null;
  activite_principale_code: string | null;
  activite_section: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  dirigeants: Array<{ name: string; qualite: string | null }>;
  raw: RawEntreprise;
}

function normalizeOne(raw: RawEntreprise): NormalizedEntreprise {
  const effCode = raw.tranche_effectif_salarie;
  const eff = effCode ? EFFECTIF_LABELS[effCode] ?? null : null;
  const foundedYear = raw.date_creation ? parseInt(raw.date_creation.slice(0, 4), 10) : null;

  const dirigeants = (raw.dirigeants ?? []).map((d) => {
    const name = d.denomination
      ? d.denomination
      : `${d.prenoms ?? ""} ${d.nom ?? ""}`.trim();
    return {
      name: name || "(inconnu)",
      qualite: d.qualite ?? d.type_dirigeant ?? null,
    };
  });

  // Approximation forme juridique depuis code INSEE 4 chiffres
  const formeJuridiqueLabel = guessFormeJuridique(raw.nature_juridique);

  return {
    siren: raw.siren,
    name: raw.nom_complet || raw.nom_raison_sociale || "(sans nom)",
    short_name: raw.sigle ?? null,
    nature_juridique: raw.nature_juridique ?? null,
    forme_juridique_label: formeJuridiqueLabel,
    category: raw.categorie_entreprise ?? null,
    company_stage_crm: mapCategoryToStage(raw.categorie_entreprise),
    founded_year: Number.isFinite(foundedYear) && foundedYear ? foundedYear : null,
    effectif_label: eff?.label ?? null,
    effectif_midpoint: eff?.midpoint ?? null,
    activite_principale_code: raw.activite_principale ?? null,
    activite_section: raw.section_activite_principale ?? null,
    address: raw.siege?.adresse ?? null,
    postal_code: raw.siege?.code_postal ?? null,
    city: raw.siege?.libelle_commune ?? raw.siege?.commune ?? null,
    country: raw.siege?.pays ?? "France",
    dirigeants,
    raw,
  };
}

// Codes INSEE catégorie juridique (extrait des plus fréquents)
function guessFormeJuridique(natureJuridique: string | null | undefined): string | null {
  if (!natureJuridique) return null;
  const code = natureJuridique;
  if (code.startsWith("57")) return "SAS";
  if (code.startsWith("54")) return "SARL";
  if (code.startsWith("55")) return "SA";
  if (code.startsWith("56")) return "SCA";
  if (code.startsWith("58")) return "SNC";
  if (code.startsWith("65")) return "Association loi 1901";
  if (code.startsWith("92")) return "Société civile";
  if (code.startsWith("10")) return "Entreprise individuelle";
  return null;
}

// ── Appels publics ────────────────────────────────────────────────────────

export async function fetchEntrepriseBySiren(siren: string): Promise<NormalizedEntreprise | null> {
  const cleaned = siren.replace(/\s+/g, "");
  if (!/^\d{9}$/.test(cleaned)) {
    throw new Error("SIREN invalide : 9 chiffres requis.");
  }
  const url = `${API_BASE}/search?q=${cleaned}&page=1&per_page=1`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API recherche-entreprises a répondu ${res.status}`);
  const json = (await res.json()) as SearchResponse;
  const first = json.results?.[0];
  if (!first || first.siren !== cleaned) return null;
  return normalizeOne(first);
}

export async function searchEntreprisesByName(query: string, limit = 5): Promise<NormalizedEntreprise[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `${API_BASE}/search?q=${encodeURIComponent(q)}&page=1&per_page=${Math.min(20, limit)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API recherche-entreprises a répondu ${res.status}`);
  const json = (await res.json()) as SearchResponse;
  return (json.results ?? []).map(normalizeOne);
}

// ═════════════════════════════════════════════════════════════════════════
// SCREENING (phase 2, temps 2) — le composeur de chasses.
//
// Tout est vérifié en réel (2026-07-28) :
//   - le filtre âge dirigeant fonctionne SANS nom (date_naissance_personne_*),
//     sémantique « au moins un dirigeant dans la tranche » → post-filtre
//     applicatif findDirigeantPrincipal ;
//   - les commissaires aux comptes figurent dans dirigeants → exclus par
//     qualite ;
//   - ca_min/max, resultat_net_min, multi-NAF (codes complets uniquement,
//     virgule), departement, region, tranche_effectif_salarie,
//     categorie_entreprise, etat_administratif=A ;
//   - fenêtre 10 000 résultats par requête → découpage par départements ;
//   - rafale 10/10 tolérée → throttle prudent ~4 req/s + retry sur 429.
// ═════════════════════════════════════════════════════════════════════════

export interface ScreeningFilters {
  /** Codes NAF complets (ex. "43.21A"). L'API refuse les divisions nues. */
  naf?: string[];
  ca_min?: number | null;
  ca_max?: number | null;
  resultat_net_min?: number | null;
  age_dirigeant_min?: number | null;
  age_dirigeant_max?: number | null;
  departements?: string[];
  regions?: string[];
  /** Codes INSEE de tranches d'effectif (ex. "12" = 20-49). */
  effectif_tranches?: string[];
  categorie?: string | null; // PME | ETI | GE
  /** Défaut true : exclut les entreprises cessées (13% du brut, vérifié). */
  actives_seulement?: boolean;
}

export const SCREENING_WINDOW = 10_000;
export const SCREENING_PER_PAGE = 25; // max accepté par l'API

export const DEPARTEMENTS_FR: readonly string[] = [
  ...Array.from({ length: 19 }, (_, i) => String(i + 1).padStart(2, "0")),
  "2A", "2B",
  ...Array.from({ length: 75 }, (_, i) => String(i + 21)),
  "971", "972", "973", "974", "976",
];

/**
 * Convertit une tranche d'âge en bornes de dates de naissance API.
 * âge ≥ min → né au plus tard il y a `min` ans (date_naissance_personne_max) ;
 * âge ≤ max → né au plus tôt il y a `max + 1` ans + 1 jour (…_min).
 */
export function birthDateRangeForAges(
  ageMin: number | null | undefined,
  ageMax: number | null | undefined,
  now: Date = new Date(),
): { min?: string; max?: string } {
  const out: { min?: string; max?: string } = {};
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (ageMin != null && ageMin > 0) {
    const d = new Date(now);
    d.setUTCFullYear(d.getUTCFullYear() - ageMin);
    out.max = iso(d);
  }
  if (ageMax != null && ageMax > 0) {
    const d = new Date(now);
    d.setUTCFullYear(d.getUTCFullYear() - ageMax - 1);
    d.setUTCDate(d.getUTCDate() + 1);
    out.min = iso(d);
  }
  return out;
}

/** Construit les paramètres d'une requête de screening. Pur, testable. */
export function buildScreeningParams(
  filters: ScreeningFilters,
  page: number,
  perPage: number = SCREENING_PER_PAGE,
  now: Date = new Date(),
): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.naf?.length) p.set("activite_principale", filters.naf.join(","));
  if (filters.ca_min != null) p.set("ca_min", String(filters.ca_min));
  if (filters.ca_max != null) p.set("ca_max", String(filters.ca_max));
  if (filters.resultat_net_min != null) p.set("resultat_net_min", String(filters.resultat_net_min));
  if (filters.departements?.length) p.set("departement", filters.departements.join(","));
  if (filters.regions?.length) p.set("region", filters.regions.join(","));
  if (filters.effectif_tranches?.length) p.set("tranche_effectif_salarie", filters.effectif_tranches.join(","));
  if (filters.categorie) p.set("categorie_entreprise", filters.categorie);
  if (filters.actives_seulement !== false) p.set("etat_administratif", "A");

  const birth = birthDateRangeForAges(filters.age_dirigeant_min, filters.age_dirigeant_max, now);
  if (birth.min) p.set("date_naissance_personne_min", birth.min);
  if (birth.max) p.set("date_naissance_personne_max", birth.max);

  p.set("page", String(page));
  p.set("per_page", String(perPage));
  return p;
}

/** Âge en années depuis une date "AAAA-MM" ou "AAAA-MM-JJ". Null si invalide. */
export function computeAgeFromBirth(birth: string | null | undefined, now: Date = new Date()): number | null {
  if (!birth) return null;
  const m = birth.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (!Number.isFinite(year) || year < 1900) return null;
  let age = now.getUTCFullYear() - year;
  if (now.getUTCMonth() + 1 < month) age -= 1;
  return age;
}

const QUALITE_DIRIGEANT_RE = /g[ée]rant|pr[ée]sident|directeur g[ée]n[ée]ral|associ[ée]/i;
const QUALITE_EXCLUE_RE = /commissaire/i;

export interface DirigeantPrincipal {
  nom: string;
  prenoms: string | null;
  qualite: string | null;
  date_de_naissance: string | null;
  age: number | null;
}

/**
 * Post-filtre du screening : identifie le dirigeant personne physique
 * exerçant réellement (gérant, président, DG — jamais le commissaire aux
 * comptes), le plus âgé, optionnellement contraint à une tranche d'âge.
 * Retourne null si aucun dirigeant ne satisfait la contrainte.
 */
export function findDirigeantPrincipal(
  raw: RawEntreprise,
  ageMin?: number | null,
  ageMax?: number | null,
  now: Date = new Date(),
): DirigeantPrincipal | null {
  const candidates: DirigeantPrincipal[] = [];
  for (const d of raw.dirigeants ?? []) {
    if (d.denomination) continue; // personne morale
    if (!d.nom) continue;
    const qualite = d.qualite ?? d.type_dirigeant ?? null;
    if (qualite && QUALITE_EXCLUE_RE.test(qualite)) continue;
    if (qualite && !QUALITE_DIRIGEANT_RE.test(qualite)) continue;
    const age = computeAgeFromBirth(d.date_de_naissance, now);
    if (ageMin != null && (age === null || age < ageMin)) continue;
    if (ageMax != null && (age === null || age > ageMax)) continue;
    candidates.push({
      nom: d.nom,
      prenoms: d.prenoms ?? null,
      qualite,
      date_de_naissance: d.date_de_naissance ?? null,
      age,
    });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (b.age ?? -1) - (a.age ?? -1));
  return candidates[0];
}

// ── Exécution ─────────────────────────────────────────────────────────────

const THROTTLE_MS = 250;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function fetchScreeningPage(params: URLSearchParams): Promise<SearchResponse> {
  const url = `${API_BASE}/search?${params}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (res.ok) return (await res.json()) as SearchResponse;
    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      await sleep(1_500);
      continue;
    }
    const body = await res.text().catch(() => "");
    throw new Error(`Recherche d'Entreprises ${res.status} : ${body.slice(0, 200)}`);
  }
  throw new Error("Recherche d'Entreprises : échec après retry");
}

/** Compteur live du composeur : total de cibles pour des filtres donnés. */
export async function countScreening(filters: ScreeningFilters, now: Date = new Date()): Promise<number> {
  const params = buildScreeningParams(filters, 1, 1, now);
  const json = await fetchScreeningPage(params);
  return json.total_results ?? 0;
}

export interface ScreeningHit {
  raw: RawEntreprise;
  normalized: NormalizedEntreprise;
  dirigeant_principal: DirigeantPrincipal | null;
}

export interface ScreeningRunResult {
  hits: ScreeningHit[];
  /** Somme des totaux API par requête (avant post-filtre dirigeant). */
  total_api: number;
  /** Nombre de fiches écartées par le post-filtre dirigeant. */
  filtered_out: number;
  /** True si une sous-requête a touché la fenêtre des 10 000. */
  truncated: boolean;
  /** Nombre de requêtes de découpage exécutées. */
  queries: number;
}

/**
 * Exécute un screening complet : découpage automatique par départements si
 * le total dépasse la fenêtre API, pagination, throttle, post-filtre
 * dirigeant. `maxResults` est un garde-fou (défaut 50 000, taille max de
 * l'univers décidée au plan).
 */
export async function runScreening(
  filters: ScreeningFilters,
  opts?: { maxResults?: number; now?: Date },
): Promise<ScreeningRunResult> {
  const now = opts?.now ?? new Date();
  const maxResults = opts?.maxResults ?? 50_000;
  const needsAgeFilter = filters.age_dirigeant_min != null || filters.age_dirigeant_max != null;

  // Plan de requêtes : direct, ou découpé par départements si trop large.
  let slices: ScreeningFilters[] = [filters];
  const total = await countScreening(filters, now);
  if (total > SCREENING_WINDOW && !filters.departements?.length) {
    slices = DEPARTEMENTS_FR.map((d) => ({ ...filters, departements: [d] }));
  }

  const hits: ScreeningHit[] = [];
  const seen = new Set<string>();
  let totalApi = 0;
  let filteredOut = 0;
  let truncated = false;
  let queries = 0;

  for (const slice of slices) {
    let page = 1;
    for (;;) {
      const params = buildScreeningParams(slice, page, SCREENING_PER_PAGE, now);
      const json = await fetchScreeningPage(params);
      queries++;
      if (page === 1) {
        totalApi += json.total_results ?? 0;
        if ((json.total_results ?? 0) > SCREENING_WINDOW) truncated = true;
      }

      for (const raw of json.results ?? []) {
        if (seen.has(raw.siren)) continue;
        seen.add(raw.siren);
        const dirigeant = findDirigeantPrincipal(
          raw,
          filters.age_dirigeant_min,
          filters.age_dirigeant_max,
          now,
        );
        if (needsAgeFilter && !dirigeant) {
          filteredOut++;
          continue;
        }
        hits.push({ raw, normalized: normalizeOne(raw), dirigeant_principal: dirigeant });
      }

      if (hits.length >= maxResults) {
        truncated = true;
        return { hits, total_api: totalApi, filtered_out: filteredOut, truncated, queries };
      }
      if (page >= (json.total_pages ?? 1) || (json.results ?? []).length === 0) break;
      page++;
      await sleep(THROTTLE_MS);
    }
    await sleep(THROTTLE_MS);
  }

  return { hits, total_api: totalApi, filtered_out: filteredOut, truncated, queries };
}

// ── ConnectorRecord helper (pour cohérence avec autres connecteurs) ───────

export function toConnectorRecord(n: NormalizedEntreprise): ConnectorRecord {
  return {
    source: "insee",
    external_id: n.siren,
    data: {
      name: n.name,
      short_name: n.short_name,
      forme_juridique: n.forme_juridique_label,
      category: n.category,
      company_stage: n.company_stage_crm,
      founded_year: n.founded_year,
      employee_count: n.effectif_midpoint,
      effectif_label: n.effectif_label,
      activite_principale_code: n.activite_principale_code,
      activite_section: n.activite_section,
      address: n.address,
      postal_code: n.postal_code,
      city: n.city,
      country: n.country,
      dirigeants: n.dirigeants,
    },
  };
}
