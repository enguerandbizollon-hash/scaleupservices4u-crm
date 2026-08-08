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

// ── Secteurs : compatibilité par FAMILLE (réforme small cap FR 2026-08) ───────
// Le référentiel a deux niveaux (voir SECTOR_GROUPS / SECTORS plus bas) :
// familles (grossier, produit par le NAF) et feuilles (précis, choix manuel).
// Deux secteurs sont compatibles/adjacents s'ils partagent la même famille :
// une feuille « Génie climatique / CVC » matche un org classé « BTP &
// Construction ». « Généraliste » est passe-partout.

/** Compatibilité de scoring : identiques, ou même famille, ou Généraliste. */
export function sectorsCompatible(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a === b || a === "Généraliste" || b === "Généraliste") return true;
  return (SECTOR_TO_FAMILY[a] ?? a) === (SECTOR_TO_FAMILY[b] ?? b);
}

/** Adjacence secteur (matching acquéreurs) : même famille = adjacent. */
export function sectorsAreAdjacent(a: string, b: string): boolean {
  if (!a || !b || a === b) return false;
  return (SECTOR_TO_FAMILY[a] ?? a) === (SECTOR_TO_FAMILY[b] ?? b);
}

// ── Maturité cession M&A (organizations type = target) ───────────────────────

export const SALE_READINESS_OPTIONS = [
  { value: "not_for_sale",     label: "Pas en vente",       bg: "#F3F4F6", tx: "#6B7280" },
  { value: "open",             label: "Ouvert aux offres",  bg: "#FEF3C7", tx: "#92400E" },
  { value: "actively_selling", label: "En cession active",  bg: "#D1FAE5", tx: "#065F46" },
] as const;

export type SaleReadiness = (typeof SALE_READINESS_OPTIONS)[number]["value"];

// ── Secteurs : SOURCE DE VÉRITÉ unique (small cap FR) ─────────────────────────
// Deux niveaux. FAMILLES = grossier, produit par l'auto-classification NAF et
// niveau de compatibilité du scoring. FEUILLES = précis, pour le choix manuel
// des critères d'un mandat. Le tech RÉEL est conservé (SaaS, ESN, cyber...) ;
// le pur jargon startup et l'international sont retirés.
export const SECTOR_GROUPS: { family: string; options: string[] }[] = [
  { family: "BTP & Construction", options: [
    "Gros œuvre", "Second œuvre", "Génie climatique / CVC", "Électricité / Courants faibles",
    "Couverture / Étanchéité", "Menuiserie / Agencement", "Travaux publics / VRD", "Peinture / Finitions",
  ] },
  { family: "Industrie & Production", options: [
    "Métallurgie / Travail des métaux", "Mécanique / Usinage", "Plasturgie / Composites",
    "Électronique / Électrotechnique", "Chimie / Cosmétique", "Textile / Habillement",
    "Bois / Ameublement", "Emballage / Packaging", "Imprimerie / Arts graphiques",
    "Automobile (équipementier)", "Aéronautique / Défense", "Industrie agroalimentaire", "Autres industries",
  ] },
  { family: "Négoce & Distribution B2B", options: [
    "Négoce de matériaux BTP", "Négoce industriel", "Commerce de gros alimentaire", "Commerce de gros non-alimentaire",
  ] },
  { family: "Transport & Logistique", options: [
    "Transport routier de marchandises", "Logistique / Entreposage", "Messagerie / Dernier km", "Transport de personnes",
  ] },
  { family: "Services aux entreprises", options: [
    "Conseil / Ingénierie", "Propreté / Facility management", "Sécurité privée / Gardiennage",
    "Intérim / RH", "Maintenance industrielle", "Marketing / Communication / Média", "Formation professionnelle",
  ] },
  { family: "Numérique & Tech", options: [
    "Éditeurs de logiciels / SaaS", "ESN / Infogérance", "Agences web / digital",
    "Cybersécurité", "Marketplace / plateforme", "Télécoms",
  ] },
  { family: "Santé & Médico-social", options: [
    "EHPAD / Médico-social", "Services à la personne / Aide à domicile", "Laboratoires / Analyses",
    "Pharmacie / Parapharmacie", "Cabinets / Cliniques",
  ] },
  { family: "Agriculture & Agro", options: [
    "Agriculture / Élevage", "Viticulture / Vins & spiritueux", "Transformation alimentaire artisanale",
  ] },
  { family: "Commerce & CHR", options: [
    "Hôtellerie / Restauration", "Commerce de détail spécialisé", "E-commerce", "Loisirs / Sport",
  ] },
  { family: "Immobilier & Énergie", options: [
    "Promotion immobilière", "Administration de biens / Syndic", "Énergies renouvelables", "Environnement / Déchets / Recyclage",
  ] },
  { family: "Services financiers", options: [
    "Expertise comptable / Audit", "Courtage (assurance / crédit)", "Fintech / Assurtech",
  ] },
];

