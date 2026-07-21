// Déduplication organisations — détection + fusion
// Utilisé par : actions/dedup.ts, OrganisationForm (alerte à la création)

/**
 * Normalise un nom d'organisation pour la comparaison.
 * Même logique que normalize_org_name() en base SQL.
 */
export function normalizeOrgName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[^a-z0-9\s]/g, "")     // ponctuation
    .replace(/\s+/g, " ");           // espaces multiples
}

/**
 * Extrait le domaine d'une URL (sans www., sans path)
 */
export function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Normalise un SIREN : ne garde que les chiffres, exige exactement 9.
 * Accepte les formats "123 456 789", "123456789", "SIREN 123456789".
 * Renvoie null si ce n'est pas un SIREN exploitable.
 */
export function normalizeSiren(siren: string | null | undefined): string | null {
  if (!siren) return null;
  const digits = siren.replace(/[^0-9]/g, "");
  return /^[0-9]{9}$/.test(digits) ? digits : null;
}

export interface DuplicateCandidate {
  id: string;
  name: string;
  website: string | null;
  linkedin_url: string | null;
  normalized_name: string | null;
  /** "siren" est le signal le plus fort : deux entreprises ne partagent jamais un SIREN. */
  matchType: "siren" | "name" | "website" | "linkedin";
}
