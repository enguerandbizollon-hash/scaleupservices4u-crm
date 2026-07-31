/**
 * lib/connectors/pappers.ts â€” Connecteur Pappers (donnÃ©es lÃ©gales FR, payant).
 *
 * Pattern base.ts (phase 2, temps 3). Factorise les 3 implÃ©mentations qui
 * vivaient inline dans app/api/pappers/* et app/api/enrich/organisation.
 *
 * DÃ©cision carte phase 2 : Pappers reste OFF par dÃ©faut (API payante).
 * Sans PAPPERS_API_KEY, chaque fonction rÃ©pond proprement Â« non configurÃ© Â»
 * et la chaÃ®ne d'enrichissement continue avec les sources gratuites.
 *
 * AmÃ©lioration v64 : l'enrichissement persiste dÃ©sormais siren/naf dans les
 * colonnes STRUCTURÃ‰ES (et le secteur dÃ©rivÃ© via sectorFromNaf), plus
 * seulement en texte dans les notes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sectorFromNaf } from "@/lib/crm/matching-maps";

const API_BASE = "https://api.pappers.fr/v2";

// â”€â”€ Configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function isPappersConfigured(): boolean {
  return !!(process.env.PAPPERS_API_KEY || process.env.PAPPERS_API_TOKEN);
}

// â”€â”€ Formes (subset utilisÃ© de /recherche) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Recherche (endpoint /recherche, fonctionne avec nom ET SIREN/SIRET) â”€â”€â”€â”€â”€â”€

export async function searchPappers(
  query: string,
  nombre: number = 10,
): Promise<{ resultats: PappersSearchResult[]; total: number }> {
  const key = (process.env.PAPPERS_API_KEY || process.env.PAPPERS_API_TOKEN);
  if (!key) throw new Error("PAPPERS_API_KEY manquante");
  const q = query.trim();
  if (!q) return { resultats: [], total: 0 };

  const url = `${API_BASE}/recherche?q=${encodeURIComponent(q)}&api_token=${key}&nombre=${Math.min(20, nombre)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 401) throw new Error("ClÃ© API Pappers invalide ou expirÃ©e");
  if (!res.ok) throw new Error(`Pappers ${res.status}`);
  const data = await res.json() as { resultats?: PappersSearchResult[]; entreprises?: PappersSearchResult[]; total?: number };
  const resultats = data.resultats ?? data.entreprises ?? [];
  return { resultats, total: data.total ?? resultats.length };
}

// â”€â”€ Fiche entreprise complÃ¨te (endpoint /entreprise, payant) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Deal OS chantier B : actionnariat (bÃ©nÃ©ficiaires effectifs) + finances
// profondes (EBE/EBITDA, dettes, trÃ©sorerie). Noms de champs vÃ©rifiÃ©s sur
// le client OpenAPI officiel (qdequippe-tech/pappers-php-api, 2026-07-30).

/** BÃ©nÃ©ficiaire effectif brut (sous-ensemble utilisÃ© du JSON Pappers). */
export interface RawPappersBeneficiaire {
  type?: string | null;                              // physique | morale
  nom?: string | null;
  prenom?: string | null;
  prenom_usuel?: string | null;
  date_de_naissance_formatee?: string | null;        // "MM/AAAA"
  nationalite?: string | null;
  pourcentage_parts?: number | null;                 // total direct + indirect
  pourcentage_parts_directes?: number | null;
  pourcentage_parts_indirectes?: number | null;
  pourcentage_votes?: number | null;
  beneficiaire_representant_legal?: boolean | null;
  [key: string]: unknown;
}

/** Exercice financier brut (sous-ensemble du JSON Pappers finances[]). */
export interface RawPappersFinance {
  annee?: number | null;
  chiffre_affaires?: number | null;
  resultat?: number | null;
  excedent_brut_exploitation?: number | null;        // EBE â‰ˆ EBITDA
  resultat_exploitation?: number | null;             // EBIT
  marge_nette?: number | null;
  taux_croissance_chiffre_affaires?: number | null;
  dettes_financieres?: number | null;
  tresorerie?: number | null;
  capacite_autofinancement?: number | null;
  effectif?: number | null;
  [key: string]: unknown;
}

export interface PappersEntrepriseFiche {
  siren?: string;
  nom_entreprise?: string;
  beneficiaires_effectifs?: RawPappersBeneficiaire[];
  finances?: RawPappersFinance[];
  [key: string]: unknown;
}

export type PappersFetchResult =
  | { ok: true; fiche: PappersEntrepriseFiche }
  | { ok: false; error: string };

/**
 * Fiche complÃ¨te par SIREN. Les erreurs Pappers (crÃ©dits Ã©puisÃ©s, accÃ¨s
 * bÃ©nÃ©ficiaires non accordÃ©) remontent avec leur message d'origine :
 * l'utilisateur doit savoir QUOI rÃ©gler dans son espace Pappers.
 */
