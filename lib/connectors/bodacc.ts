/**
 * lib/connectors/bodacc.ts — Annonces BODACC via Opendatasoft (gratuit).
 *
 * Alimente la table `signaux` (pivot SIREN), phase 2 temps 1.
 * Vérifié en réel le 2026-07-28 : parution du jour disponible, volumes hebdo
 * ~1 350 ventes/cessions, ~4 500 procédures collectives, ~8 600 radiations,
 * ~84 000 dépôts de comptes. `registre` porte les SIREN proprement.
 * Pas de prix de cession exploitable (décision : pas de moteur de
 * comparables BODACC).
 *
 * Découpage :
 *   - fonctions PURES de normalisation (extractSirens, mapFamilleToType,
 *     buildTitre, normalizeAnnonce) → testées dans tests/bodacc.test.ts ;
 *   - fetchAnnoncesFamille : pagination Opendatasoft (100/req, offset ≤ 9 900).
 *
 * L'idempotence de l'ingestion est portée par la contrainte
 * UNIQUE (source, external_id) de la table signaux (v66) : rejouer une
 * journée ne crée jamais de doublon.
 */

const API_BASE =
  "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records";

// Familles ingérées en entier (~2 000/jour au total).
export const FULL_INGEST_FAMILLES = [
  "Ventes et cessions",
  "Procédures collectives",
  "Radiations",
] as const;

// Famille croisée avec les SIREN connus uniquement (~12 000/jour brut).
export const CROSS_ONLY_FAMILLE = "Dépôts des comptes";

export type BodaccSignalType =
  | "vente_cession"
  | "procedure_collective"
  | "radiation"
  | "depot_comptes";

// ── Formes brutes de l'API (subset utilisé) ──────────────────────────────────

export interface RawAnnonce {
  id: string;
  dateparution: string;
  familleavis_lib?: string | null;
  typeavis_lib?: string | null;
  commercant?: string | null;
  /** L'API renvoie tantôt un tableau ["123456789","123 456 789"], tantôt une chaîne. */
  registre?: string | string[] | null;
  ville?: string | null;
  cp?: string | null;
  numerodepartement?: string | null;
  region_nom_officiel?: string | null;
  tribunal?: string | null;
  jugement?: string | null;  // JSON sérialisé
  acte?: string | null;      // JSON sérialisé
  depot?: string | null;     // JSON sérialisé (dépôts de comptes)
  listeprecedentproprietaire?: string | null;
  listeprecedentexploitant?: string | null;
  url_complete?: string | null;
}

export interface NormalizedSignal {
  external_id: string;
  siren: string;
  /** Tous les SIREN de l'annonce (cédant + repreneur sur les ventes). */
  sirens: string[];
  signal_type: BodaccSignalType;
  signal_date: string;
  titre: string;
  severity: "info" | "opportunite" | "alerte";
  payload: Record<string, unknown>;
}

// ── Fonctions pures ──────────────────────────────────────────────────────────

/**
 * Extrait les SIREN (9 chiffres) du champ registre, dédupliqués, dans l'ordre.
 * Tolère tableau ou chaîne, avec ou sans espaces ("342 408 861").
 */
export function extractSirens(registre: string | string[] | null | undefined): string[] {
  if (!registre) return [];
  const parts = Array.isArray(registre) ? registre : [registre];
  const out: string[] = [];
  for (const p of parts) {
    const cleaned = String(p).replace(/\s+/g, "");
    if (/^\d{9}$/.test(cleaned) && !out.includes(cleaned)) out.push(cleaned);
  }
  return out;
}

export function mapFamilleToType(famille: string | null | undefined): BodaccSignalType | null {
  switch (famille) {
    case "Ventes et cessions":     return "vente_cession";
    case "Procédures collectives": return "procedure_collective";
    case "Radiations":             return "radiation";
    case "Dépôts des comptes":     return "depot_comptes";
    default:                        return null;
  }
}

export function severityFor(type: BodaccSignalType): NormalizedSignal["severity"] {
  // Une procédure collective est une alerte marché (et une opportunité de
  // reprise à la barre côté buy-side) ; le reste est informatif.
  return type === "procedure_collective" ? "alerte" : "info";
}

