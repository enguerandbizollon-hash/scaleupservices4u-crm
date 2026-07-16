// actions/organisation-address.ts — Gestion de l'adresse structurée d'une
// organisation et géocodage via Nominatim (gratuit, sans clé).
//
// L'adresse structurée est utilisée pour le screening / sourcing M&A
// (filtre géographique + distance acquéreur ↔ cible).

'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { geocodeAddress } from '@/lib/geo/nominatim';

export interface OrganisationAddressInput {
  street?: string | null;
  postal_code?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
}

export type AddressResult =
  | { success: true; geocoded: boolean; latitude?: number; longitude?: number }
  | { success: false; error: string };

/**
 * Met à jour l'adresse structurée d'une organisation. Si `geocode=true` et
 * qu'on a au moins city+country (ou un free-form), lance le géocodage
 * Nominatim et persiste lat/lng + address_formatted.
 *
 * Si le géocodage échoue, on persiste quand même l'adresse texte —
 * l'utilisateur peut réessayer plus tard.
 */
export async function updateOrganisationAddress(
  organisationId: string,
  address: OrganisationAddressInput,
  geocode = true,
): Promise<AddressResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Non autorisé' };

  const payload: Record<string, unknown> = {
    street: address.street ?? null,
    postal_code: address.postal_code ?? null,
    city: address.city ?? null,
    region: address.region ?? null,
    country: address.country ?? null,
  };

  // Géocodage optionnel
  let geocoded = false;
  if (geocode) {
    const result = await geocodeAddress({
      street: address.street,
      postal_code: address.postal_code,
      city: address.city,
      country: address.country,
    });
    if (result) {
      payload.latitude = result.latitude;
      payload.longitude = result.longitude;
      payload.address_formatted = result.formatted;
      payload.geocoded_at = new Date().toISOString();
      payload.geocode_source = result.source;
      // Compléter les champs manquants depuis la réponse de Nominatim
      if (!address.city && result.city) payload.city = result.city;
      if (!address.postal_code && result.postal_code) payload.postal_code = result.postal_code;
      if (!address.country && result.country) payload.country = result.country;
      if (!address.region && result.region) payload.region = result.region;
      geocoded = true;
    }
  }

  const { error } = await supabase
    .from('organizations')
    .update(payload)
    .eq('id', organisationId)
    .eq('user_id', user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/protected/organisations/${organisationId}`);
  revalidatePath('/protected/organisations');
  return {
    success: true,
    geocoded,
    latitude: geocoded ? (payload.latitude as number) : undefined,
    longitude: geocoded ? (payload.longitude as number) : undefined,
  };
}

/**
 * Géocode l'adresse déjà stockée sur l'organisation. Utile pour ré-essayer
 * après une saisie incomplète ou pour enrichir des orgas legacy.
 */
export async function geocodeOrganisationAction(
  organisationId: string,
): Promise<AddressResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Non autorisé' };

  const { data: org } = await supabase
    .from('organizations')
    .select('name, street, postal_code, city, country, location')
    .eq('id', organisationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!org) return { success: false, error: 'Organisation introuvable' };

  const result = await geocodeAddress({
    street: org.street,
    postal_code: org.postal_code,
    city: org.city,
    country: org.country,
    // Fallback : si rien de structuré, tente avec le nom + location libre
    freeform: !org.street && !org.city
      ? `${org.name}${org.location ? ", " + org.location : ""}`
      : null,
  });

  if (!result) {
    return { success: false, error: 'Adresse introuvable via Nominatim' };
  }

  const payload: Record<string, unknown> = {
    latitude: result.latitude,
    longitude: result.longitude,
    address_formatted: result.formatted,
    geocoded_at: new Date().toISOString(),
    geocode_source: result.source,
  };
  if (!org.city && result.city) payload.city = result.city;
  if (!org.postal_code && result.postal_code) payload.postal_code = result.postal_code;
  if (!org.country && result.country) payload.country = result.country;

  const { error } = await supabase
    .from('organizations')
    .update(payload)
    .eq('id', organisationId)
    .eq('user_id', user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/protected/organisations/${organisationId}`);
  return {
    success: true,
    geocoded: true,
    latitude: result.latitude,
    longitude: result.longitude,
  };
}
