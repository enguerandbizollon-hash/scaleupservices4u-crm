// ─────────────────────────────────────────────────────────────────────────────
// Source de vérité unique — matching investisseurs, RH, M&A, référentiels orgs
// Utilisé dans : formulaires deals, formulaires organisations, algorithme scoring
// ─────────────────────────────────────────────────────────────────────────────

// ── Stades entreprise (M&A / profil organisation) ────────────────────────────

export const ORG_COMPANY_STAGES = [
  { value: "startup",      label: "Startup" },
  { value: "pme",          label: "PME" },
  { value: "eti",          label: "ETI" },
  { value: "grand_groupe", label: "Grand groupe" },
] as const;

export type OrgCompanyStage = (typeof ORG_COMPANY_STAGES)[number]["value"];

// ── Tranches de CA (profil organisation) ────────────────────────────────────

export const REVENUE_RANGES = [
  { value: "<1M",       label: "< 1 M€" },
  { value: "1M-5M",     label: "1 – 5 M€" },
  { value: "5M-20M",    label: "5 – 20 M€" },
  { value: "20M-100M",  label: "20 – 100 M€" },
  { value: ">100M",     label: "> 100 M€" },
] as const;

export type RevenueRange = (typeof REVENUE_RANGES)[number]["value"];

// ── Maturité cession M&A (organizations type = target) ───────────────────────

export const SALE_READINESS_OPTIONS = [
  { value: "not_for_sale",     label: "Pas en vente",       bg: "#F3F4F6", tx: "#6B7280" },
  { value: "open",             label: "Ouvert aux offres",  bg: "#FEF3C7", tx: "#92400E" },
  { value: "actively_selling", label: "En cession active",  bg: "#D1FAE5", tx: "#065F46" },
] as const;

export type SaleReadiness = (typeof SALE_READINESS_OPTIONS)[number]["value"];

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

// ─────────────────────────────────────────────────────────────────────────────
// RÉFÉRENTIELS RH — Module candidats (M1+)
// ─────────────────────────────────────────────────────────────────────────────

// ── Statuts candidat ─────────────────────────────────────────────────────────

export const CANDIDATE_STATUSES = [
  { value: "searching",   label: "En recherche active", bg: "#D1FAE5", tx: "#065F46" },
  { value: "in_process",  label: "En process",          bg: "#DBEAFE", tx: "#1D4ED8" },
  { value: "placed",      label: "Placé",               bg: "#EDE9FE", tx: "#5B21B6" },
  { value: "employed",    label: "En poste",            bg: "#FEF3C7", tx: "#92400E" },
  { value: "inactive",    label: "Inactif",             bg: "#F3F4F6", tx: "#6B7280" },
  { value: "blacklisted", label: "Blacklisté",          bg: "#FEE2E2", tx: "#991B1B" },
] as const;

export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number]["value"];

// ── Séniorité ────────────────────────────────────────────────────────────────

export const SENIORITY_OPTIONS = [
  { value: "junior",    label: "Junior (0–2 ans)" },
  { value: "mid",       label: "Confirmé (2–5 ans)" },
  { value: "senior",    label: "Senior (5–10 ans)" },
  { value: "lead",      label: "Lead / Expert" },
  { value: "director",  label: "Directeur" },
  { value: "c-level",   label: "C-Level" },
] as const;

export type Seniority = (typeof SENIORITY_OPTIONS)[number]["value"];

/**
 * Compatibilité séniorité pour le scoring M4
 * Clé = séniorité du poste, valeurs = séniorités compatibles (exact + adjacent)
 */
export const SENIORITY_MAP: Record<string, string[]> = {
  "junior":   ["junior", "mid"],
  "mid":      ["mid", "junior", "senior"],
  "senior":   ["senior", "mid", "lead"],
  "lead":     ["lead", "senior", "director"],
  "director": ["director", "lead", "c-level"],
  "c-level":  ["c-level", "director"],
};

// ── Remote ───────────────────────────────────────────────────────────────────

export const REMOTE_OPTIONS = [
  { value: "onsite",   label: "Présentiel" },
  { value: "hybrid",   label: "Hybride" },
  { value: "remote",   label: "Full remote" },
  { value: "flexible", label: "Flexible" },
] as const;

export type RemoteOption = (typeof REMOTE_OPTIONS)[number]["value"];

/**
 * Compatibilité remote poste → préférence candidat (scoring M4)
 */
export const REMOTE_COMPATIBILITY: Record<string, string[]> = {
  "onsite":   ["onsite", "flexible"],
  "hybrid":   ["hybrid", "flexible", "onsite", "remote"],
  "remote":   ["remote", "flexible"],
  "flexible": ["onsite", "hybrid", "remote", "flexible"],
};

// ── Géographies RH ───────────────────────────────────────────────────────────