/** Les 11 familles (niveau grossier, cible du mapping NAF). */
export const SECTOR_FAMILIES: string[] = SECTOR_GROUPS.map((g) => g.family);

/** Référentiel complet : familles + feuilles + Généraliste (passe-partout). */
export const SECTORS: readonly string[] = [
  ...SECTOR_FAMILIES,
  ...SECTOR_GROUPS.flatMap((g) => g.options),
  "Généraliste",
];

export type Sector = string;

/** Feuille ou famille -> famille (une famille se mappe sur elle-même). */
export const SECTOR_TO_FAMILY: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const g of SECTOR_GROUPS) {
    m[g.family] = g.family;
    for (const o of g.options) m[o] = g.family;
  }
  return m;
})();

/**
 * Normalise toute ancienne valeur de secteur (référentiel pré-2026 ou texte
 * long du formulaire) vers le référentiel actuel (familles + feuilles), pour
 * que les deals/orgs existants continuent de scorer. Cible ⊆ SECTORS (garanti
 * par tests/sector-taxonomy.test.ts).
 */
export const DEAL_SECTOR_NORMALIZATION: Record<string, string> = {
  // Anciens libellés courts (référentiel pré-2026, dont tech retiré)
  "SaaS": "Éditeurs de logiciels / SaaS",
  "Fintech": "Fintech / Assurtech",
  "InsurTech": "Fintech / Assurtech",
  "Healthtech": "Cabinets / Cliniques",
  "MedTech": "Santé & Médico-social",
  "BioTech": "Industrie & Production",
  "Deeptech": "Numérique & Tech",
  "RegTech": "Numérique & Tech",
  "Cybersécurité": "Cybersécurité",
  "Edtech": "Formation professionnelle",
  "Marketplace": "Marketplace / plateforme",
  "Hardware": "Électronique / Électrotechnique",
  "PropTech": "Immobilier & Énergie",
  "HRtech": "Intérim / RH",
  "CleanTech": "Énergies renouvelables",
  "Industrie": "Industrie & Production",
  "Métallurgie": "Métallurgie / Travail des métaux",
  "Plasturgie": "Plasturgie / Composites",
  "Chimie": "Chimie / Cosmétique",
  "Textile": "Textile / Habillement",
  "Bois & Ameublement": "Bois / Ameublement",
  "Emballage": "Emballage / Packaging",
  "Imprimerie": "Imprimerie / Arts graphiques",
  "Pharma": "Industrie & Production",
  "Aéronautique": "Aéronautique / Défense",
  "Défense": "Aéronautique / Défense",
  "Automobile": "Automobile (équipementier)",
  "BTP": "BTP & Construction",
  "Immobilier": "Immobilier & Énergie",
  "Infrastructure": "Travaux publics / VRD",
  "Négoce": "Négoce & Distribution B2B",
  "Retail": "Commerce de détail spécialisé",
  "Luxe": "Commerce de détail spécialisé",
  "Food": "Commerce & CHR",
  "Agroalimentaire": "Industrie agroalimentaire",
  "Agriculture": "Agriculture / Élevage",
  "Transport": "Transport & Logistique",
  "Logistique": "Logistique / Entreposage",
  "Services B2B": "Services aux entreprises",
  "Conseil": "Conseil / Ingénierie",
  "Propreté & Facility": "Propreté / Facility management",
  "Sécurité privée": "Sécurité privée / Gardiennage",
  "Formation": "Formation professionnelle",
  "Santé & Médico-social": "Santé & Médico-social",
  "Hôtellerie-Restauration": "Hôtellerie / Restauration",
  "Energie": "Immobilier & Énergie",
  "Média": "Marketing / Communication / Média",
  "Sport": "Loisirs / Sport",
  "Impact": "Généraliste",
  "Social": "Services à la personne / Aide à domicile",
  "Généraliste": "Généraliste",
  // Anciens libellés longs (formulaire deals pré-refonte)
  "Technologie / SaaS": "Éditeurs de logiciels / SaaS",
  "Intelligence Artificielle": "Numérique & Tech",
  "Fintech / Insurtech": "Fintech / Assurtech",
  "Santé / Medtech": "Santé & Médico-social",
  "Industrie / Manufacturing": "Industrie & Production",
  "Énergie / CleanTech": "Énergies renouvelables",
  "Distribution / Retail": "Commerce de détail spécialisé",
  "Médias / Entertainment": "Marketing / Communication / Média",
  "Transport / Logistique": "Transport & Logistique",
  "Éducation / EdTech": "Formation professionnelle",
  "Défense / Sécurité": "Aéronautique / Défense",
  "Tourisme / Hospitality": "Hôtellerie / Restauration",
  "Conseil / Advisory": "Conseil / Ingénierie",
  "Juridique": "Conseil / Ingénierie",
  "Finance / Investissement": "Services financiers",
  "Ressources Humaines": "Intérim / RH",
  "Luxe / Premium": "Commerce de détail spécialisé",
  "Construction / BTP": "BTP & Construction",
  "Télécommunications": "Télécoms",
  "Agriculture / AgriTech": "Agriculture / Élevage",
  "Chimie / Matériaux": "Chimie / Cosmétique",
  "Aérospatial": "Aéronautique / Défense",
  "Environnement": "Environnement / Déchets / Recyclage",
  "Sport / Loisirs": "Loisirs / Sport",
  "Bien-être / Beauté": "Commerce de détail spécialisé",
  "Négoce / Distribution B2B": "Négoce & Distribution B2B",
  "Propreté / Nettoyage": "Propreté / Facility management",
  "Sécurité / Gardiennage": "Sécurité privée / Gardiennage",
  "Santé / Médico-social": "Santé & Médico-social",
  "Hôtellerie / Restauration": "Hôtellerie / Restauration",
  "Formation / Organisme": "Formation professionnelle",
  "Métallurgie / Usinage": "Métallurgie / Travail des métaux",
  "Textile / Habillement": "Textile / Habillement",
  "Bois / Ameublement": "Bois / Ameublement",
  "Emballage / Packaging": "Emballage / Packaging",
  "Imprimerie / Print": "Imprimerie / Arts graphiques",
};

