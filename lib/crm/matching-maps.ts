// ─────────────────────────────────────────────────────────────────────────────
// Source de vérité unique — matching investisseurs, M&A, référentiels orgs
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

// ── Critères small cap du matching acquéreurs (v67, phase 3) ─────────────────

/** Contexte de l'opération côté cédant (deals.deal_context). */
export const DEAL_CONTEXTS = [
  { value: "succession",   label: "Succession / départ du dirigeant" },
  { value: "mbo",          label: "MBO, reprise par le management" },
  { value: "build_up",     label: "Cession à un consolidateur" },
  { value: "carve_out",    label: "Carve-out / filiale détourée" },
  { value: "croissance",   label: "Adossement pour croissance" },
  { value: "retournement", label: "Retournement / situation spéciale" },
] as const;

export type DealContext = (typeof DEAL_CONTEXTS)[number]["value"];

/** Opérations que pratique un acquéreur (organizations.operation_types). */
export const OPERATION_TYPES = [
  { value: "succession",             label: "Reprise en transmission" },
  { value: "mbi",                    label: "MBI, reprise en direct" },
  { value: "mbo_sponsor",            label: "Sponsor de MBO" },
  { value: "build_up",               label: "Build-up / consolidation" },
  { value: "carve_out",              label: "Carve-out" },
  { value: "minoritaire_croissance", label: "Minoritaire de croissance" },
  { value: "retournement",           label: "Retournement" },
] as const;

export type OperationType = (typeof OPERATION_TYPES)[number]["value"];

/** Position capitalistique de l'acquéreur (organizations.deal_stance). */
export const DEAL_STANCES = [
  { value: "majority", label: "Majoritaire uniquement" },
  { value: "minority", label: "Minoritaire uniquement" },
  { value: "both",     label: "Majoritaire ou minoritaire" },
] as const;

export type DealStance = (typeof DEAL_STANCES)[number]["value"];

/**
 * Compatibilité contexte du dossier → opérations de l'acquéreur.
 * exact = cœur de métier (20 pts) ; compatible = jouable (12 pts) ;
 * incompatible = structurellement impossible. Une opération déclarée
 * absente des trois listes est traitée « compatible » (tolérance).
 * Éliminatoire seulement si TOUTES les opérations déclarées sont
 * incompatibles (décision grille 2026-07-30).
 */
export const CONTEXT_OPERATION_COMPAT: Record<DealContext, {
  exact: OperationType[];
  incompatible: OperationType[];
}> = {
  succession:   { exact: ["succession", "mbi", "build_up"],  incompatible: ["minoritaire_croissance"] },
  mbo:          { exact: ["mbo_sponsor"],                    incompatible: ["mbi"] },
  build_up:     { exact: ["build_up"],                       incompatible: [] },
  carve_out:    { exact: ["carve_out"],                      incompatible: ["minoritaire_croissance"] },
  croissance:   { exact: ["minoritaire_croissance"],         incompatible: ["mbi", "succession"] },
  retournement: { exact: ["retournement"],                   incompatible: ["minoritaire_croissance"] },
};

/**
 * Adjacences sectorielles (référentiel SECTORS) pour le score secteur du
 * matching acquéreurs : exact 20, adjacent 12. Relation symétrique : le
 * scorer teste les deux sens, chaque paire n'est déclarée qu'une fois.
 */
