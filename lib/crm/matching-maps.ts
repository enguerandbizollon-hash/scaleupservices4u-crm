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

// ── Types acquéreur M&A ──────────────────────────────────────────────────────

export const ACQUIRER_TYPES = [
  { value: "repreneur",      label: "Repreneur individuel" },
  { value: "corporate",      label: "Corporate / Industriel" },
  { value: "private_equity",  label: "Private Equity" },
  { value: "family_office",   label: "Family Office" },
  { value: "management",      label: "Management (MBO/MBI)" },
  { value: "autre",           label: "Autre" },
] as const;

export type AcquirerType = (typeof ACQUIRER_TYPES)[number]["value"];

export const ACQUISITION_MOTIVATIONS = [
  { value: "build_up",               label: "Build-up" },
  { value: "diversification",        label: "Diversification" },
  { value: "vertical_integration",   label: "Intégration verticale" },
  { value: "financial",              label: "Investissement financier" },
  { value: "geographic_expansion",   label: "Expansion géographique" },
  { value: "technology_acquisition", label: "Acquisition technologique" },
] as const;

export type AcquisitionMotivation = (typeof ACQUISITION_MOTIVATIONS)[number]["value"];

// ── Maturité cession M&A (organizations type = target) ───────────────────────

export const SALE_READINESS_OPTIONS = [
  { value: "not_for_sale",     label: "Pas en vente",       bg: "#F3F4F6", tx: "#6B7280" },
  { value: "open",             label: "Ouvert aux offres",  bg: "#FEF3C7", tx: "#92400E" },
  { value: "actively_selling", label: "En cession active",  bg: "#D1FAE5", tx: "#065F46" },
] as const;

export type SaleReadiness = (typeof SALE_READINESS_OPTIONS)[number]["value"];

// ── Secteurs ─────────────────────────────────────────────────────────────────