/** Parse tolérant d'un champ JSON sérialisé par Opendatasoft. */
export function parseJsonField(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

export function buildTitre(type: BodaccSignalType, annonce: RawAnnonce): string {
  const nom = (annonce.commercant ?? "").trim() || "(société inconnue)";
  const ville = (annonce.ville ?? "").trim();
  const lieu = ville ? ` (${ville})` : "";
  switch (type) {
    case "vente_cession":
      return `Cession : ${nom}${lieu}`;
    case "procedure_collective": {
      const jugement = parseJsonField(annonce.jugement);
      const nature = typeof jugement?.famille === "string" && jugement.famille
        ? jugement.famille
        : "Procédure collective";
      return `${nature} : ${nom}${lieu}`;
    }
    case "radiation":
      return `Radiation : ${nom}${lieu}`;
    case "depot_comptes":
      return `Dépôt des comptes : ${nom}${lieu}`;
  }
}

/**
 * Normalise une annonce brute en signal prêt à insérer.
 * Retourne null si la famille est inconnue ou si aucun SIREN n'est présent.
 */
export function normalizeAnnonce(raw: RawAnnonce): NormalizedSignal | null {
  const type = mapFamilleToType(raw.familleavis_lib);
  if (!type) return null;
  const sirens = extractSirens(raw.registre);
  if (sirens.length === 0) return null;
  if (!raw.id || !raw.dateparution) return null;

  return {
    external_id: raw.id,
    siren: sirens[0],
    sirens,
    signal_type: type,
    signal_date: raw.dateparution,
    titre: buildTitre(type, raw),
    severity: severityFor(type),
    payload: {
      sirens,
      commercant: raw.commercant ?? null,
      ville: raw.ville ?? null,
      cp: raw.cp ?? null,
      departement: raw.numerodepartement ?? null,
      region: raw.region_nom_officiel ?? null,
      tribunal: raw.tribunal ?? null,
      type_avis: raw.typeavis_lib ?? null,
      jugement: parseJsonField(raw.jugement),
      acte: parseJsonField(raw.acte),
      depot: parseJsonField(raw.depot),
      precedent_proprietaire: parseJsonField(raw.listeprecedentproprietaire),
      precedent_exploitant: parseJsonField(raw.listeprecedentexploitant),
      url: raw.url_complete ?? null,
    },
  };
}

// ── Fetch paginé ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 100;      // max Opendatasoft
const MAX_OFFSET = 9_900;   // fenêtre Opendatosoft (offset + limit ≤ 10 000)

const SELECT_FIELDS = [
  "id", "dateparution", "familleavis_lib", "typeavis_lib", "commercant",
  "registre", "ville", "cp", "numerodepartement", "region_nom_officiel",
  "tribunal", "jugement", "acte", "depot",
  "listeprecedentproprietaire", "listeprecedentexploitant", "url_complete",
].join(", ");

function assertIsoDate(d: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`Date invalide : ${d}`);
}

/**
 * Récupère toutes les annonces d'une famille sur une plage de parution
 * [fromDate, toDate] incluse. Pagination interne, s'arrête proprement à la
 * fenêtre Opendatasoft (les volumes quotidiens réels en sont très loin).
 */
export async function fetchAnnoncesFamille(
  famille: string,
  fromDate: string,
  toDate: string,
): Promise<RawAnnonce[]> {
  assertIsoDate(fromDate);
  assertIsoDate(toDate);
  // famille provient de constantes internes ; l'échappement reste une garde.
  const where = `familleavis_lib = "${famille.replace(/"/g, "")}" AND dateparution >= date'${fromDate}' AND dateparution <= date'${toDate}'`;

  const out: RawAnnonce[] = [];
  for (let offset = 0; offset <= MAX_OFFSET; offset += PAGE_SIZE) {
    const url = `${API_BASE}?${new URLSearchParams({
      select: SELECT_FIELDS,
      where,
      order_by: "dateparution ASC, id ASC",
      limit: String(PAGE_SIZE),
      offset: String(offset),
    })}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`BODACC ${res.status} sur ${famille} : ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { results?: RawAnnonce[] };
    const page = json.results ?? [];
    out.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return out;
}