export const SECTOR_ADJACENCY: Record<string, string[]> = {
  "Industrie":       ["Métallurgie", "Plasturgie", "Chimie", "Emballage", "Automobile", "Aéronautique", "Hardware", "Bois & Ameublement", "Textile", "Imprimerie"],
  "Métallurgie":     ["Automobile", "Aéronautique"],
  "Plasturgie":      ["Emballage", "Chimie"],
  "Chimie":          ["Pharma", "CleanTech"],
  "Textile":         ["Luxe"],
  "Bois & Ameublement": ["BTP"],
  "Emballage":       ["Imprimerie"],
  "Imprimerie":      ["Média"],
  "Pharma":          ["BioTech", "MedTech", "Healthtech"],
  "Aéronautique":    ["Défense"],
  "Défense":         ["Cybersécurité", "Sécurité privée"],
  "Automobile":      ["Transport"],
  "BTP":             ["Immobilier", "Infrastructure"],
  "Immobilier":      ["Infrastructure", "PropTech"],
  "Infrastructure":  ["Energie"],
  "Négoce":          ["Retail", "Logistique", "Services B2B"],
  "Retail":          ["Food", "Luxe", "Marketplace"],
  "Food":            ["Agroalimentaire", "Hôtellerie-Restauration"],
  "Agroalimentaire": ["Agriculture"],
  "Transport":       ["Logistique"],
  "Services B2B":    ["Conseil", "Propreté & Facility", "Sécurité privée", "Formation", "HRtech"],
  "Conseil":         ["Formation"],
  "Propreté & Facility": ["Sécurité privée"],
  "Formation":       ["Edtech"],
  "Santé & Médico-social": ["Healthtech", "MedTech"],
  "Hôtellerie-Restauration": ["Sport"],
  "Energie":         ["CleanTech"],
  "SaaS":            ["Marketplace", "Fintech", "HRtech", "Edtech", "RegTech", "InsurTech", "Cybersécurité", "PropTech"],
  "Fintech":         ["InsurTech", "RegTech"],
  "Healthtech":      ["MedTech", "BioTech"],
  "Deeptech":        ["Hardware", "BioTech", "CleanTech"],
  "Média":           ["Sport"],
};

/** Adjacence symétrique entre deux secteurs du référentiel. */
export function sectorsAreAdjacent(a: string, b: string): boolean {
  if (!a || !b || a === b) return false;
  return (SECTOR_ADJACENCY[a] ?? []).includes(b) || (SECTOR_ADJACENCY[b] ?? []).includes(a);
}

// ── Maturité cession M&A (organizations type = target) ───────────────────────

export const SALE_READINESS_OPTIONS = [
  { value: "not_for_sale",     label: "Pas en vente",       bg: "#F3F4F6", tx: "#6B7280" },
  { value: "open",             label: "Ouvert aux offres",  bg: "#FEF3C7", tx: "#92400E" },
  { value: "actively_selling", label: "En cession active",  bg: "#D1FAE5", tx: "#065F46" },
] as const;

export type SaleReadiness = (typeof SALE_READINESS_OPTIONS)[number]["value"];

// ── Secteurs ─────────────────────────────────────────────────────────────────

export const SECTORS = [
  // Tech / innovation
  "SaaS", "Fintech", "Healthtech", "Deeptech", "Cybersécurité",
  "Edtech", "Marketplace", "Hardware", "PropTech", "InsurTech",
  "RegTech", "HRtech", "CleanTech", "BioTech", "MedTech",
  // Industrie et matériaux
  "Industrie", "Métallurgie", "Plasturgie", "Chimie", "Textile",
  "Bois & Ameublement", "Emballage", "Imprimerie", "Pharma",
  "Aéronautique", "Défense", "Automobile",
  // Construction et immobilier
  "BTP", "Immobilier", "Infrastructure",
  // Commerce et distribution
  "Négoce", "Retail", "Luxe", "Food",
  // Agro
  "Agroalimentaire", "Agriculture",
  // Transport et logistique
  "Transport", "Logistique",
  // Services
  "Services B2B", "Conseil", "Propreté & Facility", "Sécurité privée",
  "Formation", "Santé & Médico-social", "Hôtellerie-Restauration",
  // Autres
  "Energie", "Média", "Sport", "Impact", "Social", "Généraliste",
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
  "Agroalimentaire":             "Agroalimentaire",
  "Éducation / EdTech":          "Edtech",
  "Défense / Sécurité":          "Défense",
  "Tourisme / Hospitality":      "Hôtellerie-Restauration",
  "Services B2B":                "Services B2B",
  "Conseil / Advisory":          "Conseil",
  "Juridique":                   "Conseil",
  "Finance / Investissement":    "Fintech",
  "Ressources Humaines":         "HRtech",
  "Luxe / Premium":              "Luxe",
  "Construction / BTP":          "BTP",
  "Télécommunications":          "Infrastructure",
  "Agriculture / AgriTech":      "Agriculture",
  "Chimie / Matériaux":          "Chimie",
  "Aérospatial":                 "Aéronautique",
  "Environnement":               "Energie",
  "Sport / Loisirs":             "Sport",
  "Bien-être / Beauté":          "Luxe",
  "Cybersécurité":               "Cybersécurité",
  // Small cap traditionnel (pivot M&A 2026)
  "Négoce / Distribution B2B":   "Négoce",
  "Logistique":                  "Logistique",
  "Propreté / Nettoyage":        "Propreté & Facility",
  "Sécurité / Gardiennage":      "Sécurité privée",
  "Santé / Médico-social":       "Santé & Médico-social",
  "Hôtellerie / Restauration":   "Hôtellerie-Restauration",
  "Formation / Organisme":       "Formation",
  "Automobile":                  "Automobile",
  "Métallurgie / Usinage":       "Métallurgie",
  "Plasturgie":                  "Plasturgie",
  "Textile / Habillement":       "Textile",
  "Bois / Ameublement":          "Bois & Ameublement",
  "Emballage / Packaging":       "Emballage",
  "Imprimerie / Print":          "Imprimerie",
};

