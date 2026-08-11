// Référentiel canonique des 101 départements français (métropole + Corse + DOM),
// avec nom et rattachement RÉGION (slugs GEO_REGIONS_FRANCE de matching-maps).
// C'est le pont manquant entre la prospection (filtrée par département) et le
// scoring géo (par région). Les codes doivent rester alignés sur
// DEPARTEMENTS_FR (lib/connectors/recherche-entreprises.ts) — affirmé par test.

/** region = slug d'une entrée de GEO_REGIONS_FRANCE (dont "corse" et "dom_tom"). */
export interface Departement {
  code: string;
  nom: string;
  region: string;
}

// Regroupés par région pour la lisibilité, aplatis ensuite.
const BY_REGION: Record<string, [string, string][]> = {
  ile_de_france: [
    ["75", "Paris"], ["77", "Seine-et-Marne"], ["78", "Yvelines"], ["91", "Essonne"],
    ["92", "Hauts-de-Seine"], ["93", "Seine-Saint-Denis"], ["94", "Val-de-Marne"], ["95", "Val-d'Oise"],
  ],
  auvergne_rhone_alpes: [
    ["01", "Ain"], ["03", "Allier"], ["07", "Ardèche"], ["15", "Cantal"], ["26", "Drôme"], ["38", "Isère"],
    ["42", "Loire"], ["43", "Haute-Loire"], ["63", "Puy-de-Dôme"], ["69", "Rhône"], ["73", "Savoie"], ["74", "Haute-Savoie"],
  ],
  paca: [
    ["04", "Alpes-de-Haute-Provence"], ["05", "Hautes-Alpes"], ["06", "Alpes-Maritimes"],
    ["13", "Bouches-du-Rhône"], ["83", "Var"], ["84", "Vaucluse"],
  ],
  occitanie: [
    ["09", "Ariège"], ["11", "Aude"], ["12", "Aveyron"], ["30", "Gard"], ["31", "Haute-Garonne"], ["32", "Gers"],
    ["34", "Hérault"], ["46", "Lot"], ["48", "Lozère"], ["65", "Hautes-Pyrénées"], ["66", "Pyrénées-Orientales"],
    ["81", "Tarn"], ["82", "Tarn-et-Garonne"],
  ],
  nouvelle_aquitaine: [
    ["16", "Charente"], ["17", "Charente-Maritime"], ["19", "Corrèze"], ["23", "Creuse"], ["24", "Dordogne"],
    ["33", "Gironde"], ["40", "Landes"], ["47", "Lot-et-Garonne"], ["64", "Pyrénées-Atlantiques"],
    ["79", "Deux-Sèvres"], ["86", "Vienne"], ["87", "Haute-Vienne"],
  ],
  bretagne: [
    ["22", "Côtes-d'Armor"], ["29", "Finistère"], ["35", "Ille-et-Vilaine"], ["56", "Morbihan"],
  ],
  grand_est: [
    ["08", "Ardennes"], ["10", "Aube"], ["51", "Marne"], ["52", "Haute-Marne"], ["54", "Meurthe-et-Moselle"],
    ["55", "Meuse"], ["57", "Moselle"], ["67", "Bas-Rhin"], ["68", "Haut-Rhin"], ["88", "Vosges"],
  ],
  hauts_de_france: [
    ["02", "Aisne"], ["59", "Nord"], ["60", "Oise"], ["62", "Pas-de-Calais"], ["80", "Somme"],
  ],
  normandie: [
    ["14", "Calvados"], ["27", "Eure"], ["50", "Manche"], ["61", "Orne"], ["76", "Seine-Maritime"],
  ],
  pays_de_la_loire: [
    ["44", "Loire-Atlantique"], ["49", "Maine-et-Loire"], ["53", "Mayenne"], ["72", "Sarthe"], ["85", "Vendée"],
  ],
  centre_val_de_loire: [
    ["18", "Cher"], ["28", "Eure-et-Loir"], ["36", "Indre"], ["37", "Indre-et-Loire"], ["41", "Loir-et-Cher"], ["45", "Loiret"],
  ],
  bourgogne_franche_comte: [
    ["21", "Côte-d'Or"], ["25", "Doubs"], ["39", "Jura"], ["58", "Nièvre"], ["70", "Haute-Saône"],
    ["71", "Saône-et-Loire"], ["89", "Yonne"], ["90", "Territoire de Belfort"],
  ],
  corse: [
    ["2A", "Corse-du-Sud"], ["2B", "Haute-Corse"],
  ],
  dom_tom: [
    ["971", "Guadeloupe"], ["972", "Martinique"], ["973", "Guyane"], ["974", "La Réunion"], ["976", "Mayotte"],
  ],
};

export const DEPARTEMENTS: readonly Departement[] = Object.entries(BY_REGION).flatMap(
  ([region, list]) => list.map(([code, nom]) => ({ code, nom, region })),
);

/** Code -> "44 Loire-Atlantique" (sans tiret cadratin). */
export const DEPARTEMENT_LABELS: Record<string, string> = Object.fromEntries(
  DEPARTEMENTS.map((d) => [d.code, `${d.code} ${d.nom}`]),
);

/** Code de département -> slug de région. */
export const DEPT_TO_REGION: Record<string, string> = Object.fromEntries(
  DEPARTEMENTS.map((d) => [d.code, d.region]),
);

/** Slug de région -> codes de ses départements. */
export const REGION_TO_DEPTS: Record<string, string[]> = (() => {
  const m: Record<string, string[]> = {};
  for (const d of DEPARTEMENTS) (m[d.region] ??= []).push(d.code);
  return m;
})();

/** Options { value, label } pour un sélecteur (value = code). */
export const GEO_DEPT_OPTIONS = DEPARTEMENTS.map((d) => ({ value: d.code, label: DEPARTEMENT_LABELS[d.code] }));

/** Un code est-il un département connu ? */
export function isDepartementCode(code: string): boolean {
  return code in DEPT_TO_REGION;
}

/**
 * Slug de région -> code(s) INSEE région, le format qu'attend le paramètre
 * `region` de l'API Recherche d'Entreprises (un libellé ou un slug y est
 * silencieusement ignoré). dom_tom est un regroupement : plusieurs codes.
 */
export const REGION_INSEE_CODES: Record<string, string[]> = {
  ile_de_france: ["11"],
  centre_val_de_loire: ["24"],
  bourgogne_franche_comte: ["27"],
  normandie: ["28"],
  hauts_de_france: ["32"],
  grand_est: ["44"],
  pays_de_la_loire: ["52"],
  bretagne: ["53"],
  nouvelle_aquitaine: ["75"],
  occitanie: ["76"],
  auvergne_rhone_alpes: ["84"],
  paca: ["93"],
  corse: ["94"],
  dom_tom: ["01", "02", "03", "04", "06"],
};

/**
 * Convertit des slugs de régions du référentiel en codes INSEE dédupliqués.
 * Toute autre valeur est écartée, y compris un code à 2 chiffres : les codes
 * INSEE de régions et de départements se recouvrent (11, 44, 75...), un
 * passe-droit numérique enverrait un filtre régional FAUX en silence.
 */
export function regionsToInseeCodes(values: string[]): string[] {
  const out = new Set<string>();
  for (const v of values) {
    const codes = REGION_INSEE_CODES[v];
    if (codes) codes.forEach((c) => out.add(c));
  }
  return [...out];
}
