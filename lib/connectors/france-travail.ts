// Connecteur France Travail, API Offres d'emploi v2 (recherche sourcing
// 2026-07-31, le signal le plus convergent des 5 angles) : les offres
// d'emploi d'une PME sont un marqueur comportemental triple.
//   - Recrutement d'un directeur / DG / n°2 chez un dirigeant senior :
//     relève en préparation, AVANT toute trace légale (barème routine).
//   - Volume d'offres soutenu : consolidateur / croissance (flux 2 et 3).
//   - Gel prolongé : essoufflement.
// Limite structurelle : l'API n'expose pas le SIRET des offres, le
// rattachement se fait par nom d'entreprise (garde de similarité stricte).
//
// Auth : OAuth2 client credentials, realm /partenaire. Variables (noms
// choisis par Enguérand dans .env.local) : FRANCE_TRAVAIL_CLIENT_ID,
// FRANCE_TRAVAIL_CLIENT_SECRET, FRANCE_TRAVAIL_SCOPE
// (défaut : "api_offresdemploiv2 o2dsoffre").

const TOKEN_URL =
  "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire";
const SEARCH_URL =
  "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search";

export function isFranceTravailConfigured(): boolean {
  return !!(process.env.FRANCE_TRAVAIL_CLIENT_ID && process.env.FRANCE_TRAVAIL_CLIENT_SECRET);
}

// Token en mémoire process : les crons vivent le temps d'une exécution,
// inutile de persister (expiration ~25 min, très au-delà d'un run).
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.value;
  const id = process.env.FRANCE_TRAVAIL_CLIENT_ID;
  const secret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("FRANCE_TRAVAIL_CLIENT_ID / _SECRET manquants dans .env.local");
  const scope = process.env.FRANCE_TRAVAIL_SCOPE || "api_offresdemploiv2 o2dsoffre";

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
      scope,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`France Travail OAuth ${res.status} : ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

export interface OffreEmploi {
  id: string;
  intitule: string;
  entreprise_nom: string | null;
  lieu: string | null;
  date_creation: string | null; // ISO date
  type_contrat: string | null;
  url: string | null;
}

interface RawOffre {
  id?: string;
  intitule?: string;
  entreprise?: { nom?: string };
  lieuTravail?: { libelle?: string };
  dateCreation?: string;
  typeContrat?: string;
  origineOffre?: { urlOrigine?: string };
}

/**
 * Recherche d'offres par mots-clés et département. 429/absence de résultats
 * gérés proprement (204 = zéro offre). Plafond range 0-49 : largement assez
 * pour un croisement par entreprise.
 */
export async function searchOffres(params: {
  motsCles: string;
  departement?: string | null;
  publieeDepuisJours?: number | null;
}): Promise<OffreEmploi[]> {
  const token = await getToken();
  const q = new URLSearchParams({ motsCles: params.motsCles, range: "0-49" });
  if (params.departement) q.set("departement", params.departement);
  if (params.publieeDepuisJours) q.set("publieeDepuis", String(params.publieeDepuisJours));

  const res = await fetch(`${SEARCH_URL}?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 204) return [];
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`France Travail search ${res.status} : ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { resultats?: RawOffre[] };
  return (json.resultats ?? []).map((o) => ({
    id: o.id ?? "",
    intitule: o.intitule ?? "",
    entreprise_nom: o.entreprise?.nom ?? null,
    lieu: o.lieuTravail?.libelle ?? null,
    date_creation: o.dateCreation ? o.dateCreation.slice(0, 10) : null,
    type_contrat: o.typeContrat ?? null,
    url: o.origineOffre?.urlOrigine ?? null,
  })).filter((o) => o.id);
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

/** L'offre appartient-elle vraisemblablement à cette entreprise ? */
export function offreMatchesEntreprise(offre: OffreEmploi, nomEntreprise: string): boolean {
  if (!offre.entreprise_nom) return false;
  const a = norm(offre.entreprise_nom);
  const b = norm(nomEntreprise);
  if (a.length < 4 || b.length < 4) return false;
  return a.includes(b) || b.includes(a);
}

const DIRECTION_RE = /directeur g[ée]n[ée]ral|directeur d'exploitation|directeur de site|directeur d'agence|\bdirecteur\b|\bDG\b|responsable d'exploitation|directeur des op[ée]rations/i;

/** L'offre est-elle un poste de direction (relève potentielle) ? */
export function isOffreDirection(offre: OffreEmploi): boolean {
  return DIRECTION_RE.test(offre.intitule);
}