// ── NAF → secteur ────────────────────────────────────────────────────────────
// Mapping par DIVISION NAF rév. 2 (2 premiers chiffres du code APE). C'est le
// niveau le plus robuste : la sous-classe (ex. 43.21A) est trop fine pour un
// référentiel de matching, la section (lettre) trop grossière.
// Source de vérité pour rattacher automatiquement une organisation enrichie
// (Pappers / INSEE / Recherche d'Entreprises) à un secteur du référentiel.

export const NAF_DIVISION_TO_SECTOR: Record<string, string> = {
  // Agriculture, sylviculture, pêche
  "01": "Agriculture", "02": "Agriculture", "03": "Agriculture",
  // Industries extractives
  "05": "Industrie", "06": "Industrie", "07": "Industrie", "08": "Industrie", "09": "Industrie",
  // Industrie manufacturière
  "10": "Agroalimentaire", "11": "Agroalimentaire", "12": "Agroalimentaire",
  "13": "Textile", "14": "Textile", "15": "Textile",
  "16": "Bois & Ameublement",
  "17": "Emballage", "18": "Imprimerie",
  "19": "Chimie", "20": "Chimie", "21": "Pharma", "22": "Plasturgie",
  "23": "Industrie",
  "24": "Métallurgie", "25": "Métallurgie",
  "26": "Hardware", "27": "Industrie", "28": "Industrie",
  "29": "Automobile", "30": "Aéronautique",
  "31": "Bois & Ameublement", "32": "Industrie", "33": "Industrie",
  // Énergie, eau, déchets
  "35": "Energie", "36": "Energie", "37": "Energie", "38": "Energie", "39": "Energie",
  // Construction
  "41": "BTP", "42": "BTP", "43": "BTP",
  // Commerce
  "45": "Automobile", "46": "Négoce", "47": "Retail",
  // Transport et entreposage
  "49": "Transport", "50": "Transport", "51": "Transport",
  "52": "Logistique", "53": "Logistique",
  // Hébergement et restauration
  "55": "Hôtellerie-Restauration", "56": "Hôtellerie-Restauration",
  // Information et communication
  "58": "Média", "59": "Média", "60": "Média",
  "61": "Infrastructure", "62": "SaaS", "63": "SaaS",
  // Finance et assurance
  "64": "Fintech", "65": "InsurTech", "66": "Fintech",
  // Immobilier
  "68": "Immobilier",
  // Services scientifiques et techniques
  "69": "Conseil", "70": "Conseil", "71": "Conseil",
  "72": "Deeptech", "73": "Média", "74": "Conseil", "75": "Services B2B",
  // Services administratifs et de soutien
  "77": "Services B2B", "78": "HRtech", "79": "Services B2B",
  "80": "Sécurité privée", "81": "Propreté & Facility", "82": "Services B2B",
  // Administration, enseignement, santé
  "84": "Services B2B", "85": "Formation",
  "86": "Santé & Médico-social", "87": "Santé & Médico-social", "88": "Santé & Médico-social",
  // Arts, autres services
  "90": "Média", "91": "Média", "92": "Sport", "93": "Sport",
  "94": "Social", "95": "Services B2B", "96": "Services B2B",
};

