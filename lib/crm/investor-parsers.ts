// Parsers pour convertir les anciennes colonnes texte investisseur → colonnes structurées
// Utilisé par : actions/matching.ts (fallback scoring) et actions/import/organisations.ts (import CSV)

/** Parse "< 500k€", "1M – 3M€", "> 25M€" → {min, max} en euros */
export function parseTicketText(text: string | null): { min: number | null; max: number | null } | null {
  if (!text) return null;
  const t = text.replace(/\s/g, "").toLowerCase();

  function toNum(s: string): number {
    const m = s.match(/(\d+(?:[.,]\d+)?)(k|m)?/);
    if (!m) return 0;
    const n = parseFloat(m[1].replace(",", "."));
    return m[2] === "m" ? n * 1_000_000 : m[2] === "k" ? n * 1_000 : n;
  }

  if (t.startsWith("<")) return { min: null, max: toNum(t.slice(1)) };
  if (t.startsWith(">")) return { min: toNum(t.slice(1)), max: null };
  const parts = t.split(/[–-]/).map(s => s.replace(/[€chfusd$]/g, ""));
  if (parts.length === 2) return { min: toNum(parts[0]), max: toNum(parts[1]) };
  return null;
}

/** Normalise un texte de stage vers les valeurs STAGE_OPTIONS */
export function normalizeStageText(text: string | null): string | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("pre-seed") || t.includes("preseed") || t.includes("pré-seed")) return "Seed";
  if (t.includes("pré-série a") || t.includes("pre-series a") || t.includes("pre-a")) return "Pré-Série A";
  if (t.includes("série a") || t.includes("series a")) return "Série A";
  if (t.includes("série b") || t.includes("series b")) return "Série B";
  if (t.includes("late") || t.includes("buyout")) return "Late Stage";
  if (t.includes("growth")) return "Growth";
  if (t.includes("seed")) return "Seed";
  if (t.includes("toutes") || t.includes("généraliste") || t.includes("generaliste")) return "Généraliste";
  return null;
}

/** Normalise un texte de secteur vers les valeurs SECTORS du référentiel */
export function normalizeSectorText(text: string | null): string | null {
  if (!text) return null;
  const t = text.toLowerCase().trim();
  // Généraliste
  if (t.includes("généraliste") || t.includes("generaliste")) return "Généraliste";
  // Tech
  if (t.includes("saas") || t.includes("logiciel") || t.includes("software")) return "SaaS";
  if (t.includes("fintech")) return "Fintech";
  if (t.includes("insurtech")) return "InsurTech";
  if (t.includes("regtech")) return "RegTech";
  if (t.includes("proptech")) return "PropTech";
  if (t.includes("hrtech") || t.includes("ressources humaines")) return "HRtech";
  if (t.includes("cleantech")) return "CleanTech";
  if (t.includes("biotech")) return "BioTech";
  if (t.includes("medtech") || t.includes("santé") || t.includes("health")) return "MedTech";
  if (t.includes("healthtech")) return "Healthtech";
  if (t.includes("pharma")) return "Pharma";
  if (t.includes("ia") || t.includes("intelligence artificielle") || t.includes("deeptech")) return "Deeptech";
  if (t.includes("cyber")) return "Cybersécurité";
  // Industrie
  if (t.includes("industrie") || t.includes("industrial") || t.includes("manufacturing") || t.includes("btp") || t.includes("construction") || t.includes("chimie") || t.includes("matériaux")) return "Industrie";
  if (t.includes("infrastructure")) return "Infrastructure";
  if (t.includes("aéro") || t.includes("aérospatial") || t.includes("aerospace")) return "Aéronautique";
  if (t.includes("défense") || t.includes("defense") || t.includes("sécurité")) return "Défense";
  // Commerce & services
  if (t.includes("retail") || t.includes("e-commerce") || t.includes("commerce") || t.includes("distribution")) return "Retail";
  if (t.includes("marketplace")) return "Marketplace";
  if (t.includes("luxe") || t.includes("premium") || t.includes("beauté")) return "Luxe";
  if (t.includes("services b2b")) return "Services B2B";
  if (t.includes("conseil") || t.includes("advisory") || t.includes("consulting")) return "Conseil";
  // Énergie & environnement
  if (t.includes("energie") || t.includes("énergie") || t.includes("environnement")) return "Energie";
  if (t.includes("immobilier") || t.includes("real estate")) return "Immobilier";
  if (t.includes("transport") || t.includes("mobility") || t.includes("logistique")) return "Transport";
  // Food & agri
  if (t.includes("food") || t.includes("agri") || t.includes("agroalimentaire")) return "Food";
  // Education & social
  if (t.includes("edtech") || t.includes("éducation") || t.includes("education")) return "Edtech";
  if (t.includes("impact") || t.includes("social")) return "Impact";
  // Média & sport
  if (t.includes("média") || t.includes("media") || t.includes("entertainment") || t.includes("télécom")) return "Média";
  if (t.includes("sport") || t.includes("loisir")) return "Sport";
  // Hardware
  if (t.includes("hardware")) return "Hardware";
  // Juridique / Finance
  if (t.includes("juridique") || t.includes("legal")) return "Conseil";
  if (t.includes("finance") || t.includes("investissement")) return "Fintech";
  return null;
}

