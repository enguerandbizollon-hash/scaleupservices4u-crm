// ─────────────────────────────────────────────────────────────────────────────
// Source de vérité unique pour le matching investisseurs
// Utilisé dans : formulaires deals, formulaires organisations, algorithme scoring
// ─────────────────────────────────────────────────────────────────────────────

// ── Secteurs ─────────────────────────────────────────────────────────────────

export const SECTORS = [
  "Généraliste", "SaaS", "Fintech", "Healthtech", "Deeptech",
  "Industrie", "Retail", "Energie", "Juridique", "Transport",
  "Impact", "Food", "Immobilier", "Edtech", "Cybersécurité",
  "Marketplace", "Hardware", "Autre",
] as const;

export type Sector = (typeof SECTORS)[number];

/**
 * Normalise les anciennes valeurs de secteur (texte long du formulaire deals)
 * vers les valeurs courtes du référentiel SECTORS.
 */
export const DEAL_SECTOR_NORMALIZATION: Record<string, string> = {
  "Généraliste":                 "Généraliste",
  "Technologie / SaaS":          "SaaS",
  "Intelligence Artificielle":   "Deeptech",
  "Fintech / Insurtech":         "Fintech",
  "Santé / Medtech":             "Healthtech",
  "Industrie / Manufacturing":   "Industrie",
  "Énergie / CleanTech":         "Energie",
  "Immobilier":                  "Immobilier",
  "Distribution / Retail":       "Retail",
  "Médias / Entertainment":      "Autre",
  "Transport / Logistique":      "Transport",
  "Agroalimentaire":             "Food",
  "Éducation / EdTech":          "Edtech",
  "Défense / Sécurité":          "Cybersécurité",
  "Tourisme / Hospitality":      "Autre",
  "Services B2B":                "SaaS",
  "Conseil / Advisory":          "Autre",
  "Juridique":                   "Juridique",
  "Finance / Investissement":    "Fintech",
  "Ressources Humaines":         "Autre",
  "Luxe / Premium":              "Retail",
  "Construction / BTP":          "Industrie",
  "Télécommunications":          "Hardware",
  "Agriculture / AgriTech":      "Food",
  "Chimie / Matériaux":          "Industrie",
  "Aérospatial":                 "Hardware",
  "Environnement":               "Energie",
  "Sport / Loisirs":             "Autre",
  "Bien-être / Beauté":          "Autre",
  "Cybersécurité":               "Cybersécurité",
  "Autre":                       "Autre",
};

/** Normalise n'importe quelle valeur de secteur deal vers le référentiel */
export function normalizeDealSector(sector: string | null | undefined): string | null {
  if (!sector) return null;
  return DEAL_SECTOR_NORMALIZATION[sector] ?? sector;
}

// ── Stades ────────────────────────────────────────────────────────────────────

/** Clés de stade pour les dossiers (valeurs stockées dans deals.company_stage) */
export const COMPANY_STAGES = [
  { value: "seed",          label: "Seed / Pré-Seed" },
  { value: "pre-series-a",  label: "Pré-Série A" },
  { value: "series-a",      label: "Série A" },
  { value: "series-b",      label: "Série B" },
  { value: "growth",        label: "Growth / Late Stage" },
] as const;

export type CompanyStage = (typeof COMPANY_STAGES)[number]["value"];

/**
 * Compatibilité stade deal → valeurs acceptées dans investor_stages (org)
 * Une clé = valeur stockée dans deals.company_stage
 * Les valeurs = libellés stockés dans organizations.investor_stages (STAGE_OPTIONS)
 */
export const STAGE_MAP: Record<string, string[]> = {
  "seed":          ["Seed", "Pré-Série A"],
  "pre-series-a":  ["Pré-Série A", "Série A", "Seed"],
  "series-a":      ["Série A", "Pré-Série A"],
  "series-b":      ["Série B", "Growth"],
  "growth":        ["Growth", "Late Stage", "Série B"],
};

// ── Géographies ───────────────────────────────────────────────────────────────

export const GEOGRAPHIES = [
  { value: "france",        label: "France" },
  { value: "suisse",        label: "Suisse" },
  { value: "dach",          label: "DACH (DE, AT, CH)" },
  { value: "ue",            label: "Union Européenne" },
  { value: "europe",        label: "Europe (hors UE)" },
  { value: "amerique_nord", label: "Amérique du Nord" },
  { value: "amerique_sud",  label: "Amérique du Sud" },
  { value: "asie",          label: "Asie" },
  { value: "moyen_orient",  label: "Moyen-Orient" },
  { value: "afrique",       label: "Afrique" },
  { value: "oceanie",       label: "Océanie" },
  { value: "global",        label: "Global / Worldwide" },
] as const;

export type Geography = (typeof GEOGRAPHIES)[number]["value"];

/**
 * Compatibilité géo deal → zones couvertes par l'investisseur
 *
 * Logique : la clé est la géo du DEAL.
 * On vérifie si une des investor_geographies est dans cette liste.
 *   - Correspondance exacte  → 15 pts
 *   - Correspondance large (UE, Europe, Global) → 8 pts
 *   - Aucune correspondance → 0 pts
 */
export const GEO_COMPATIBILITY: Record<string, string[]> = {
  "france":        ["france", "ue", "europe", "global"],
  "suisse":        ["suisse", "dach", "ue", "europe", "global"],
  "dach":          ["dach", "ue", "europe", "global"],
  "ue":            ["ue", "europe", "global"],
  "europe":        ["europe", "ue", "global"],
  "amerique_nord": ["amerique_nord", "global"],
  "amerique_sud":  ["amerique_sud", "global"],
  "asie":          ["asie", "global"],
  "moyen_orient":  ["moyen_orient", "global"],
  "afrique":       ["afrique", "global"],
  "oceanie":       ["oceanie", "global"],
  "global":        ["global"],
};

/** Zones "larges" : correspondent mais ne sont pas un match exact */
const GEO_BROAD: Record<string, string[]> = {
  "france":        ["ue", "europe", "global"],
  "suisse":        ["dach", "ue", "europe", "global"],
  "dach":          ["ue", "europe", "global"],
  "ue":            ["europe", "global"],
  "europe":        ["ue", "global"],
  "amerique_nord": ["global"],
  "amerique_sud":  ["global"],
  "asie":          ["global"],
  "moyen_orient":  ["global"],
  "afrique":       ["global"],
  "oceanie":       ["global"],
  "global":        [],
};

/**
 * Score géographique : 15pts exact, 8pts large, 0pts aucune
 */
export function scoreGeography(
  dealGeo: string | null | undefined,
  investorGeos: string[],
): number {
  if (!dealGeo || !investorGeos?.length) return 0;
  const compatible = GEO_COMPATIBILITY[dealGeo] ?? [];
  const broad      = GEO_BROAD[dealGeo] ?? [];
  if (investorGeos.some(g => g === dealGeo)) return 15;
  if (investorGeos.some(g => compatible.includes(g) && !broad.includes(g))) return 15;
  if (investorGeos.some(g => broad.includes(g))) return 8;
  return 0;
}