/**
 * Déduit le secteur du référentiel à partir d'un code NAF/APE.
 * Tolère les formats "43.21A", "4321A", "43.21", "43" (avec espaces).
 * Renvoie null si le code est absent ou hors nomenclature.
 */
export function sectorFromNaf(naf: string | null | undefined): string | null {
  if (!naf) return null;
  const digits = naf.replace(/[^0-9]/g, "");
  if (digits.length < 2) return null;
  return NAF_DIVISION_TO_SECTOR[digits.slice(0, 2)] ?? null;
}

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

// ── Stades par métier (V55) ──────────────────────────────────────────────────
// Source de vérité unique pour le kanban adaptatif et le sélecteur de stade
// dans la fiche dossier. Chaque deal_type a sa propre séquence ordonnée.
// L'ordre = l'ordre d'avancement normal du dossier.
//
// Les anciennes valeurs transversales (DEAL_STAGES ci-dessus) sont conservées
// pour rétro-compat, mais n'alimentent plus les UI de pilotage.

export const STAGE_LABELS_BY_KEY: Record<string, string> = {
  kickoff:           "Kickoff",
  preparation:       "Préparation",
  outreach:          "Outreach",
  meetings:          "Meetings",
  term_sheets:       "Term sheets",
  loi:               "LOI",
  dd:                "Due Diligence",
  spa:               "SPA",
  criteria:          "Critères",
  sourcing:          "Sourcing",
  pre_qualification: "Pré-qualification",
  interviews:        "Entretiens client",
  offer:             "Offre",
  placement:         "Placement",
  probation:         "Période d'essai",
  onboarding:        "Onboarding",
  delivery:          "Delivery",
  support:           "Suivi",
  closing:           "Closing",
  post_closing:      "Post-closing",
};

export type DealTypeKey = "ma_sell" | "ma_buy";

export const DEAL_STAGES_BY_TYPE: Record<DealTypeKey, readonly string[]> = {
  ma_sell:     ["kickoff", "preparation", "outreach", "meetings", "loi", "dd", "spa", "closing", "post_closing"],
  ma_buy:      ["kickoff", "criteria", "sourcing", "outreach", "loi", "dd", "spa", "closing"],
} as const;

// Stages affichés par défaut dans le kanban actif (exclut les états "après
// l'opération" qui polluent le pipeline opérationnel).
export const DEAL_STAGES_MAIN_BY_TYPE: Record<DealTypeKey, readonly string[]> = {
  ma_sell:     ["kickoff", "preparation", "outreach", "meetings", "loi", "dd", "spa", "closing"],
  ma_buy:      ["kickoff", "criteria", "sourcing", "outreach", "loi", "dd", "spa", "closing"],
} as const;

export function stagesForDealType(type: string | null | undefined): readonly string[] {
  if (!type) return DEAL_STAGES_BY_TYPE.ma_sell;
  return DEAL_STAGES_BY_TYPE[type as DealTypeKey] ?? DEAL_STAGES_BY_TYPE.ma_sell;
}

export function stageLabel(stageKey: string | null | undefined): string {
  if (!stageKey) return "";
  return STAGE_LABELS_BY_KEY[stageKey] ?? stageKey;
}

export function isValidStageForType(type: string | null | undefined, stage: string | null | undefined): boolean {
  if (!stage) return false;
  return stagesForDealType(type).includes(stage);
}

// Renvoie le stade suivant dans la séquence du type (ou null si dernier).
export function nextStageForType(type: string | null | undefined, current: string | null | undefined): string | null {
  const seq = stagesForDealType(type);
  if (!current) return seq[0] ?? null;
  const idx = seq.indexOf(current);
  if (idx < 0 || idx >= seq.length - 1) return null;
  return seq[idx + 1] ?? null;
}