/**
 * Parse un texte multi-valeurs séparé par virgules, points-virgules ou "/"
 * et normalise chaque valeur avec la fonction fournie.
 */
export function parseMultiText(text: string | null, normalizer: (t: string | null) => string | null): string[] {
  if (!text) return [];
  return text
    .split(/[,;/]/)
    .map(s => normalizer(s.trim()))
    .filter((s): s is string => s !== null && s.length > 0);
}

/** Parse une géographie texte vers les valeurs GEO_ALL du référentiel */
export function normalizeGeoText(text: string | null): string | null {
  if (!text) return null;
  const t = text.toLowerCase().trim();
  // Global
  if (t.includes("global") || t.includes("worldwide") || t.includes("international")) return "global";
  // Régions France
  if (t.includes("ile-de-france") || t.includes("île-de-france") || t.includes("paris") || t.includes("idf")) return "ile_de_france";
  if (t.includes("auvergne") || t.includes("rhone-alpes") || t.includes("rhône-alpes") || t.includes("lyon")) return "auvergne_rhone_alpes";
  if (t.includes("paca") || t.includes("provence") || t.includes("marseille") || t.includes("nice")) return "paca";
  if (t.includes("occitanie") || t.includes("toulouse")) return "occitanie";
  if (t.includes("nouvelle-aquitaine") || t.includes("bordeaux")) return "nouvelle_aquitaine";
  if (t.includes("bretagne") || t.includes("rennes")) return "bretagne";
  if (t.includes("grand est") || t.includes("grand-est") || t.includes("strasbourg") || t.includes("alsace") || t.includes("lorraine")) return "grand_est";
  if (t.includes("hauts-de-france") || t.includes("hauts de france") || t.includes("lille")) return "hauts_de_france";
  if (t.includes("normandie") || t.includes("rouen") || t.includes("caen")) return "normandie";
  if (t.includes("pays de la loire") || t.includes("nantes")) return "pays_de_la_loire";
  if (t.includes("centre-val") || t.includes("centre val") || t.includes("tours") || t.includes("orléans")) return "centre_val_de_loire";
  if (t.includes("bourgogne") || t.includes("franche-comté") || t.includes("dijon")) return "bourgogne_franche_comte";
  if (t.includes("dom") || t.includes("réunion") || t.includes("martinique") || t.includes("guadeloupe")) return "dom_tom";
  // France (générique — après les régions)
  if (t.includes("france")) return "france";
  // Zones Europe
  if (t.includes("suisse") || t.includes("switzerland") || t.includes("zürich") || t.includes("genève") || t.includes("allemagne") || t.includes("germany") || t.includes("autriche") || t.includes("austria") || t.includes("dach")) return "dach";
  if (t.includes("benelux") || t.includes("belgique") || t.includes("belgium") || t.includes("pays-bas") || t.includes("netherlands") || t.includes("luxembourg")) return "benelux";
  if (t.includes("nordics") || t.includes("scandinavie") || t.includes("suède") || t.includes("danemark") || t.includes("norvège") || t.includes("finlande")) return "nordics";
  if (t.includes("uk") || t.includes("royaume-uni") || t.includes("angleterre") || t.includes("london") || t.includes("irlande") || t.includes("ireland")) return "uk_ireland";
  if (t.includes("europe de l'est") || t.includes("europe est") || t.includes("pologne") || t.includes("tchèque") || t.includes("roumanie")) return "europe_est";
  if (t.includes("europe du sud") || t.includes("espagne") || t.includes("italie") || t.includes("portugal") || t.includes("grèce")) return "europe_sud";
  if (t.includes("union europ") || t.includes(" ue ") || t.includes("(ue)")) return "ue";
  if (t.includes("europe")) return "europe";
  // Hors Europe
  if (t.includes("usa") || t.includes("états-unis") || t.includes("amerique du nord") || t.includes("north america")) return "amerique_nord";
  if (t.includes("amerique du sud") || t.includes("latam") || t.includes("south america")) return "amerique_sud";
  if (t.includes("asie") || t.includes("asia") || t.includes("chine") || t.includes("japon")) return "asie";
  if (t.includes("moyen-orient") || t.includes("middle east") || t.includes("mena")) return "moyen_orient";
  if (t.includes("afrique") || t.includes("africa")) return "afrique";
  return null;
}
