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
interface RawEntreprise {
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
