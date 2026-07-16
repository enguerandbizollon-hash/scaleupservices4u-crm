// Géocodage via OpenStreetMap Nominatim (gratuit, sans clé).
//
// Doc : https://nominatim.org/release-docs/develop/api/Search/
// Usage Policy : https://operations.osmfoundation.org/policies/nominatim/
//   - Max 1 req/seconde
//   - User-Agent obligatoire
//   - Caching côté client recommandé (on persiste les coords en base)
//
// Pour un cabinet à 4 utilisateurs qui géocode quelques organisations
// par mois, on est largement dans les limites gratuites.

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formatted: string;
  source: "nominatim";
  // Composants normalisés (extraits de l'adresse retournée)
  city: string | null;
  postal_code: string | null;
  country: string | null;
  region: string | null;
}

export interface GeocodeInput {
  street?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  /** Fallback si rien d'autre : requête libre (ex: "Acme SAS, Paris") */
  freeform?: string | null;
}

function buildQuery(input: GeocodeInput): string {
  const parts: string[] = [];
  if (input.street) parts.push(input.street);
  if (input.postal_code) parts.push(input.postal_code);
  if (input.city) parts.push(input.city);
  if (input.country) parts.push(input.country);
  if (parts.length > 0) return parts.join(", ");
  return input.freeform ?? "";
}

interface NominatimRaw {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    postcode?: string;
    country?: string;
    state?: string;
    region?: string;
  };
}

/**
 * Géocode une adresse. Retourne `null` si rien trouvé ou erreur réseau.
 * Le caller est responsable de la persistance + de respecter le rate limit
 * (1 req/sec côté serveur).
 */
export async function geocodeAddress(
  input: GeocodeInput,
): Promise<GeocodeResult | null> {
  const q = buildQuery(input).trim();
  if (!q) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  // Bias FR/CH/BE/LU si pas de pays spécifié — la base d'orgas du cabinet
  // est très majoritairement européenne francophone.
  if (!input.country) {
    url.searchParams.set("countrycodes", "fr,ch,be,lu,de,it,es,gb,nl");
  }

  try {
    const res = await fetch(url.toString(), {
      headers: {
        // Conforme aux policies Nominatim — User-Agent identifiant le service
        "User-Agent": "ScaleUpServicesCRM/1.0 (contact@scaleupservices4u.com)",
        "Accept-Language": "fr",
      },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as NominatimRaw[];
    if (!Array.isArray(data) || data.length === 0) return null;

    const first = data[0];
    if (!first.lat || !first.lon) return null;
    const lat = parseFloat(first.lat);
    const lon = parseFloat(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const a = first.address ?? {};
    const city = a.city ?? a.town ?? a.village ?? a.municipality ?? null;

    return {
      latitude: lat,
      longitude: lon,
      formatted: first.display_name ?? q,
      source: "nominatim",
      city,
      postal_code: a.postcode ?? null,
      country: a.country ?? null,
      region: a.state ?? a.region ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Distance Haversine (km) entre deux points GPS. Utile pour le sourcing
 * géographique (filtre "acquéreurs dans 200 km de la cible").
 */
export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