// ── NAF → secteur ────────────────────────────────────────────────────────────
// Mapping par DIVISION NAF rév. 2 (2 premiers chiffres du code APE). C'est le
// niveau le plus robuste : la sous-classe (ex. 43.21A) est trop fine pour un
// référentiel de matching, la section (lettre) trop grossière.
// Source de vérité pour rattacher automatiquement une organisation enrichie
// (Pappers / INSEE / Recherche d'Entreprises) à un secteur du référentiel.

// NAF (division = 2 chiffres) -> FAMILLE. La division est trop grossière pour
// distinguer les feuilles (gros œuvre vs second œuvre) : on classe donc à la
// famille, et le scoring reste compatible feuille<->famille via SECTOR_TO_FAMILY.
export const NAF_DIVISION_TO_SECTOR: Record<string, string> = {
  // Agriculture, sylviculture, pêche
  "01": "Agriculture & Agro", "02": "Agriculture & Agro", "03": "Agriculture & Agro",
  // Industries extractives + manufacturières
  "05": "Industrie & Production", "06": "Industrie & Production", "07": "Industrie & Production", "08": "Industrie & Production", "09": "Industrie & Production",
  "10": "Industrie & Production", "11": "Industrie & Production", "12": "Industrie & Production",
  "13": "Industrie & Production", "14": "Industrie & Production", "15": "Industrie & Production",
  "16": "Industrie & Production", "17": "Industrie & Production", "18": "Industrie & Production",
  "19": "Industrie & Production", "20": "Industrie & Production", "21": "Industrie & Production", "22": "Industrie & Production",
  "23": "Industrie & Production", "24": "Industrie & Production", "25": "Industrie & Production",
  "26": "Industrie & Production", "27": "Industrie & Production", "28": "Industrie & Production",
  "29": "Industrie & Production", "30": "Industrie & Production",
  "31": "Industrie & Production", "32": "Industrie & Production", "33": "Industrie & Production",
  // Énergie, eau, déchets
  "35": "Immobilier & Énergie", "36": "Immobilier & Énergie", "37": "Immobilier & Énergie", "38": "Immobilier & Énergie", "39": "Immobilier & Énergie",
  // Construction
  "41": "BTP & Construction", "42": "BTP & Construction", "43": "BTP & Construction",
  // Commerce
  "45": "Commerce & CHR", "46": "Négoce & Distribution B2B", "47": "Commerce & CHR",
  // Transport et entreposage
  "49": "Transport & Logistique", "50": "Transport & Logistique", "51": "Transport & Logistique",
  "52": "Transport & Logistique", "53": "Transport & Logistique",
  // Hébergement et restauration
  "55": "Commerce & CHR", "56": "Commerce & CHR",
  // Information et communication
  "58": "Numérique & Tech", "59": "Services aux entreprises", "60": "Services aux entreprises",
  "61": "Numérique & Tech", "62": "Numérique & Tech", "63": "Numérique & Tech",
  // Finance et assurance
  "64": "Services financiers", "65": "Services financiers", "66": "Services financiers",
  // Immobilier
  "68": "Immobilier & Énergie",
  // Services scientifiques et techniques
  "69": "Services aux entreprises", "70": "Services aux entreprises", "71": "Services aux entreprises",
  "72": "Services aux entreprises", "73": "Services aux entreprises", "74": "Services aux entreprises", "75": "Services aux entreprises",
  // Services administratifs et de soutien
  "77": "Services aux entreprises", "78": "Services aux entreprises", "79": "Services aux entreprises",
  "80": "Services aux entreprises", "81": "Services aux entreprises", "82": "Services aux entreprises",
  // Administration, enseignement, santé
  "84": "Services aux entreprises", "85": "Services aux entreprises",
  "86": "Santé & Médico-social", "87": "Santé & Médico-social", "88": "Santé & Médico-social",
  // Arts, autres services
  "90": "Services aux entreprises", "91": "Services aux entreprises", "92": "Commerce & CHR", "93": "Commerce & CHR",
  "94": "Services aux entreprises", "95": "Services aux entreprises", "96": "Services aux entreprises",
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

// Périmètre national France (international + Suisse retirés, hérités du
// fundraising). La seule « zone » est la France ; régions et départements
// (lib/crm/departements.ts) portent la granularité.
export const GEO_ZONES = ["france"] as const;

export const GEO_REGIONS_FRANCE = [
  "ile_de_france", "auvergne_rhone_alpes", "paca",
  "occitanie", "nouvelle_aquitaine", "bretagne",
  "grand_est", "hauts_de_france", "normandie",
  "pays_de_la_loire", "centre_val_de_loire",
  "bourgogne_franche_comte", "corse", "dom_tom",
] as const;

export const GEO_ALL = [...GEO_ZONES, ...GEO_REGIONS_FRANCE] as const;
export type GeoValue = (typeof GEO_ALL)[number];

export const GEO_LABELS: Record<string, string> = {
  france:                  "France",
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
  corse:                   "Corse",
  dom_tom:                 "DOM-TOM",
};

// Options { value, label } France + régions (les départements viennent de
// lib/crm/departements.ts::GEO_DEPT_OPTIONS).
export const GEOGRAPHIES = GEO_ALL.map((v) => ({ value: v, label: GEO_LABELS[v] ?? v }));
export type Geography = (typeof GEO_ALL)[number];

// Compatibilité au niveau zone/région (France). Le pont département <-> région
// est géré par lib/crm/geo-match.ts (geoIsCompatible), utilisé par le scoring.
export const GEO_COMPATIBILITY: Record<string, string[]> = {
  france:                  ["france", ...GEO_REGIONS_FRANCE],
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
  corse:                   ["corse", "france"],
  dom_tom:                 ["dom_tom", "france"],
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

// ── Devise (périmètre national France : EUR) ─────────────────────────────────

export const CURRENCIES = [
  { value: "EUR", label: "EUR (€)", symbol: "€" },
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