export const RH_GEOGRAPHIES = [
  // France
  { value: "ile_de_france",       label: "Île-de-France",         group: "France" },
  { value: "auvergne_rhone",      label: "Auvergne-Rhône-Alpes",  group: "France" },
  { value: "paca",                label: "PACA",                  group: "France" },
  { value: "occitanie",           label: "Occitanie",             group: "France" },
  { value: "nouvelle_aquitaine",  label: "Nouvelle-Aquitaine",    group: "France" },
  { value: "bretagne",            label: "Bretagne",              group: "France" },
  { value: "grand_est",           label: "Grand Est",             group: "France" },
  { value: "hauts_de_france",     label: "Hauts-de-France",       group: "France" },
  { value: "normandie",           label: "Normandie",             group: "France" },
  { value: "bourgogne",           label: "Bourgogne-Franche-Comté", group: "France" },
  { value: "pays_de_la_loire",    label: "Pays de la Loire",      group: "France" },
  { value: "centre_val_loire",    label: "Centre-Val de Loire",   group: "France" },
  { value: "france_entiere",      label: "France entière",        group: "France" },
  // Suisse
  { value: "geneve",              label: "Genève",                group: "Suisse" },
  { value: "vaud",                label: "Vaud",                  group: "Suisse" },
  { value: "zurich",              label: "Zürich",                group: "Suisse" },
  { value: "berne",               label: "Berne",                 group: "Suisse" },
  { value: "bale",                label: "Bâle",                  group: "Suisse" },
  { value: "suisse_romande",      label: "Suisse romande",        group: "Suisse" },
  { value: "suisse_entiere",      label: "Suisse entière",        group: "Suisse" },
  // Europe
  { value: "belgique",            label: "Belgique",              group: "Europe" },
  { value: "luxembourg",          label: "Luxembourg",            group: "Europe" },
  { value: "allemagne",           label: "Allemagne",             group: "Europe" },
  { value: "royaume_uni",         label: "Royaume-Uni",           group: "Europe" },
  { value: "espagne",             label: "Espagne",               group: "Europe" },
  { value: "italie",              label: "Italie",                group: "Europe" },
  { value: "pays_bas",            label: "Pays-Bas",              group: "Europe" },
  { value: "europe_entiere",      label: "Europe entière",        group: "Europe" },
  // Global
  { value: "international",       label: "International",         group: "Global" },
] as const;

export type RhGeography = (typeof RH_GEOGRAPHIES)[number]["value"];

/**
 * Compatibilité géo RH — clé = géo du poste, valeurs = géos candidat compatibles (scoring M4)
 */
export const RH_GEO_COMPATIBILITY: Record<string, string[]> = {
  "ile_de_france":      ["ile_de_france", "france_entiere", "international"],
  "auvergne_rhone":     ["auvergne_rhone", "france_entiere", "international"],
  "paca":               ["paca", "france_entiere", "international"],
  "occitanie":          ["occitanie", "france_entiere", "international"],
  "nouvelle_aquitaine": ["nouvelle_aquitaine", "france_entiere", "international"],
  "bretagne":           ["bretagne", "france_entiere", "international"],
  "grand_est":          ["grand_est", "france_entiere", "international"],
  "hauts_de_france":    ["hauts_de_france", "france_entiere", "international"],
  "normandie":          ["normandie", "france_entiere", "international"],
  "bourgogne":          ["bourgogne", "france_entiere", "international"],
  "pays_de_la_loire":   ["pays_de_la_loire", "france_entiere", "international"],
  "centre_val_loire":   ["centre_val_loire", "france_entiere", "international"],
  "france_entiere":     ["ile_de_france","auvergne_rhone","paca","occitanie","nouvelle_aquitaine","bretagne","grand_est","hauts_de_france","normandie","bourgogne","pays_de_la_loire","centre_val_loire","france_entiere","international"],
  "geneve":             ["geneve", "suisse_romande", "suisse_entiere", "international"],
  "vaud":               ["vaud", "suisse_romande", "suisse_entiere", "international"],
  "zurich":             ["zurich", "suisse_entiere", "international"],
  "berne":              ["berne", "suisse_entiere", "international"],
  "bale":               ["bale", "suisse_entiere", "international"],
  "suisse_romande":     ["geneve", "vaud", "suisse_romande", "suisse_entiere", "international"],
  "suisse_entiere":     ["geneve","vaud","zurich","berne","bale","suisse_romande","suisse_entiere","international"],
  "belgique":           ["belgique", "europe_entiere", "international"],
  "luxembourg":         ["luxembourg", "europe_entiere", "international"],
  "allemagne":          ["allemagne", "europe_entiere", "international"],
  "royaume_uni":        ["royaume_uni", "europe_entiere", "international"],
  "espagne":            ["espagne", "europe_entiere", "international"],
  "italie":             ["italie", "europe_entiere", "international"],
  "pays_bas":           ["pays_bas", "europe_entiere", "international"],
  "europe_entiere":     ["belgique","luxembourg","allemagne","royaume_uni","espagne","italie","pays_bas","europe_entiere","international"],
  "international":      ["international","france_entiere","suisse_entiere","europe_entiere"],
};
