// Connecteur RGE ADEME (recherche sourcing 2026-07-31, angle données
// publiques) : le NON-RENOUVELLEMENT d'une qualification RGE est un signal
// de désengagement volontaire du dirigeant du bâtiment, souvent 1 à 2 ans
// avant l'arrêt ou la cession. Renoncer au RGE = renoncer aux chantiers
// MaPrimeRénov et CEE, une part majeure du carnet de commandes.
//
// Source : data.ademe.fr, dataset liste-des-entreprises-rge-2 (API data-fair,
// gratuite, sans clé). Vérifié en live le 2026-07-31 : les lignes expirées
// restent présentes avec leur lien_date_fin passée, ce qui permet la
// détection sur une fenêtre glissante sans dataset historique.

const API_BASE =
  "https://data.ademe.fr/data-fair/api/v1/datasets/liste-des-entreprises-rge-2/lines";

const PAGE_SIZE = 1000;
const MAX_PAGES = 10; // garde-fou : les fenêtres réelles font quelques centaines de lignes

export interface RgeExpiredRow {
  siret: string;
  siren: string;
  nom_entreprise: string;
  domaine: string | null;
  lien_date_fin: string;
  commune: string | null;
  code_postal: string | null;
}

interface DataFairResponse {
  total: number;
  results?: Array<Record<string, unknown>>;
  next?: string;
}

function assertIsoDate(d: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`Date invalide : ${d}`);
}

/**
 * Qualifications RGE dont la validité a expiré dans la fenêtre [fromDate,
 * toDate]. Une entreprise peut apparaître plusieurs fois (une ligne par
 * qualification) : le groupement par SIREN se fait chez l'appelant.
 */
export async function fetchRgeExpirations(fromDate: string, toDate: string): Promise<RgeExpiredRow[]> {
  assertIsoDate(fromDate);
  assertIsoDate(toDate);

  const out: RgeExpiredRow[] = [];
  let url: string | null = `${API_BASE}?${new URLSearchParams({
    size: String(PAGE_SIZE),
    select: "siret,nom_entreprise,domaine,lien_date_fin,commune,code_postal",
    qs: `lien_date_fin:[${fromDate} TO ${toDate}]`,
  })}`;

  for (let page = 0; url && page < MAX_PAGES; page++) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`ADEME RGE ${res.status} : ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as DataFairResponse;
    for (const r of json.results ?? []) {
      const siret = typeof r.siret === "string" ? r.siret.replace(/\s+/g, "") : "";
      const dateFin = typeof r.lien_date_fin === "string" ? r.lien_date_fin.slice(0, 10) : "";
      if (!/^\d{14}$/.test(siret) || !dateFin) continue;
      out.push({
        siret,
        siren: siret.slice(0, 9),
        nom_entreprise: typeof r.nom_entreprise === "string" ? r.nom_entreprise : "(inconnue)",
        domaine: typeof r.domaine === "string" ? r.domaine : null,
        lien_date_fin: dateFin,
        commune: typeof r.commune === "string" ? r.commune : null,
        code_postal: typeof r.code_postal === "string" ? r.code_postal : null,
      });
    }
    url = json.next ?? null;
  }
  return out;
}

export interface RgeExpirationParSiren {
  siren: string;
  nom_entreprise: string;
  derniere_fin: string;      // la plus récente des dates d'expiration
  domaines: string[];
  commune: string | null;
}

/** Regroupe les lignes par SIREN : un signal par entreprise, pas par qualification. */
export function groupRgeBySiren(rows: RgeExpiredRow[]): RgeExpirationParSiren[] {
  const map = new Map<string, RgeExpirationParSiren>();
  for (const r of rows) {
    const cur = map.get(r.siren);
    if (!cur) {
      map.set(r.siren, {
        siren: r.siren,
        nom_entreprise: r.nom_entreprise,
        derniere_fin: r.lien_date_fin,
        domaines: r.domaine ? [r.domaine] : [],
        commune: r.commune,
      });
    } else {
      if (r.lien_date_fin > cur.derniere_fin) cur.derniere_fin = r.lien_date_fin;
      if (r.domaine && !cur.domaines.includes(r.domaine)) cur.domaines.push(r.domaine);
    }
  }
  return [...map.values()];
}
