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

/**
 * Normalise un texte libre de secteur vers le référentiel actuel (familles +
 * feuilles small cap FR). Détection par mots entiers ordonnée du plus précis au
 * plus général (fin du bug `"média".includes("ia")` de l'ancienne version).
 */
export function normalizeSectorText(text: string | null): string | null {
  if (!text) return null;
  const t = text.toLowerCase().trim();
  if (!t) return null;
  const has = (...ws: string[]) => ws.some((w) => t.includes(w));
  if (has("généraliste", "generaliste")) return "Généraliste";
  // Numérique & Tech (vrais business conservés)
  if (has("saas", "logiciel", "software", "éditeur")) return "Éditeurs de logiciels / SaaS";
  if (has("esn", "infogérance", "infogerance")) return "ESN / Infogérance";
  if (has("cyber")) return "Cybersécurité";
  if (has("marketplace", "plateforme")) return "Marketplace / plateforme";
  if (has("télécom", "telecom")) return "Télécoms";
  if (has("agence web", "digital", "webmarketing")) return "Agences web / digital";
  if (has("deeptech", "intelligence artificielle")) return "Numérique & Tech";
  // Services financiers
  if (has("fintech", "assurtech", "insurtech")) return "Fintech / Assurtech";
  if (has("expertise comptable", "comptable", "audit")) return "Expertise comptable / Audit";
  if (has("courtage", "courtier", "assurance", "banque")) return "Courtage (assurance / crédit)";
  if (has("finance", "investissement", "gestion de patrimoine")) return "Services financiers";
  // BTP & Construction
  if (has("cvc", "génie climatique", "genie climatique", "chauffage", "climatisation", "plomberie")) return "Génie climatique / CVC";
  if (has("électricité", "electricite", "électricien")) return "Électricité / Courants faibles";
  if (has("couverture", "étanchéité", "etancheite", "toiture")) return "Couverture / Étanchéité";
  if (has("menuiserie", "agencement")) return "Menuiserie / Agencement";
  if (has("travaux publics", "vrd", "génie civil")) return "Travaux publics / VRD";
  if (has("maçonnerie", "maconnerie", "gros œuvre", "gros oeuvre")) return "Gros œuvre";
  if (has("btp", "construction", "bâtiment", "batiment", "second œuvre", "second oeuvre")) return "BTP & Construction";
  // Industrie & Production
  if (has("métallurgie", "metallurgie", "usinage", "chaudronnerie")) return "Métallurgie / Travail des métaux";
  if (has("mécanique", "mecanique")) return "Mécanique / Usinage";
  if (has("plasturgie", "plastique", "composite")) return "Plasturgie / Composites";
  if (has("électronique", "electronique", "électrotechnique")) return "Électronique / Électrotechnique";
  if (has("chimie", "cosmétique", "cosmetique", "matériaux", "materiaux")) return "Chimie / Cosmétique";
  if (has("textile", "habillement")) return "Textile / Habillement";
  if (has("ameublement", "menuiserie industrielle")) return "Bois / Ameublement";
  if (has("emballage", "packaging")) return "Emballage / Packaging";
  if (has("imprimerie", "impression", "arts graphiques")) return "Imprimerie / Arts graphiques";
  if (has("automobile", "équipementier", "equipementier")) return "Automobile (équipementier)";
  if (has("aéro", "aero", "aérospatial", "défense", "defense")) return "Aéronautique / Défense";
  if (has("agroalimentaire", "industrie alimentaire")) return "Industrie agroalimentaire";
  if (has("industrie", "industrial", "manufacturing", "fabrication")) return "Industrie & Production";
  // Négoce & distribution
  if (has("négoce", "negoce", "grossiste", "commerce de gros")) return "Négoce & Distribution B2B";
  // Transport & logistique
  if (has("transport routier", "fret")) return "Transport routier de marchandises";
  if (has("logistique", "entreposage", "supply")) return "Logistique / Entreposage";
  if (has("messagerie", "livraison")) return "Messagerie / Dernier km";
  if (has("transport")) return "Transport & Logistique";
  // Services aux entreprises
  if (has("propreté", "proprete", "nettoyage", "facility")) return "Propreté / Facility management";
  if (has("sécurité privée", "securite privee", "gardiennage", "surveillance")) return "Sécurité privée / Gardiennage";
  if (has("intérim", "interim", "ressources humaines", "recrutement")) return "Intérim / RH";
  if (has("maintenance")) return "Maintenance industrielle";
  if (has("marketing", "communication", "publicité", "publicite", "média", "media")) return "Marketing / Communication / Média";
  if (has("formation", "organisme de formation")) return "Formation professionnelle";
  if (has("conseil", "advisory", "consulting", "ingénierie", "ingenierie", "juridique", "legal")) return "Conseil / Ingénierie";
  // Santé & médico-social
  if (has("ehpad", "médico-social", "medico-social", "maison de retraite")) return "EHPAD / Médico-social";
  if (has("aide à domicile", "aide a domicile", "services à la personne")) return "Services à la personne / Aide à domicile";
  if (has("laboratoire", "analyses")) return "Laboratoires / Analyses";
  if (has("pharmacie", "parapharmacie")) return "Pharmacie / Parapharmacie";
  if (has("santé", "sante", "médical", "medical", "clinique", "medtech", "healthtech")) return "Santé & Médico-social";
  // Agriculture & agro
  if (has("viticulture", "spiritueux", "brasserie")) return "Viticulture / Vins & spiritueux";
  if (has("agriculture", "élevage", "elevage", "agri")) return "Agriculture / Élevage";
  if (has("boulangerie", "traiteur")) return "Transformation alimentaire artisanale";
  // Commerce & CHR
  if (has("hôtellerie", "hotellerie", "restauration", "restaurant", "hôtel", "hotel")) return "Hôtellerie / Restauration";
  if (has("e-commerce", "ecommerce")) return "E-commerce";
  if (has("sport", "loisir", "fitness")) return "Loisirs / Sport";
  if (has("retail", "commerce de détail", "commerce de detail", "distribution", "magasin", "boutique", "luxe", "premium")) return "Commerce de détail spécialisé";
  // Immobilier & énergie
  if (has("promotion immobilière", "promoteur")) return "Promotion immobilière";
  if (has("syndic", "administration de biens", "gestion locative")) return "Administration de biens / Syndic";
  if (has("photovoltaïque", "solaire", "éolien", "eolien", "énergie renouvelable", "energie renouvelable")) return "Énergies renouvelables";
  if (has("déchets", "dechets", "recyclage", "environnement", "assainissement")) return "Environnement / Déchets / Recyclage";
  if (has("immobilier", "real estate")) return "Immobilier & Énergie";
  if (has("énergie", "energie")) return "Immobilier & Énergie";
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
  // Régions Suisse (avant suisse générique)
  if (t.includes("romand") || t.includes("genève") || t.includes("geneva") || t.includes("lausanne") || t.includes("vaud") || t.includes("valais") || t.includes("neuchâtel") || t.includes("fribourg") || t.includes("jura")) return "suisse_romande";
  if (t.includes("zürich") || t.includes("zurich") || t.includes("bâle") || t.includes("basel") || t.includes("berne") || t.includes("bern") || t.includes("alémanique") || t.includes("aléman") || t.includes("saint-gall") || t.includes("lucerne")) return "suisse_alemanique";
  if (t.includes("tessin") || t.includes("ticino") || t.includes("lugano") || t.includes("italienne")) return "suisse_italienne";
  // Suisse générique + DACH
  if (t.includes("suisse") || t.includes("switzerland") || t.includes("swiss") || t.includes("allemagne") || t.includes("germany") || t.includes("autriche") || t.includes("austria") || t.includes("dach")) return "dach";
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
