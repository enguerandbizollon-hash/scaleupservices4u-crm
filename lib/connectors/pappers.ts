/**
 * lib/connectors/pappers.ts — Connecteur Pappers (données légales FR, payant).
 *
 * Pattern base.ts (phase 2, temps 3). Factorise les 3 implémentations qui
 * vivaient inline dans app/api/pappers/* et app/api/enrich/organisation.
 *
 * Décision carte phase 2 : Pappers reste OFF par défaut (API payante).
 * Sans PAPPERS_API_KEY, chaque fonction répond proprement « non configuré »
 * et la chaîne d'enrichissement continue avec les sources gratuites.
 *
 * Amélioration v64 : l'enrichissement persiste désormais siren/naf dans les
 * colonnes STRUCTURÉES (et le secteur dérivé via sectorFromNaf), plus
 * seulement en texte dans les notes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sectorFromNaf } from "@/lib/crm/matching-maps";

const API_BASE = "https://api.pappers.fr/v2";

// ── Configuration ────────────────────────────────────────────────────────────

export function isPappersConfigured(): boolean {
  return !!process.env.PAPPERS_API_KEY;
}

// ── Formes (subset utilisé de /recherche) ────────────────────────────────────

export interface PappersSearchResult {
  siren?: string;
  siret?: string;
  nom_entreprise?: string;
  code_naf?: string;
  libelle_code_naf?: string;
  domaine_activite?: string;
  forme_juridique?: string;
  date_creation?: string;
  chiffre_affaires?: number;
  resultat?: number;
  effectif?: string;
  tranche_effectif?: string;
  site_internet?: string;
  ville?: string;
  code_postal?: string;
  siege?: {
    adresse_ligne_1?: string;
    code_postal?: string;
    ville?: string;
  };
  dirigeants?: Array<{ nom?: string; prenom?: string; qualite?: string }>;
  [key: string]: unknown;
}

export const PAPPERS_EFFECTIF_LABELS: Record<string, string> = {
  "00": "0", "01": "1-2", "02": "3-5", "03": "6-9",
  "11": "10-19", "12": "20-49",
  "21": "50-99", "22": "100-199",
  "31": "200-249", "32": "250-499",
  "41": "500-999", "42": "1000-1999",
  "51": "2000-4999", "52": "5000-9999",
  "53": "+10000",
};

// ── Recherche (endpoint /recherche, fonctionne avec nom ET SIREN/SIRET) ──────

export async function searchPappers(
  query: string,
  nombre: number = 10,
): Promise<{ resultats: PappersSearchResult[]; total: number }> {
  const key = process.env.PAPPERS_API_KEY;
  if (!key) throw new Error("PAPPERS_API_KEY manquante");
  const q = query.trim();
  if (!q) return { resultats: [], total: 0 };

  const url = `${API_BASE}/recherche?q=${encodeURIComponent(q)}&api_token=${key}&nombre=${Math.min(20, nombre)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 401) throw new Error("Clé API Pappers invalide ou expirée");
  if (!res.ok) throw new Error(`Pappers ${res.status}`);
  const data = await res.json() as { resultats?: PappersSearchResult[]; entreprises?: PappersSearchResult[]; total?: number };
  const resultats = data.resultats ?? data.entreprises ?? [];
  return { resultats, total: data.total ?? resultats.length };
}

// ── Enrichissement d'une organisation existante ──────────────────────────────

export interface PappersEnrichmentReport {
  source: "pappers";
  ok: boolean;
  found: boolean;
  updated_fields: string[];
  message?: string;
}

/**
 * Enrichit une organisation existante depuis Pappers. Les champs déjà
 * remplis ne sont JAMAIS écrasés (règle « organisme vivant », CLAUDE.md).
 * Persiste siren/naf structurés + secteur dérivé (v64).
 */
export async function enrichExistingOrganizationWithPappers(
  supabase: SupabaseClient,
  orgId: string,
  orgName: string,
): Promise<PappersEnrichmentReport> {
  if (!isPappersConfigured()) {
    return { source: "pappers", ok: false, found: false, updated_fields: [], message: "PAPPERS_API_KEY manquante" };
  }

  try {
    const { resultats } = await searchPappers(orgName, 1);
    const r = resultats[0];
    if (!r) return { source: "pappers", ok: true, found: false, updated_fields: [] };

    const { data: existing } = await supabase
      .from("organizations")
      .select("location, website, employee_count, notes, siren, naf, sector")
      .eq("id", orgId)
      .maybeSingle();
    if (!existing) {
      return { source: "pappers", ok: false, found: true, updated_fields: [], message: "Organisation introuvable" };
    }

    const updates: Record<string, unknown> = {};
    const ville = r.ville ?? r.siege?.ville;
    const codePostal = r.code_postal ?? r.siege?.code_postal;

    // Identité légale structurée (v64)
    const siren = String(r.siren ?? "").replace(/\D/g, "");
    if (!existing.siren && /^\d{9}$/.test(siren)) updates.siren = siren;
    if (!existing.naf && r.code_naf) {
      updates.naf = r.code_naf;
      if (!existing.sector) {
        const secteur = sectorFromNaf(r.code_naf);
        if (secteur) updates.sector = secteur;
      }
    }

    if (!existing.location && ville) {
      updates.location = codePostal ? `${ville} (${codePostal})` : ville;
    }
    if (!existing.website && r.site_internet) {
      updates.website = r.site_internet;
    }
    if (!existing.employee_count && r.tranche_effectif) {
      // Pappers retourne une tranche. On extrait la borne basse comme proxy numérique.
      const lower = (PAPPERS_EFFECTIF_LABELS[r.tranche_effectif] ?? "").split(/[-+]/)[0];
      const n = parseInt(lower ?? "", 10);
      if (Number.isFinite(n) && n > 0) updates.employee_count = n;
    }

    // Notes : compléments non structurés (forme juridique, CA), une seule fois.
    const noteParts: string[] = [];
    if (r.forme_juridique) noteParts.push(`Forme: ${r.forme_juridique}`);
    if (r.tranche_effectif) noteParts.push(`Effectif: ${PAPPERS_EFFECTIF_LABELS[r.tranche_effectif] ?? r.tranche_effectif}`);
    if (typeof r.chiffre_affaires === "number") {
      noteParts.push(`CA: ${(r.chiffre_affaires / 1_000_000).toFixed(1)}M EUR`);
    }
    const existingNotes = (existing.notes as string | null) ?? "";
    if (noteParts.length && !existingNotes.includes("[Pappers]")) {
      const enrichNote = `[Pappers] ${noteParts.join(" | ")}`;
      updates.notes = existingNotes ? `${existingNotes}\n${enrichNote}` : enrichNote;
    }

    if (Object.keys(updates).length > 0) {
      Object.assign(updates, {
        enriched_at: new Date().toISOString(),
        enriched_by_source: "pappers",
      });
      await supabase.from("organizations").update(updates).eq("id", orgId);
    }

    const updatedFields = Object.keys(updates).filter(
      (k) => k !== "enriched_at" && k !== "enriched_by_source",
    );
    return { source: "pappers", ok: true, found: true, updated_fields: updatedFields };
  } catch (err) {
    return {
      source: "pappers",
      ok: false,
      found: false,
      updated_fields: [],
      message: err instanceof Error ? err.message : "Erreur Pappers",
    };
  }
}