export const SECTORS = [
  "SaaS", "Fintech", "Healthtech", "Deeptech", "Cybersécurité",
  "Industrie", "Retail", "Energie", "Immobilier", "Transport",
  "Food", "Edtech", "Marketplace", "Hardware", "Impact", "Social",
  "Généraliste", "PropTech", "InsurTech", "RegTech", "HRtech",
  "CleanTech", "BioTech", "MedTech", "Pharma", "Défense",
  "Aéronautique", "Luxe", "Média", "Sport", "Services B2B",
  "Conseil", "Infrastructure",
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
  "Santé / Medtech":             "MedTech",
  "Industrie / Manufacturing":   "Industrie",
  "Énergie / CleanTech":         "CleanTech",
  "Immobilier":                  "Immobilier",
  "Distribution / Retail":       "Retail",
  "Médias / Entertainment":      "Média",
  "Transport / Logistique":      "Transport",
  "Agroalimentaire":             "Food",
  "Éducation / EdTech":          "Edtech",
  "Défense / Sécurité":          "Défense",
  "Tourisme / Hospitality":      "Sport",
  "Services B2B":                "Services B2B",
  "Conseil / Advisory":          "Conseil",
  "Juridique":                   "Conseil",
  "Finance / Investissement":    "Fintech",
  "Ressources Humaines":         "HRtech",
  "Luxe / Premium":              "Luxe",
  "Construction / BTP":          "Industrie",
  "Télécommunications":          "Infrastructure",
  "Agriculture / AgriTech":      "Food",
  "Chimie / Matériaux":          "Industrie",
  "Aérospatial":                 "Aéronautique",
  "Environnement":               "Energie",
  "Sport / Loisirs":             "Sport",
  "Bien-être / Beauté":          "Luxe",
  "Cybersécurité":               "Cybersécurité",
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

// ── Géographies — référentiel unique CRM ─────────────────────────────────────

export const GEO_ZONES = [
  "france", "benelux", "dach", "europe_sud", "nordics",
  "europe_est", "uk_ireland", "ue", "europe",
  "amerique_nord", "amerique_sud", "asie",
  "moyen_orient", "afrique", "global",
] as const;

export const GEO_REGIONS_FRANCE = [
  "ile_de_france", "auvergne_rhone_alpes", "paca",
  "occitanie", "nouvelle_aquitaine", "bretagne",
  "grand_est", "hauts_de_france", "normandie",
  "pays_de_la_loire", "centre_val_de_loire",
  "bourgogne_franche_comte", "dom_tom",
] as const;

export const GEO_REGIONS_SUISSE = [
  "suisse_romande",
  "suisse_alemanique",
  "suisse_italienne",
] as const;

export const GEO_ALL = [...GEO_ZONES, ...GEO_REGIONS_FRANCE, ...GEO_REGIONS_SUISSE] as const;
export type GeoValue = (typeof GEO_ALL)[number];

export const GEO_LABELS: Record<string, string> = {
  france:                  "France",
  benelux:                 "Benelux (BE, NL, LU)",
  dach:                    "DACH (DE, AT, CH)",
  europe_sud:              "Europe du Sud",
  nordics:                 "Nordics",
  europe_est:              "Europe de l'Est",
  uk_ireland:              "UK / Irlande",
  ue:                      "Union Européenne",
  europe:                  "Europe (hors UE)",
  amerique_nord:           "Amérique du Nord",
  amerique_sud:            "Amérique du Sud",
  asie:                    "Asie",
  moyen_orient:            "Moyen-Orient",
  afrique:                 "Afrique",
  global:                  "Global / Worldwide",
  ile_de_france:           "Île-de-France",
  auvergne_rhone_alpes:    "Auvergne-Rhône-Alpes",
  paca:                    "PACA",
  occitanie:               "Occitanie",
  nouvelle_aquitaine:      "Nouvelle-Aquitaine",
  bretagne:                "Bretagne",
  grand_est:               "Grand Est",
  hauts_de_france:         "Hauts-de-France",
  normandie:               "Normandie",
  pays_de_la_loire:        "Pays de la Loire",
  centre_val_de_loire:     "Centre-Val de Loire",
  bourgogne_franche_comte: "Bourgogne-Franche-Comté",
  dom_tom:                 "DOM-TOM",
  suisse_romande:          "Suisse romande (GE, VD, VS, FR, NE, JU)",
  suisse_alemanique:       "Suisse alémanique (ZH, BS, BE, SG, LU)",
  suisse_italienne:        "Suisse italienne (Tessin / Ticino)",
};

// Backward compat : ancien format { value, label } pour composants existants
export const GEOGRAPHIES = GEO_ZONES.map(v => ({ value: v, label: GEO_LABELS[v] ?? v }));
export type Geography = (typeof GEO_ZONES)[number];

export const GEO_COMPATIBILITY: Record<string, string[]> = {
  global: [...GEO_ZONES, ...GEO_REGIONS_FRANCE, ...GEO_REGIONS_SUISSE],
  europe: ["france", "benelux", "dach", "europe_sud", "nordics", "europe_est", "uk_ireland", "ue", "europe", ...GEO_REGIONS_FRANCE, ...GEO_REGIONS_SUISSE],
  ue: ["france", "benelux", "dach", "europe_sud", "nordics", "europe_est", "ue", ...GEO_REGIONS_FRANCE, ...GEO_REGIONS_SUISSE],
  france:                  ["france", ...GEO_REGIONS_FRANCE],
  benelux:                 ["benelux"],
  dach:                    ["dach", "suisse_romande", "suisse_alemanique", "suisse_italienne"],
  europe_sud:              ["europe_sud"],
  nordics:                 ["nordics"],
  europe_est:              ["europe_est"],
  uk_ireland:              ["uk_ireland"],
  amerique_nord:           ["amerique_nord"],
  amerique_sud:            ["amerique_sud"],
  asie:                    ["asie"],
  moyen_orient:            ["moyen_orient"],
  afrique:                 ["afrique"],
  ile_de_france:           ["ile_de_france", "france"],
  auvergne_rhone_alpes:    ["auvergne_rhone_alpes", "france"],
  paca:                    ["paca", "france"],
  occitanie:               ["occitanie", "france"],
  nouvelle_aquitaine:      ["nouvelle_aquitaine", "france"],
  bretagne:                ["bretagne", "france"],
  grand_est:               ["grand_est", "france"],
  hauts_de_france:         ["hauts_de_france", "france"],
  normandie:               ["normandie", "france"],
  pays_de_la_loire:        ["pays_de_la_loire", "france"],
  centre_val_de_loire:     ["centre_val_de_loire", "france"],
  bourgogne_franche_comte: ["bourgogne_franche_comte", "france"],
  dom_tom:                 ["dom_tom", "france"],
  suisse_romande:          ["suisse_romande", "dach", "france"],
  suisse_alemanique:       ["suisse_alemanique", "dach"],
  suisse_italienne:        ["suisse_italienne", "dach"],
};

/** Score géographique (plus utilisé directement — le scoring est dans matching.ts) */
export function scoreGeography(
  dealGeo: string | null | undefined,
  investorGeos: string[],
): number {
  if (!dealGeo || !investorGeos?.length) return 0;
  const compatible = GEO_COMPATIBILITY[dealGeo] ?? [dealGeo];
  if (investorGeos.some(g => compatible.includes(g) || g === "global")) return 15;
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

// ── Round types (Fundraising) ────────────────────────────────────────────────

export const ROUND_TYPES = [
  { value: "seed",         label: "Seed" },
  { value: "pre-series-a", label: "Pre-Series A" },
  { value: "series-a",     label: "Series A" },
  { value: "series-b",     label: "Series B" },
  { value: "growth",       label: "Growth" },
  { value: "bridge",       label: "Bridge" },
  { value: "convertible",  label: "Convertible" },
] as const;

export type RoundType = (typeof ROUND_TYPES)[number]["value"];

// ── Deal timing (M&A) ────────────────────────────────────────────────────────

export const DEAL_TIMING_OPTIONS = [
  { value: "now",      label: "Immédiat" },
  { value: "6months",  label: "Sous 6 mois" },
  { value: "1year",    label: "Sous 1 an" },
  { value: "2years+",  label: "Plus de 2 ans" },
] as const;

export type DealTiming = (typeof DEAL_TIMING_OPTIONS)[number]["value"];

// ── Devises (multi-devise cabinet) ───────────────────────────────────────────

export const CURRENCIES = [
  { value: "EUR", label: "EUR (€)", symbol: "€" },
  { value: "CHF", label: "CHF",     symbol: "CHF" },
  { value: "USD", label: "USD ($)", symbol: "$" },
  { value: "GBP", label: "GBP (£)", symbol: "£" },
] as const;

export type Currency = (typeof CURRENCIES)[number]["value"];

// ── Deal stages (pipeline kanban) ────────────────────────────────────────────

export const DEAL_STAGES = [
  { value: "kickoff",             label: "Kickoff" },
  { value: "preparation",         label: "Préparation" },
  { value: "outreach",            label: "Outreach" },
  { value: "management_meetings", label: "Mgmt meetings" },
  { value: "dd",                  label: "Due Diligence" },
  { value: "negotiation",         label: "Négociation" },
  { value: "closing",             label: "Closing" },
  { value: "post_closing",        label: "Post-closing" },
  { value: "ongoing_support",     label: "Suivi" },
  { value: "search",              label: "Recherche" },
] as const;

export type DealStage = (typeof DEAL_STAGES)[number]["value"];

// Stages affichés par défaut dans le kanban actif.
// post_closing, ongoing_support, search sont masqués si colonne vide
// (cf. logique UI dans deals-kanban.tsx).
export const DEAL_STAGES_MAIN: readonly DealStage[] = [
  "kickoff", "preparation", "outreach", "management_meetings",
  "dd", "negotiation", "closing",
] as const;

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