export async function fetchEntreprisePappers(siren: string): Promise<PappersFetchResult> {
  const key = (process.env.PAPPERS_API_KEY || process.env.PAPPERS_API_TOKEN);
  if (!key) return { ok: false, error: "PAPPERS_API_KEY manquante dans .env.local" };
  const clean = siren.replace(/\D/g, "");
  if (!/^\d{9}$/.test(clean)) return { ok: false, error: "SIREN invalide" };

  try {
    const res = await fetch(`${API_BASE}/entreprise?api_token=${key}&siren=${clean}`, { cache: "no-store" });
    const data = await res.json().catch(() => null) as (PappersEntrepriseFiche & { error?: string; message?: string }) | null;
    if (!res.ok || !data || data.error) {
      const msg = [data?.error, data?.message].filter(Boolean).join(" Â· ") || `Pappers ${res.status}`;
      return { ok: false, error: msg };
    }
    return { ok: true, fiche: data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur rÃ©seau Pappers" };
  }
}

// â”€â”€ Normalisations pures (testÃ©es) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Actionnaire normalisÃ©, forme stockÃ©e en JSONB (univers + organizations). */
export interface ActionnaireNormalise {
  type: "physique" | "morale";
  nom: string;
  prenom: string | null;
  date_de_naissance: string | null;   // "MM/AAAA" telle que fournie
  age: number | null;
  nationalite: string | null;
  pourcentage_parts: number | null;
  pourcentage_parts_directes: number | null;
  pourcentage_parts_indirectes: number | null;
  pourcentage_votes: number | null;
  representant_legal: boolean;
}

/** "MM/AAAA" (format Pappers) â†’ Ã¢ge rÃ©volu, prÃ©cision mois. */
export function ageFromMmYyyy(value: string | null | undefined, now: Date = new Date()): number | null {
  if (!value) return null;
  const m = value.match(/^(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const year = parseInt(m[2], 10);
  if (!Number.isFinite(year) || year < 1900 || month < 1 || month > 12) return null;
  let age = now.getUTCFullYear() - year;
  if (now.getUTCMonth() + 1 < month) age -= 1;
  return age;
}

/** BÃ©nÃ©ficiaires bruts â†’ actionnariat normalisÃ©, triÃ© par parts dÃ©croissantes. */
export function normalizeBeneficiaires(
  raw: RawPappersBeneficiaire[] | null | undefined,
  now: Date = new Date(),
): ActionnaireNormalise[] {
  return (raw ?? [])
    .filter((b) => b.nom)
    .map((b) => ({
      type: (b.type === "morale" ? "morale" : "physique") as "physique" | "morale",
      nom: (b.nom as string).trim(),
      prenom: b.prenom_usuel ?? b.prenom ?? null,
      date_de_naissance: b.date_de_naissance_formatee ?? null,
      age: ageFromMmYyyy(b.date_de_naissance_formatee, now),
      nationalite: b.nationalite ?? null,
      pourcentage_parts: b.pourcentage_parts ?? null,
      pourcentage_parts_directes: b.pourcentage_parts_directes ?? null,
      pourcentage_parts_indirectes: b.pourcentage_parts_indirectes ?? null,
      pourcentage_votes: b.pourcentage_votes ?? null,
      representant_legal: b.beneficiaire_representant_legal === true,
    }))
    .sort((a, b) => (b.pourcentage_parts ?? -1) - (a.pourcentage_parts ?? -1));
}

/** AnnÃ©e de finances univers, forme Ã©tendue rÃ©trocompatible ({ca, resultat_net} + profondeur Pappers). */
export interface FinanceYearEnrichie {
  ca?: number | null;
  resultat_net?: number | null;
  ebitda?: number | null;
  ebit?: number | null;
  marge_nette?: number | null;
  dettes_financieres?: number | null;
  tresorerie?: number | null;
  caf?: number | null;
  effectif?: number | null;
  croissance_ca?: number | null;
}

/**
 * Fusionne les finances Pappers dans le JSONB finances existant d'une fiche
 * univers. Les clÃ©s existantes (ca, resultat_net venues de l'API gratuite)
 * ne sont Ã©crasÃ©es que si Pappers apporte une valeur non nulle.
 */
export function mergeFinancesPappers(
  existing: Record<string, FinanceYearEnrichie> | null | undefined,
  pappers: RawPappersFinance[] | null | undefined,
): Record<string, FinanceYearEnrichie> {
  const out: Record<string, FinanceYearEnrichie> = { ...(existing ?? {}) };
  for (const f of pappers ?? []) {
    if (!f.annee) continue;
    const year = String(f.annee);
    const base = out[year] ?? {};
    out[year] = {
      ...base,
      ca: f.chiffre_affaires ?? base.ca ?? null,
      resultat_net: f.resultat ?? base.resultat_net ?? null,
      ebitda: f.excedent_brut_exploitation ?? base.ebitda ?? null,
      ebit: f.resultat_exploitation ?? base.ebit ?? null,
      marge_nette: f.marge_nette ?? base.marge_nette ?? null,
      dettes_financieres: f.dettes_financieres ?? base.dettes_financieres ?? null,
      tresorerie: f.tresorerie ?? base.tresorerie ?? null,
      caf: f.capacite_autofinancement ?? base.caf ?? null,
      effectif: f.effectif ?? base.effectif ?? null,
      croissance_ca: f.taux_croissance_chiffre_affaires ?? base.croissance_ca ?? null,
    };
  }
  return out;
}

// â”€â”€ Enrichissement d'une organisation existante â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface PappersEnrichmentReport {
  source: "pappers";
  ok: boolean;
  found: boolean;
  updated_fields: string[];
  message?: string;
}

/**
 * Enrichit une organisation existante depuis Pappers. Les champs dÃ©jÃ 
 * remplis ne sont JAMAIS Ã©crasÃ©s (rÃ¨gle Â« organisme vivant Â», CLAUDE.md).
 * Persiste siren/naf structurÃ©s + secteur dÃ©rivÃ© (v64).
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

    // IdentitÃ© lÃ©gale structurÃ©e (v64)
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
      // Pappers retourne une tranche. On extrait la borne basse comme proxy numÃ©rique.
      const lower = (PAPPERS_EFFECTIF_LABELS[r.tranche_effectif] ?? "").split(/[-+]/)[0];
      const n = parseInt(lower ?? "", 10);
      if (Number.isFinite(n) && n > 0) updates.employee_count = n;
    }

    // Notes : complÃ©ments non structurÃ©s (forme juridique, CA), une seule fois.
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