export function prevStageForType(type: string | null | undefined, current: string | null | undefined): string | null {
  const seq = stagesForDealType(type);
  if (!current) return null;
  const idx = seq.indexOf(current);
  if (idx <= 0) return null;
  return seq[idx - 1] ?? null;
}

// ── M2 — Vivier proactif (V56) ───────────────────────────────────────────────
// Enums pour deal_target_suggestions et connector_runs. Source de vérité pour
// les filtres UI, les validations Server Actions et les libellés.

export const SUGGESTION_STATUSES = [
  { value: "suggested", label: "À évaluer",  tone: "neutral" },
  { value: "approved",  label: "Approuvée",  tone: "success" },
  { value: "rejected",  label: "Rejetée",    tone: "danger"  },
  { value: "deferred",  label: "Reportée",   tone: "warning" },
  { value: "contacted", label: "Contactée",  tone: "info"    },
] as const;

export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number]["value"];

// Aligné sur dts_role_check (migration v56) : le SQL accepte 6 rôles, le TS
// n'en listait que 3 (un rôle investor/candidate/partner s'affichait brut).
export const SUGGESTION_ROLES = [
  { value: "target",    label: "Cible",                context: "ma_sell,ma_buy" },
  { value: "acquirer",  label: "Acquéreur",            context: "ma_sell"         },
  { value: "investor",  label: "Fonds",                context: "ma_sell"         },
  { value: "candidate", label: "Candidat",             context: "*"                },
  { value: "partner",   label: "Partenaire",           context: "*"                },
  { value: "other",     label: "Autre",                context: "*"                },
] as const;

export type SuggestionRole = (typeof SUGGESTION_ROLES)[number]["value"];

export const CONNECTOR_SOURCES = [
  { value: "apollo",   label: "Apollo.io"   },
  { value: "harmonic", label: "Harmonic"    },
  { value: "vibe",     label: "Vibe"        },
  { value: "pappers",  label: "Pappers"     },
  { value: "insee",    label: "INSEE"       },
  { value: "manual",   label: "Manuel"      },
  { value: "ai",       label: "IA"          },
  { value: "portal",   label: "Portail"     },
] as const;

export type ConnectorSource = (typeof CONNECTOR_SOURCES)[number]["value"];

export function suggestionStatusLabel(status: string | null | undefined): string {
  if (!status) return "";
  return SUGGESTION_STATUSES.find(s => s.value === status)?.label ?? status;
}

export function suggestionRoleLabel(role: string | null | undefined): string {
  if (!role) return "";
  return SUGGESTION_ROLES.find(r => r.value === role)?.label ?? role;
}

export function connectorSourceLabel(source: string | null | undefined): string {
  if (!source) return "";
  return CONNECTOR_SOURCES.find(c => c.value === source)?.label ?? source;
}

// Rôles par défaut par type de dossier (utilisé à la génération de
// suggestions pour pré-remplir role_suggested).
export function defaultSuggestionRoleForDealType(dealType: string | null | undefined): SuggestionRole {
  switch (dealType) {
    case "ma_sell":     return "acquirer";
    case "ma_buy":      return "target";
    default:            return "other";
  }
}

// ── Screening qualifié du dossier (V53) ──────────────────────────────────────
// Hard gate : seuls les dossiers en SCREENING_READY déclenchent les
// suggestions proactives (Module 2) et les campagnes sortantes (Module 3).

export const SCREENING_STATUSES = [
  { value: "not_started",        label: "À démarrer",         tone: "neutral" },
  { value: "drafting",           label: "En rédaction",       tone: "warning" },
  { value: "ready_for_outreach", label: "Prêt pour outreach", tone: "success" },
  { value: "on_hold",            label: "En pause",           tone: "neutral" },
] as const;

export type ScreeningStatus = (typeof SCREENING_STATUSES)[number]["value"];

export const SCREENING_READY: ScreeningStatus = "ready_for_outreach";

export function isScreeningReady(status: string | null | undefined): boolean {
  return status === SCREENING_READY;
}

